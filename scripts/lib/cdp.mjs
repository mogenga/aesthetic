// cdp.mjs — 浏览器连接适配层。零第三方依赖。
//
// 两种上游，按顺序尝试：
//   1) CDP Proxy（web-access skill）  http://localhost:3456
//      /targets /new /eval /screenshot /navigate /close /info
//   2) 直连 DevTools 协议             http://127.0.0.1:9222/json/version → webSocketDebuggerUrl
//
// 依赖：Node 内置 fetch + Node 22+ 的全局 WebSocket。不安装、不下载、不启动浏览器。
//
// 失败时抛出的 Error 带 code：
//   ENOENT     所有上游都没有响应（找不到浏览器）
//   ETIMEDOUT  探测 / 命令 / 导航超时
//   EPROTO     上游存在但协议层失败：HTTP 非 2xx、CDP error、页面表达式抛错、能力缺失
// 页面表达式抛错时，错误的 detail.exceptionDetails 里带 CDP 原始的 exceptionDetails。
//
// 能力矩阵（capabilities）：
//                    evaluate  screenshot  fullPageScreenshot  setViewport  navigate  close
//   proxy               ✓         ✓               ✗               ✗           ✓        ✓
//   direct cdp          ✓         ✓               ✓               ✓           ✓        ✓
// Proxy 没有 Emulation 端点，也没有全页截图参数，所以 shoot.mjs / audit.mjs 用
// need: ['setViewport', 'fullPageScreenshot'] 跳过它，落到直连 CDP；两者都没有时
// 抛 code=EPROTO（带 missing 详情），脚本据此输出 manual-required（退出码 2），
// 不伪造结果。
//
// 生命周期：connect() 惰性创建 tab（proxy 走 /new，直连走 Target.createTarget），
// close() 关掉自己创建的 tab 后断开。进程退出前务必调用 close()，否则会留下标签页。
//
// 注意：CDP 事件（Page.loadEventFired 等）不做分发。导航就绪靠轮询
// document.readyState，避免"监听器挂上之前加载已经完成"的竞态。

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 导航到不可达地址时 Chromium 会停在内建错误页，URL 协议是 chrome-error:。
// 这不是"页面已加载"，任何后续采集都没有意义。
//
// 这类失败带 detail.navigationFailure = true：浏览器本身是好的，是页面没加载成。
// 调用方据此区分"环境不可用（manual-required）"与"页面加载失败（普通失败）"。
function assertNotErrorPage(url, tag) {
  const href = String(url || '');
  if (/^(chrome|edge|brave)-error:/i.test(href)) {
    throw new CdpError('EPROTO', `导航失败，浏览器停在错误页：${href}`, {
      url: href, upstream: tag, navigationFailure: true,
    });
  }
}

export class CdpError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'CdpError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const PROXY_PORT = 3456;
const DEFAULT_PORT = 9222;
const HOST = '127.0.0.1';

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function httpRequest(url, { method = 'GET', body, timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: ctrl.signal,
      headers: body != null ? { 'content-type': 'text/plain;charset=utf-8' } : undefined,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, ok: res.ok, contentType: res.headers.get('content-type') || '', buf };
  } finally {
    clearTimeout(timer);
  }
}

function isAbort(e) {
  return e && (e.name === 'AbortError' || e.name === 'TimeoutError');
}

function parseJson(buf, what) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new CdpError('EPROTO', `${what} 返回的不是合法 JSON`);
  }
}

// fetch 失败的原因在 cause 里（ECONNREFUSED / ENOTFOUND / ...）
function causeCode(e) {
  return e?.cause?.code || e?.code || '';
}

// ---------------------------------------------------------------------------
// 上游探测
// ---------------------------------------------------------------------------

