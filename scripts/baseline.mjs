#!/usr/bin/env node
/**
 * baseline.mjs — 重设计前的「不许丢东西」基线。
 *
 * contract.md 记的是意图（该是什么样），不是目标项目里已有的事实（链接、表单、
 * 事件处理器、脚本依赖的选择器）。意图不会替你记住 `href="/pricing"`，人更不会。
 * 所以这里在动手前把源码里的「接线」录成基线，改完逐条比对：hard 项丢失 = 不通过。
 *
 * 纯静态扫描，不启动浏览器、不解析框架 AST、零依赖。扫描的是源码层：
 *   .html .htm .jsx .tsx .vue .svelte .astro
 * 因此「静态扫描不覆盖运行时注入的 DOM」——JS 里 createElement 出来的片段、
 * 服务端/客户端渲染后才出现的节点，都不在基线里。它只回答一个窄问题：
 * 源码里原本写死的东西，重设计后还在不在。
 *
 * 退出码：0 通过 · 1 hard 项丢失 · 2 环境问题（项目/基线不存在、拒绝覆盖）
 *         3 输入非法（沿用 scripts/*.mjs 的约定）
 *
 * Usage:
 *   node baseline.mjs --project <dir> --record [--force] [--json]
 *   node baseline.mjs --project <dir> --check [--json]
 *   node baseline.mjs --help
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EXIT = { PASS: 0, DRIFT: 1, ENV: 2, INPUT: 3 };
const OUT_DIR = path.join('design', 'aesthetic');
const BASELINE_REL = path.join(OUT_DIR, 'baseline.json');
const SCHEMA_VERSION = 1;

// 扫描范围。刻意只收静态源码：跑浏览器会把「当前渲染出来的」当事实，
// 而重设计要保护的是「作者写下的」。
const SCAN_EXTS = ['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.astro'];
const SCAN_EXT_SET = new Set(SCAN_EXTS);

// 构建产物和依赖树不是「作者写下的接线」。design/aesthetic 是 skill 自己的产物，
// 若扫描它，基线会把自己的输出当事实，越比越乱。
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'vendor', 'coverage',
]);

// 固定顺序：输出、JSON、裁决行都按它排列，保证两次录制可逐字比较。
const CATEGORIES = [
  { id: 'links', level: 'hard', label: 'links' },
  { id: 'fields', level: 'hard', label: 'fields' },
  { id: 'forms', level: 'hard', label: 'forms' },
  { id: 'handlers', level: 'hard', label: 'handlers' },
  { id: 'ids', level: 'hard', label: 'ids' },
  { id: 'selectors', level: 'hard', label: 'selectors' },
  { id: 'headings', level: 'soft', label: 'headings' },
  { id: 'images', level: 'soft', label: 'images' },
];
const HARD_IDS = CATEGORIES.filter((c) => c.level === 'hard').map((c) => c.id);
const SOFT_IDS = CATEGORIES.filter((c) => c.level === 'soft').map((c) => c.id);

const MIN_REASON_CHARS = 12;

class InputError extends Error {}
class EnvError extends Error {}

// ---------------------------------------------------------------------------
// args / config
// ---------------------------------------------------------------------------

function usage() {
  return [
    'baseline.mjs --project <dir> --record [--force] [--json]',
    '             --project <dir> --check [--json]',
    '',
    '  --project  目标项目根目录',
    '  --record   录制基线到 <project>/design/aesthetic/baseline.json',
    '  --check    与已有基线比对',
    '  --force    --record 时允许覆盖旧基线（不加则拒绝）',
    '  --json     输出机器可读 JSON（--check 时）',
    '',
    '  扫描：.html .htm .jsx .tsx .vue .svelte .astro（静态源码，不跑浏览器）',
    '  跳过：node_modules .git dist build .next out vendor coverage',
    '        design/aesthetic 以及所有点开头的目录',
    '',
    '  豁免（只对 hard 项，理由至少 12 字，同一条只能豁免一次）：',
    '    /* aesthetic · dropped /pricing · 定价页并入了产品页 */',
    '    <!-- aesthetic · dropped /pricing · 定价页并入了产品页 -->',
    '',
    '  注意：静态扫描不覆盖运行时注入的 DOM。JS 里 createElement、',
    '  框架渲染后才出现的节点不在基线里；通过只代表源码层没丢。',
    '',
    '退出码：0 通过 · 1 hard 项丢失 · 2 环境问题 · 3 输入非法',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    project: null, record: false, check: false, force: false, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') opts.project = argv[++i];
    else if (a === '--record') opts.record = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new InputError(`unknown argument: ${a}`);
  }
  return opts;
}

