#!/usr/bin/env node
/**
 * studio.mjs — Aesthetic Studio：本地设计工作台 + 六个写回端点。
 * 零运行时第三方依赖，只用 node: 内置模块。assets/studio/ → /studio/。
 *
 * 本地安全（七条，全部生效）：
 *   1. 只监听 127.0.0.1
 *   2. 一次性 token，所有 POST 必须带 X-Studio-Token，否则 403
 *   3. 默认关闭 CORS   4. JSON body ≤ 256 KB，超限 413
 *   5. 路径 resolve → realpath（取最近已存在祖先）→ 允许根校验；
 *      拒绝 `..`、绝对路径、符号链接逃逸、非预期扩展名
 *   6. 原子替换：临时文件 → rename；覆盖前留 .bak
 *   7. --dry-run：只打印路径与 diff，不落盘
 *
 * Exit codes: 0 ok · 1 failed · 2 environment unavailable · 3 invalid input
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validate } from './lib/schema.mjs';
import { hashDecisions } from './check-consistency.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const STUDIO_ASSETS = path.join(SKILL_ROOT, 'assets', 'studio');
const UI_DIR = path.join(STUDIO_ASSETS, 'ui');

const OUT_REL = 'design/aesthetic';
const RECIPE_REL = 'assets/recipes';
const MAX_BODY = 256 * 1024;
const MAX_BODY_LABEL = '256 KB';
const GENERATOR = 'aesthetic-v2';
const EXIT = { OK: 0, FAIL: 1, ENV: 2, INPUT: 3 };

// === errors / args ===

class HttpError extends Error {
  constructor(status, code, message, detail) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function parseArgs(argv) {
  const o = {
    project: null, port: 4318, open: false, designFile: null,
    dryRun: false, quiet: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') o.project = argv[++i];
    else if (a === '--port') o.port = Number.parseInt(argv[++i], 10);
    else if (a === '--open') o.open = true;
    else if (a === '--design-file') o.designFile = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new HttpError(EXIT.INPUT, 'ARG', `未知参数：${a}`);
  }
  if (!o.help && (!Number.isInteger(o.port) || o.port < 0 || o.port > 65535)) {
    throw new HttpError(EXIT.INPUT, 'ARG', `--port 必须是 0–65535 的整数`);
  }
  return o;
}

function usage() {
  console.log([
    'Aesthetic Studio',
    '',
    '  node studio.mjs --project <dir> [--port 4318] [--open]',
    '                  [--design-file <path>] [--dry-run] [--quiet]',
    '',
    '  --project <dir>       目标项目根目录（必填）',
    '  --port <n>            起始端口，默认 4318；被占用时自动 +1',
    '  --open                监听成功后调用系统 open 命令（失败则只打印 URL）',
    '  --design-file <path>  目标设计文档，默认 <project>/DESIGN.md',
    '  --dry-run             所有写操作只打印路径与 diff，不落盘',
    '  --quiet               不打印请求日志',
  ].join('\n'));
}

// === path policy ===

const isInside = (root, target) => {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};

/** realpath of the nearest existing ancestor + the not-yet-existing tail. */
function nearestReal(target) {
  let cur = path.resolve(target);
  const tail = [];
  for (let i = 0; i < 64; i++) {
    try {
      const real = fs.realpathSync(cur);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      const parent = path.dirname(cur);
      if (parent === cur) return path.join(cur, ...tail.reverse());
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
  throw new HttpError(400, 'PATH_DEPTH', '路径层级过深');
}

/**
 * Validate a client-supplied relative path against an allowed write root.
 * Returns { abs, real, rel }. Throws HttpError(400/403) on any violation.
 */
function safeTarget(rootDir, relRaw, { exts = null, label = '路径' } = {}) {
  if (typeof relRaw !== 'string' || !relRaw.trim()) {
    throw new HttpError(400, 'PATH_EMPTY', `${label}不能为空`);
  }
  if (relRaw.length > 512) {
    throw new HttpError(400, 'PATH_LONG', `${label}超过 512 字符`);
  }
  if (relRaw.includes('\0')) {
    throw new HttpError(400, 'PATH_NUL', `${label}包含非法字符`);
  }
  if (path.isAbsolute(relRaw) || /^[a-zA-Z]:/.test(relRaw) || relRaw.startsWith('\\\\')) {
    throw new HttpError(400, 'PATH_ABSOLUTE', `${label}必须是相对路径`);
  }
  const segs = relRaw.split(/[\\/]+/).filter(Boolean);
  if (!segs.length) throw new HttpError(400, 'PATH_EMPTY', `${label}不能为空`);
  if (segs.some((s) => s === '..' || s === '.')) {
    throw new HttpError(400, 'PATH_DOTDOT', `${label}不允许包含 . 或 ..`);
  }

  const abs = path.resolve(rootDir, ...segs);
  if (!isInside(rootDir, abs)) {
    throw new HttpError(403, 'PATH_OUTSIDE', `${label}越出允许根目录`);
  }

  const ext = path.extname(abs).toLowerCase();
  if (exts && !exts.includes(ext)) {
    throw new HttpError(400, 'PATH_EXT', `${label}扩展名必须是 ${exts.join(' / ')}`);
  }

  let real;
  let realRoot;
  try {
    real = nearestReal(abs);
    realRoot = nearestReal(rootDir);
  } catch {
    throw new HttpError(400, 'PATH_REAL', `${label}无法解析`);
  }
  if (!isInside(realRoot, real)) {
    throw new HttpError(403, 'PATH_SYMLINK', `${label}经符号链接逃出允许根目录`);
  }
  return { abs, real, rel: path.relative(rootDir, abs).split(path.sep).join('/') };
}

// === fs helpers ===

const toPosix = (p) => p.split(path.sep).join('/');

/** Leave a .bak next to an existing file, then tmp → rename. */
function writeAtomic(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  const tmp = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`,
  );
  fs.writeFileSync(tmp, text.replace(/\r\n/g, '\n'), 'utf8');
  fs.renameSync(tmp, file);
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Minimal LCS line diff: unchanged runs >6 lines collapse, output capped. */
function lineDiff(oldText, newText, label) {
  const a = oldText ? oldText.replace(/\r\n/g, '\n').split('\n') : [];
  const b = String(newText).replace(/\r\n/g, '\n').split('\n');
  if (a.length + b.length > 2000) {
    return `--- ${label}\n- ${a.length} 行 → + ${b.length} 行（文件过大，只报告行数）`;
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const raw = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { raw.push(`  ${a[i]}`); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) raw.push(`- ${a[i++]}`);
    else raw.push(`+ ${b[j++]}`);
  }
  while (i < a.length) raw.push(`- ${a[i++]}`);
  while (j < b.length) raw.push(`+ ${b[j++]}`);

  const out = [];
  for (let k = 0; k < raw.length; k++) {
    if (!raw[k].startsWith('  ')) { out.push(raw[k]); continue; }
    let run = 0;
    while (k + run < raw.length && raw[k + run].startsWith('  ')) run++;
    if (run > 6) {
      out.push(raw[k], `  … ${run - 2} 行未变化 …`, raw[k + run - 1]);
      k += run - 1;
    } else {
      out.push(...raw.slice(k, k + run));
      k += run - 1;
    }
  }
  const capped = out.length > 300 ? [...out.slice(0, 300), '…（diff 截断）'] : out;
  return [`--- ${label}`, ...capped].join('\n');
}

// === http helpers ===

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const baseHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
});

function sendJson(res, status, obj) {
  const body = Buffer.from(`${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  res.writeHead(status, {
    ...baseHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, { ...baseHeaders(), 'Content-Type': type, 'Content-Length': body.length });
  res.end(body);
}

/** Read a JSON body; rejects >256 KB with 413. `optional` allows an empty body. */
function readJsonBody(req, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
      reject(new HttpError(415, 'CONTENT_TYPE', '请求必须是 application/json'));
      return;
    }
    let size = 0;
    let done = false;
    const chunks = [];
    const finish = (ok, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ok) resolve(value); else reject(value);
    };
    const timer = setTimeout(() => finish(false, new HttpError(408, 'BODY_TIMEOUT', '请求体读取超时')), 15000);
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { chunks.length = 0; return; }
      chunks.push(c);
    });
    req.on('error', (e) => finish(false, e));
    req.on('end', () => {
      if (size > MAX_BODY) {
        finish(false, new HttpError(413, 'BODY_TOO_LARGE', `请求体超过 ${MAX_BODY_LABEL} 上限`));
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        finish(optional, optional ? {} : new HttpError(400, 'BODY_EMPTY', '请求体为空'));
        return;
      }
      try { finish(true, JSON.parse(text)); } catch { finish(false, new HttpError(400, 'BODY_JSON', '请求体不是合法 JSON')); }
    });
  });
}

const timingEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// === script runner ===

/** Spawn a sibling script; map exit 0/1/2/3 → 200/422/503/400. */
function runScript(scriptName, argv, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve) => {
    const script = path.join(HERE, scriptName);
    if (!fs.existsSync(script)) {
      resolve({ ok: false, code: 'ENV', status: 503, stdout: '', stderr: '',
        message: `找不到 ${scriptName}（该功能尚未实现或未安装）` });
      return;
    }
    const child = spawn(process.execPath, [script, ...argv], {
      cwd: HERE, windowsHide: true, env: { ...process.env, AESTHETIC_STUDIO: '1' },
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const cap = (s, c) => (s.length > 65536 ? s : s + c.toString('utf8'));
    child.stdout.on('data', (c) => { stdout = cap(stdout, c); });
    child.stderr.on('data', (c) => { stderr = cap(stderr, c); });
    const timer = setTimeout(() => { killed = true; child.kill(); }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, code: 'ENV', status: 500, message: e.message, stdout, stderr });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        resolve({ ok: false, code: 'TIMEOUT', status: 504, message: `${scriptName} 超时`, stdout, stderr });
        return;
      }
      const status = code === 0 ? 200 : code === 2 ? 503 : code === 3 ? 400 : 422;
      resolve({ ok: code === 0, code, status, message: code === 0 ? null : `退出码 ${code}`, stdout, stderr });
    });
  });
}