/** 探测 CDP Proxy。返回描述对象或 null（代理没在跑）。 */
async function probeProxy(port, timeoutMs) {
  // 真实 Proxy 绑在 127.0.0.1，而文档里写的是 localhost。Windows 上 localhost
  // 可能先解析到 ::1，单试一个会误判"代理不存在"，所以两个都试。
  const hosts = ['localhost', HOST];
  let base = null;
  let health = null;
  let timedOut = null;
  for (const h of hosts) {
    try {
      const res = await httpRequest(`http://${h}:${port}/health`, {
        timeoutMs: Math.min(timeoutMs, 2500),
      });
      if (!res.ok) continue; // 端口上跑着别的服务：不是代理
      const parsed = JSON.parse(res.buf.toString('utf8'));
      if (parsed && typeof parsed === 'object') {
        base = `http://${h}:${port}`;
        health = parsed;
        break;
      }
    } catch (e) {
      if (isAbort(e)) timedOut = new CdpError('ETIMEDOUT', `CDP Proxy :${port} 健康检查超时`);
      // 连接被拒绝 / 非法 JSON / 别的服务：换下一个 host
    }
  }
  if (!base) {
    if (timedOut) throw timedOut;
    return null;
  }
  // 代理在线但浏览器没连上：这是"环境不可用"，不是"代理不存在"。
  // connected === false / connectionState 非 connected 都算。两个字段都缺失时
  // 只认 status:'ok' 的 /health，继续往下走。
  const state = health.connectionState;
  const waiting = health.connected === false
    || (typeof state === 'string' && state !== 'connected');
  if (waiting) {
    const err = new CdpError('ENOENT',
      `CDP Proxy 在运行，但浏览器未连接（${state || 'connected=false'}）`);
    err.proxyWaiting = true;
    throw err;
  }
  return { base, health };
}

/** 探测直连 Chrome / Edge 调试端口。返回描述对象或 null。 */
async function probeDirect(host, port, timeoutMs) {
  const base = `http://${host}:${port}`;
  let version;
  try {
    const res = await httpRequest(`${base}/json/version`, { timeoutMs: Math.min(timeoutMs, 2500) });
    if (!res.ok) return null;
    version = parseJson(res.buf, 'DevTools /json/version');
  } catch (e) {
    if (isAbort(e)) throw new CdpError('ETIMEDOUT', `DevTools :${port} 探测超时`);
    return null;
  }
  if (!version || typeof version.webSocketDebuggerUrl !== 'string') {
    throw new CdpError('EPROTO', `DevTools :${port} 的 /json/version 里没有 webSocketDebuggerUrl`,
      { version });
  }
  return { base, wsUrl: version.webSocketDebuggerUrl, version };
}

/**
 * 依次尝试 CDP Proxy :3456、直连 :9222。
 * 返回 { kind: 'proxy'|'direct', endpoint, info }，找不到时返回 null。
 * need 里的能力项会在探测阶段过滤掉不具备它的上游。
 */
export async function findBrowser({
  port = DEFAULT_PORT, host = HOST, proxyPort = PROXY_PORT, timeoutMs = 10000, need = [],
} = {}) {
  const found = [];
  let timedOut = null;
  let waiting = null;
  let hardError = null;

  const tryUpstream = async (fn, args) => {
    try {
      const r = await fn(...args);
      if (r) found.push(r);
    } catch (e) {
      // 单个上游失败不代表整体失败：另一个上游可能是好的
      if (e instanceof CdpError && e.code === 'ETIMEDOUT') timedOut = e;
      else if (e instanceof CdpError && e.proxyWaiting) waiting = e;
      else if (e instanceof CdpError) hardError = e;
    }
  };

  await tryUpstream(async (p) => {
    const r = await probeProxy(p, timeoutMs);
    if (!r) return null;
    return { kind: 'proxy', endpoint: r.base, info: r.health, capabilities: PROXY_CAPS };
  }, [proxyPort]);

  await tryUpstream(async (h, p) => {
    const r = await probeDirect(h, p, timeoutMs);
    if (!r) return null;
    return {
      kind: 'direct', endpoint: r.base, wsUrl: r.wsUrl,
      info: r.version, capabilities: DIRECT_CAPS,
    };
  }, [host, port]);

  const eligible = found.filter((u) => need.every((c) => u.capabilities[c]));
  if (eligible.length) return eligible[0];

  // 有上游但缺能力 = 环境不可用（EPROTO），不能当成"没有浏览器"
  if (found.length) {
    const missing = need.filter((c) => !found.some((u) => u.capabilities[c]));
    throw new CdpError('EPROTO',
      `找到浏览器上游（${found.map((u) => u.endpoint).join(', ')}），但缺少能力：${missing.join(', ')}`,
      { upstreams: found.map((u) => ({ kind: u.kind, endpoint: u.endpoint })), missing });
  }
  if (waiting) throw waiting;
  if (hardError) throw hardError;
  if (timedOut) throw timedOut;
  return null;
}