function buildConfig(opts) {
  if (!opts.project) throw new InputError('缺少 --project <目标项目路径>');
  if (opts.record === opts.check) {
    throw new InputError('必须且只能指定 --record 或 --check 之一');
  }
  if (opts.force && !opts.record) {
    throw new InputError('--force 只能与 --record 一起使用');
  }
  const project = path.resolve(opts.project);
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) {
    // 项目不存在不是输入笔误，是「没东西可比」——用 2，和缺基线一致。
    throw new EnvError(`项目目录不存在或不是目录：${project}`);
  }
  return {
    project,
    mode: opts.record ? 'record' : 'check',
    force: opts.force,
    json: opts.json,
    baselineFile: path.resolve(project, BASELINE_REL),
  };
}

// ---------------------------------------------------------------------------
// stable ordering
// ---------------------------------------------------------------------------

// 不用 localeCompare：不同机器的 locale 可能给出不同顺序，基线就不可逐字比较了。
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function relPath(project, abs) {
  // 统一成正斜杠：Windows 和 POSIX 录出的基线才能互相比较。
  return path.relative(project, abs).split(path.sep).join('/');
}

function sortItems(items) {
  return items.slice().sort((a, b) =>
    cmp(a.file, b.file) || cmp(a.value, b.value) || cmp(a.kind, b.kind));
}

function emptyItems() {
  const out = {};
  for (const c of CATEGORIES) out[c.id] = [];
  return out;
}

// ---------------------------------------------------------------------------
// file walking
// ---------------------------------------------------------------------------

function isDesignDir(project, abs) {
  const rel = relPath(project, abs).toLowerCase();
  return rel === OUT_DIR.split(path.sep).join('/').toLowerCase();
}

function walk(project) {
  const files = [];
  const stack = [project];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // 读不了的目录跳过，扫描不该因为一个权限问题整体失败
    }
    for (const entry of entries) {
      // 不跟随符号链接：既避免环，也避免把项目外的东西录进基线。
      if (entry.isSymbolicLink()) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const name = entry.name.toLowerCase();
        if (entry.name.startsWith('.')) continue;
        if (SKIP_DIRS.has(name)) continue;
        if (isDesignDir(project, abs)) continue;
        stack.push(abs);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SCAN_EXT_SET.has(ext)) files.push(abs);
      }
    }
  }
  return files.sort((a, b) => cmp(relPath(project, a), relPath(project, b)));
}

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------

// CJK 统一表意文字（含扩展 A 与兼容区）。只数 BMP 内的区间，不处理代理对——估算词数不需要精确到 emoji。
const HAN_RE = /[㐀-䶿一-鿿豈-﫿]/g;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–',
};

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

function collapse(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, ' ');
}

// 只去掉 <!-- --> 与 /* */，保留 script/style 里的内容——选择器就在内联脚本里。
// 刻意不处理 `//` 行注释：它会把 `href="//cdn…"` 这类协议相对 URL 从中间截断，
// 而协议相对 URL 恰恰是链接基线要保护的东西之一。
function stripComments(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

// 文本节点：去掉注释、脚本、样式之后，取 > 与 < 之间的内容。
// 这是近似——JSX 里 `a < b` 这类比较会产生噪声，但 record/check 用同一套规则，
// 变化率仍然有意义；它本来就不是精确字数统计。
function stripForText(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

function textNodes(s) {
  const out = [];
  const re = />([^<>]+)</g;
  let m;
  while ((m = re.exec(s))) {
    const text = collapse(decodeEntities(m[1]));
    if (text) out.push(text);
  }
  return out;
}

function countWords(text) {
  // 中文按字符数 / 2 估：一个汉字承载的信息量约等于半个英文词。
  const han = (text.match(HAN_RE) || []).length;
  const latin = text
    .replace(HAN_RE, ' ')
    .split(/\s+/)
    .filter((t) => /[A-Za-z0-9]/.test(t))
    .length;
  return han / 2 + latin;
}

// ---------------------------------------------------------------------------
// attribute parsing
// ---------------------------------------------------------------------------

// 允许 "…"、'…'、`…`、{…}（JSX）。不追求完整 HTML 解析器：
// 静态扫描要的是「作者写下的字面量」，表达式本来就不该被当成事实。
const ATTR_RE = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{([^}]*)\})/g;