// === API endpoints ===

function createApi(config, schema) {
  const { projectRoot, designFile, outDir, dryRun } = config;
  const decisionsPath = path.join(outDir, 'decisions.json');

  function planWrite(target, text, label) {
    const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    const diff = lineDiff(old, text, label);
    if (dryRun) {
      console.log(`\n[dry-run] 将写入 ${target}\n${diff}`);
      return { dryRun: true, diff, bytes: Buffer.byteLength(text, 'utf8') };
    }
    writeAtomic(target, text);
    console.log(`✓ 写入 ${target}（${Buffer.byteLength(text, 'utf8')} 字节${old ? '，已留 .bak' : ''}）`);
    return { dryRun: false, diff: null, bytes: Buffer.byteLength(text, 'utf8') };
  }

  /** Run a child script with --project (+ optional extras), map its exit code. */
  async function call(script, extra = [], opts) {
    const argv = ['--project', projectRoot, ...extra];
    if (dryRun) argv.push('--dry-run');
    const r = await runScript(script, argv, opts);
    if (!r.ok) throw new HttpError(r.status, String(r.code), r.message, { stdout: r.stdout, stderr: r.stderr });
    return r.stdout.trim();
  }

  const endpoints = {
    async commit(req) {
      const body = await readJsonBody(req);
      const stored = readJsonFile(decisionsPath);
      const incoming = body && typeof body.decisions === 'object' && body.decisions
        ? body.decisions : body;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        throw new HttpError(400, 'DECISIONS_SHAPE', 'decisions 必须是对象');
      }
      const target = safeTarget(outDir, body.path || 'decisions.json', { exts: ['.json'], label: 'decisions 路径' });

      const merged = {
        ...(stored || {}),
        ...incoming,
        meta: {
          schemaVersion: 1,
          theme: 'light-dark',
          ...(stored?.meta || {}),
          ...(incoming.meta || {}),
        },
      };
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(merged.meta.generatedAt || ''))) {
        merged.meta.generatedAt = new Date().toISOString();
      }
      merged.meta.schemaVersion = 1;
      merged.meta.generatorVersion = GENERATOR;

      const { valid, errors } = validate(schema, merged);
      if (!valid) {
        throw new HttpError(422, 'SCHEMA', 'decisions.json 不符合 schema', errors.slice(0, 20));
      }

      const text = `${JSON.stringify(merged, null, 2)}\n`;
      const plan = planWrite(target.abs, text, toPosix(path.relative(projectRoot, target.abs)));
      return {
        ok: true, file: toPosix(path.relative(projectRoot, target.abs)),
        sourceHash: `sha256:${hashDecisions(merged)}`, ...plan,
      };
    },

    async tokens() {
      const log = await call('build.mjs', ['--only', 'tokens']);
      return { ok: true, outputs: [`${OUT_REL}/tokens.json`, `${OUT_REL}/tokens.css`], log };
    },

    async contract() {
      const log = await call('build.mjs', ['--only', 'contract']);
      return { ok: true, outputs: [`${OUT_REL}/contract.md`], log };
    },

    async inject() {
      const log = await call('inject.mjs', ['--design-file', designFile]);
      return {
        ok: true, file: toPosix(path.relative(projectRoot, designFile)), log,
        designFileOutsideProject: !isInside(projectRoot, designFile),
      };
    },

    async recipe(req) {
      const body = await readJsonBody(req);
      if (typeof body.css !== 'string' || !body.css.trim()) {
        throw new HttpError(400, 'RECIPE_CSS', 'css 字段必须是非空字符串');
      }
      const rawName = typeof body.name === 'string' ? body.name.trim() : '';
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(rawName)) {
        throw new HttpError(400, 'RECIPE_NAME', 'name 只能含字母、数字、点、下划线、短横，长度 1–64');
      }
      const relRaw = body.path || `${rawName}.css`;
      const root = path.join(projectRoot, RECIPE_REL);
      const target = safeTarget(root, relRaw, { exts: ['.css'], label: 'recipe 路径' });
      if (!target.rel.endsWith('.css')) {
        throw new HttpError(400, 'RECIPE_EXT', 'recipe 必须是 .css 文件');
      }
      if (fs.existsSync(target.abs) && body.overwrite !== true) {
        throw new HttpError(409, 'RECIPE_EXISTS', `recipes/${target.rel} 已存在；确认覆盖请带 overwrite: true`);
      }
      const stamp = new Date().toISOString();
      const header = `/* recipe: ${target.rel} — 由 Aesthetic Studio 生成于 ${stamp} */\n`
        + `/* 依赖 design/aesthetic/tokens.css 的变量；不要在业务代码里硬编码视觉值。 */\n\n`;
      const text = `${header}${body.css.replace(/\r\n/g, '\n').trimEnd()}\n`;
      const plan = planWrite(target.abs, text, `${RECIPE_REL}/${target.rel}`);
      return { ok: true, file: `${RECIPE_REL}/${target.rel}`, ...plan };
    },

    async shot(req) {
      const body = await readJsonBody(req, { optional: true });
      if (!fs.existsSync(path.join(HERE, 'shoot.mjs'))) {
        throw new HttpError(503, 'ENV',
          'shoot.mjs 尚未实现（批次 3 接入）。当前请手工截图并放到 design/aesthetic/shots/。');
      }
      const extra = ['--out', path.join(outDir, 'shots')];
      if (['desktop', 'tablet', 'mobile'].includes(body.view)) extra.push('--view', body.view);
      if (['light', 'dark'].includes(body.theme)) extra.push('--theme', body.theme);
      if (typeof body.style === 'string' && /^[a-z0-9-]{1,40}$/.test(body.style)) extra.push('--style', body.style);
      const log = await call('shoot.mjs', extra, { timeoutMs: 180000 });
      return { ok: true, dir: `${OUT_REL}/shots`, log };
    },
  };

  return { endpoints, decisionsPath };
}