const PROXY_CAPS = {
  evaluate: true, screenshot: true, fullPageScreenshot: false,
  setViewport: false, navigate: true, close: true,
};

const DIRECT_CAPS = {
  evaluate: true, screenshot: true, fullPageScreenshot: true,
  setViewport: true, navigate: true, close: true,
};

// ---------------------------------------------------------------------------
// CDP Proxy 上游
// ---------------------------------------------------------------------------

class ProxyConnection {
  constructor(base, health, timeoutMs) {
    this.upstream = 'proxy';
    this.endpoint = base;
    this.capabilities = PROXY_CAPS;
    this.timeoutMs = timeoutMs;
    this.browser = health?.browser || null;
    this.targetId = null;
  }

  async #request(pathAndQuery, { method = 'GET', body, timeoutMs } = {}) {
    const url = `${this.endpoint}${pathAndQuery}`;
    let res;
    try {
      res = await httpRequest(url, { method, body, timeoutMs: timeoutMs ?? this.timeoutMs });
    } catch (e) {
      if (isAbort(e)) throw new CdpError('ETIMEDOUT', `CDP Proxy 请求超时：${pathAndQuery}`);
      throw new CdpError('EPROTO', `CDP Proxy 请求失败：${pathAndQuery}（${causeCode(e) || e.message}）`);
    }
    if (!res.ok) {
      let detail = null;
      try { detail = JSON.parse(res.buf.toString('utf8')); } catch { /* 非 JSON 错误体 */ }
      throw new CdpError('EPROTO',
        `CDP Proxy ${pathAndQuery} 返回 ${res.status}${detail?.error ? `：${detail.error}` : ''}`,
        detail);
    }
    return res;
  }

  async ensureTarget() {
    if (this.targetId) return this.targetId;
    const res = await this.#request('/new', { method: 'POST', body: 'about:blank' });
    const data = parseJson(res.buf, 'CDP Proxy /new');
    if (!data?.targetId) {
      throw new CdpError('EPROTO', 'CDP Proxy /new 没有返回 targetId', data);
    }
    this.targetId = data.targetId;
    return this.targetId;
  }

  async evaluate(expr) {
    const target = await this.ensureTarget();
    let res;
    try {
      res = await this.#request(`/eval?target=${encodeURIComponent(target)}`, {
        method: 'POST', body: String(expr),
      });
    } catch (e) {
      // /eval 用 400 + {error} 表示页面表达式抛错。这不是代理故障，但对调用方是同一类"表达式失败"。
      if (e instanceof CdpError && e.detail && typeof e.detail.error === 'string') {
        throw new CdpError('EPROTO', `页面表达式抛错：${e.detail.error}`, {
          exceptionDetails: null, error: e.detail.error, upstream: 'proxy',
        });
      }
      throw e;
    }
    const data = parseJson(res.buf, 'CDP Proxy /eval');
    if (data && typeof data === 'object' && 'error' in data && data.value === undefined) {
      throw new CdpError('EPROTO', `页面表达式抛错：${data.error}`, {
        exceptionDetails: null, error: data.error, upstream: 'proxy',
      });
    }
    return data?.value;
  }

  async screenshot({ fullPage = false } = {}) {
    if (fullPage) {
      throw new CdpError('EPROTO', 'CDP Proxy 没有全页截图能力（Page.captureScreenshot 无 captureBeyondViewport）');
    }
    const target = await this.ensureTarget();
    const res = await this.#request(`/screenshot?target=${encodeURIComponent(target)}`);
    if (!/^image\//.test(res.contentType) && res.buf.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') {
      throw new CdpError('EPROTO', `CDP Proxy /screenshot 返回的不是图片（${res.contentType || 'no content-type'}）`);
    }
    return res.buf;
  }

  setViewport() {
    throw new CdpError('EPROTO', 'CDP Proxy 不暴露 Emulation 端点，无法设置视口');
  }

  async navigate(url) {
    const target = await this.ensureTarget();
    await this.#request(`/navigate?target=${encodeURIComponent(target)}`, {
      method: 'POST', body: String(url),
    });
    return this.#waitReady();
  }

  async #waitReady() {
    const deadline = Date.now() + this.timeoutMs;
    let last = 'loading';
    while (Date.now() < deadline) {
      try {
        last = await this.evaluate('document.readyState');
      } catch { /* 导航期间上下文可能被销毁，重试 */ }
      if (last === 'complete') break;
      await sleep(120);
    }
    await this.settle();
    const href = await this.evaluate('location.href').catch(() => null);
    assertNotErrorPage(href, 'proxy');
    return { url: href, readyState: last };
  }

  async settle(ms = 120) {
    await sleep(ms);
  }

  async info() {
    const out = {
      upstream: 'proxy', endpoint: this.endpoint, targetId: this.targetId,
      browser: this.browser, capabilities: this.capabilities,
    };
    if (!this.targetId) return out;
    try {
      const res = await this.#request(`/info?target=${encodeURIComponent(this.targetId)}`, {
        timeoutMs: Math.min(this.timeoutMs, 3000),
      });
      const page = parseJson(res.buf, 'CDP Proxy /info');
      return { ...out, title: page?.title, url: page?.url, readyState: page?.ready };
    } catch {
      return out;
    }
  }

  async close() {
    const target = this.targetId;
    this.targetId = null;
    if (!target) return;
    try {
      await this.#request(`/close?target=${encodeURIComponent(target)}`, {
        timeoutMs: Math.min(this.timeoutMs, 5000),
      });
    } catch { /* 关闭是尽力而为 */ }
  }
}