function unwrapExpr(raw) {
  const s = raw.trim();
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'" || q === '`') && s[s.length - 1] === q) {
      return { value: s.slice(1, -1), literal: !s.includes('${') };
    }
  }
  return { value: s, literal: false };
}

/** @returns {Map<string, {value: string, literal: boolean}>} */
function parseAttrs(body) {
  const attrs = new Map();
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(body))) {
    const name = m[1].toLowerCase();
    let parsed;
    if (m[2] !== undefined) parsed = { value: m[2], literal: true };
    else if (m[3] !== undefined) parsed = { value: m[3], literal: true };
    else if (m[4] !== undefined) parsed = { value: m[4], literal: !m[4].includes('${') };
    else parsed = unwrapExpr(m[5] ?? '');
    attrs.set(name, parsed);
  }
  return attrs;
}

/**
 * 从 `<tag` 开始向前找配对的 `>`，跳过引号里的内容与 `{…}` 表达式。
 *
 * 不能用 `/<tag\b([^>]*)>/`：JSX 的 `onClick={() => go()}` 里就有 `>`，
 * 正则会从箭头函数中间截断，后面整段属性都丢了。
 * 允许嵌套 `{ {…} }`，字符串里的 `}` 不算闭合。
 */
function readOpeningTag(text, start) {
  let i = start;
  let brace = 0;
  let quote = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '`') { quote = c; continue; }
    if (c === '{') { brace++; continue; }
    if (c === '}') { if (brace > 0) brace--; continue; }
    if (c === '>' && brace === 0) {
      return { body: text.slice(start, i), end: i + 1 };
    }
  }
  return null; // 没有闭合，说明这是 JSX 片段或坏标记，跳过
}

/** 返回 `[{name, body}]`，name 为小写标签名。 */
function openingTags(text) {
  const out = [];
  const re = /<([a-zA-Z][\w:.-]*)/g;
  let m;
  while ((m = re.exec(text))) {
    const tag = readOpeningTag(text, m.index + m[0].length);
    if (!tag) continue;
    out.push({ name: m[1].toLowerCase(), body: tag.body });
    re.lastIndex = tag.end;
  }
  return out;
}

// ---------------------------------------------------------------------------
// scan
// ---------------------------------------------------------------------------