// === static files (/studio/ → assets/studio) ===

function resolveStatic(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    throw new HttpError(400, 'URL_ENCODING', 'URL 编码非法');
  }
  if (rel !== '/studio' && !rel.startsWith('/studio/')) throw new HttpError(404, 'NOT_FOUND', '未找到');
  let rest = rel === '/studio' ? '' : rel.slice('/studio/'.length);
  if (!rest || rest.endsWith('/')) rest += 'index.html';
  if (rest.includes('\0')) throw new HttpError(400, 'URL_NUL', 'URL 含非法字符');

  const segs = rest.split('/').filter(Boolean);
  if (segs.some((s) => s === '..' || s === '.') || path.isAbsolute(rest)) {
    throw new HttpError(403, 'PATH_DOTDOT', '静态路径不允许 . 或 ..');
  }
  const abs = path.resolve(STUDIO_ASSETS, ...segs);
  if (!isInside(STUDIO_ASSETS, abs)) throw new HttpError(403, 'PATH_OUTSIDE', '越出静态根目录');

  let real;
  let realRoot;
  try {
    real = fs.realpathSync(abs);
    realRoot = fs.realpathSync(STUDIO_ASSETS);
  } catch {
    throw new HttpError(404, 'NOT_FOUND', '未找到');
  }
  if (!isInside(realRoot, real)) throw new HttpError(403, 'PATH_SYMLINK', '符号链接逃出静态根目录');
  if (!fs.statSync(real).isFile()) throw new HttpError(404, 'NOT_FOUND', '未找到');
  return real;
}

const CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:", "frame-src 'self'", "connect-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'",
].join('; ');

function serveStatic(req, res, urlPath, token) {
  const file = resolveStatic(urlPath);
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) throw new HttpError(403, 'MIME', `不提供该扩展名：${path.extname(file) || '(无)'}`);
  const buf = fs.readFileSync(file);
  // 一次性 token 内联进外壳；前端从 window.__STUDIO_TOKEN__ 读。
  const shell = file === path.join(UI_DIR, 'index.html');
  const body = shell
    ? Buffer.from(buf.toString('utf8').replace(
      '</head>', `<script>window.__STUDIO_TOKEN__ = ${JSON.stringify(token)};</script>\n</head>`,
    ), 'utf8')
    : buf;
  res.writeHead(200, {
    ...baseHeaders(), 'Content-Type': type, 'Content-Length': body.length, 'Content-Security-Policy': CSP,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

// === GET reads (Studio 只读面板用) ===

function createReads(config) {
  const { projectRoot, designFile, outDir } = config;
  const rel = (p) => toPosix(path.relative(projectRoot, p));

  return {
    '/api/health': () => ({
      ok: true,
      project: projectRoot,
      designFile: rel(designFile),
      outDir: OUT_REL,
      generatorVersion: GENERATOR,
      node: process.version,
    }),
    '/api/state': () => {
      const decisions = readJsonFile(path.join(outDir, 'decisions.json'));
      const tokens = readJsonFile(path.join(outDir, 'tokens.json'));
      const hasContract = fs.existsSync(path.join(outDir, 'contract.md'));
      const hasDesign = fs.existsSync(designFile);
      let designBlock = false;
      if (hasDesign) {
        try {
          designBlock = /<!--\s*aesthetic:begin/.test(fs.readFileSync(designFile, 'utf8'));
        } catch { designBlock = false; }
      }
      const stylesDir = path.join(STUDIO_ASSETS, 'styles');
      let styleCount = 0;
      try {
        styleCount = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.css')).length;
      } catch { styleCount = 0; }
      const fixture = fs.existsSync(path.join(STUDIO_ASSETS, 'fixture', 'index.html'));
      return {
        ok: true,
        decisions,
        sourceHash: decisions ? `sha256:${hashDecisions(decisions)}` : null,
        tokensSourceHash: tokens?.sourceHash || null,
        artifacts: {
          decisions: !!decisions, tokens: !!tokens,
          contract: hasContract, designFile: hasDesign, designBlock,
        },
        studio: { styles: styleCount, fixture, recipes: rel(path.join(projectRoot, RECIPE_REL)) },
      };
    },
    '/api/recipes': () => {
      const dir = path.join(projectRoot, RECIPE_REL);
      let files = [];
      try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort();
      } catch { files = []; }
      return { ok: true, dir: RECIPE_REL, files };
    },
  };
}

// === server ===

function listen(server, port, host, attempts = 20) {
  return new Promise((resolve, reject) => {
    let current = port;
    let left = attempts;
    const onError = (e) => {
      if (e.code === 'EADDRINUSE' && left > 0 && port !== 0) {
        left -= 1;
        current += 1;
        setTimeout(() => server.listen(current, host), 0);
        return;
      }
      server.removeListener('error', onError);
      reject(e);
    };
    server.on('error', onError);
    server.once('listening', () => {
      server.removeListener('error', onError);
      resolve(server.address().port);
    });
    server.listen(current, host);
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try {
    const child = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => { /* 打不开就只留 URL */ });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

const PROXY_RE = /^\/studio\/proxy\/([a-z0-9-]{1,40})\/(.*)$/;

/**
 * Gallery placeholder: /studio/proxy/<variant>/<file> serves the neutral
 * fixture. No variant CSS exists yet (批次 6), so the prefix is dropped.
 */
function rewriteProxy(urlPath) {
  const m = urlPath.match(PROXY_RE);
  return m ? `/studio/fixture/${m[2] || 'index.html'}` : urlPath;
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(EXIT.INPUT);
  }
  if (o.help) { usage(); process.exit(EXIT.OK); }
  if (!o.project) {
    console.error('缺少 --project <目标项目路径>（--help 查看用法）');
    process.exit(EXIT.INPUT);
  }

  const projectRoot = path.resolve(o.project);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    console.error(`项目目录不存在：${projectRoot}`);
    process.exit(EXIT.INPUT);
  }
  if (!fs.existsSync(UI_DIR)) {
    console.error(`缺少 Studio 界面：${path.relative(SKILL_ROOT, UI_DIR)}`);
    process.exit(EXIT.ENV);
  }

  const designFile = path.resolve(o.designFile || path.join(projectRoot, 'DESIGN.md'));
  const outDir = path.join(projectRoot, OUT_REL);
  const config = { projectRoot, designFile, outDir, dryRun: o.dryRun };

  if (!o.dryRun) {
    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (e) {
      console.error(`无法创建 ${path.relative(projectRoot, outDir)}：${e.message}`);
      process.exit(EXIT.FAIL);
    }
  }
  if (!isInside(projectRoot, designFile)) {
    console.warn(`注意：DESIGN_FILE 在项目目录外（${designFile}），注入端点只写该文件的 marker 块。`);
  }

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, 'schemas', 'decisions.schema.json'), 'utf8'));
  } catch (e) {
    console.error(`无法读取 decisions schema：${e.message}`);
    process.exit(EXIT.ENV);
  }

  const token = crypto.randomBytes(24).toString('base64url');
  const { endpoints } = createApi(config, schema);
  const reads = createReads(config);
  const host = '127.0.0.1';
  const startedAt = Date.now();

  const server = http.createServer(async (req, res) => {
    const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
    const log = (s) => { if (!o.quiet) console.log(`${String(s).padEnd(3)} ${req.method.padEnd(4)} ${urlPath}`); };
    const fail = (err) => {
      const e = err instanceof HttpError ? err : new HttpError(500, 'INTERNAL', err?.message || '内部错误');
      if (!(err instanceof HttpError) && !o.quiet) console.error(err);
      const body = { ok: false, code: e.code, message: e.message, detail: e.detail ?? null };
      if (urlPath.startsWith('/api/')) sendJson(res, e.status || 500, body);
      else sendText(res, e.status || 500, `${e.status || 500} ${e.message}\n`);
      log(e.status || 500);
    };

    try {
      if (req.method === 'OPTIONS') {
        // CORS 默认关闭：不返回任何 Access-Control-Allow-*。
        res.writeHead(405, { ...baseHeaders(), Allow: 'GET, HEAD, POST' });
        res.end();
        log(405);
        return;
      }

      if (urlPath.startsWith('/api/')) {
        const name = urlPath.slice(5).replace(/\/+$/, '');
        if (req.method === 'GET' || req.method === 'HEAD') {
          const fn = reads[`/api/${name}`];
          if (!fn) throw new HttpError(404, 'API_NOT_FOUND', `未知端点：/api/${name}`);
          const payload = fn();
          if (name === 'state') payload.tokenAccepted = timingEqual(req.headers['x-studio-token'] || '', token);
          sendJson(res, 200, payload);
          log(200);
          return;
        }
        if (req.method !== 'POST') throw new HttpError(405, 'METHOD', '该端点只接受 POST');
        if (!timingEqual(req.headers['x-studio-token'] || '', token)) {
          throw new HttpError(403, 'TOKEN',
            '缺少或错误的 X-Studio-Token。请用 `node studio.mjs` 打印的 URL 打开 Studio；页面会自动带上一次性 token。');
        }
        if (!Object.prototype.hasOwnProperty.call(endpoints, name)) {
          throw new HttpError(404, 'API_NOT_FOUND', `未知端点：/api/${name}`);
        }
        sendJson(res, 200, await endpoints[name](req));
        log(200);
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        throw new HttpError(405, 'METHOD', '静态资源只支持 GET');
      }

      const target = rewriteProxy(urlPath);
      if (target === '/' || target === '/index.html') {
        const qs = new URL(req.url, 'http://127.0.0.1').search;
        res.writeHead(302, { ...baseHeaders(), Location: `/studio/ui/index.html${qs}` });
        res.end();
        log(302);
        return;
      }
      serveStatic(req, res, target, token);
      log(200);
    } catch (err) {
      fail(err);
    }
  });

  server.keepAliveTimeout = 5000;
  server.headersTimeout = 10000;

  let port;
  try {
    port = await listen(server, o.port, host);
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      console.error(`端口 ${o.port}–${o.port + 20} 都被占用，请用 --port 指定其他端口。`);
      process.exit(EXIT.ENV);
    }
    console.error(`监听 ${host} 失败：${e.message}`);
    process.exit(EXIT.ENV);
  }

  const url = `http://${host}:${port}/studio/ui/index.html?t=${encodeURIComponent(token)}`;
  console.log('');
  console.log('  Aesthetic Studio');
  console.log(`  项目    ${projectRoot}`);
  console.log(`  设计文档 ${path.relative(projectRoot, designFile) || designFile}`);
  console.log(`  监听    http://${host}:${port}/`);
  console.log(`  Token   ${token}`);
  console.log('          页面打开时自动带上，不要外传；进程退出即失效。');
  console.log(`  打开    ${url}`);
  if (o.dryRun) console.log('  模式    --dry-run：所有写操作只打印，不落盘');
  console.log('');
  console.log('  Ctrl+C 停止。');

  if (o.open) {
    const ok = openBrowser(url);
    if (!ok) console.log('  无法调用系统打开命令，请手动打开上面的 URL。');
  }

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\n收到 ${signal}，正在关闭…`);
    const force = setTimeout(() => {
      console.log('已停止');
      process.exit(EXIT.OK);
    }, 2000);
    force.unref();
    server.close(() => {
      const ms = Date.now() - startedAt;
      console.log(`已停止（运行 ${Math.round(ms / 1000)}s）`);
      process.exit(EXIT.OK);
    });
    server.closeAllConnections?.();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  server.on('error', (e) => {
    console.error(`服务器错误：${e.message}`);
    process.exit(EXIT.FAIL);
  });
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exit(EXIT.FAIL);
});