// ---------------------------------------------------------------------------
// 直连 DevTools 协议上游
// ---------------------------------------------------------------------------

class DirectConnection {
  constructor(base, wsUrl, version, timeoutMs) {
    this.upstream = 'direct';
    this.endpoint = base;
    this.wsUrl = wsUrl;
    this.version = version || {};
    this.capabilities = DIRECT_CAPS;
    this.timeoutMs = timeoutMs;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
    this.targetId = null;
    this.sessionId = null;
    this.opened = null;
  }

  async #open() {
    if (this.opened) return this.opened;
    this.opened = (async () => {
      if (typeof WebSocket === 'undefined') {
        throw new CdpError('EPROTO', '当前 Node 没有全局 WebSocket（需要 Node 22+），无法直连 DevTools');
      }
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          try { ws.close(); } catch { /* noop */ }
          reject(new CdpError('ETIMEDOUT', `连接 DevTools WebSocket 超时：${this.wsUrl}`));
        }, this.timeoutMs);
        ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new CdpError('EPROTO', `DevTools WebSocket 连接失败：${this.wsUrl}`));
        }, { once: true });
      });
      ws.addEventListener('message', (ev) => this.#onMessage(ev));
      ws.addEventListener('close', () => this.#rejectAll('DevTools WebSocket 已关闭'));
      ws.addEventListener('error', () => this.#rejectAll('DevTools WebSocket 出错'));
    })();
    try {
      await this.opened;
    } catch (e) {
      this.opened = null;
      throw e;
    }
    return this.opened;
  }

  #onMessage(ev) {
    let msg;
    try {
      const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
      msg = JSON.parse(raw);
    } catch { return; }
    if (msg.id == null) return; // 事件；本适配层不用事件，导航靠轮询
    const waiter = this.pending.get(msg.id);
    if (!waiter) return;
    this.pending.delete(msg.id);
    clearTimeout(waiter.timer);
    if (msg.error) {
      waiter.reject(new CdpError('EPROTO',
        `CDP ${waiter.method} 失败：${msg.error.message}`, msg.error));
    } else {
      waiter.resolve(msg.result);
    }
  }

  #rejectAll(message) {
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timer);
      waiter.reject(new CdpError('EPROTO', `${message}（${waiter.method}）`));
    }
    this.pending.clear();
  }

  send(method, params = {}, sessionId = null, timeoutMs = null) {
    if (!this.ws || this.ws.readyState !== 1) {
      return Promise.reject(new CdpError('EPROTO', `DevTools 连接未就绪，无法发送 ${method}`));
    }
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const wait = timeoutMs ?? this.timeoutMs;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CdpError('ETIMEDOUT', `CDP ${method} 超时 ${wait}ms`));
      }, wait);
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new CdpError('EPROTO', `CDP ${method} 发送失败：${e.message}`));
      }
    });
  }

  /** 拿到（必要时创建）一个页面 session。 */
  async ensureTarget() {
    await this.#open();
    if (this.sessionId) return this.sessionId;
    const created = await this.send('Target.createTarget', { url: 'about:blank' });
    if (!created?.targetId) {
      throw new CdpError('EPROTO', 'Target.createTarget 没有返回 targetId', created);
    }
    this.targetId = created.targetId;
    const attached = await this.send('Target.attachToTarget', {
      targetId: this.targetId, flatten: true,
    });
    if (!attached?.sessionId) {
      throw new CdpError('EPROTO', 'Target.attachToTarget 没有返回 sessionId', attached);
    }
    this.sessionId = attached.sessionId;
    await this.send('Page.enable', {}, this.sessionId);
    await this.send('Runtime.enable', {}, this.sessionId);
    return this.sessionId;
  }

  async evaluate(expr) {
    const sid = await this.ensureTarget();
    const res = await this.send('Runtime.evaluate', {
      expression: String(expr),
      returnByValue: true,
      awaitPromise: true,
      userGesture: false,
    }, sid);

    if (res?.exceptionDetails) {
      const ex = res.exceptionDetails;
      const text = ex.exception?.description || ex.text || '表达式抛错';
      throw new CdpError('EPROTO', `页面表达式抛错：${text}`,
        { exceptionDetails: ex, upstream: 'direct' });
    }
    const r = res?.result;
    if (!r) return undefined;
    if (r.subtype === 'error' && r.description) {
      throw new CdpError('EPROTO', `页面表达式抛错：${r.description}`,
        { exceptionDetails: null, description: r.description, upstream: 'direct' });
    }
    if ('value' in r) return r.value;
    if (r.type === 'undefined') return undefined;
    // 不可序列化（DOM 节点、函数等）：不当成功
    throw new CdpError('EPROTO',
      `表达式返回值不可序列化（type=${r.type}${r.subtype ? `/${r.subtype}` : ''}）`,
      { result: r, upstream: 'direct' });
  }

  async setViewport(width, height, dpr = 1) {
    const sid = await this.ensureTarget();
    const w = Math.round(Number(width));
    const h = Math.round(Number(height));
    const d = Number(dpr) || 1;
    if (!(w > 0) || !(h > 0)) {
      throw new CdpError('EPROTO', `非法视口尺寸：${width}×${height}`);
    }
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: d, mobile: false,
      screenWidth: w, screenHeight: h,
    }, sid);
    return { width: w, height: h, dpr: d };
  }

  async navigate(url) {
    const sid = await this.ensureTarget();
    const nav = await this.send('Page.navigate', { url: String(url) }, sid);

    // 网络层失败（DNS、拒绝连接、端口被禁）不会抛错，只在结果里给 errorText。
    // 不检查就会拍到 chrome-error:// 页面并当成成功。
    if (nav?.errorText) {
      throw new CdpError('EPROTO', `导航失败（${nav.errorText}）：${url}`,
        { errorText: nav.errorText, url, upstream: 'direct', navigationFailure: true });
    }

    // 不用 Page.loadEventFired：加载可能在我们挂上监听之前就完成。
    // 轮询 readyState 没有竞态，超时后如实标记。
    const deadline = Date.now() + this.timeoutMs;
    let readyState = 'loading';
    while (Date.now() < deadline) {
      try {
        readyState = await this.send('Runtime.evaluate', {
          expression: 'document.readyState', returnByValue: true,
        }, sid, 5000).then((r) => r?.result?.value || 'loading');
      } catch {
        readyState = 'loading';
      }
      if (readyState === 'complete') break;
      await sleep(120);
    }

    // 字体就绪后再截图，避免回退字体被拍进全页图。
    try {
      await this.send('Runtime.evaluate', {
        expression: 'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
        returnByValue: true, awaitPromise: true,
      }, sid, Math.min(this.timeoutMs, 5000));
    } catch { /* 字体 API 不可用时忽略 */ }
    await sleep(120);

    const href = await this.evaluate('location.href').catch(() => null);
    assertNotErrorPage(href, 'direct');
    return { url: href, readyState };
  }

  async screenshot({ fullPage = false } = {}) {
    const sid = await this.ensureTarget();
    let params = { format: 'png' };

    if (fullPage) {
      const metrics = await this.send('Page.getLayoutMetrics', {}, sid);
      const content = metrics?.cssContentSize || metrics?.contentSize;
      if (!content?.width || !content?.height) {
        throw new CdpError('EPROTO', 'Page.getLayoutMetrics 没有返回内容尺寸',
          { metrics });
      }
      const width = Math.max(1, Math.ceil(content.width));
      const height = Math.max(1, Math.ceil(content.height));
      params = {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 },
      };
    }

    const res = await this.send('Page.captureScreenshot', params, sid, this.timeoutMs * 2);
    if (!res?.data) {
      throw new CdpError('EPROTO', 'Page.captureScreenshot 没有返回图片数据', res);
    }
    return Buffer.from(res.data, 'base64');
  }

  async info() {
    const out = {
      upstream: 'direct',
      endpoint: this.endpoint,
      wsUrl: this.wsUrl,
      targetId: this.targetId,
      browser: this.version?.Browser || null,
      protocolVersion: this.version?.['Protocol-Version'] || null,
      capabilities: this.capabilities,
    };
    if (!this.sessionId) return out;
    try {
      const page = await this.evaluate(
        'JSON.stringify({ title: document.title, url: location.href, readyState: document.readyState })'
      );
      return { ...out, ...JSON.parse(page || '{}') };
    } catch {
      return out;
    }
  }

  async close() {
    const target = this.targetId;
    this.targetId = null;
    this.sessionId = null;
    if (target && this.ws && this.ws.readyState === 1) {
      try {
        await this.send('Target.closeTarget', { targetId: target }, null, 5000);
      } catch { /* 尽力而为 */ }
    }
    try { this.ws?.close(); } catch { /* noop */ }
    this.#rejectAll('DevTools 连接已关闭');
    this.ws = null;
    this.opened = null;
  }
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

