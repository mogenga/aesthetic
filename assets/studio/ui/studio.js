// studio.js — 原生 ESM，无框架，无构建。
// 一次性 token 由 studio.mjs 在返回 index.html 时内联到 window.__STUDIO_TOKEN__；
// <meta name="studio-token"> 只作兜底（服务端不注入时为空）。

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** el('span', { class, text, html, style, dataset, ...attrs }, ...children) */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  node.append(...children.filter(Boolean));
  return node;
}

const TOKEN = (typeof window.__STUDIO_TOKEN__ === 'string' && window.__STUDIO_TOKEN__)
  || document.querySelector('meta[name="studio-token"]')?.content || '';

/** 所有 POST 都带 X-Studio-Token；缺 token 时给明确提示，不静默失败。 */
async function request(method, path, body) {
  if (method === 'POST' && !TOKEN) {
    throw new Error('页面里没有一次性 token。请用 `node scripts/studio.mjs --project <dir>` 打印的 Studio URL 打开，'
      + '而不是直接访问 /studio/ui/；否则所有写回都会被拒绝（HTTP 403）。');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['X-Studio-Token'] = TOKEN;
  const res = await fetch(path, { method, headers, body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON 错误页 */ }
  if (!res.ok) {
    const detail = Array.isArray(data?.detail) ? `\n· ${data.detail.slice(0, 6).join('\n· ')}` : '';
    throw new Error(`${data?.message || `请求失败（HTTP ${res.status}）`}${detail}`);
  }
  return data;
}

const post = (path, body) => request('POST', path, body);
const get = (path) => request('GET', path);

// === 颜色 ===
// oklch() → hex 交给浏览器自己做：canvas fillStyle 往返拿到的就是平台真实渲染值
// （含 CSS Color 4 gamut mapping），不用手写转换公式。
const swatchCtx = document.createElement('canvas').getContext('2d');
function toHex(oklch) {
  swatchCtx.fillStyle = '#000000';
  swatchCtx.fillStyle = oklch;
  return swatchCtx.fillStyle.toUpperCase();
}

const fmtOklch = ({ L, C, H }) => `oklch(${Number(L.toFixed(3))} ${Number(C.toFixed(3))} ${Number(H.toFixed(1))})`;
const toColor = (L, C, H) => {
  const oklch = fmtOklch({ L, C, H });
  return { oklch, hex: toHex(oklch), l: Number(L.toFixed(4)) };
};

const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

function contrastOf(hexA, hexB) {
  const [a, b] = [luminance(hexToRgb(hexA)), luminance(hexToRgb(hexB))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const fmtRatio = (v) => `${v.toFixed(2)}:1`;

// === state ===
// 七维转写表：key / 中文名 / 默认取值 / 默认依据（null = 无方向依据，按规则取默认）
const DIM_KEYS = [
  ['neutralTemp', '中性色温度', 'H 250, C 0.002', '像瑞士铁路时刻表'],
  ['chromaCap', '彩度上限', 0.12, '不要糖水感'],
  ['radius', '圆角', [0, 2, 4, 999], '工业感'],
  ['border', '边框', '1px / fg 8%', '像图纸'],
  ['shadow', '阴影', '仅浮层一层', null],
  ['weight', '字重', [400, 500, 600], '不要大字报'],
  ['motion', '动效', '120-180ms ease-out', null],
];

const state = {
  mode: 'palette', view: 'desktop', theme: 'light', content: 'home',
  accentHue: 250, accentChroma: 0.12, neutral: 0,
  translation: Object.fromEntries(DIM_KEYS.map(([k, , value, from]) => [k, { value, from }])),
  weights: { light: { body: 400, strong: 600, display: 700 }, dark: { body: 350, strong: 500, display: 600 } },
  direction: { director: 'self', mode: 'Operate', keywords: ['克制', '工业', '清晰'],
    references: ['瑞士铁路时刻表', '像 Braun 但更轻'], anti: ['糖水渐变'] },
  weightLadder: { family: 'system-ui', available: [300, 400, 500, 600, 700] },
  overrides: [], artifacts: { committed: false, tokens: false, injected: false }, fixture: 'unknown',
};

const STEP = [0.010, 0.015, 0.017];
const VIEWS = { desktop: [1440, 900], tablet: [834, 1000], mobile: [390, 844] };
const FIXTURE_ROUTE = { home: 'dashboard', settings: 'settings', form: 'form', ai: 'ai' };
const neutralHue = () => ((250 + (85 - 250) * (state.neutral / 100)) + 360) % 360;
const tempLabel = () => (state.neutral < 33 ? '冷' : state.neutral > 66 ? '暖' : '近中性');

/** 表面阶梯只动 L；色相与彩度锁死在基色上（R2）。暗色往更亮的方向走。 */
function colorSet(theme) {
  const H = neutralHue();
  const dark = theme === 'dark';
  const base = dark ? 0.180 : 0.985;
  const steps = dark ? [0.022, 0.046, 0.072] : [0.010, 0.025, 0.042];
  const surf = (i) => toColor(base - steps[i], 0.002, H);
  return {
    bg: toColor(base, 0.002, H),
    'surface-1': surf(0), 'surface-2': surf(1), 'surface-3': surf(2),
    'surface-sunken': toColor(base - steps[1], 0.003, H),
    fg: toColor(dark ? 0.940 : 0.2174, dark ? 0.002 : 0.0019, dark ? H : 106.6),
    'fg-muted': toColor(dark ? 0.720 : 0.520, 0.004, H),
    accent: toColor(dark ? 0.720 : 0.520, state.accentChroma, state.accentHue),
    'line-1': toColor(dark ? 0.300 : 0.900, 0.002, H),
    'line-2': toColor(dark ? 0.380 : 0.860, 0.002, H),
    'line-inset': toColor(dark ? 0.268 : 0.918, 0.002, H),
  };
}

/** 从 "0 / 2 / 4 / 999"、"120-180ms ease-out" 里取数值序列。 */
const numbersOf = (value) => (Array.isArray(value)
  ? value.filter((v) => typeof v === 'number')
  : (String(value).match(/\d+(?:\.\d+)?/g) || []).map(Number));

/** 转写表的圆角 / 阴影 / 动效 → CSS 变量。 */
function translationCss() {
  const r = [0, 2, 4, 999];
  numbersOf(state.translation.radius?.value).slice(0, 4).forEach((v, i) => { r[i] = v; });
  const motion = numbersOf(state.translation.motion?.value);
  const fast = motion[0] || 120;
  const base = motion[motion.length - 1] || Math.max(fast, 180);
  const shadowRaw = String(state.translation.shadow?.value ?? '').trim();
  const shadow = !shadowRaw || shadowRaw === 'null' || shadowRaw.includes('无')
    ? 'none' : '0 1px 2px -1px rgb(0 0 0 / .10), 0 2px 6px -2px rgb(0 0 0 / .08)';
  return {
    '--r-sm': `${r[1]}px`, '--r-md': `${r[2]}px`, '--r-lg': `${Math.max(r[2], 8)}px`, '--r-full': `${r[3]}px`,
    '--shadow-1': shadow, '--shadow-2': shadow,
    '--dur-fast': `${fast}ms`, '--dur-base': `${base}ms`, '--dur-slow': `${Math.max(base, 320)}ms`,
    '--ease-out': 'cubic-bezier(.2,.7,.2,1)',
  };
}

/** 夹具 base.css 消费的变量名（见 assets/studio/fixture/tokens.css）。 */
function cssVars(theme) {
  const c = colorSet(theme);
  const w = state.weights[theme] || state.weights.light;
  const onAccent = theme === 'dark' ? '#0D1B26' : '#FFFFFF';
  return {
    '--bg': c.bg.oklch, '--surface-1': c['surface-1'].oklch, '--surface-2': c['surface-2'].oklch,
    '--surface-3': c['surface-3'].oklch, '--surface-sunken': c['surface-sunken'].oklch,
    '--fg': c.fg.oklch, '--fg-muted': c['fg-muted'].oklch,
    '--accent': c.accent.oklch, '--accent-hover': c.accent.oklch,
    '--accent-soft': `color-mix(in oklab, ${c.accent.oklch} 12%, transparent)`,
    '--on-accent': onAccent, '--accent-fg': onAccent,
    '--line-1': c['line-1'].oklch, '--line-2': c['line-2'].oklch, '--line-inset': c['line-inset'].oklch,
    '--line-hair': `1px solid ${c['line-1'].oklch}`,
    ...translationCss(),
    '--fw-body': String(w.body), '--fw-strong': String(w.strong), '--fw-display': String(w.display),
  };
}

// === 状态提示 ===
let statusTimer = null;
/** kind: ok | warn | error；ms<=0 表示常驻（错误提示不自动消失）。 */
function setStatus(kind, message, ms = 7000) {
  const box = $('#status');
  box.hidden = false;
  box.dataset.kind = kind;
  $('#status-text').textContent = message;
  clearTimeout(statusTimer);
  if (ms > 0) statusTimer = setTimeout(() => { box.hidden = true; }, ms);
}

// === 转写表 ===

/** "0 / 2 / 4 / 999" → [0,2,4,999]；纯数字 → number；其余原样保留。 */
function parseValue(text) {
  const raw = text.trim();
  if (!raw) return '';
  if (/^\d+(?:\s*\/\s*\d+)+$/.test(raw)) return raw.split('/').map((s) => Number(s.trim()));
  return /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
}

function renderTranslation() {
  const host = $('#translation-rows');
  const input = (key, field, value, label) => el('input', {
    type: 'text', value: value ?? '', spellcheck: 'false', dataset: { key, field },
    class: `${field === 'from' ? 'from' : ''}${value ? '' : ' is-null'}`.trim(),
    placeholder: field === 'from' ? '无依据 → 取默认' : '',
    'aria-label': `${label} ${field === 'from' ? '依据' : '取值'}`,
  });

  host.textContent = '';
  for (const [key, label] of DIM_KEYS) {
    host.append(el('div', { class: 'trow' },
      el('span', { class: 'dim', text: label }),
      input(key, 'value', Array.isArray(state.translation[key]?.value)
        ? state.translation[key].value.join(' / ') : state.translation[key]?.value ?? '', label),
      input(key, 'from', state.translation[key]?.from ?? '', label)));
  }

  host.addEventListener('input', (event) => {
    const { key, field } = event.target.dataset || {};
    if (!key || !state.translation[key]) return;
    if (field === 'value') {
      state.translation[key].value = parseValue(event.target.value);
      markDirty();
      applyPreview();
    } else {
      const v = event.target.value.trim();
      state.translation[key].from = v || null;
      event.target.classList.toggle('is-null', !v);
    }
  });
}

// === 预览 ===

const fixtureSrc = () => `/studio/fixture/index.html#/${FIXTURE_ROUTE[state.content] || 'dashboard'}`;

function applyVars(root) {
  const vars = cssVars(state.theme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  if (root.dataset) root.dataset.theme = state.theme;
  return vars;
}

function applyPreview() {
  applyVars($('#preview-root'));
  // 夹具存在时把变量写进 iframe 的 :root（内联样式压过夹具 tokens.css）。
  const frame = $('#fixture-frame');
  if (state.fixture === 'ready' && !frame.hidden) {
    try {
      const vars = applyVars(frame.contentDocument.documentElement);
      frame.contentWindow?.postMessage(
        { type: 'aesthetic:state', theme: state.theme, view: state.content, vars },
        window.location.origin,
      );
    } catch { /* iframe 未就绪或跨源 */ }
  }
  renderPanels();
}

function updateFrameSize() {
  const stage = $('.stage');
  const shell = $('#frame-shell');
  if (!stage || !shell) return;
  const [w, h] = VIEWS[state.view];
  const scale = Math.min(1, Math.max(240, stage.clientWidth - 32) / w);
  shell.style.width = `${Math.round(w * scale)}px`;
  Object.assign($('#fixture-frame').style, {
    width: `${w}px`, height: `${h}px`, transform: `scale(${scale})`, transformOrigin: 'top left',
  });
  $('#frame-viewport').style.height = `${Math.round(h * scale)}px`;
  $('#frame-meta').textContent = `${w} × ${h}${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}`;
}

function loadFrame() {
  const frame = $('#fixture-frame');
  if (!frame || state.fixture !== 'ready') return;
  frame.src = fixtureSrc();
  frame.addEventListener('load', () => {
    // 夹具 app.js 的 boot() 会按 prefers-color-scheme 重写 data-theme，所以 load 后再推一次。
    applyPreview();
    try { frame.contentDocument.documentElement.dataset.theme = state.theme; } catch { /* ignore */ }
  }, { once: true });
  $('#frame-url').textContent = fixtureSrc().replace('/studio/fixture ', '');
}

// === 色板 / 层级阶梯 / 校验读数（一次渲染，共用同一份 colorSet）===

function renderPanels() {
  const light = colorSet(state.theme);
  const dark = colorSet('dark');

  const sw = $('#swatches');
  sw.textContent = '';
  for (const [name, e] of Object.entries(light)) {
    sw.append(el('div', { class: 'swatch', dataset: { name }, style: { background: e.oklch },
      title: `${name} · ${e.oklch} · ${e.hex}` }));
  }

  // 层级阶梯：ΔL = |L₁ − L₂|，超出 [0.010, 0.030] 标红。
  const order = ['bg', 'surface-1', 'surface-2', 'surface-3'];
  const ladder = $('#ladder');
  ladder.textContent = '';
  order.forEach((name, i) => {
    const e = light[name];
    const dl = i === 0 ? null : Math.round(Math.abs(e.l - light[order[i - 1]].l) * 1000) / 1000;
    const bad = dl !== null && (dl < 0.010 || dl > 0.030);
    ladder.append(el('li', {},
      el('span', { class: 'chip', style: { background: e.oklch } }),
      el('span', { class: 'name', text: name }),
      el('span', { text: `L ${e.l.toFixed(3)}  ${e.hex}` }),
      el('span', {
        class: dl === null ? 'dl' : `dl ${bad ? 'bad' : 'ok'}`,
        text: dl === null ? 'Δ —' : `Δ ${dl.toFixed(3)}`,
        title: bad ? 'ΔL 超出 [0.010, 0.030]' : dl === null ? '' : 'ΔL 在允许区间内',
      })));
  });

  const rows = [
    ['正文对比度', light.fg.hex, light.bg.hex, 4.5],
    ['次要对比度', light['fg-muted'].hex, light.bg.hex, 4.5],
    ['焦点对比度', light.accent.hex, light.bg.hex, 3],
    ['暗色正文', dark.fg.hex, dark.bg.hex, 4.5],
  ];
  const checks = $('#checks');
  checks.textContent = '';
  for (const [label, fg, bg, min] of rows) {
    const ratio = contrastOf(fg, bg);
    const pass = ratio >= min;
    checks.append(el('li', { class: pass ? 'ok' : 'bad' },
      el('span', { class: 'flag', text: pass ? '✓' : '✗' }),
      el('span', { class: 'k', text: label }),
      el('span', { class: 'v', text: `${fmtRatio(ratio)} / ${min}:1` })));
  }
}

// === 写入链 ===
function setArtifacts(partial) {
  const a = Object.assign(state.artifacts, partial);
  $('#artifact-hint').textContent = `${a.committed ? '' : '未'}写 decisions · `
    + `${a.tokens ? '' : '未'}生成 tokens · ${a.injected ? '' : '未'}注入 DESIGN.md`;
  // 单向生成链：先写 decisions 才能生成 tokens，先生成 tokens 才能注入。
  $('#btn-tokens').disabled = !a.committed;
  $('#btn-inject').disabled = !a.tokens;
}

const markDirty = () => setArtifacts({ committed: false, tokens: false });

/** schema 对 direction 有 minItems / maxItems 约束：补齐再发送，避免 422。 */
function ensureDirection() {
  const d = state.direction || {};
  const pad = (list, min, max, filler) => {
    const clean = (Array.isArray(list) ? list : []).filter((x) => typeof x === 'string' && x.trim());
    return clean.length >= min ? clean.slice(0, max) : clean.concat(filler.slice(clean.length, min));
  };
  const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
  return {
    director: oneOf(d.director, ['impeccable', 'frontend-design', 'self'], 'self'),
    mode: oneOf(d.mode, ['Persuade', 'Operate', 'Read', 'Experience'], 'Operate'),
    keywords: pad(d.keywords, 3, 5, ['克制', '工业', '清晰', '有序']),
    references: pad(d.references, 2, 3, ['瑞士铁路时刻表', '像 Braun 但更轻']),
    anti: pad(d.anti, 1, 2, ['糖水渐变']),
    tone: typeof d.tone === 'string' ? d.tone : '克制、工业、图纸感',
  };
}

function buildDecisions() {
  const clean = (set) => Object.fromEntries(Object.entries(set)
    .map(([k, v]) => [k, { oklch: v.oklch, hex: v.hex, l: v.l }]));
  return {
    meta: {
      schemaVersion: 1, theme: 'light-dark',
      generatedAt: new Date().toISOString(), generatorVersion: 'aesthetic-v2',
    },
    direction: ensureDirection(),
    translation: structuredClone(state.translation),
    color: { light: clean(colorSet('light')), dark: clean(colorSet('dark')) },
    surfaceLadder: { step: STEP },
    weightLadder: state.weightLadder,
    weights: structuredClone(state.weights),
    overrides: Array.isArray(state.overrides) ? state.overrides : [],
  };
}

/** 写回步骤共用：忙碌态 → 请求 → 成功/失败提示。返回响应（失败为 null）。 */
async function runStep({ buttonId, busyLabel, doneLabel, path, body, onOk, describe }) {
  const button = $(buttonId);
  const original = button.textContent;
  const reset = (ok) => {
    button.disabled = false;
    button.dataset.state = ok ? 'done' : 'error';
    button.textContent = ok ? `${doneLabel} ✓` : `${original} · 失败`;
    setTimeout(() => { button.dataset.state = ''; button.textContent = original; }, 2400);
  };
  button.disabled = true;
  button.dataset.state = 'busy';
  button.textContent = busyLabel;
  try {
    const result = await post(path, body ?? {});
    onOk?.(result);
    reset(true);
    setStatus('ok', describe(result));
    return result;
  } catch (e) {
    reset(false);
    setStatus('error', `${doneLabel.replace(/^已/, '')}失败：${e.message}`, 12000);
    return null;
  }
}

async function doCommit() {
  const ok = await runStep({
    buttonId: '#btn-commit', busyLabel: '写入中…', doneLabel: '已写入 decisions',
    path: '/api/commit', body: { decisions: buildDecisions() },
    onOk: () => setArtifacts({ committed: true }),
    describe: (r) => `写入 ${r.file}${r.dryRun ? '（dry-run，未落盘）' : ''}。下一步：生成 tokens。`,
  });
  if (ok) await doTokens(true);
}

const doTokens = (auto) => runStep({
  buttonId: '#btn-tokens', busyLabel: '生成中…', doneLabel: '已生成 tokens', path: '/api/tokens',
  onOk: () => setArtifacts({ tokens: true }),
  describe: () => `${auto ? '已自动' : ''}生成 tokens.css / tokens.json。下一步：注入 DESIGN.md。`,
});
const doInject = () => runStep({
  buttonId: '#btn-inject', busyLabel: '注入中…', doneLabel: '已注入', path: '/api/inject',
  onOk: () => setArtifacts({ injected: true }),
  describe: (r) => `已刷新 ${r.file} 的 marker 块`
    + `${r.designFileOutsideProject ? '（该文件在项目目录外，只改 marker 块）' : ''}。块外内容未改动。`,
});

// === 模式 / 顶栏 ===

function setMode(mode) {
  state.mode = mode;
  for (const tab of $$('.mode-tab')) {
    const on = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', on);
    tab.setAttribute('aria-selected', String(on));
  }
  $('#mode-palette').hidden = mode !== 'palette';
  $('#mode-gallery').hidden = mode !== 'gallery';
  $('#mode-lab').hidden = mode !== 'lab';
  if (mode === 'gallery') renderGallery();
  if (mode === 'lab') renderLab();
  if (mode === 'palette') requestAnimationFrame(updateFrameSize);
}

function setView(view) {
  state.view = view;
  updateFrameSize();
  for (const f of $$('#gallery-grid iframe')) {
    [f.style.width, f.style.height] = VIEWS[view].map((v) => `${v}px`);
  }
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  applyPreview();
}

function setContent(content) {
  state.content = content;
  const route = FIXTURE_ROUTE[content] || 'dashboard';
  // 只改 hash：夹具自己按 hash 路由重渲染，不需要重载 iframe。
  if (state.fixture === 'ready') {
    try { $('#fixture-frame').contentWindow.location.hash = `#/${route}`; applyPreview(); } catch { /* ignore */ }
  }
  $('#frame-url').textContent = fixtureSrc();
}

// === 画廊 ===
//
// 候选来自 assets/studio/styles/style-index.json，按逻辑卡计数
// （玻璃卡的三个变体都列出来，其余卡片一卡一帧）。
// 每帧走 /studio/proxy/<variant>/，由 studio.mjs 把夹具 HTML 改写成
// 引用该变体 CSS 的版本 —— 不用前端自己拼 CSS 覆盖。

let galleryBuilt = false;
let galleryIndex = null;

async function loadStyleIndex() {
  if (galleryIndex) return galleryIndex;
  try {
    const res = await fetch('/studio/styles/style-index.json', { credentials: 'same-origin' });
    const idx = await res.json();
    galleryIndex = { variants: idx.variants || [] };
  } catch {
    galleryIndex = { variants: [] };
  }
  return galleryIndex;
}

/** 按逻辑卡去重：玻璃卡三支全留，其余每卡只出第一帧。 */
function galleryCandidates(variants) {
  const seen = new Set();
  const out = [];
  for (const v of variants) {
    const isGlass = v.card === 'glassmorphism';
    if (!isGlass) {
      if (seen.has(v.card)) continue;
      seen.add(v.card);
    }
    out.push(v);
  }
  return out;
}

async function renderGallery() {
  const grid = $('#gallery-grid');
  const load = $('#gallery-load')?.checked;
  if (galleryBuilt && grid.dataset.load === String(load)) return;

  const { variants } = await loadStyleIndex();
  galleryBuilt = true;
  grid.dataset.load = String(load);
  grid.textContent = '';

  if (!variants.length) {
    grid.dataset.count = '1';
    grid.append(el('div', { class: 'gallery-card' },
      el('header', {}, el('span', { class: 'g-num', text: '—' }), el('span', { text: '读不到风格索引' })),
      el('div', { class: 'g-body', html: '读不到 <code>assets/studio/styles/style-index.json</code>。'
        + '请确认 Studio 是由 <code>scripts/studio.mjs</code> 启动的。' })));
    return;
  }

  let list = galleryCandidates(variants);
  if (!load) list = list.slice(0, 3);
  list = list.slice(0, 6);
  grid.dataset.count = String(list.length);

  const frames = [];
  list.forEach((variant, i) => {
    const frame = el('iframe', {
      title: `${variant.name} 候选 ${i + 1}`,
      src: `/studio/proxy/${variant.id}/index.html#/${FIXTURE_ROUTE[state.content] || 'dashboard'}`,
      style: { width: `${VIEWS[state.view][0]}px`, height: `${VIEWS[state.view][1]}px` },
    });
    const head = el('header', {},
      el('span', { class: 'g-num', text: String(i + 1).padStart(2, '0') }),
      el('span', { class: 'g-name', text: variant.name }));
    if (variant.engine === 'chromium-only') {
      head.append(el('span', { class: 'g-note', text: '仅 Chromium 折射' }));
    }
    head.append(el('button', { type: 'button', class: 'g-pick', dataset: { pick: variant.id }, text: '选择' }));
    grid.append(el('div', { class: 'gallery-card', dataset: { variant: variant.id } }, head, frame));
    frames.push(frame);
  });

  for (const btn of $$('#gallery-grid .g-pick')) {
    btn.addEventListener('click', () => {
      const v = list.find((x) => x.id === btn.dataset.pick);
      if (!v) return;
      state.styleCard = v.card;
      state.styleVariant = v.id;
      for (const card of $$('#gallery-grid .gallery-card')) {
        card.classList.toggle('is-picked', card.dataset.variant === v.id);
      }
      setStatus('ok', `已选 ${v.name}（${v.id}）。点「写入 decisions」保存。`);
    });
  }

  // 同步滚动：滚动一个，其余按比例跟随。
  let syncing = false;
  const scroller = (f) => f.contentDocument?.scrollingElement || f.contentDocument?.documentElement;
  for (const frame of frames) {
    frame.addEventListener('load', () => {
      frame.contentDocument?.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        const own = scroller(frame);
        const ratio = own.scrollTop / Math.max(1, own.scrollHeight - own.clientHeight);
        for (const other of frames) {
          const oe = other === frame ? null : scroller(other);
          if (oe) oe.scrollTop = ratio * (oe.scrollHeight - oe.clientHeight);
        }
        syncing = false;
      }, { passive: true });
    }, { once: true });
  }
}

// === 组件实验室 ===
//
// 预览走 iframe，不用内联 DOM。区别很关键：内联画只能用 Studio 自己的
// --ui-* 变量，预览出来的是 Studio 的皮肤；iframe 加载夹具的 #/lab 路由，
// 那里挂的是当前项目的 tokens.css + 当前 data-style 的变体 CSS，
// 所以实验室里看到的就是组件在真实项目里的样子。

const LAB_COMPONENTS = ['button', 'input', 'switch', 'card', 'badge', 'tag'];
const LAB_VARIANT_COMPS = new Set(['button', 'badge', 'tag']);

/** 当前实验台配置 → 夹具裸渲染 URL */
function labSrc() {
  const comp = $('#lab-component').value;
  const params = new URLSearchParams({
    comp,
    variant: $('#lab-variant').value,
    state: $('#lab-state').value,
    size: $('#lab-size').value,
    bg: $('#lab-bg').value,
  });
  const variant = state.styleVariant || 'minimalism';
  // data-style 由 studio.mjs 的 proxy 路由注入，和画廊用同一条路径
  return `/studio/proxy/${variant}/index.html?${params}#/lab`;
}

let labFrameReady = false;

function renderLab() {
  const comp = $('#lab-component').value;
  const frame = $('#lab-frame');
  if (!frame) return;

  // 变体下拉只对按钮 / 徽章 / 标签有意义
  const variantCtl = $('#lab-variant');
  if (variantCtl) {
    variantCtl.disabled = !LAB_VARIANT_COMPS.has(comp);
    variantCtl.closest('.ctl')?.toggleAttribute('data-dim', !LAB_VARIANT_COMPS.has(comp));
  }

  $('#recipe-name').value = comp;
  $('#recipe-path').textContent = `assets/recipes/${comp}.css`;

  frame.src = labSrc();
  labFrameReady = true;
}

/**
 * 提示栏文案。常驻监听 load，而不是每次 renderLab 挂一次性监听：
 * renderLab 会在模块初始化时就跑一次（iframe 还是 about:blank），
 * 那时挂的 once 监听会随一次空 load 消耗掉，之后的真正加载就没人更新提示了。
 */
function bindLabHint() {
  const frame = $('#lab-frame');
  const hint = $('#lab-hint');
  if (!frame || !hint) return;
  frame.addEventListener('load', () => {
    // 变体名从 iframe 实际的 data-style 读，不从 state 猜：
    // 画廊选了 A 而实验室加载 B 时，state 会撒谎。
    let served = state.styleVariant || 'minimalism';
    try {
      const ds = frame.contentDocument?.documentElement?.dataset?.style;
      if (ds) served = ds;
    } catch { /* 跨域时保留 state 值 */ }
    hint.textContent = `真实渲染：当前 token + 变体 ${served}`;
  });
}

/**
 * 从 iframe 里真实渲染的组件读出计算样式，生成 recipe。
 *
 * 为什么读计算样式而不是拼一份模板：实验室的全部价值在于「看到什么就固化成什么」。
 * 模板拼出来的片段会和当前 token/变体脱节，写进项目就是错的。
 */
function recipeCss() {
  const frame = $('#lab-frame');
  const comp = $('#lab-component').value;
  const labState = $('#lab-state').value;
  const size = $('#lab-size').value;

  let cs = null;
  let el = null;
  try {
    el = frame.contentDocument?.querySelector('.lab-mount > *');
    if (el) cs = frame.contentWindow.getComputedStyle(el);
  } catch { /* 跨域或未加载完 */ }

  if (!cs) {
    // 读不到就明确说明，不编一份看起来对的 CSS
    return [
      `/* recipe: ${comp} —— 未能从预览读取计算样式 */`,
      `/* 请确认 Studio 已启动且预览已加载（${labSrc()}） */`,
      '',
    ].join('\n');
  }

  const pick = (prop, fallback = '') => String(cs.getPropertyValue(prop) || '').trim() || fallback;
  // 只固化「与 token 无关、且是这个状态特有」的部分
  const lines = [
    `/* === recipe: ${comp} · ${labState} · ${size} ===
 * 读自 Studio 实验台的真实渲染（token + 变体 ${state.styleVariant || 'minimalism'}）
 * 依赖：当前项目的 tokens.css；如与变体冲突，以变体为准
 */`,
    `.${el.className.split(' ')[0]}[data-state="${labState}"] {`,
  ];

  // 只固化「有视觉意义」的属性。逐个显式判断，不用一条正则糊过去：
  // 浏览器会把未设置的 outline 算成 `rgb(0, 0, 0) none 3px`，
  // 直接把计算值抄进 CSS 会写出一行无效声明。
  const skip = (prop, v) => {
    if (!v) return true;
    if (v === 'none' || v === 'normal' || v === 'auto') return true;
    if (/^0(px|%)?(\s+0(px|%)?)*$/.test(v)) return true;
    if (v.includes('rgba(0, 0, 0, 0)')) return true;
    // 浏览器把"没有 outline"算成 `rgb(0, 0, 0) none 3px`，抄进 CSS 是无效声明
    if (prop === 'outline' && v.split(/\s+/).includes('none')) return true;
    if (prop === 'transform' && v === 'none') return true;
    return false;
  };

  const props = [
    'background-color', 'color', 'border-radius', 'box-shadow',
    'padding', 'font-size', 'font-weight', 'opacity', 'transform', 'outline',
  ];
  for (const prop of props) {
    const v = pick(prop);
    if (skip(prop, v)) continue;
    lines.push(`  ${prop}: ${v};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

async function writeRecipe() {
  const name = ($('#recipe-name').value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) {
    setStatus('error', 'recipe 名只能含字母、数字、点、下划线、短横，长度 1–64。', 0);
    return;
  }
  await runStep({
    buttonId: '#btn-recipe', busyLabel: '写入中…', doneLabel: '已写入 recipe',
    path: '/api/recipe', body: { name, path: `${name}.css`, css: recipeCss(), overwrite: true },
    describe: (r) => {
      const msg = `recipe 已写入 ${r.file}${r.dryRun ? '（dry-run，未落盘）' : ''}。`;
      $('#recipe-hint').textContent = msg;
      return msg;
    },
  });
}

// === 初始化 ===

function updatePaletteOutputs() {
  $('#accent-hue-out').textContent = `${Math.round(state.accentHue)}°`;
  $('#accent-chroma-out').textContent = `C ${state.accentChroma.toFixed(3)}`;
  $('#neutral-temp-out').textContent = `H ${Math.round(neutralHue())} · ${tempLabel()}`;
  $('#palette-sub').textContent = colorSet(state.theme).bg.hex;
}

function syncControls() {
  $('#view-select').value = state.view;
  $('#theme-select').value = state.theme;
  $('#content-select').value = state.content;
  $('#accent-hue').value = String(state.accentHue);
  $('#accent-chroma').value = String(Math.round((state.accentChroma / 0.20) * 100));
  $('#neutral-temp').value = String(state.neutral);
  updatePaletteOutputs();
}

const OKLCH_RE = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/;

/** 把已有 decisions 读进面板状态（色板控件位置由 OKLCH 反推）。 */
function applyRemoteDecisions(d) {
  for (const [key] of DIM_KEYS) {
    if (d.translation?.[key]) state.translation[key] = structuredClone(d.translation[key]);
  }
  if (d.weights) state.weights = { ...state.weights, ...structuredClone(d.weights) };
  if (d.direction) state.direction = { ...state.direction, ...d.direction };
  if (d.weightLadder) state.weightLadder = d.weightLadder;
  if (Array.isArray(d.overrides)) state.overrides = d.overrides;

  const pick = (oklch, i) => Number(String(oklch || '').match(OKLCH_RE)?.[i] ?? NaN);
  const accent = d.color?.light?.accent?.oklch;
  const [c, h] = [pick(accent, 2), pick(accent, 3)];
  if (Number.isFinite(c)) state.accentChroma = c;
  if (Number.isFinite(h)) state.accentHue = h;
  const bgH = pick(d.color?.light?.bg?.oklch, 3);
  if (Number.isFinite(bgH)) state.neutral = Math.round(Math.min(100, Math.max(0, (250 - bgH) / 165 * 100)));
}

async function loadState() {
  try {
    const s = await get('/api/state');
    state.artifacts = { committed: !!s.artifacts?.decisions, tokens: !!s.artifacts?.tokens,
      injected: !!s.artifacts?.designBlock };
    if (s.decisions) applyRemoteDecisions(s.decisions);
    state.fixture = s.studio?.fixture ? 'ready' : 'missing';
    setArtifacts({});
  } catch (e) {
    setStatus('warn', `无法读取项目状态：${e.message}（仍可调色，但写入前请确认路径）`);
  }
}

function bindEvents() {
  const on = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
  const slider = (sel, apply) => on(sel, 'input', (e) => {
    apply(Number(e.target.value));
    updatePaletteOutputs();
    markDirty();
    applyPreview();
  });

  on('#status-close', 'click', () => { $('#status').hidden = true; });
  for (const tab of $$('.mode-tab')) tab.addEventListener('click', () => setMode(tab.dataset.mode));
  on('#view-select', 'change', (e) => setView(e.target.value));
  on('#theme-select', 'change', (e) => setTheme(e.target.value));
  on('#content-select', 'change', (e) => setContent(e.target.value));
  on('#btn-commit', 'click', doCommit);
  on('#btn-tokens', 'click', () => doTokens(false));
  on('#btn-inject', 'click', doInject);
  on('#btn-recipe', 'click', writeRecipe);
  on('#gallery-load', 'change', () => { galleryBuilt = false; renderGallery(); });
  for (const sel of ['#lab-component', '#lab-variant', '#lab-size', '#lab-state', '#lab-bg']) on(sel, 'change', renderLab);
  on('#recipe-name', 'input', () => {
    const v = $('#recipe-name').value.trim() || 'component';
    $('#recipe-path').textContent = `assets/recipes/${v}.css`;
  });
  window.addEventListener('resize', () => requestAnimationFrame(updateFrameSize));

  slider('#accent-hue', (v) => { state.accentHue = v; });
  slider('#accent-chroma', (v) => { state.accentChroma = (v / 100) * 0.20; });
  slider('#neutral-temp', (v) => { state.neutral = v; });
}

async function init() {
  renderTranslation();
  syncControls();
  bindEvents();
  setArtifacts({});
  await loadState();

  const ready = state.fixture === 'ready';
  $('#fixture-frame').hidden = !ready;
  $('#fixture-fallback').hidden = ready;
  if (ready) loadFrame();
  applyPreview();
  updateFrameSize();
  bindLabHint();
  renderLab();

  if (!TOKEN) {
    setStatus('error', '页面里没有一次性 token：请用 `node scripts/studio.mjs --project <dir>` 打印的 Studio URL 打开。'
      + '所有写回按钮都会被拒绝（HTTP 403）。', 0);
  }
}

init();