const HANDLER_RE = /^(?:on[a-z][a-z0-9]*|on:[a-z][\w:.-]*|@[\w:.-]+|v-on:[\w:.-]+|x-on:[\w:.-]+)$/i;
const SELECTOR_RE = /\b(getElementById|querySelector(?:All)?)\s*\(\s*(['"`])([^'"`\n]*?)\2\s*\)/g;
const HEADING_RE = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

function usable(value) {
  return value && !value.includes('${');
}

function add(items, kind, value, file) {
  items[kind].push({ value, file, kind });
}

function scanFile(project, abs) {
  const rel = relPath(project, abs);
  const ext = path.extname(abs).toLowerCase();
  const text = fs.readFileSync(abs, 'utf8');
  const items = emptyItems();
  const waivers = [];
  let words = 0;

  // ---- selectors：所有源码文件都扫（内联 <script> 里也常写） ----
  const code = stripComments(text);
  SELECTOR_RE.lastIndex = 0;
  let sel;
  while ((sel = SELECTOR_RE.exec(code))) {
    const value = sel[3].trim();
    if (usable(value)) add(items, 'selectors', value, rel);
  }

  // ---- 标签层：扫描范围全部是模板/组件源码，都可能含标签 ----
  if (SCAN_EXT_SET.has(ext)) {
    const markup = stripComments(text);

    // 每个开标签只解析一次属性，后面按标签名分流。
    const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
    for (const tag of openingTags(markup)) {
      const attrs = parseAttrs(tag.body);

      // links：href / to。`#` 与 javascript: 不是接线；mailto/tel 是。
      for (const name of ['href', 'to']) {
        const attr = attrs.get(name);
        if (!attr || !attr.literal) continue;
        const value = attr.value.trim();
        if (!value || value === '#' || /^javascript:/i.test(value)) continue;
        add(items, 'links', value, rel);
      }

      for (const [name, attr] of attrs) {
        // handlers：只记属性名与文件，不记函数体——函数体是重设计会重写的部分。
        if (HANDLER_RE.test(name) && attr.value) add(items, 'handlers', name, rel);
      }

      const id = attrs.get('id');
      if (id && id.literal && id.value.trim()) {
        add(items, 'ids', id.value.trim(), rel);
      }

      if (FIELD_TAGS.has(tag.name)) {
        const name = attrs.get('name');
        if (name && name.literal && name.value.trim()) {
          add(items, 'fields', name.value.trim(), rel);
        }
        // 无 name 但有 id 的字段，id 已统一记入 ids（不重复记 fields）。
      } else if (tag.name === 'form') {
        const action = attrs.get('action');
        const method = attrs.get('method');
        let recorded = false;
        if (action && action.literal && action.value.trim()) {
          add(items, 'forms', `action=${action.value.trim()}`, rel);
          recorded = true;
        }
        if (method && method.literal && method.value.trim()) {
          add(items, 'forms', `method=${method.value.trim().toLowerCase()}`, rel);
          recorded = true;
        }
        // 既没有 action 也没有 method 的 <form> 仍然是接线（提交逻辑可能绑在 handler 上）。
        if (!recorded) add(items, 'forms', 'form', rel);
      } else if (tag.name === 'img') {
        const src = attrs.get('src');
        if (src && src.literal && src.value.trim()) {
          add(items, 'images', src.value.trim(), rel);
        }
      }
    }

    // ---- soft：标题文本 ----
    HEADING_RE.lastIndex = 0;
    let h;
    while ((h = HEADING_RE.exec(markup))) {
      const raw = decodeEntities(stripTags(h[2]));
      const value = collapse(raw);
      if (value) add(items, 'headings', value, rel);
    }

    // ---- soft：词数（文本节点） ----
    const body = stripForText(text);
    words = countWords(textNodes(body).join(' '));
  }

  // ---- 豁免注释：hard 项丢失时唯一的人工出口 ----
  waivers.push(...readWaivers(text, rel));

  return { rel, ext, items, words, waivers };
}

// ---------------------------------------------------------------------------
// waivers
// ---------------------------------------------------------------------------

const WAIVER_BODY_RE = /^\s*aesthetic\s*·\s*dropped\s+(.+?)\s*·\s*([\s\S]*?)\s*$/;
const BLOCK_COMMENT_RE = /\/\*([\s\S]*?)\*\//g;
const HTML_COMMENT_RE = /<!--([\s\S]*?)-->/g;

/**
 * 只认两种豁免注释：`/* aesthetic · dropped … *​/` 与
 * `<!-- aesthetic · dropped … -->`。不认 `//`：它会把 URL 里的 `//` 误当注释，
 * 而且两种写法已经覆盖 JS 与 HTML。
 */
function readWaivers(text, file) {
  const out = [];
  for (const re of [BLOCK_COMMENT_RE, HTML_COMMENT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const parsed = m[1].match(WAIVER_BODY_RE);
      if (!parsed) continue;
      const value = parsed[1].trim();
      const reason = collapse(parsed[2]);
      if (!value) continue;
      out.push({
        value,
        reason,
        file,
        valid: [...reason].length >= MIN_REASON_CHARS,
        index: m.index,
      });
    }
  }
  return out.sort((a, b) => cmp(a.file, b.file) || a.index - b.index);
}

// ---------------------------------------------------------------------------
// scan project
// ---------------------------------------------------------------------------

function scanProject(project) {
  const files = walk(project);
  const items = emptyItems();
  const waivers = [];
  const extensions = new Set();
  let words = 0;

  for (const abs of files) {
    let scanned;
    try {
      scanned = scanFile(project, abs);
    } catch {
      continue; // 单个文件读失败不拖垮整次扫描
    }
    extensions.add(scanned.ext);
    for (const c of CATEGORIES) {
      for (const item of scanned.items[c.id]) items[c.id].push(item);
    }
    waivers.push(...scanned.waivers);
    words += scanned.words;
  }

  for (const c of CATEGORIES) items[c.id] = sortItems(dedupe(items[c.id]));

  return {
    items,
    waivers,
    words: Math.round(words),
    files: files.map((f) => relPath(project, f)),
    extensions: [...extensions].sort(cmp),
  };
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${it.kind}\u0000${it.value}\u0000${it.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// ---------------------------------------------------------------------------
// baseline io
// ---------------------------------------------------------------------------

function baselinePath(cfg) {
  return path.resolve(cfg.project, BASELINE_REL);
}

function makeBaseline(scan) {
  return {
    schemaVersion: SCHEMA_VERSION,
    tool: 'baseline.mjs',
    recordedAt: new Date().toISOString(),
    extensions: scan.extensions,
    files: scan.files,
    words: scan.words,
    items: scan.items,
  };
}

function loadBaseline(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new EnvError(`基线文件无法读取或不是合法 JSON：${e.message}`);
  }
  if (!data || data.schemaVersion !== SCHEMA_VERSION || !data.items) {
    throw new EnvError('基线文件版本不兼容，请用 --record --force 重新录制');
  }
  return data;
}

function countBaselineItems(data) {
  let n = 0;
  for (const c of CATEGORIES) n += Array.isArray(data.items[c.id]) ? data.items[c.id].length : 0;
  return n;
}

function record(cfg) {
  const file = baselinePath(cfg);
  if (fs.existsSync(file) && !cfg.force) {
    let old = null;
    try {
      old = loadBaseline(file);
    } catch { /* 旧文件坏了也仍然拒绝静默覆盖 */ }
    const when = old?.recordedAt || '（无法读取录制时间）';
    const n = old ? countBaselineItems(old) : '?';
    // 不静默覆盖：旧基线可能是重设计前唯一的事实快照，覆盖掉就再也录不回来。
    throw new EnvError([
      `基线已存在：${path.relative(cfg.project, file)}`,
      `  录制时间 ${when} · 条目 ${n} 项`,
      '  覆盖会丢弃旧基线；确认要覆盖请加 --force',
    ].join('\n'));
  }

  const scan = scanProject(cfg.project);
  const data = makeBaseline(scan);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const total = countBaselineItems(data);
  if (cfg.json) {
    console.log(JSON.stringify({
      ok: true,
      baseline: path.relative(cfg.project, file).split(path.sep).join('/'),
      recordedAt: data.recordedAt,
      files: data.files.length,
      items: total,
      words: data.words,
    }, null, 2));
  } else {
    console.log(`✓ 基线已录制：${path.relative(cfg.project, file).split(path.sep).join('/')}`);
    console.log(`  ${data.files.length} 个文件 · ${total} 项 · words ${data.words}`);
    if (!data.files.length) {
      console.log('  ! 没有找到可扫描的源文件（静态源码层只认 .html/.jsx/.tsx/.vue/.svelte/.astro）');
    }
    console.log(`  录制时间 ${data.recordedAt}`);
  }
  process.exit(EXIT.PASS);
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

function formatPct(before, after) {
  if (!before) return after ? 100 : 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

function displayPct(pct) {
  const rounded = Math.round(pct);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function itemLine(item) {
  return `${item.kind} · ${item.value} · ${item.file}`;
}

function check(cfg) {
  const file = baselinePath(cfg);

  if (!fs.existsSync(file)) {
    throw new EnvError(
      `找不到基线 ${path.relative(cfg.project, file).split(path.sep).join('/')}；`
      + '先运行 node scripts/baseline.mjs --project <dir> --record',
    );
  }

  const base = loadBaseline(file);
  const scan = scanProject(cfg.project);

  const warnings = [];
  const failedWaivers = [];

  // ---- waiver 分类：有效的、理由太短的、重复的 ----
  // 同一 hard 值只允许豁免一次：第一条有效记录生效，后面的只提示。
  const waiverByValue = new Map();
  const duplicateWaivers = [];
  for (const w of scan.waivers) {
    if (!w.valid) {
      failedWaivers.push(w);
      continue;
    }
    if (waiverByValue.has(w.value)) {
      duplicateWaivers.push(w);
      continue;
    }
    waiverByValue.set(w.value, w);
  }

  const hardMissing = [];
  const softMissing = [];
  const waived = [];
  const waivedSeen = new Set();
  const perCat = {};
  for (const c of CATEGORIES) perCat[c.id] = { total: 0, missing: 0, waived: 0 };

  for (const c of CATEGORIES) {
    const baseItems = Array.isArray(base.items[c.id]) ? base.items[c.id] : [];
    const currentValues = new Set(scan.items[c.id].map((it) => it.value));
    perCat[c.id].total = baseItems.length;

    for (const item of baseItems) {
      if (currentValues.has(item.value)) continue;

      if (c.level === 'hard') {
        // 一条豁免针对的是一个「值」，不是某一次出现：同一个链接在多个文件里
        // 都丢了，写一次豁免就够了，但仍逐条记入 waived，便于审阅覆盖面。
        const waiver = waiverByValue.get(item.value);
        if (waiver) {
          perCat[c.id].waived++;
          const key = `${item.value}\u0000${waiver.file}`;
          if (!waivedSeen.has(key)) {
            waivedSeen.add(key);
            waived.push({
              kind: item.kind, value: item.value, file: item.file,
              reason: waiver.reason, commentFile: waiver.file,
            });
          }
          continue;
        }
        perCat[c.id].missing++;
        hardMissing.push(item);
      } else {
        perCat[c.id].missing++;
        softMissing.push(item);
      }
    }
  }

  // ---- 覆盖不到的类别：基线录了 .jsx，项目改成 .tsx ----
  const currentExts = new Set(scan.extensions);
  for (const ext of base.extensions || []) {
    if (!currentExts.has(ext)) {
      warnings.push(`未覆盖 ${ext}：基线里有该类型文件，本次扫描没有；未覆盖不等于通过`);
    }
  }

  // ---- waiver 的旁支提示 ----
  for (const w of failedWaivers) {
    warnings.push(`豁免不在案（理由 ${[...w.reason].length} 字，至少 ${MIN_REASON_CHARS} 字）：${w.value} · ${w.file}`);
  }
  for (const w of duplicateWaivers) {
    warnings.push(`重复豁免（同一条 hard 项只能豁免一次）：${w.value} · ${w.file}`);
  }
  // 豁免注释写错时最危险——它看起来像「已处理」，实际什么都没豁免。
  // 所以两种情况都要出声：没录进基线的值，以及根本没丢的值。
  const hardValuesInBase = new Set();
  for (const id of HARD_IDS) {
    const list = Array.isArray(base.items[id]) ? base.items[id] : [];
    for (const it of list) hardValuesInBase.add(it.value);
  }
  const hardValuesNow = new Set();
  for (const id of HARD_IDS) {
    for (const it of scan.items[id]) hardValuesNow.add(it.value);
  }
  for (const [value, w] of waiverByValue) {
    if (!hardValuesInBase.has(value)) {
      warnings.push(`豁免未在基线中（拼写或值不匹配）：${value} · ${w.file}`);
    } else if (hardValuesNow.has(value)) {
      warnings.push(`豁免多余（该项仍在）：${value} · ${w.file}`);
    }
  }

  // ---- 词数 ----
  const before = Number(base.words) || 0;
  const after = scan.words;
  const deltaPct = formatPct(before, after);
  if (before > 0 && after < before * 0.6) {
    warnings.push(`words 比基线少 ${Math.abs(deltaPct)}%（${before} → ${after}），超过 40% 阈值`);
  }

  const ok = hardMissing.length === 0;
  const hardTotal = HARD_IDS.reduce((n, id) => n + perCat[id].total, 0);
  const softTotal = SOFT_IDS.reduce((n, id) => n + perCat[id].total, 0);

  if (cfg.json) {
    console.log(JSON.stringify({
      ok,
      hard: { missing: hardMissing, total: hardTotal },
      soft: { missing: softMissing, total: softTotal },
      words: { before, after, deltaPct },
      waived,
      warnings,
    }, null, 2));
    process.exit(ok ? EXIT.PASS : EXIT.DRIFT);
  }

  // ---- 人读输出 ----
  const relBase = path.relative(cfg.project, file).split(path.sep).join('/');
  console.log(`基线 ${relBase} · 录制于 ${base.recordedAt || '未知'} · ${countBaselineItems(base)} 项`);
  console.log(`扫描 ${scan.files.length} 个文件（${scan.extensions.join(' ') || '无'}）· 静态源码层，不含运行时注入的 DOM`);
  console.log('');

  for (const level of ['hard', 'soft']) {
    const cats = CATEGORIES.filter((c) => c.level === level && perCat[c.id].total > 0);
    if (!cats.length) continue;
    console.log(level);
    for (const c of cats) {
      const s = perCat[c.id];
      const kept = s.total - s.missing - s.waived;
      const mark = s.missing > 0 ? '✗' : s.waived > 0 ? '·' : '✓';
      let line = `  ${mark} ${c.label.padEnd(10)} ${kept}/${s.total}`;
      if (s.waived) line += `（豁免 ${s.waived}）`;
      console.log(line);
      const missing = (level === 'hard' ? hardMissing : softMissing).filter((it) => it.kind === c.id);
      for (const it of missing) {
        console.log(`      ! ${itemLine(it)}`);
      }
    }
    console.log('');
  }

  const wordMark = before > 0 && after < before * 0.6 ? '!' : '·';
  console.log(`${wordMark} words ${before} → ${after} (${displayPct(deltaPct)})`);

  if (waived.length) {
    console.log('');
    console.log('waived');
    for (const w of waived) {
      console.log(`  · ${w.kind} · ${w.value} · ${w.file} — ${w.reason}（${w.commentFile}）`);
    }
  }

  if (warnings.length) {
    console.log('');
    console.log('warnings');
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  console.log('');
  const ledger = CATEGORIES
    .filter((c) => perCat[c.id].total > 0)
    .map((c) => {
      const s = perCat[c.id];
      return `${s.total - s.missing - s.waived}/${s.total} ${c.label}`;
    });
  ledger.push(`words ${displayPct(deltaPct)}`);
  const verdict = ok
    ? `— ✓ 通过${warnings.length ? `（${warnings.length} 条警告）` : ''}`
    : `— ✗ 不通过（${hardMissing.length} 项 hard 丢失）`;
  console.log(`Baseline kept ${ledger.join(' · ')} ${verdict}`);

  process.exit(ok ? EXIT.PASS : EXIT.DRIFT);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function fail(opts, e) {
  const code = e instanceof EnvError ? EXIT.ENV : EXIT.INPUT;
  if (opts?.json) {
    console.log(JSON.stringify({
      ok: false,
      error: e instanceof EnvError ? 'environment' : 'input',
      message: e.message,
    }, null, 2));
  } else {
    console.error(`✗ ${e.message}`);
    if (e instanceof InputError) console.error(usage());
  }
  process.exit(code);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    console.error(usage());
    process.exit(EXIT.INPUT);
  }

  if (opts.help) {
    console.log(usage());
    process.exit(EXIT.PASS);
  }

  let cfg;
  try {
    cfg = buildConfig(opts);
  } catch (e) {
    fail(opts, e);
  }

  try {
    if (cfg.mode === 'record') record(cfg);
    else check(cfg);
  } catch (e) {
    fail(cfg, e);
  }
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]).toLowerCase() === path.resolve(self).toLowerCase();
})();

if (isDirectRun) {
  main();
}