/**
 * 连接浏览器。依次尝试 CDP Proxy、直连 DevTools。
 *
 * @param {object}  opts
 * @param {number}  opts.port       直连调试端口，默认 9222
 * @param {string}  opts.host       直连主机，默认 127.0.0.1
 * @param {number}  opts.timeoutMs  探测与单条命令超时，默认 10000
 * @param {number}  opts.proxyPort  CDP Proxy 端口，默认 3456
 * @param {string[]} opts.need      必须具备的能力，如 ['setViewport', 'fullPageScreenshot']
 * @returns {Promise<object>} { evaluate, screenshot, setViewport, navigate, close, info,
 *                             upstream, endpoint, capabilities }
 * @throws {CdpError} code: ENOENT | ETIMEDOUT | EPROTO
 */
export async function connect({
  port = DEFAULT_PORT, host = HOST, timeoutMs = 10000, proxyPort = PROXY_PORT, need = [],
} = {}) {
  const found = await findBrowser({ port, host, timeoutMs, proxyPort, need });
  if (!found) {
    throw new CdpError('ENOENT',
      `找不到可用的浏览器：CDP Proxy :${proxyPort} 与 DevTools :${host}:${port} 都没有响应`,
      { proxyPort, port, host });
  }
  if (found.kind === 'proxy') return new ProxyConnection(found.endpoint, found.info, timeoutMs);
  return new DirectConnection(found.endpoint, found.wsUrl, found.info, timeoutMs);
}
