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
//
// oklch() → hex 必须自己算。两条「交给浏览器」的路都不成立：
//   · canvas fillStyle 往返：Chrome 把 oklch 原样保留，不转 rgb
//   · getComputedStyle：同样返回 oklch(...) 字符串
// 所以实现 OKLCH → 线性 sRGB → sRGB，含 CSS Color 4 的色域映射
// （保持 L 与 H，二分降低 C 直到进入色域）。

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchToLinear(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const inGamut = (rgb, eps = 1e-4) => rgb.every((v) => v >= -eps && v <= 1 + eps);

function toHex(oklchStr) {
  const m = String(oklchStr).match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return String(oklchStr).toUpperCase();
  const L = Number(m[1]), C = Number(m[2]), H = Number(m[3]);

  let rgb = oklchToLinear(L, C, H);
  if (!inGamut(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid; else hi = mid;
    }
    rgb = oklchToLinear(L, lo, H);
  }
  const to = (v) => Math.round(clamp01(linToSrgb(v)) * 255).toString(16).padStart(2, '0');
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`.toUpperCase();
}

const fmtOklch = ({ L, C, H }) => `oklch(${Number(L.toFixed(3))} ${Number(C.toFixed(3))} ${Number(H.toFixed(1))})`;
const toColor = (L, C, H) => {
  const oklch = fmtOklch({ L, C, H });
  return { oklch, hex: toHex(oklch), l: Number(L.toFixed(4)) };
};

/** 支持 #rgb / #rrggbb；无效输入交给调用方判断（这里只解析，不抛错）。 */
const hexToRgb = (hex) => {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

// === 反向色值解析（hex / rgb / hsl → OKLCH）===
//
// 正向 OKLCH → hex 已经在 toHex() 里。色值输入框需要反向：
// 用户粘贴的是 sRGB 写法，而色板内部（以及 decisions.json）用 OKLCH。
// UI 是零依赖 ESM，算法按 scripts/lib/oklch.mjs 的同一套系数在本地实现，
// 不 import scripts/（那是 Node 侧代码，不能跟着 UI 静态文件一起发）。

/** [r,g,b] 0..1 → { L, C, H }（OKLab → OKLCH，与 scripts/lib/oklch.mjs 同系数）。 */
function rgbToOklch([r, g, b]) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.hypot(a, bb);
  const H = C < 1e-6 ? 0 : (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360;
  return { L, C, H };
}

/** h 0–360, s/l 0..1 → [r,g,b] 0..1 */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg];
  return [r + m, g + m, b + m];
}

const colorError = (raw, reason) => new Error(`无法解析 \`${String(raw).trim() || '空'}\`：${reason}`);

/**
 * 解析用户输入的色值 → { L, C, H, hex }。六种写法：
 * #RGB / #RRGGBB / rgb(r g b) / rgb(r, g, b) / hsl(...) / oklch(...)。
 * 解析失败抛带具体原因的 Error —— 调用方必须显示出来，不能静默回退。
 */
function parseColorInput(raw) {
  const text = String(raw ?? '').trim();
  if (!text) throw colorError(raw, '请填入色值，例如 #F2D045');
  const lower = text.toLowerCase();

  if (text.startsWith('#')) {
    let h = text.slice(1);
    if (!/^[0-9a-f]+$/i.test(h) || (h.length !== 3 && h.length !== 6)) {
      throw colorError(raw, 'hex 需要 3 或 6 位十六进制');
    }
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const { L, C, H } = rgbToOklch(rgb);
    // hex 是精确输入：回显直接用规范化后的原字符串，避免来回转换掉最后一位
    return { L, C, H, hex: `#${h.toUpperCase()}` };
  }

  if (lower.startsWith('rgb')) {
    const m = lower.match(/^rgba?\(\s*([^)]*)\)$/);
    if (!m) throw colorError(raw, 'rgb() 需要闭合括号');
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) throw colorError(raw, 'rgb() 需要三个分量，如 rgb(242 208 69)');
    const rgb = parts.slice(0, 3).map((p) => {
      const v = parseFloat(p);
      if (!Number.isFinite(v)) throw colorError(raw, `rgb() 的分量 \`${p}\` 不是数字`);
      if (p.endsWith('%')) {
        if (v < 0 || v > 100) throw colorError(raw, 'rgb() 百分比分量需在 0–100%');
        return v / 100;
      }
      if (v < 0 || v > 255) throw colorError(raw, 'rgb() 分量需在 0–255');
      return v / 255;
    });
    const { L, C, H } = rgbToOklch(rgb);
    return { L, C, H, hex: toHex(fmtOklch({ L, C, H })) };
  }

  if (lower.startsWith('hsl')) {
    const m = lower.match(/^hsla?\(\s*([^)]*)\)$/);
    if (!m) throw colorError(raw, 'hsl() 需要闭合括号');
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) throw colorError(raw, 'hsl() 需要三个分量，如 hsl(47 90% 60%)');
    if (!parts[1].includes('%') || !parts[2].includes('%')) {
      throw colorError(raw, 'hsl() 的饱和度与明度要带 %');
    }
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    if (![h, s, l].every(Number.isFinite)) throw colorError(raw, 'hsl() 的分量必须是数字');
    if (s < 0 || s > 100 || l < 0 || l > 100) throw colorError(raw, 'hsl() 的饱和度 / 明度需在 0–100%');
    const rgb = hslToRgb(((h % 360) + 360) % 360, s / 100, l / 100);
    const { L, C, H } = rgbToOklch(rgb);
    return { L, C, H, hex: toHex(fmtOklch({ L, C, H })) };
  }

  if (lower.startsWith('oklch')) {
    const m = lower.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/);
    if (!m) throw colorError(raw, 'oklch() 形如 oklch(0.86 0.155 95)');
    const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    const C = parseFloat(m[2]);
    const H = parseFloat(m[3]);
    if (![L, C, H].every(Number.isFinite) || L < 0 || L > 1 || C < 0) {
      throw colorError(raw, 'oklch() 的 L 需在 0–1、C ≥ 0');
    }
    return { L, C, H: ((H % 360) + 360) % 360, hex: toHex(fmtOklch({ L, C, H })) };
  }

  throw colorError(raw, '支持 #hex、rgb()、hsl()、oklch() 四种写法');
}

function contrastOf(hexA, hexB) {
  const [a, b] = [luminance(hexToRgb(hexA)), luminance(hexToRgb(hexB))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const fmtRatio = (v) => `${v.toFixed(2)}:1`;

// === state ===
// 七维转写表：key / 中文名 / 默认取值 / 默认依据（null = 无方向依据，按规则取默认）/ 人话提示。
// 提示分两半：「控制什么」+「从什么话推导出来」。
// 后半句是必需的 —— 用户看不懂的往往不是维度本身，而是「我该拿哪句话来填依据」。
const DIM_KEYS = [
  ['neutralTemp', '中性色温度', 'H 250, C 0.002', '像瑞士铁路时刻表',
    '所有灰阶偏冷还是偏暖。写成「色相 + 彩度」，H 250 偏冷、H 85 偏暖；C 越接近 0 越中性。'
    + '从什么话推导：说「冷」「像德国铁路」→ H 250；说「暖」「像纸张」→ H 85。'],
  ['chromaCap', '彩度上限', 0.12, '不要糖水感',
    '整套界面允许的最高饱和度（0–0.4）。主色与强调色都不会超过它；越大越鲜艳。'
    + '从什么话推导：说「不要糖水感」「克制」→ 0.12；说「鲜明」「有活力」→ 0.20 以上。'],
  ['radius', '圆角', [0, 2, 4, 999], '工业感',
    '四档圆角半径，按「小 / 中 / 大 / 胶囊」顺序写 px，如 0 / 2 / 4 / 999。'
    + '从什么话推导：说「工业感」「锐利」→ 0；说「亲和」→ 8 以上。'],
  ['border', '边框', '1px / fg 8%', '像图纸',
    '边框线宽 + 颜色不透明度，如 1px / fg 8%；写 0 表示不用边框。'
    + '从什么话推导：说「像图纸」「边界清晰」→ 1px 实线；说「轻」「无框」→ 0。'],
  ['shadow', '阴影', '仅浮层一层', null,
    '浮层（菜单、弹层、卡片）用几层什么样的阴影；写「无」或 null 表示不投影。'
    + '从什么话推导：说「浮层」→ 一层；说「扁平」→ 无。'],
  ['weight', '字重', [400, 500, 600], '不要大字报',
    '正文 / 强调 / 标题三档字重，按顺序写数字，如 400 / 500 / 600。'
    + '从什么话推导：说「不要大字报」→ 400/500/600；说「有力量」→ 600/700/800。'],
  ['motion', '动效', '120-180ms ease-out', null,
    '快 / 基础两档时长与曲线，如 120-180ms ease-out；曲线写在最后。'
    + '从什么话推导：说「快」→ 120ms；说「从容」→ 300ms 以上。'],
];

// 项目的「当前方向」与这里的示例值是两回事：
// 没有 decisions.json 时面板会显示示例方向，但必须标明「尚未定稿」，
// 不能把写死的示例伪装成用户的需求。
const DEFAULT_DIRECTION = {
  director: 'self', mode: 'Operate', keywords: ['克制', '工业', '清晰'],
  references: ['瑞士铁路时刻表', '像 Braun 但更轻'], anti: ['糖水渐变'],
};

const state = {
  mode: 'palette', view: 'desktop', content: 'home',
  // 两个「主题」是两件事，不要合并：
  //   themeMode —— 项目主题意图，决定哪几套颜色会被写进 decisions.json；
  //   theme     —— 此刻预览的是哪一套颜色。
  // themeMode 默认 'light'：一个还没有 decisions.json 的新项目，
  // Studio 不替用户决定「要做暗色」；只有用户显式选「浅 + 深」才写 dark。
  // 注意这里只支持 light / light-dark 两种可写模式：schema 的 color 段
  // required: ["light"]，单主题深色写出来是非法 decisions（见 applyRemoteDecisions）。
  themeMode: 'light',
  theme: 'light',
  accentHue: 250, accentChroma: 0.12, neutral: 0,
  // 明度覆盖：null = 跟随项目 accent 的 L；数字 = 用户手动指定
  accentLight: null,
  // 画廊里选了风格后，配色基线换成该变体自己的 token（见 colorSet）
  variantPicked: false, variantColor: null, variantColorCache: null, loadedFrameVariant: null,
  neutralPinned: null,
  translation: Object.fromEntries(DIM_KEYS.map(([k, , value, from]) => [k, { value, from }])),
  weights: { light: { body: 400, strong: 600, display: 700 }, dark: { body: 350, strong: 500, display: 600 } },
  direction: structuredClone(DEFAULT_DIRECTION),
  directionFromProject: false,
  weightLadder: { family: 'system-ui', available: [300, 400, 500, 600, 700] },
  overrides: [], artifacts: { committed: false, tokens: false, injected: false }, fixture: 'unknown',
};

const STEP = [0.010, 0.015, 0.017];
const VIEWS = { desktop: [1440, 900], tablet: [834, 1000], mobile: [390, 844] };
const FIXTURE_ROUTE = { home: 'dashboard', settings: 'settings', form: 'form', ai: 'ai' };
const neutralHue = () => ((250 + (85 - 250) * (state.neutral / 100)) + 360) % 360;
/**
 * 从画廊选来的变体，它的中性色相可能落在滑块量程之外（材料设计 H 45、
 * 像素风 H 95）。此时以变体原值为准；用户一动中性温度滑块就解钉，
 * 回到滑块自己的 0–100 映射，保证「拖了就有反馈」。
 */
const effectiveNeutralHue = () => (state.neutralPinned ?? neutralHue());
/** 标签按实际色相判断，而不是滑块位置：钉住变体色相时滑块位置已不代表温度。 */
const neutralLabel = () => {
  const h = effectiveNeutralHue();
  if (Math.abs(h - 250) <= 20) return '冷';
  if (Math.abs(h - 85) <= 25) return '暖';
  return '近中性';
};

/** 表面阶梯只动 L；色相与彩度锁死在基色上（R2）。暗色往更亮的方向走。 */
const OKLCH_PARTS = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/;
const parseParts = (e) => {
  const m = String(e?.oklch || '').match(OKLCH_PARTS);
  return m ? { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) } : null;
};

/**
 * 中性色系：只有这一组 token 受「中性温度」滑块影响。
 * 状态色（danger / success / warning）不在名单里 —— 它们的语义是「红=危险」，
 * 跟着中性温度漂移会让警示色变成别的颜色。
 */
const NEUTRAL_TOKENS = new Set([
  'bg', 'surface-1', 'surface-2', 'surface-3', 'surface-sunken',
  'fg', 'fg-muted', 'line-1', 'line-2', 'line-inset',
]);

/**
 * token 列表的语义分组（渲染顺序即此顺序）。
 *
 * 分组不是「按颜色相似度」—— 那只是色阶内部的排列逻辑（Radix Colors 的
 * 1–12 级就是同一条色相的 12 个用途）。这里一个项目横跨背景、文字、描边、
 * 状态色，读者要按「这一项是干什么的」找，不是按「它长什么样」找。
 * 状态色单独成组并标注「不随滑块变化」：它们是语义色，跟中性温度走会变味。
 */
const TOKEN_GROUPS = [
  { id: 'bg', title: '页面底', names: ['bg'] },
  { id: 'surface', title: '表面', note: 'ΔL 阶梯', names: ['surface-1', 'surface-2', 'surface-3', 'surface-sunken'] },
  { id: 'text', title: '文字', names: ['fg', 'fg-muted'] },
  { id: 'accent', title: '强调', names: ['accent', 'accent-hover'] },
  { id: 'line', title: '描边', names: ['line-1', 'line-2', 'line-inset'] },
  { id: 'status', title: '状态色', note: '不随滑块变化', static: true, names: ['danger', 'danger-hover', 'success', 'warning'] },
];

/**
 * accent 的 L：手动改过就用覆盖值；否则跟着「当前基线」的 accent。
 * 基线是项目 decisions（有的话），刚在画廊选了新变体时则换成变体自己的 token ——
 * 否则选了新粗野主义，L 还是项目极简风格的 0.52，黄色会被拉暗成土黄。
 */
function accentLight(theme) {
  if (state.accentLight !== null) return state.accentLight;
  const base = (state.variantPicked && state.variantColor?.[theme]) || state.remoteColor?.[theme];
  const L = parseParts(base?.accent)?.L;
  if (Number.isFinite(L)) return L;
  return theme === 'dark' ? 0.72 : 0.52;
}

/**
 * 当前主题的色板。
 *
 * 关键：**以项目里真实的 token 为基准**，调色控件只在此基础上改主色与中性温度。
 * 早先这里从硬编码公式现算一整套，结果面板显示的是「Studio 觉得应该长什么样」，
 * 而不是 decisions.json 里写了什么 —— 项目自定义的状态色、表面阶梯全丢了。
 */
function colorSet(theme) {
  // 项目没有这个主题就直接返回空集，不要走兜底公式假装它存在。
  // 例外：
  //   · 刚在画廊换了变体时以变体 token 为基线，变体自带明暗两套；
  //   · 用户已经把项目主题意图设成「浅 + 深」（themeMode），但 decisions 里
  //     还没有 dark 段 —— 此时 dark 是「即将写入」的一套，必须能按兜底公式生成。
  //     否则从单主题切到浅+深时 dark 是 {}，写出的 decisions 非法。
  // light 永远可算：schema 要求 color.light 必填，面板的阶梯 / 校验也都以它为主。
  const intended = theme === 'light' || (theme === 'dark' && state.themeMode === 'light-dark');
  const variantBase = state.variantPicked ? state.variantColor?.[theme] : null;
  if (!variantBase && state.remoteColor && !state.remoteColor[theme] && !intended) return {};
  const remote = state.remoteColor?.[theme];
  // 变体里有些 token 是 color-mix（如 line-inset），读不出 oklch 的项保留项目值。
  const base = variantBase ? { ...(remote || {}), ...variantBase } : remote;
  if (base && Object.keys(base).length) {
    const out = {};
    for (const [name, entry] of Object.entries(base)) {
      const p = parseParts(entry);
      if (!p) continue;
      if (name === 'accent') {
        // 主色跟随色相 / 饱和度 / 明度三个滑块
        out[name] = toColor(accentLight(theme), effectiveChroma(), state.accentHue);
      } else if (name === 'accent-hover') {
        // hover 与主色同色相，只压一点明度，保持「同一个色的深浅」关系
        out[name] = toColor(Math.max(0.05, accentLight(theme) - 0.045), effectiveChroma(), state.accentHue);
      } else if (NEUTRAL_TOKENS.has(name)) {
        // 中性色系保留基线的 L 与 C（表面阶梯不能被滑块破坏），只换色相。
        // 早先这里原样保留项目色相，导致中性温度滑块只在「没有项目数据」时才有效。
        out[name] = toColor(p.L, p.C, effectiveNeutralHue());
      } else {
        // 状态色与其余 token：基线原值。danger/success/warning 不该被中性温度影响。
        out[name] = toColor(p.L, p.C, p.H);
      }
    }
    // 基线可能没有 accent-hover（变体缺项）：补一条同色相、压暗的
    if (out.accent && !out['accent-hover']) {
      out['accent-hover'] = toColor(Math.max(0, accentLight(theme) - 0.045), effectiveChroma(), state.accentHue);
    }
    return out;
  }

  // 没有项目数据时的兜底（首次使用、或 decisions.json 还没有 color 段）
  const H = effectiveNeutralHue();
  const dark = theme === 'dark';
  const bgL = dark ? 0.180 : 0.985;
  const steps = dark ? [0.022, 0.046, 0.072] : [0.010, 0.025, 0.042];
  const surf = (i) => toColor(bgL - steps[i], 0.002, H);
  return {
    bg: toColor(bgL, 0.002, H),
    'surface-1': surf(0), 'surface-2': surf(1), 'surface-3': surf(2),
    'surface-sunken': toColor(bgL - steps[1], 0.003, H),
    fg: toColor(dark ? 0.940 : 0.2174, dark ? 0.002 : 0.0019, dark ? H : 106.6),
    'fg-muted': toColor(dark ? 0.720 : 0.520, 0.004, H),
    accent: toColor(accentLight(theme), effectiveChroma(), state.accentHue),
    'accent-hover': toColor(Math.max(0.05, accentLight(theme) - 0.045), effectiveChroma(), state.accentHue),
    'line-1': toColor(dark ? 0.300 : 0.900, 0.002, H),
    'line-2': toColor(dark ? 0.380 : 0.860, 0.002, H),
    'line-inset': toColor(dark ? 0.268 : 0.918, 0.002, H),
  };
}

/** 从 "0 / 2 / 4 / 999"、"120-180ms ease-out" 里取数值序列。 */
const numbersOf = (value) => (Array.isArray(value)
  ? value.filter((v) => typeof v === 'number')
  : (String(value).match(/\d+(?:\.\d+)?/g) || []).map(Number));

/**
 * 阴影档位：无 / 仅浮层 / 卡片+浮层 / 硬偏移。
 *
 * 旧解析只有「有无」两态（含「无」就是 none，其余一律单层软阴影），
 * 参数行换成四段控件后需要四态往返。未识别的旧文案（如 "仅浮层"）
 * 仍归到「仅浮层」，保持 decisions.json 的历史值可读。
 */
function shadowModeOf(value) {
  const raw = String(value ?? '').trim();
  if (/硬/.test(raw)) return 'hard';
  if (/卡片|双层/.test(raw)) return 'stack';
  if (!raw || raw === 'null' || raw === 'undefined' || raw.includes('无')) return 'none';
  return 'layer';
}

/** 四个阴影档位 → CSS 值。primary 是样本里最该被看见的那一层。 */
function shadowSetFor(mode) {
  const soft = '0 1px 2px -1px rgb(0 0 0 / .10), 0 2px 6px -2px rgb(0 0 0 / .08)';
  const raised = '0 4px 12px -4px rgb(0 0 0 / .12), 0 12px 32px -12px rgb(0 0 0 / .16)';
  // 硬偏移在暗底上用黑色等于看不见，暗色换成带 alpha 的白（R3 允许阴影带 alpha）。
  const hard = state.theme === 'dark'
    ? '4px 4px 0 rgb(255 255 255 / .34)'
    : '4px 4px 0 rgb(0 0 0 / .28)';
  return {
    none: { 1: 'none', 2: 'none', primary: 'none' },
    layer: { 1: soft, 2: soft, primary: soft },
    stack: { 1: soft, 2: raised, primary: raised },
    hard: { 1: hard, 2: hard, primary: hard },
  }[mode];
}

/**
 * 七项设计参数的「解析后数值」。
 *
 * 为什么单独抽出来：样本、主预览内联、滑块说明都读同一份解析结果。
 * 早先 translationCss() 只被写入 tokens，预览拿不到 —— 用户把圆角从 0 改成 12，
 * 主预览纹丝不动，参数表看起来像摆设。
 */
function designParams() {
  const r = [0, 2, 4, 999];
  numbersOf(state.translation.radius?.value).slice(0, 4).forEach((v, i) => { r[i] = v; });
  const motion = numbersOf(state.translation.motion?.value);
  const fast = motion[0] || 120;
  const base = motion[motion.length - 1] || Math.max(fast, 180);
  // 动效曲线：从 "120-180ms ease-out" 里取曲线词；缺省用 ease-out。
  // 顺序必须长的在前：\b 在 "ease-in-out" 的 n 与 - 之间成立，
  // 先写 ease-in 会把它截成 "ease-in"，往返后曲线被悄悄换掉。
  const motionRaw = String(state.translation.motion?.value ?? '');
  const easeName = (motionRaw.match(/\b(linear|ease-in-out|ease-in|ease-out|ease)\b/) || [])[1] || 'ease-out';
  const easings = {
    linear: 'linear', ease: 'ease', 'ease-in': 'ease-in',
    'ease-out': 'cubic-bezier(.2,.7,.2,1)', 'ease-in-out': 'ease-in-out',
  };
  const shadowMode = shadowModeOf(state.translation.shadow?.value);
  const shadowSet = shadowSetFor(shadowMode);
  const shadowOn = shadowMode !== 'none';
  const shadow = shadowSet.primary;
  const shadow1 = shadowSet[1];
  const shadow2 = shadowSet[2];
  // 字重：转写表是「设计意图」，state.weights 是实际 token。
  // 两者都可能被修改；以转写表为准同步到 weights（见 setTranslationValue）。
  const w = state.translation.weight?.value;
  const wArr = Array.isArray(w) ? w : numbersOf(w);
  const weights = {
    body: Number(wArr[0]) || state.weights[state.theme]?.body || 400,
    strong: Number(wArr[1]) || state.weights[state.theme]?.strong || 600,
    display: Number(wArr[2]) || state.weights[state.theme]?.display || 700,
  };
  // 边框：'1px / fg 8%' → 宽度与不透明度
  const borderRaw = String(state.translation.border?.value ?? '');
  const borderNums = numbersOf(borderRaw);
  const borderW = borderNums.length ? borderNums[0] : 1;
  const borderAlpha = borderNums.length > 1 ? borderNums[1] : 8;
  // 彩度上限：转写表写数字，缺省沿用滑块量程上沿的常用值
  const chromaCap = numbersOf(state.translation.chromaCap?.value)[0] ?? 0.12;
  return { r, fast, base, ease: easings[easeName], easeName, shadow, shadow1, shadow2,
    shadowMode, shadowOn, weights, borderW, borderAlpha, chromaCap };
}

/** 圆角 / 阴影 / 动效 / 边框宽度 → CSS 变量。 */
function translationCss() {
  const p = designParams();
  return {
    // 四档按转写表声明的顺序「小 / 中 / 大 / 胶囊」一一对应。
    // 早先这里把 r[0] 整个丢掉、从 r[1] 起读，用户填的小圆角永远不生效，
    // 且「0 / 2 / 4 / 999」在预览里表现为 2 / 4 / 4 —— 四个数只落了两个半。
    '--r-sm': `${p.r[0]}px`, '--r-md': `${p.r[1]}px`, '--r-lg': `${p.r[2]}px`, '--r-full': `${p.r[3]}px`,
    '--shadow-1': p.shadow1, '--shadow-2': p.shadow2,
    '--dur-fast': `${p.fast}ms`, '--dur-base': `${p.base}ms`, '--dur-slow': `${Math.max(p.base, 320)}ms`,
    '--ease-out': p.ease,
    '--border-w': `${p.borderW}px`,
    '--border-w-strong': `${Math.max(p.borderW, 2)}px`,
  };
}

/**
 * 字重三档：按主题取值（暗色下 R5 要求降一档）。
 * state.weights 是实际 token，转写表里的 weight 只是设计意图 ——
 * 编辑参数行时两者同步（见 setTranslationValue），预览读 state.weights。
 */
function weightCss(theme = state.theme) {
  const w = state.weights?.[theme] || state.weights?.light || { body: 400, strong: 600, display: 700 };
  return { '--fw-body': String(w.body), '--fw-strong': String(w.strong), '--fw-display': String(w.display) };
}

/** 只含颜色变量：调色滑块唯一有资格覆盖的东西。 */
function colorCssVars(theme) {
  const c = colorSet(theme);
  const onAccent = theme === 'dark' ? '#0D1B26' : '#FFFFFF';
  const vars = {};
  // 项目 / 变体可能只给了一部分 token：示例项目的 dark 段就没有 line-2 与
  // surface-sunken。缺项不要硬读 .oklch —— 那会在切到暗色预览时抛
  // TypeError，整个面板停在半渲染状态。缺的变量不写，让夹具 tokens.css
  // 自己的定义（line-2 / line-inset 有 color-mix 兜底）生效。
  const put = (key, entry) => { if (entry?.oklch) vars[key] = entry.oklch; };
  put('--bg', c.bg);
  put('--surface-1', c['surface-1']); put('--surface-2', c['surface-2']);
  put('--surface-3', c['surface-3']); put('--surface-sunken', c['surface-sunken']);
  put('--fg', c.fg); put('--fg-muted', c['fg-muted']);
  put('--accent', c.accent);
  put('--accent-hover', c['accent-hover'] || c.accent);
  if (c.accent?.oklch) vars['--accent-soft'] = `color-mix(in oklab, ${c.accent.oklch} 12%, transparent)`;
  vars['--on-accent'] = onAccent;
  vars['--accent-fg'] = onAccent;
  put('--line-1', c['line-1']); put('--line-2', c['line-2']); put('--line-inset', c['line-inset']);
  if (c['line-1']?.oklch) vars['--line-hair'] = `1px solid ${c['line-1'].oklch}`;
  return vars;
}

/**
 * 夹具 base.css 消费的全部变量（见 assets/studio/fixture/tokens.css）。
 *
 * 结构 token（圆角 / 阴影 / 动效 / 字重 / 边框）也内联到预览：
 * 它们在参数表里被用户直接编辑，必须立刻生效，否则「调整了没有显示」。
 * 变体里写死字面量的签名规则（不引用变量的那部分）不受影响 —— 见 applyVars()。
 */
function cssVars(theme) {
  return {
    ...colorCssVars(theme),
    ...translationCss(),
    ...weightCss(theme),
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
  // 无内容的提示条不该留一个关闭键（[hidden] 由 studio.css 的全局守卫兜底）。
  const close = $('#status-close');
  if (close) close.hidden = !message;
  clearTimeout(statusTimer);
  if (ms > 0) statusTimer = setTimeout(() => { box.hidden = true; }, ms);
}

// === 转写表 ===
//
// 早先这里有一个 parseValue()：把用户手写的 "0 / 2 / 4 / 999" 解析成数组。
// 七项改成控件驱动后没有任何调用方 —— 序列化在控件层完成，
// 解析只剩 designParams() 里读回已有 decisions.json 的那一份。

/**
 * 「当前方向」条（压缩成一行）。
 *
 * 早先每行参数都有「来自哪句话」，但界面上根本不显示那句话 ——
 * 用户看到的是一列他从未说过的引用（项目没走 Phase 1 时全是示例值）。
 * 现在来源只留在 decisions.json 的 translation[key].from 里，
 * 界面上只保留「来自你的描述 / 默认值」这个只读标签。
 * 方向本身退成一行背景信息：关键词 3 个 + 示例小标签。
 */
function renderDirection() {
  const host = $('#direction-bar');
  if (!host) return;
  const d = state.direction || {};
  const keywords = (Array.isArray(d.keywords) ? d.keywords : []).filter(Boolean).slice(0, 3);

  host.textContent = '';
  host.classList.add('is-compact');
  host.append(
    el('span', { class: 'dir-label', text: '方向' }),
    el('span', { class: 'dir-chips' },
      ...keywords.map((t) => el('span', { class: 'dir-chip kw', text: String(t) }))),
    state.directionFromProject
      ? el('span', { class: 'dir-badge ok', text: '来自 decisions.json' })
      : el('span', { class: 'dir-badge warn', text: '示例方向 · 尚未定稿' }));
  host.setAttribute('aria-label',
    `当前方向：${keywords.join('、') || '未定'}${state.directionFromProject ? '' : '（示例，尚未定稿）'}`);
}

/**
 * 每项参数的「影响哪些 token / 控件」小字与样本画法。
 *
 * 样本是这次重做的核心：用户不靠文字理解数值，靠看。
 * 每个样本都用当前真实值渲染，改数值立刻变（见 renderParamsSpecimens）。
 */
const PARAM_META = {
  neutralTemp: {
    influence: '影响 bg / surface-1..3 / fg / line-1..2 的色相',
    specimen: 'heat',
  },
  chromaCap: {
    influence: '影响 accent 的 C 上限（滑块与色盘彩度不会超过它）',
    specimen: 'chroma',
  },
  radius: {
    influence: '影响 --r-sm / --r-md / --r-lg，按钮、卡片、输入框都读它',
    specimen: 'radius',
  },
  border: {
    influence: '影响 --border-w / --border-w-strong（边框宽度）',
    specimen: 'border',
  },
  shadow: {
    influence: '影响 --shadow-1 / --shadow-2（卡片与按钮投影）',
    specimen: 'shadow',
  },
  weight: {
    influence: '影响 --fw-body / --fw-strong / --fw-display（正文、强调、标题）',
    specimen: 'weight',
  },
  motion: {
    influence: '影响 --dur-fast / --dur-base / --ease-out（全站过渡）',
    specimen: 'motion',
  },
};

/** 当前主题下的字重三档（与 weightCss 同源，样本用它渲染）。 */
const specimenWeights = () => weightCss(state.theme);

/** 样本区域：每行右侧一小块，用真实值画。 */
function specimenFor(key) {
  const p = designParams();
  const kind = PARAM_META[key]?.specimen;
  switch (kind) {
    case 'heat': {
      // 5 格灰阶：从页面底到正文色，套用当前中性色相
      const set = colorSet(state.theme);
      const lo = set?.bg || toColor(0.97, 0.002, effectiveNeutralHue());
      const hi = set?.fg || toColor(0.22, 0.002, effectiveNeutralHue());
      // 用真实的中性色 C，而不是写死 0.004：色相从 250 拖到 85 时，
      // 低彩度灰阶在 5 个色块里几乎看不出差别，样本也就无法回答
      // 「我现在选的是冷还是暖」。C 抬到 0.02 仍属灰，但方向一眼可辨。
      const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const L = lo.l + (hi.l - lo.l) * t;
        return toHex(fmtOklch({ L, C: 0.02, H: effectiveNeutralHue() }));
      });
      return el('div', { class: 'spec-heat' }, ...stops.map((hex) => el('i', { style: { background: hex } })));
    }
    case 'chroma': {
      const hues = [25, 95, 165, 250, 320];
      return el('div', { class: 'spec-chroma' },
        ...hues.map((h) => el('i', { style: { background: toHex(fmtOklch({ L: 0.62, C: p.chromaCap, H: h })) } })));
    }
    case 'radius': {
      // 四档都画：sm / md / lg / full。只画三档会让「胶囊」预设
      // （4 / 8 / 12 / 999）与「圆润」在三格样本里只差一档，看不出选中了什么。
      // 999 会撑成圆形——这正是胶囊档应有的样子。
      return el('div', { class: 'spec-radius' },
        ...p.r.map((radius) =>
          el('i', { style: { borderRadius: `${radius}px` }, title: `${radius}px` })));
    }
    case 'border': {
      // 8% 透明度的边框放在同色底上等于看不见 —— 样本要能读出「这条线有多粗」。
      // 所以样本底色用面板色、边框色用当前中性色相但把不透明度抬到可见范围
      // （真实值仍写在小字里）。这不是美化：边框的作用是分隔两个面，
      // 单独画在白底上本来就脱离了它的使用场景。
      // 边缘色跟随主题：暗色面板上用 L 0.30 的灰等于看不见，
      // 样本必须能读出「这条线有多粗」，所以暗色换到 L 0.72。
      const edge = toColor(state.theme === 'dark' ? 0.72 : 0.30, 0.002, effectiveNeutralHue()).oklch;
      // 1px 在屏幕上只有 1 个设备像素；样本里按比例放大到至少 2px，
      // 让「改 1 → 3px」的差别肉眼可比，同时保持相对关系。
      // 宽 0 就是真的没有边框 —— 样本也必须承认这一点，否则「无边框」档
      // 的样本还画着一条线，控件与画面互相打脸。
      const shownW = p.borderW <= 0 ? 0 : Math.max(2, p.borderW * 2);
      return el('div', {
        class: 'spec-border',
        style: {
          borderWidth: `${shownW}px`,
          borderStyle: shownW ? 'solid' : 'none',
          borderColor: shownW
            ? `color-mix(in oklab, ${edge} ${Math.max(18, p.borderAlpha)}%, transparent)` : 'transparent',
        },
      });
    }
    case 'shadow': {
      return el('div', { class: 'spec-shadow' },
        el('i', { style: { boxShadow: p.shadow } }));
    }
    case 'weight': {
      const w = specimenWeights();
      return el('div', { class: 'spec-weight' },
        el('span', { style: { fontWeight: w['--fw-body'] }, text: '正文 Aa' }),
        el('span', { style: { fontWeight: w['--fw-strong'] }, text: '强调 Aa' }),
        el('span', { style: { fontWeight: w['--fw-display'] }, text: '标题 Aa' }));
    }
    case 'motion': {
      const dot = el('i', { class: 'motion-dot' });
      const track = el('span', { class: 'motion-track' }, dot);
      const play = () => {
        // 用当前真实时长与曲线跑一遍：改数值后下一次点击立刻体现
        dot.style.transition = `left ${p.base}ms ${p.ease}`;
        dot.classList.toggle('is-on');
      };
      track.addEventListener('click', play);
      track.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
      });
      track.tabIndex = 0;
      track.setAttribute('role', 'button');
      track.setAttribute('aria-label', `播放动效样本：${p.base}ms ${p.easeName}`);
      return el('div', { class: 'spec-motion' }, track,
        el('span', { class: 'motion-meta', text: `${p.fast}–${p.base}ms` }));
    }
    default:
      return el('div', {});
  }
}

/** 只刷新样本，不重建输入框（否则拖动滑块时输入框会丢焦点）。 */
function renderParamsSpecimens() {
  for (const host of $$('.param-specimen[data-key]')) {
    host.textContent = '';
    const node = specimenFor(host.dataset.key);
    // 动效样本里含可聚焦元素，不能整体 aria-hidden
    if (host.dataset.key !== 'motion') node.setAttribute('aria-hidden', 'true');
    host.append(node);
  }
  // 缩略条与样本同源：同一个 specimenFor，只是外面套一层 28px 的框。
  // 缩略条是按钮、真正的标签是按钮自身的 aria-label，样本本身不再进无障碍树。
  for (const item of $$('.strip-item[data-key]')) {
    const slot = $('.strip-slot', item);
    if (!slot) continue;
    slot.textContent = '';
    const node = specimenFor(item.dataset.key);
    node.setAttribute('aria-hidden', 'true');
    // 缩略图里不保留动效样本的播放按钮：28px 内无法操作，且外层按钮已经能打开编辑
    node.querySelectorAll('[tabindex], [role="button"]').forEach((n) => {
      n.removeAttribute('tabindex'); n.removeAttribute('role'); n.removeAttribute('aria-label');
    });
    slot.append(node);
    const tip = $('.strip-tip', item);
    if (tip) tip.textContent = paramShortValue(item.dataset.key);
    // tooltip 只是视觉提示；读屏用户靠按钮自身的 aria-label，所以它也必须跟着值走。
    const label = DIM_KEYS.find(([key]) => key === item.dataset.key)?.[1] || item.dataset.key;
    item.setAttribute('aria-label', `${label}：${paramShortValue(item.dataset.key)}。点击展开编辑`);
  }
}

/** 缩略条 tooltip 里显示的简短值。 */
function paramShortValue(key) {
  const p = designParams();
  switch (key) {
    case 'neutralTemp': return `H ${Math.round(effectiveNeutralHue())} · ${neutralLabel()}`;
    case 'chromaCap': return `C ≤ ${Number(p.chromaCap).toFixed(2)}`;
    case 'radius': return `${p.r[0]} / ${p.r[1]} / ${p.r[2]}px`;
    case 'border': return `${p.borderW}px / ${p.borderAlpha}%`;
    case 'shadow': return SHADOW_MODES.find((m) => m.id === p.shadowMode)?.label || '无';
    case 'weight': {
      const w = specimenWeights();
      return `${w['--fw-body']} / ${w['--fw-strong']} / ${w['--fw-display']}`;
    }
    case 'motion': return `${p.fast}–${p.base}ms`;
    default: return '';
  }
}

/**
 * 参数行编辑后把值同步到实际生效的 state。
 *
 * translation 是「设计意图的记录」，state.weights 才是预览与 tokens 读的东西；
 * 只改前者会出现「参数表显示 300，预览正文还是 400」。
 * 中性温度与彩度上限本来就走 state.neutral / state.accentChroma，这里负责
 * 从文本值反推。
 */
function setTranslationValue(key, value) {
  state.translation[key].value = value;
  const p = designParams();
  if (key === 'weight' && Array.isArray(value)) {
    const [body, strong, display] = value;
    state.weights.light = { ...state.weights.light, body, strong, display };
    // 暗色只在项目真的做暗色时才推导。单主题项目里推导出来的 weights.dark
    // 不会被写入，但会随「切回浅 + 深」一起过期 —— 那时由 deriveDarkWeights()
    // 从当前浅色重新降档，而不是沿用这段历史值。
    if (hasDarkTheme()) {
      // 暗色「降一档」必须在可用阶梯上找严格更低的一档（R5 + 静态字重校验）：
      // 硬减 50 会造出 350 / 550 / 650 这类字体里不存在的值，
      // check-tokens 会报「不在 weightLadder.available 里」。
      state.weights.dark = deriveDarkWeights(state.weights.light);
    }
  }
  if (key === 'neutralTemp') {
    // "H 250, C 0.002" → 钉住色相；用户显式写在参数表里，视为手动指定
    const h = numbersOf(value)[0];
    if (Number.isFinite(h)) {
      state.neutralPinned = ((h % 360) + 360) % 360;
      state.neutral = Math.round(Math.min(100, Math.max(0, (250 - state.neutralPinned) / 165 * 100)));
      $('#neutral-temp').value = String(state.neutral);
    }
  }
  if (key === 'chromaCap') {
    // 上限压住当前主色：控件边界与主色都立刻收进来，避免「读数说 0.1、颜色还是 0.2」。
    const cap = numbersOf(value)[0];
    if (Number.isFinite(cap)) state.accentChroma = Math.min(state.accentChroma, Math.max(0, cap));
  }
  void p;
}

// --- 七项参数的控件模型 ---
//
// 用户不该背诵序列化格式。每一维只提供「选择 / 拖动」，序列化在下面这层完成，
// 写回 decisions.json 的仍是 build.mjs / check-tokens.mjs 认识的老格式。
// 每档预设只声明用户能理解的部分；`full` 恒为 999（头像、徽章、开关的胶囊）。
const RADIUS_PRESETS = [
  { id: 'sharp', label: '锐利', values: [0, 2, 4, 999] },
  { id: 'restrained', label: '克制', values: [2, 4, 8, 999] },
  { id: 'round', label: '圆润', values: [4, 8, 12, 999] },
  { id: 'pill', label: '胶囊', values: [8, 12, 999, 999] },
];
const BORDER_MODES = [
  { id: 'none', label: '无边框', w: 0 },
  { id: 'hair', label: '细线', w: 1 },
  { id: 'strong', label: '强调线', w: 2 },
];
const SHADOW_MODES = [
  { id: 'none', label: '无', value: '无' },
  { id: 'layer', label: '仅浮层', value: '仅浮层一层' },
  { id: 'stack', label: '卡片+浮层', value: '卡片 + 浮层双层' },
  { id: 'hard', label: '硬偏移', value: '硬偏移' },
];
const MOTION_PRESETS = [
  { id: 'crisp', label: '利落', fast: 80, base: 140 },
  { id: 'standard', label: '标准', fast: 120, base: 180 },
  { id: 'calm', label: '从容', fast: 200, base: 300 },
];
const MOTION_EASES = ['ease-out', 'ease-in-out', 'linear'];

const sameNums = (a, b) => a.length === b.length && a.every((v, i) => Number(v) === Number(b[i]));

/** 中性色温度序列化时保留原有的 C（用户看不到也不该改它）。 */
function neutralC() {
  const nums = numbersOf(state.translation.neutralTemp?.value);
  return nums.length > 1 ? nums[1] : 0.002;
}

/** 可用字重（升序整数）。weightLadder 可能来自项目，缺省回落到默认阶梯。 */
function availableWeights() {
  const list = (state.weightLadder?.available || []).filter((v) => Number.isFinite(v));
  const sorted = [...new Set(list)].sort((a, b) => a - b);
  return sorted.length ? sorted : [300, 400, 500, 600, 700];
}

/**
 * 项目是否做暗色主题。
 *
 * 判据是用户的显式意图 state.themeMode，不是「remoteColor 里有没有 dark」——
 * 旧 decisions.json 里躺着一整套 dark 不代表这一期还做暗色；用户把它改成
 * 单主题后，remoteColor 在内存里仍带着旧 dark（还没重新载入），
 * 读 remoteColor 会让字重下限、对比度行又按「有暗色」来算。
 *
 * 它同时决定字重下限：R5 要求暗色字重严格低于浅色，而正文护栏是 300 ——
 * 浅色正文一旦取 300，暗色就没有「更低且合法」的值可写。所以有暗色时
 * 正文的下限抬到 400（references/translation.md 的同一句：
 * 「浅色 body 最低取 400 才留得住降档空间」）。
 */
const hasDarkTheme = () => state.themeMode === 'light-dark';

/** 正文下拉的最小合法值：无暗色可到 300，有暗色必须留出降档空间。 */
function weightFloorBody() {
  const avail = availableWeights();
  if (!hasDarkTheme()) return avail[0];
  // 有暗色时，正文必须是「阶梯上还有更小一档」的最小值，
  // 否则暗色降档无处可去（R5 要求严格更低，body 护栏又是 300）。
  // 阶梯为 300/400/500/600/700 时结果是 400 —— 不写死 400，
  // 项目换成 200–900 的可变阶梯（variable: true）也能算出正确下限。
  const candidates = avail.filter((a) => a >= 300 && avail.some((b) => b < a));
  return candidates.length ? candidates[0] : avail[avail.length - 1];
}

/** 在可用阶梯上取「严格低于 v 的最大一档」；没有就返回 null。 */
function stepDown(v) {
  const below = availableWeights().filter((a) => a < Number(v));
  return below.length ? below[below.length - 1] : null;
}

/**
 * 浅色三档 → 暗色三档（各降一档，R5）。
 *
 * 抽成函数是因为有两条触发路径：用户改字重、以及用户从「单主题」切到
 * 「浅 + 深」。两条路径必须产出同一结果，否则会写出一份和浅色不匹配的
 * dark（例如浅色是 300、暗色还是旧项目留下的 350 —— 不是「严格更低」就被
 * check-tokens 判 R5 失败）。
 */
function deriveDarkWeights(light) {
  const prev = state.weights.dark || {};
  const down = (v, fallback) => stepDown(v) ?? Math.min(Number(v), Math.max(300, fallback ?? 300));
  const out = {
    ...prev,
    body: down(light?.body, prev.body),
    strong: down(light?.strong, prev.strong),
    display: down(light?.display, prev.display),
  };
  // 小字两档不参与降档，必须与浅色同值。项目显式声明过就跟着浅色走，
  // 没声明就不凭空写 —— 但若暗色那边历史上有，就保留（否则 check-tokens
  // 会判 weights.dark.small 缺失，与切换前相比是一处退步）。
  for (const key of ['small', 'small-strong']) {
    const v = light?.[key] ?? prev[key];
    if (typeof v === 'number') out[key] = v;
  }
  return out;
}

/** 链式约束：返回 [body, strong, display]，保证 body ≤ strong ≤ display 且都在可用阶梯上。 */
function clampWeightChain(body, strong, display) {
  const avail = availableWeights();
  const atLeast = (v) => avail.find((a) => a >= v) ?? avail[avail.length - 1];
  // 正文不能低于 weightFloorBody()：有暗色时 300 写不出合法的低于它的暗色值。
  body = Math.max(body, weightFloorBody());
  const atMost = (v) => [...avail].reverse().find((a) => a <= v) ?? avail[0];
  const b = atLeast(Number(body) || avail[0]);
  const s = atLeast(Math.max(b, Number(strong) || b));
  const d = atLeast(Math.max(s, Number(display) || s));
  // display 被手动调低时反向压回前两档
  if (Number(display) < Number(strong)) {
    const dd = atMost(Number(display));
    const ss = atMost(Math.min(Number(strong), dd));
    const bb = atMost(Math.min(Number(body), ss));
    return [bb, ss, dd];
  }
  return [b, s, d];
}

/**
 * 分段控件。用原生 radio 而不是 role=radio 按钮：
 * 原生 radio 自带方向键切换与 roving tabindex，这里不必重写键盘模型；
 * 视觉上把 input 视觉隐藏，由 label 承担外观。
 */
function segmented({ name, label, options, selected, onChange, className = '' }) {
  const group = el('div', { class: `seg ${className}`.trim(), role: 'radiogroup', 'aria-label': label });
  for (const opt of options) {
    const input = el('input', {
      type: 'radio', name, value: opt.id, class: 'seg-input',
    });
    input.checked = opt.id === selected;
    input.addEventListener('change', () => { if (input.checked) onChange(opt); });
    group.append(el('label', { class: 'seg-opt', title: opt.title || opt.label },
      input, el('span', { class: 'seg-label', text: opt.label })));
  }
  return group;
}

/** 只读读数（等宽数字）。 */
const readout = (text, id) => el('output', { class: 'param-readout', id, text });

/** 单选控件 + 读数的一行布局：控制区左，读数右。 */
const paramLine = (...children) => el('div', { class: 'param-line' }, ...children);

/** 数字步进器：− / 数字 / +。用于圆角四档这类连续值。 */
function stepper({ label, value, min, max, onChange }) {
  const num = el('input', {
    type: 'number', class: 'stepper-num', value: String(value),
    min: String(min), max: String(max), step: '1', 'aria-label': label,
  });
  const commit = (v) => {
    const n = Math.min(max, Math.max(min, Math.round(Number(v))));
    if (!Number.isFinite(n)) { num.value = String(value); return; }
    num.value = String(n);
    onChange(n);
  };
  const dec = el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `${label} 减小`, text: '−' });
  const inc = el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `${label} 增大`, text: '+' });
  dec.addEventListener('click', () => commit(Number(num.value) - 1));
  inc.addEventListener('click', () => commit(Number(num.value) + 1));
  // 边输入边写会让「1」被当成最终值；失焦 / 回车时才提交。
  num.addEventListener('change', () => commit(num.value));
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(num.value); } });
  return el('div', { class: 'stepper' }, dec, num, inc);
}

/** 每项改动后的统一链路：写 state → 失效确认 → 标脏 → 刷新预览与样本。 */
function commitParam(key, value) {
  setTranslationValue(key, value);
  // 任一项改动都让「确认」失效：确认的语义是「我逐项看过现在这组值」
  setParamsConfirmed(false);
  markDirty();
  applyPreview();
  updatePaletteOutputs();
  renderParamsSpecimens();
  // 有些控件会互相影响（彩度上限压住 accent C、字重链式约束、圆角预设
  // 反填四档数值），序列化之后统一回到控件，避免界面显示与 state 打架。
  syncParamControls();
}

/** 中性色温度：冷 ←→ 暖 双极滑块。 */
function neutralControl() {
  const range = el('input', {
    type: 'range', class: 'param-range', min: '0', max: '100', step: '1',
    value: String(state.neutral), 'aria-label': '中性色温度：左冷右暖',
  });
  const out = readout('', 'param-neutral-out');
  range.addEventListener('input', () => {
    const v = Number(range.value);
    state.neutral = v;
    state.neutralPinned = null;   // 拖了就有反馈：解除变体色相的钉住
    commitParam('neutralTemp', `H ${Math.round(neutralHue())}, C ${neutralC()}`);
  });
  return el('div', { class: 'param-control' },
    paramLine(range, out),
    el('div', { class: 'param-scale', 'aria-hidden': 'true' },
      el('span', { text: '冷' }), el('span', { text: '中性' }), el('span', { text: '暖' })));
}

/** 彩度上限：0.04–0.40。 */
function chromaControl() {
  const range = el('input', {
    type: 'range', class: 'param-range', min: '0.04', max: '0.4', step: '0.01',
    value: String(designParams().chromaCap), 'aria-label': '彩度上限',
  });
  const out = readout('', 'param-chroma-out');
  range.addEventListener('input', () => {
    commitParam('chromaCap', Math.round(Number(range.value) * 100) / 100);
  });
  return el('div', { class: 'param-control' }, paramLine(range, out));
}

/** 圆角：四段预设 + 四个数值步进器（预设选中后仍可单独微调）。 */
function radiusControl() {
  const p = designParams();
  const preset = RADIUS_PRESETS.find((presetItem) => sameNums(presetItem.values, p.r));
  const group = segmented({
    name: 'param-radius', label: '圆角预设',
    // 整个预设对象都要传进 onChange：只挑 id/label 会把 values 丢掉，
    // 点下去写进 translation 的就是 undefined。
    options: RADIUS_PRESETS.map((r) => ({ ...r, title: `${r.values.join(' / ')}px` })),
    selected: preset?.id,
    onChange: (opt) => commitParam('radius', [...opt.values]),
  });
  const labels = ['小', '中', '大', '胶囊'];
  const steps = p.r.map((v, i) => stepper({
    label: `圆角 ${labels[i]}（px）`, value: v, min: 0, max: 999,
    onChange: (n) => {
      const next = designParams().r.slice();
      next[i] = n;
      commitParam('radius', next);
    },
  }));
  return el('div', { class: 'param-control' },
    group,
    el('div', { class: 'stepper-grid' },
      ...steps.map((node, i) => el('div', { class: 'stepper-cell' },
        el('span', { class: 'stepper-label', text: labels[i] }), node))));
}

/** 边框：三段宽度 + 一条不透明度。 */
function borderControl() {
  const p = designParams();
  const modeId = BORDER_MODES.find((m) => m.w === p.borderW)?.id
    || (p.borderW <= 0 ? 'none' : 'strong');
  const alpha = el('input', {
    type: 'range', class: 'param-range', min: '4', max: '20', step: '1',
    value: String(p.borderAlpha), 'aria-label': '边框不透明度',
  });
  const out = readout('', 'param-border-out');
  const write = (w, a) => commitParam('border', `${w}px / fg ${a}%`);
  const group = segmented({
    name: 'param-border', label: '边框粗细',
    options: BORDER_MODES.map((m) => ({ ...m, title: `${m.w}px` })),
    selected: modeId,
    onChange: (opt) => write(opt.w, designParams().borderAlpha),
  });
  alpha.addEventListener('input', () => {
    const m = BORDER_MODES.find((b) => b.id === modeId) || BORDER_MODES[1];
    write(m.w, Number(alpha.value));
  });
  return el('div', { class: 'param-control' },
    group,
    el('div', { class: 'param-line param-line-gap' },
      el('span', { class: 'param-inline-label', text: '不透明度' }), alpha, out));
}

/** 阴影：四档策略。 */
function shadowControl() {
  const mode = designParams().shadowMode;
  return el('div', { class: 'param-control' },
    segmented({
      name: 'param-shadow', label: '阴影策略',
      options: SHADOW_MODES, selected: mode,
      onChange: (opt) => commitParam('shadow', opt.value),
    }));
}

/** 当前转写表里的三档字重（数组缺失时用预览实际值兜底）。 */
function weightIntent() {
  const w = state.translation.weight?.value;
  const arr = Array.isArray(w) ? w : numbersOf(w);
  const p = designParams();
  return [0, 1, 2].map((i) => Number(arr[i]) || p.weights[['body', 'strong', 'display'][i]]);
}

/** 字重：三个下拉，选项来自系统可用字重，且强制 body ≤ strong ≤ display。 */
function weightControl() {
  const intent = weightIntent();
  const p = { weights: { body: intent[0], strong: intent[1], display: intent[2] } };
  const avail = availableWeights();
  const roles = [['body', '正文'], ['strong', '强调'], ['display', '标题']];
  const selects = {};
  const wrap = el('div', { class: 'weight-grid' });
  for (const [role, label] of roles) {
    const sel = el('select', { class: 'weight-select', 'aria-label': `${label}字重` });
    for (const w of avail) sel.append(el('option', { value: String(w), text: String(w) }));
    sel.value = String(p.weights[role]);
    selects[role] = sel;
    wrap.append(el('label', { class: 'weight-field' },
      el('span', { class: 'weight-label', text: label }), sel));
  }
  const floor = weightFloorBody();
  // 低于下限的档位不是「藏起来」而是「禁用 + 说明」：用户看得到阶梯是完整的，
  // 也知道为什么选不了，而不是以为字体缺了这一档。
  const below = stepDown(floor);
  const floorNote = el('p', {
    class: 'weight-note',
    // 一句话说清约束即可；长句在 250px 宽里会折成三行，把整行撑高。
    text: hasDarkTheme()
      ? `正文 ≥ ${floor}：暗色要再降一档到 ${below}`
      : '',
  });
  if (!floorNote.textContent) floorNote.hidden = true;
  const apply = (role) => {
    const [body, strong, display] = clampWeightChain(
      selects.body.value, selects.strong.value, selects.display.value,
    );
    // 把约束后的值写回控件：不允许出现「正文 600、强调 400」这种非法组合。
    selects.body.value = String(body);
    selects.strong.value = String(strong);
    selects.display.value = String(display);
    void role;
    commitParam('weight', [body, strong, display]);
  };
  for (const sel of Object.values(selects)) sel.addEventListener('change', () => apply());
  return el('div', { class: 'param-control' }, wrap, floorNote);
}

/** 动效：三段节奏 + 缓动曲线。 */
function motionControl() {
  const p = designParams();
  const preset = MOTION_PRESETS.find((m) => m.fast === p.fast && m.base === p.base);
  const ease = el('select', { class: 'motion-ease', 'aria-label': '缓动曲线' });
  for (const name of MOTION_EASES) ease.append(el('option', { value: name, text: name }));
  ease.value = p.easeName;
  const write = (fast, base, easeName) => commitParam('motion', `${fast}-${base}ms ${easeName}`);
  const group = segmented({
    name: 'param-motion', label: '动效节奏',
    options: MOTION_PRESETS.map((m) => ({ ...m, title: `${m.fast}–${m.base}ms` })),
    selected: preset?.id,
    onChange: (opt) => write(opt.fast, opt.base, ease.value),
  });
  ease.addEventListener('change', () => {
    const cur = designParams();
    write(cur.fast, cur.base, ease.value);
  });
  return el('div', { class: 'param-control' },
    el('div', { class: 'param-line param-line-gap' }, group, ease));
}

const PARAM_CONTROLS = {
  neutralTemp: neutralControl,
  chromaCap: chromaControl,
  radius: radiusControl,
  border: borderControl,
  shadow: shadowControl,
  weight: weightControl,
  motion: motionControl,
};

/** 七项参数表。每行是「名称 + 控件 + 样本」，不再让用户手写格式。 */
function renderTranslation() {
  const host = $('#params-table');
  renderDirection();
  host.textContent = '';

  for (const [key, label, , , hint] of DIM_KEYS) {
    const meta = PARAM_META[key] || {};
    const fromProject = !!state.translation[key]?.from;
    const build = PARAM_CONTROLS[key];
    host.append(el('div', { class: 'param-row', dataset: { key } },
      el('div', { class: 'param-main' },
        el('div', { class: 'param-head' },
          el('span', { class: 'param-name', text: label }),
          el('span', {
            class: `param-origin${fromProject ? ' is-from' : ''}`,
            text: fromProject ? '来自你的描述' : '默认值',
            title: fromProject ? 'decisions.json 里有来源记录（不在界面展开）' : '没有来源记录，使用规则默认值',
          })),
        build ? build() : el('p', { class: 'param-influence', text: hint }),
        el('p', { class: 'param-influence', id: `param-influence-${key}`, text: meta.influence || hint || '' })),
      // 样本本身是装饰性的，但「动效」样本里有可聚焦的播放按钮 ——
      // 对容器加 aria-hidden 会把可聚焦元素藏进无障碍树，键盘用户能 Tab 到
      // 一个屏幕阅读器读不出来的东西。所以样本容器不加 aria-hidden，
      // 每个样本内部各自决定（纯色块不进入无障碍树，播放按钮有 aria-label）。
      el('div', { class: 'param-specimen', dataset: { key } })));
  }

  syncParamControls();
  renderParamsSpecimens();
  renderStrip();
}

/**
 * 把 state 同步到参数控件（不重建 DOM，不触发事件）。
 * 调色滑块、画廊换风格、读取 decisions 都会从外部改 state，
 * 参数控件必须跟着动，否则同一份值在界面上有两处矛盾显示。
 */
function syncParamControls() {
  const host = $('#params-table');
  if (!host) return;
  const p = designParams();
  const row = (key) => $(`.param-row[data-key="${key}"]`, host);

  // 选择器一律限定在某一行的 DOM 内：整张表里 .param-range 有六个，
  // 从 host 找第一个会把中性温度滑块当成彩度滑块写值。
  const setRange = (root, value) => {
    const node = $('.param-range', root);
    if (node && node.value !== String(value)) node.value = String(value);
  };
  const setText = (sel, text) => { const node = $(sel, host); if (node && node.textContent !== text) node.textContent = text; };
  const checkRadio = (name, id) => {
    const input = $(`input[name="${name}"][value="${id}"]`, host);
    if (input && !input.checked) input.checked = true;
    if (!id) $$(`input[name="${name}"]`, host).forEach((n) => { n.checked = false; });
  };

  if (row('neutralTemp')) {
    // 滑块位置来自 state.neutral，不读回序列化值：钉住变体色相时
    // 量程外的 H 没有对应的滑块位置，硬写回去会让滑块与读数打架。
    setRange(row('neutralTemp'), state.neutral);
    setText('#param-neutral-out', `H ${Math.round(effectiveNeutralHue())} · ${neutralLabel()}`);
  }
  if (row('chromaCap')) {
    setRange(row('chromaCap'), p.chromaCap);
    setText('#param-chroma-out', `C ≤ ${Number(p.chromaCap).toFixed(2)}`);
  }
  if (row('radius')) {
    const nums = $$('.stepper-num', row('radius'));
    p.r.forEach((v, i) => { if (nums[i] && nums[i] !== document.activeElement) nums[i].value = String(v); });
    const preset = RADIUS_PRESETS.find((item) => sameNums(item.values, p.r));
    checkRadio('param-radius', preset?.id);
  }
  if (row('border')) {
    const mode = BORDER_MODES.find((m) => m.w === p.borderW)?.id || (p.borderW <= 0 ? 'none' : 'strong');
    checkRadio('param-border', mode);
    setRange(row('border'), p.borderAlpha);
    setText('#param-border-out', `fg ${p.borderAlpha}%`);
  }
  if (row('shadow')) checkRadio('param-shadow', p.shadowMode);
  if (row('weight')) {
    // 变量名沿用旧的 p.weights 形状，下面两段都只读 intent，不再读 designParams。
    const sels = $$('.weight-select', row('weight'));
    const intent = weightIntent();
    ['body', 'strong', 'display'].forEach((role, i) => {
      const sel = sels[i];
      if (!sel) return;
      if (sel.value !== String(intent[i])) sel.value = String(intent[i]);
    });
    // 选项全量保留但禁用非法值：下拉展开时用户仍看得到完整阶梯，
    // 只是选不到比前一档更细的那一档。必须先写完值再算 floor，
    // 否则「正文刚改成 300」会按旧的 400 去禁用强调档的 300。
    // 正文的 floor 另受 R5 约束：有暗色时低于 400 无法导出合法的暗色值。
    const avail = availableWeights();
    const bodyFloor = weightFloorBody();
    ['body', 'strong', 'display'].forEach((role, i) => {
      const sel = sels[i];
      if (!sel) return;
      const floor = i === 0 ? bodyFloor : Number(sels[i - 1]?.value || avail[0]);
      for (const opt of Array.from(sel.options)) {
        opt.disabled = Number(opt.value) < floor;
      }
    });
  }
  if (row('motion')) {
    const preset = MOTION_PRESETS.find((m) => m.fast === p.fast && m.base === p.base);
    checkRadio('param-motion', preset?.id);
    const ease = $('.motion-ease', row('motion'));
    if (ease && ease.value !== p.easeName) ease.value = p.easeName;
  }
}

// === 预览 ===

/**
 * 调色页预览也走变体代理。
 *
 * 早先固定 /studio/fixture/index.html —— 那个页面只有基线 token，没有变体 CSS：
 * 画廊里选了新粗野主义，调色页看到的还是极简。走 proxy 后 data-style 与变体 CSS
 * 都由 studio.mjs 注入，画廊的选择才真正影响这里的画面。
 *
 * 层级关系：proxy 把变体 CSS 插在 base.css 之后，而 applyPreview() 往
 * documentElement 写内联样式（优先级最高）。所以内联 token 永远压过变体 token ——
 * 这是有意的：变体定风格，滑块只在其上微调颜色。正因如此，写进 iframe 的
 * 内联变量只带颜色（colorCssVars），否则新粗野主义的硬阴影与超粗标题会被
 * Studio 的默认圆角/字重压掉，看到的就不再是那个变体。
 */
const activeVariant = () => state.styleVariant || 'minimalism';
const fixtureSrc = () => `/studio/proxy/${activeVariant()}/index.html#/${FIXTURE_ROUTE[state.content] || 'dashboard'}`;

/**
 * 预览源。两种：
 *   fixture —— 技能自带的夹具，覆盖全部组件与规则，用于调 token
 *   project —— 项目自己的页面（用户填 URL），用于看 token 在真实界面上的效果
 * 早先只能看夹具，等于「在别人的页面上调自己的色板」。
 */
function previewSrc() {
  if (state.previewTarget === 'project' && state.previewUrl) return state.previewUrl;
  return fixtureSrc();
}

/**
 * 写入 CSS 变量。
 *
 * structural 决定是否连圆角 / 阴影 / 动效 / 字重一起写：
 * 早先走变体 proxy 时只写颜色，理由是「变体定风格」。但这样一来用户在
 * 参数表里把圆角从 0 改到 12，主预览完全不动 —— 调整没有反馈，参数表像摆设。
 *
 * 现在的优先级是：内联（本函数）> 变体 CSS > fixture tokens.css。
 * 这几项是「用户在本页直接编辑的值」，理应压过变体默认值；变体自身的
 * 签名规则（如 `.btn { box-shadow: 4px 4px 0 }` 写死字面量、不引用变量）不受影响，
 * 因为它们根本不读这些变量 —— 那是变体的签名，不该被参数表抹平。
 */
function applyVars(root, { structural = true } = {}) {
  const vars = structural
    ? cssVars(state.theme)
    : colorCssVars(state.theme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  if (root.dataset) root.dataset.theme = state.theme;
  return vars;
}

function applyPreview() {
  applyVars($('#preview-root'));
  // 夹具存在时把变量写进 iframe 的 :root（内联样式压过夹具 tokens.css 与变体 CSS）。
  const frame = $('#fixture-frame');
  if (state.fixture === 'ready' && !frame.hidden) {
    try {
      // 颜色与结构 token 都要内联：参数表改圆角 / 字重 / 阴影后主预览必须立刻变。
      const vars = applyVars(frame.contentDocument.documentElement, { structural: true });
      frame.contentWindow?.postMessage(
        { type: 'aesthetic:state', theme: state.theme, view: state.content, vars },
        window.location.origin,
      );
    } catch { /* iframe 未就绪或跨源 */ }
  }
  renderPanels();
  renderParamsSpecimens();
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
  const src = previewSrc();
  frame.src = src;
  // 只记夹具预览的变体：项目 URL 没有变体概念，否则每次切模式都会被误判成「变体不一致」
  state.loadedFrameVariant = src.startsWith('/studio/proxy/') ? activeVariant() : null;
  frame.addEventListener('load', () => {
    // 夹具 app.js 的 boot() 会按 prefers-color-scheme 重写 data-theme，所以 load 后再推一次。
    applyPreview();
    try { frame.contentDocument.documentElement.dataset.theme = state.theme; } catch { /* ignore */ }
  }, { once: true });
  // 地址只显示路径，变体名已经在顶栏「风格」和画廊里表达过
  $('#frame-url').textContent = src.replace('/studio/fixture ', '');
}

// === 色板 / 层级阶梯 / 校验读数（一次渲染，共用同一份 colorSet）===

function renderPanels() {
  const light = colorSet(state.theme);
  const dark = colorSet('dark');

  // 行式 token 列表，按语义分组。
  // 早期是 30×30 方块 + ::after 悬浮标签，9px 字号在窄面板里互相压叠，
  // surface-1/2/3 根本分不清；改成行后名称永不被截断。
  // 再后来发现平铺顺序没有含义（bg 与 danger 相邻），于是按用途分组 ——
  // 分组只影响阅读顺序，每行仍是完整的一行。
  const sw = $('#swatches');
  sw.textContent = '';
  const seen = new Set();
  const groups = TOKEN_GROUPS.map((g) => ({
    ...g,
    names: g.names.filter((n) => light[n] && !seen.has(n) && seen.add(n)),
  }));
  // 未归类的 token（项目自定义的 accent-2、brand 等）落到最后一个「其他」组，
  // 不能因为分组表没列到就悄悄从界面上消失。
  const rest = Object.keys(light).filter((n) => !seen.has(n));
  if (rest.length) groups.push({ id: 'other', title: '其他', note: '项目自定义', names: rest });

  for (const group of groups) {
    if (!group.names.length) continue;
    const rows = group.names.map((name) => {
      const e = light[name];
      return el('div', { class: 'swatch', dataset: { name }, title: e.oklch },
        el('span', { class: 'swatch-chip' }, el('span', { style: { background: e.oklch } })),
        el('span', { class: 'swatch-name', text: name }),
        el('span', { class: 'swatch-values' },
          el('span', { class: 'swatch-hex', text: e.hex }),
          el('span', { class: 'swatch-oklch', text: e.oklch })));
    });
    sw.append(el('section', { class: `token-group${group.static ? ' is-static' : ''}` },
      el('h3', { class: 'token-group-title' },
        el('span', { text: group.title }),
        el('span', { class: 'tg-note', text: group.note })),
      el('div', { class: 'swatches' }, ...rows)));
  }
  const count = $('#token-count');
  if (count) count.textContent = `${Object.keys(light).length} 项`;

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

  // 「暗色正文」这一行只在项目真的做暗色时出现。判据是显式的 themeMode，
  // 不是 dark 里有没有值：单主题项目即使 colorSet('dark') 还能算出兜底，
  // 那套颜色也不会写进 decisions，列出来只会让人以为项目有暗色要验收。
  const hasDark = hasDarkTheme() && !!(dark && dark.fg && dark.bg);
  const rows = [
    ['正文对比度', light?.fg, light?.bg, 4.5],
    ['次要对比度', light?.['fg-muted'], light?.bg, 4.5],
    ['焦点对比度', light?.accent, light?.bg, 3],
    ['主按钮文字', light?.['on-accent'], light?.accent, 4.5],
  ];
  if (hasDark) rows.push(['暗色正文', dark.fg, dark.bg, 4.5]);

  const checks = $('#checks');
  checks.textContent = '';
  for (const [label, fgE, bgE, min] of rows) {
    if (!fgE?.hex || !bgE?.hex) continue;          // 这一组没定义就跳过
    const ratio = contrastOf(fgE.hex, bgE.hex);
    const pass = ratio >= min;
    checks.append(el('li', { class: pass ? 'ok' : 'bad' },
      el('span', { class: 'flag', text: pass ? '✓' : '✗' }),
      el('span', { class: 'k', text: label }),
      el('span', { class: 'v', text: `${fmtRatio(ratio)} / ${min}:1` })));
  }
}

// === 色板的多路输入 ===
//
// 同一份 state（accentHue / accentChroma / accentLight）有四条输入路径：
// 色值框、色轮、滑块、色相数字框。每条路径都只写 state，再统一走
// syncPaletteInputs() 把其余控件刷成一致 —— 否则改一处、别处显示旧值。

const WHEEL_MAX_C = 0.4;   // 与转写表「彩度上限」的取值范围对齐（0–0.4）
// 取色盘几何（CSS px）。canvas 内部按 devicePixelRatio 放大，只影响清晰度。
const WHEEL_CSS = 212;
const RING_INNER_CSS = 88;
const PLANE_SIDE_CSS = 120;               // 内切于 88 半径圆的方形 C × L 平面
const PLANE_LEFT_CSS = (WHEEL_CSS - PLANE_SIDE_CSS) / 2;
const PLANE_TOP_CSS = PLANE_LEFT_CSS;
const PLANE_L_MIN = 0.2;                  // 与明度滑块量程一致
const PLANE_L_MAX = 0.95;
const RING_L = 0.62;                      // 色相环固定在感知中亮的位置，与当前 L 解耦
let wheelDrawnFor = null;  // `${size}|${theme}|${H}`，这些没变就不重画
let ringCache = null;      // 色相环与当前色相无关，单独缓存
let ringCacheKey = '';

/**
 * 彩度上限是「整套界面允许的最高 C」，不是只在填写参数表那一刻夹一次。
 * 主色、强调色、以及色轮 / 色值框的取色都必须经过它 ——
 * 否则用户把上限从 0.4 拖到 0.1，按钮还是原来的 0.2，读数与画面自相矛盾。
 */
const effectiveChroma = () => Math.min(state.accentChroma, designParams().chromaCap);

/** 当前 accent（含 L 覆盖）—— 色值框回显、chip、校验读数都用它。 */
const accentColor = () => toColor(accentLight(state.theme), effectiveChroma(), state.accentHue);

function setAccentError(message) {
  const input = $('#accent-hex');
  const box = $('#accent-hex-msg');
  input.classList.toggle('is-error', !!message);
  input.setAttribute('aria-invalid', String(!!message));
  box.hidden = !message;
  box.textContent = message || '';
}

/** 把 state 同步到所有色板控件（不改 state 本身）。 */
function syncPaletteInputs() {
  const a = accentColor();
  const L = accentLight(state.theme);
  // 滑块 step=1，只能显示整数；数字框保留 1 位小数，色相精度以 state 为准。
  $('#accent-hue').value = String(Math.round(state.accentHue));
  $('#accent-hue-num').value = String(Math.round(state.accentHue * 10) / 10);
  // 彩度滑块的上限跟着「彩度上限」走：上限不是一句提示，而是控件本身的边界，
  // 用户拖不过去，也就不会出现「参数表写 0.1，主色却是 0.2」的矛盾。
  const cap = designParams().chromaCap;
  $('#accent-chroma').max = String(cap);
  $('#accent-chroma').value = String(Number(effectiveChroma().toFixed(3)));
  $('#accent-light').value = String(L);
  $('#accent-hex').value = a.hex;
  $('#accent-hex-echo').textContent = `= ${a.oklch}`;
  $('#accent-hue-out').textContent = `${Math.round(state.accentHue)}°`;
  $('#accent-chroma-out').textContent = `C ${effectiveChroma().toFixed(3)}`;
  $('#accent-light-out').textContent = `L ${L.toFixed(3)}`;
  $('#neutral-temp-out').textContent = `H ${Math.round(effectiveNeutralHue())} · ${neutralLabel()}`;
  $('#accent-hue-chip').style.background = a.hex;
  $('#accent-chroma-chip').style.background = a.hex;
  $('#accent-light-chip').style.background = a.hex;
  $('#neutral-temp-chip').style.background = colorSet(state.theme)?.bg?.hex || 'transparent';
  $('#accent-light-follow').setAttribute('aria-pressed', String(state.accentLight === null));
  $('#accent-light-note').textContent = state.accentLight === null
    ? '跟随项目 accent 的 L' : '已手动覆盖（点「跟随主题」复位）';
  // 标记：位置由「在外环还是内部平面」决定，见 paintWheel 的同一套几何。
  const marker = $('#accent-wheel-marker');
  const ringPos = hueRingPoint(state.accentHue);
  marker.style.left = `${ringPos.x}px`;
  marker.style.top = `${ringPos.y}px`;
  marker.classList.remove('is-plane');
  marker.style.borderColor = a.hex;
  // 平面标记：用第二层（同一元素挪不过去，因为外环标记表示「当前色相」，
  // 平面标记表示「当前 C / L」；两者同时可见才有意义）
  const planeMark = $('#accent-plane-marker');
  if (planeMark) {
    const pp = planePoint(state.accentChroma, L);
    planeMark.style.left = `${pp.x}px`;
    planeMark.style.top = `${pp.y}px`;
    planeMark.style.background = a.hex;
  }
  // canvas 没有原生 value 语义，aria-valuenow 在 role=group 上不会被读，
  // 所以当前值走 aria-live 的隐藏文本：键盘调节时读屏会播报新值。
  $('#accent-wheel').setAttribute('aria-valuenow', String(Math.round(state.accentHue)));
  $('#accent-wheel').setAttribute('aria-valuetext',
    `色相 ${Math.round(state.accentHue)}°，彩度 ${state.accentChroma.toFixed(3)}，明度 ${L.toFixed(3)}`);
  const live = $('#wheel-value');
  if (live) live.textContent = `色相 ${Math.round(state.accentHue)}°，彩度 ${state.accentChroma.toFixed(3)}，明度 ${L.toFixed(3)}`;
  renderHero();
  renderFormats();
  drawWheel();
}

/** 外环上某色相的标记位置（CSS px，相对 .wheel-wrap）。 */
function hueRingPoint(H) {
  const rad = (H * Math.PI) / 180;
  const rr = (RING_INNER_CSS + (WHEEL_CSS / 2 - RING_INNER_CSS) / 2);
  return { x: WHEEL_CSS / 2 + Math.cos(rad) * rr, y: WHEEL_CSS / 2 + Math.sin(rad) * rr };
}

/** 平面内 (C, L) → 标记位置（CSS px，相对 .wheel-wrap）。 */
function planePoint(C, L) {
  const t = Math.min(1, Math.max(0, C / WHEEL_MAX_C));
  const u = Math.min(1, Math.max(0, (L - PLANE_L_MIN) / (PLANE_L_MAX - PLANE_L_MIN)));
  return {
    x: PLANE_LEFT_CSS + t * PLANE_SIDE_CSS,
    y: PLANE_TOP_CSS + (1 - u) * PLANE_SIDE_CSS,
  };
}

/**
 * 取色盘：外环 = 色相（永远完整），内部 = 当前色相的 C × L 平面。
 *
 * 为什么改结构：
 *   旧实现是 OKLCH 极坐标逐像素画，超 sRGB 的点直接透明。默认 L 0.52 时
 *   只有一小块扇形落在色域内，屏幕上像坏掉 —— 用户反馈「色轮显示不全」。
 *   根因是把「明度」这个第三维压进了色轮的固定底图：任何 L 都不可能让
 *   整个色相圆都落在 sRGB 里（高彩度蓝、青在 sRGB 本就到不了）。
 *
 * 现在：
 *   · 外环只依赖色相，任何 L 下都是完整的一圈；环上不会有超域区域。
 *   · 内部平面固定当前色相，横轴彩度、纵轴明度。逐像素判断 sRGB 色域：
 *     域内画真实颜色，域外用同一颜色降饱和 / 降不透明度表示「这里有这个值，
 *     但这台显示器显示不出来」，并在边界处画一条线。
 *   · 这正是 Chrome DevTools 的取色器（色相环 + SV 平面）与 oklch.com
 *     （色相滑块 + C/L 平面 + 色域边界）的共同结构：把三个维度拆成「环 + 面」，
 *     而不是硬把三维塞进一个圆。
 *
 * 性能：只有尺寸 / 主题 / 当前色相变化时才重画。外环与色相无关，单独缓存。
 */
let wheelQueued = false;
function drawWheel() {
  const key = `${WHEEL_CSS}|${state.theme}|${Math.round(state.accentHue * 10) / 10}`;
  if (key === wheelDrawnFor || wheelQueued) return;
  wheelQueued = true;
  requestAnimationFrame(() => {
    wheelQueued = false;
    paintWheel();
  });
}

function paintWheel() {
  const canvas = $('#accent-wheel');
  if (!canvas) return;
  const H = state.accentHue;
  wheelDrawnFor = `${WHEEL_CSS}|${state.theme}|${Math.round(H * 10) / 10}`;

  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const px = Math.round(WHEEL_CSS * dpr);
  if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, WHEEL_CSS, WHEEL_CSS);

  const cx = WHEEL_CSS / 2, cy = WHEEL_CSS / 2;
  const outerR = WHEEL_CSS / 2 - 1;
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const lineStrong = cssVar('--ui-line-strong', '#c8c4bf');
  const panelBg = cssVar('--ui-panel', '#fbfaf8');

  // ---- 外环：色相，固定 L，逐像素按角度算 ----
  const ringKey = `${px}|${state.theme}`;
  if (!ringCache || ringCacheKey !== ringKey) {
    const ring = ctx.createImageData(px, px);
    const d = ring.data;
    const R = outerR * dpr;
    const Rin = RING_INNER_CSS * dpr;
    const c = px / 2;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x - c + 0.5, dy = y - c + 0.5;
        const r = Math.hypot(dx, dy);
        const i = (y * px + x) * 4;
        if (r > R || r < Rin) continue;              // 环外 / 环内透明
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const rgb = oklchToLinear(RING_L, WHEEL_MAX_C, h);
        // 环的最外沿一定超域（任何色相在 C=0.4 都超出 sRGB），
        // 这里按实际色域二分到边界，不是直接夹 RGB —— 夹出来的颜色不是那个色相。
        const bounded = inGamut(rgb) ? WHEEL_MAX_C : maxChromaInGamut(RING_L, h, WHEEL_MAX_C);
        const rgbIn = bounded === WHEEL_MAX_C ? rgb : oklchToLinear(RING_L, bounded, h);
        d[i] = Math.round(clamp01(linToSrgb(rgbIn[0])) * 255);
        d[i + 1] = Math.round(clamp01(linToSrgb(rgbIn[1])) * 255);
        d[i + 2] = Math.round(clamp01(linToSrgb(rgbIn[2])) * 255);
        d[i + 3] = 255;
      }
    }
    ringCache = ring;
    ringCacheKey = ringKey;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, RING_INNER_CSS, 0, Math.PI * 2, true);
  ctx.clip();
  ctx.putImageData(ringCache, 0, 0);
  ctx.restore();

  // ---- 内部平面：当前色相的 C × L ----
  const side = PLANE_SIDE_CSS;
  const ppx = Math.round(side * dpr);
  const plane = ctx.createImageData(ppx, ppx);
  const pd = plane.data;
  for (let y = 0; y < ppx; y++) {
    const L = PLANE_L_MAX - (y + 0.5) / ppx * (PLANE_L_MAX - PLANE_L_MIN);
    for (let x = 0; x < ppx; x++) {
      const C = (x + 0.5) / ppx * WHEEL_MAX_C;
      const i = (y * ppx + x) * 4;
      const rgb = oklchToLinear(L, C, H);
      const inside = inGamut(rgb);
      if (inside) {
        pd[i] = Math.round(clamp01(linToSrgb(rgb[0])) * 255);
        pd[i + 1] = Math.round(clamp01(linToSrgb(rgb[1])) * 255);
        pd[i + 2] = Math.round(clamp01(linToSrgb(rgb[2])) * 255);
        pd[i + 3] = 235;
      } else {
        // 域外：把彩度压到当前 L / H 的色域边界，再降不透明度。
        // 这样用户看到的是「这里有个更饱和的颜色，但屏幕显示不出来」，
        // 而不是一块空白 —— 旧实现正是后者。
        const bounded = maxChromaInGamut(L, H, C);
        const fallback = oklchToLinear(L, bounded, H);
        pd[i] = Math.round(clamp01(linToSrgb(fallback[0])) * 255);
        pd[i + 1] = Math.round(clamp01(linToSrgb(fallback[1])) * 255);
        pd[i + 2] = Math.round(clamp01(linToSrgb(fallback[2])) * 255);
        pd[i + 3] = 70;
      }
    }
  }
  // 底：域外区域垫面板色，让降透明度的像素不会透出画布外的棋盘
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PLANE_LEFT_CSS, PLANE_TOP_CSS, side, side, 4);
  ctx.clip();
  ctx.fillStyle = panelBg;
  ctx.fillRect(PLANE_LEFT_CSS, PLANE_TOP_CSS, side, side);
  ctx.putImageData(plane, PLANE_LEFT_CSS, PLANE_TOP_CSS);
  ctx.restore();

  // 色域边界线：对每个 L 找到最大彩度，画成一条曲线。
  // 这是「色域内最大彩度」的可视化 —— oklch.com 与 Chrome DevTools 都提供
  // 边界提示；没有它，用户分不清「颜色变淡」是因为降饱和还是因为选了低 C。
  ctx.beginPath();
  const steps = 96;
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const L = PLANE_L_MAX - i / steps * (PLANE_L_MAX - PLANE_L_MIN);
    const c = maxChromaInGamut(L, H, WHEEL_MAX_C);
    const t = Math.min(1, c / WHEEL_MAX_C);
    const x = PLANE_LEFT_CSS + t * side;
    const y = PLANE_TOP_CSS + i / steps * side;
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = state.theme === 'dark' ? 'rgb(255 255 255 / .72)' : 'rgb(0 0 0 / .55)';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 平面外框 + 环的内外描边
  ctx.strokeStyle = lineStrong;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(PLANE_LEFT_CSS - .5, PLANE_TOP_CSS - .5, side + 1, side + 1, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, RING_INNER_CSS, 0, Math.PI * 2);
  ctx.stroke();

  // 平面轴标：C 向右、L 向上
  ctx.fillStyle = cssVar('--ui-fg-muted', '#6f6d6a');
  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillText('C →', PLANE_LEFT_CSS + side - 2, PLANE_TOP_CSS + side - 3);
  ctx.textAlign = 'left';
  ctx.fillText('L ↑', PLANE_LEFT_CSS + 3, PLANE_TOP_CSS + 10);
}

/** 在给定 L / H 下二分出 sRGB 色域内的最大彩度（24 次足够到 1e-6）。 */
function maxChromaInGamut(L, H, hi = WHEEL_MAX_C) {
  if (inGamut(oklchToLinear(L, hi, H))) return hi;
  let lo = 0, top = hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + top) / 2;
    if (inGamut(oklchToLinear(L, mid, H))) lo = mid; else top = mid;
  }
  return lo;
}

/** 取色盘坐标 → 命中区域与值。屏幕坐标先换算回 CSS px。 */
function wheelPick(event) {
  const canvas = $('#accent-wheel');
  const rect = canvas.getBoundingClientRect();
  const scale = WHEEL_CSS / rect.width;
  const px = (event.clientX - rect.left) * scale;
  const py = (event.clientY - rect.top) * scale;
  return wheelPickAt(px, py);
}

/**
 * CSS 坐标 → { zone: 'ring' | 'plane', H?, C?, L? }。
 * 环上点：角度即色相；平面点：横轴彩度、纵轴明度。
 * 落在环内、平面外（四个角）时归到最近的平面边缘，不跳变。
 */
function wheelPickAt(px, py) {
  const cx = WHEEL_CSS / 2, cy = WHEEL_CSS / 2;
  const dx = px - cx, dy = py - cy;
  const r = Math.hypot(dx, dy);
  if (r >= RING_INNER_CSS) {
    return { zone: 'ring', H: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360 };
  }
  const left = PLANE_LEFT_CSS, top = PLANE_TOP_CSS, side = PLANE_SIDE_CSS;
  const tx = Math.min(1, Math.max(0, (px - left) / side));
  const ty = Math.min(1, Math.max(0, (py - top) / side));
  return {
    zone: 'plane',
    C: Math.round(tx * WHEEL_MAX_C * 1000) / 1000,
    L: Math.round((PLANE_L_MAX - ty * (PLANE_L_MAX - PLANE_L_MIN)) * 1000) / 1000,
  };
}

let wheelRaf = 0;
/**
 * 应用一次取色盘点击 / 拖动。
 * 环上只改 H，平面里同时改 C 与 L —— 这正是把三维拆成「环 + 面」的好处：
 * 每个手势只动用户手指所在的那两个维度，不会因为摸了一下圆盘就顺带改亮暗。
 */
function applyWheelPick(event) {
  const pick = wheelPick(event);
  if (pick.zone === 'ring') {
    state.accentHue = pick.H;
  } else {
    state.accentChroma = pick.C;
    state.accentLight = pick.L;
  }
  // 拖动时控件与预览一帧一次，别在 pointermove 里同步重画整个面板
  if (wheelRaf) return;
  wheelRaf = requestAnimationFrame(() => {
    wheelRaf = 0;
    syncPaletteInputs();
    markDirty();
    applyPreview();
  });
}

/** 色值输入：解析成功才改 state；失败只标红报错，绝不偷偷回退。 */
function commitHexInput() {
  const raw = $('#accent-hex').value;
  try {
    const c = parseColorInput(raw);
    // 色相保留 1 位小数：四舍五入到整数会让 hex 往返掉色（#2B6CB0 ↔ #2A6CB0）。
    // 多格式复制功能的验收就是「复制出去的字符串能被原样解析回来」，
    // 精度在这里不能省。
    state.accentHue = Math.round(c.H * 10) / 10;
    state.accentChroma = Math.round(c.C * 1000) / 1000;
    // 色值本身带明度：不顺手设 L 的话，输入 #F2D045 会被项目 L 0.52 拉暗，
    // 回显的 hex 和用户输入对不上。输入色值即视为手动指定明度。
    state.accentLight = Math.round(c.L * 1000) / 1000;
    setAccentError('');
    syncPaletteInputs();
    markDirty();
    applyPreview();
  } catch (e) {
    setAccentError(e.message);
  }
}

function commitHueNumber() {
  const input = $('#accent-hue-num');
  const v = Number(input.value);
  if (!Number.isFinite(v)) {
    setStatus('error', `色相必须是数字：\`${input.value}\``, 8000);
    input.value = String(Math.round(state.accentHue * 10) / 10);
    return;
  }
  const clamped = Math.min(360, Math.max(0, Math.round(v * 10) / 10));
  if (clamped !== v) setStatus('warn', `色相 ${v} 超出 0–360，已夹到 ${clamped}。`, 8000);
  state.accentHue = clamped % 361;
  syncPaletteInputs();
  markDirty();
  applyPreview();
}

function bindPaletteInputs() {
  // 色值框：回车与失焦都解析。change 事件天然覆盖「失焦且值改过」，
  // 回车单独挂 keydown 是因为 change 在回车时也会触发，但输入后立即点别处
  // 时要保证先解析再让焦点离开。
  $('#accent-hex').addEventListener('change', commitHexInput);
  $('#accent-hex').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitHexInput(); }
  });
  $('#accent-hex').addEventListener('input', () => {
    // 用户重新开始输入时清掉旧错误，但不解析
    if ($('#accent-hex').classList.contains('is-error')) setAccentError('');
  });

  $('#accent-hue-num').addEventListener('change', commitHueNumber);
  $('#accent-hue-num').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitHueNumber(); }
  });

  $('#accent-light-follow').addEventListener('click', () => {
    state.accentLight = null;
    wheelDrawnFor = null;       // 明度回到项目值，色轮底图要重画
    syncPaletteInputs();
    markDirty();
    applyPreview();
  });

  // 取色盘：点击、拖动与方向键。指针捕获让拖出画布后仍能继续调。
  const wheel = $('#accent-wheel');
  let dragging = false;
  let dragZone = null;          // 'ring' | 'plane'：一次拖动内不切换区域，避免手滑跳维度
  wheel.addEventListener('pointerdown', (e) => {
    // 先取值再捕获指针：setPointerCapture 对不是「活动指针」的 id 会抛
    // NotFoundError（合成事件、部分触控笔驱动都会遇到）。抛在取值之前，
    // 一次点击就完全失效 —— 捕获失败只该损失「拖出画布还能继续拖」，不该丢点击。
    const hit = wheelPick(e);
    dragZone = hit.zone;
    dragging = true;
    applyWheelPick(e);
    try { wheel.setPointerCapture?.(e.pointerId); } catch { /* 无捕获也能点，只是拖出边界后会停 */ }
    wheel.focus();
  });
  wheel.addEventListener('pointermove', (e) => { if (dragging && dragZone) applyWheelPick(e); });
  wheel.addEventListener('pointerup', (e) => {
    dragging = false;
    dragZone = null;
    try { wheel.releasePointerCapture?.(e.pointerId); } catch { /* 没有捕获时释放会抛，忽略 */ }
  });
  wheel.addEventListener('pointercancel', () => { dragging = false; dragZone = null; });
  // 键盘：左右 = 色相，上下 = 彩度，PageUp/PageDown = 明度。
  // 环与面是同一个控件，所以维度直接绑在方向键与翻页键上，
  // 不需要先用鼠标「进入某个区域」—— 键盘用户无法做到后者。
  wheel.addEventListener('keydown', (e) => {
    const stepH = e.shiftKey ? 10 : 1;
    const stepC = e.shiftKey ? 0.05 : 0.005;
    const stepL = e.shiftKey ? 0.05 : 0.005;
    let handled = true;
    if (e.key === 'ArrowRight') state.accentHue = (state.accentHue + stepH) % 360;
    else if (e.key === 'ArrowLeft') state.accentHue = (state.accentHue - stepH + 360) % 360;
    else if (e.key === 'ArrowUp') state.accentChroma = Math.min(WHEEL_MAX_C, state.accentChroma + stepC);
    else if (e.key === 'ArrowDown') state.accentChroma = Math.max(0, state.accentChroma - stepC);
    else if (e.key === 'PageUp') state.accentLight = Math.min(PLANE_L_MAX, accentLight(state.theme) + stepL);
    else if (e.key === 'PageDown') state.accentLight = Math.max(PLANE_L_MIN, accentLight(state.theme) - stepL);
    else if (e.key === 'Home') state.accentHue = 0;
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    state.accentChroma = Math.round(state.accentChroma * 1000) / 1000;
    if (state.accentLight !== null) state.accentLight = Math.round(state.accentLight * 1000) / 1000;
    syncPaletteInputs();
    markDirty();
    applyPreview();
  });

  bindHeroControls();
  bindParamsControls();
}

// === 主色卡 / 多格式色值 / 七项参数缩略条 ===

/**
 * 色值多格式：hex / rgb / hsl / oklch。
 *
 * 为什么四种并列：同一个颜色在不同上下文里要不同写法 —— CSS 里用 oklch、
 * 设计稿交接用 hex、旧代码用 rgb、设计讨论用 hsl。让用户自己换算既易错
 * 又打断调色节奏；Chrome DevTools 的颜色选择器也是同一个色值可切换多种格式。
 * 每一行都能点击复制（整行命中面积比小图标大），并有「已复制」反馈。
 */
function colorFormats() {
  const a = accentColor();
  const rgb = hexToRgb(a.hex).map((v) => Math.round(v * 255));
  const { L, C, H } = rgbToOklch(rgb.map((v) => v / 255));
  // HSL：从 sRGB 直接算，避免再走一次 OKLCH 近似
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = ((h * 60) + 360) % 360;
  }
  // HSL 保留 1 位小数：取整会让 hsl(210.7 60.7% 42.9%) 变成 211/61/43，
  // 再解析回来差一个 hex 通道（#2B6CB0 → #2B6BB0）。验收要求「复制出的字符串
  // 能被 parseColorInput 原样解析回来」，所以精度按能回环的最小值取。
  const round1 = (v) => Math.round(v * 10) / 10;
  return [
    { label: 'hex', value: a.hex },
    { label: 'rgb', value: `rgb(${rgb.join(' ')})` },
    { label: 'hsl', value: `hsl(${round1(h)} ${round1(s * 100)}% ${round1(l * 100)}%)` },
    { label: 'oklch', value: fmtOklch({ L, C, H }) },
  ];
}

/** 剪贴板：navigator.clipboard 不可用（非安全上下文）时退回 textarea + execCommand。 */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 落到 execCommand */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/** 复制反馈：元素 data-copied=1 显示「已复制」，1.4s 后复原。 */
function flashCopied(node) {
  node.dataset.copied = '1';
  clearTimeout(node._copyTimer);
  node._copyTimer = setTimeout(() => { node.dataset.copied = ''; }, 1400);
}

function renderFormats() {
  const host = $('#format-list');
  if (!host) return;
  host.textContent = '';
  for (const { label, value } of colorFormats()) {
    const btn = el('button', {
      type: 'button', class: 'format-row', dataset: { format: label, value },
      'aria-label': `复制 ${label}：${value}`, title: `点击复制 ${label}`,
    },
    el('span', { class: 'format-label', text: label }),
    el('span', { class: 'format-value', text: value }),
    el('span', { class: 'format-copy', text: '复制' }));
    btn.addEventListener('click', async () => {
      const ok = await copyText(value);
      if (!ok) { setStatus('error', '复制失败：浏览器拒绝了剪贴板访问。', 6000); return; }
      $('.format-copy', btn).textContent = '已复制';
      flashCopied(btn);
      setTimeout(() => { const c = $('.format-copy', btn); if (c) c.textContent = '复制'; }, 1400);
    });
    host.append(btn);
  }
}

/**
 * 主色卡：大色块 + hex + oklch + 与页面底的对比度 + 吸管 + 复制。
 * 对比度按 WCAG 2.2：正文 4.5:1、非文本 3:1 两个阈值分别着色 ——
 * 只给一个数字而不给判定，用户还得自己记阈值。
 */
function renderHero() {
  const a = accentColor();
  const bg = colorSet(state.theme)?.bg?.hex;
  const sw = $('#hero-swatch');
  // 色块本身是一个纯色层，对比度读数叠在底部
  let solid = $('.hero-solid', sw);
  if (!solid) {
    solid = el('span', { class: 'hero-solid' });
    sw.prepend(solid);
  }
  solid.style.background = a.oklch;
  $('#hero-hex').textContent = a.hex;
  $('#hero-oklch').textContent = a.oklch;

  const ratioRow = $('#hero-ratio');
  if (ratioRow) {
    ratioRow.textContent = '';
    if (bg) {
      const ratio = contrastOf(a.hex, bg);
      const textOk = ratio >= 4.5;
      const uiOk = ratio >= 3;
      ratioRow.append(
        el('span', { text: `对页面底 ${bg}` }),
        el('span', { class: `ratio-badge ${textOk ? 'ok' : 'bad'}`, text: `正文 ${fmtRatio(ratio)} ${textOk ? '✓' : '✗'} 4.5` }),
        el('span', { class: `ratio-badge ${uiOk ? 'ok' : 'bad'}`, text: `非文本 ${uiOk ? '✓' : '✗'} 3` }));
    }
  }
  const copyBtn = $('#hero-copy-all');
  if (copyBtn) {
    copyBtn.setAttribute('aria-label', `复制 hex 色值 ${a.hex}`);
    copyBtn.title = `复制 ${a.hex}`;
  }
  // 色相环 / 平面标记位置在 syncPaletteInputs 里画，这里只管卡片本身
}

function bindHeroControls() {
  const eye = $('#hero-eyedropper');
  // EyeDropper 是 Chromium 系浏览器能力；不支持就不显示按钮，而不是给一个点了没反应的按钮。
  if (eye && 'EyeDropper' in window) {
    eye.hidden = false;
    eye.addEventListener('click', async () => {
      try {
        const result = await new window.EyeDropper().open();
        const c = parseColorInput(result.sRGBHex);
        state.accentHue = Math.round(c.H * 10) / 10;
        state.accentChroma = Math.round(c.C * 1000) / 1000;
        state.accentLight = Math.round(c.L * 1000) / 1000;
        setAccentError('');
        syncPaletteInputs();
        markDirty();
        applyPreview();
        setStatus('ok', `已取色 ${result.sRGBHex.toUpperCase()}`);
      } catch { /* 用户按 Esc 取消：不是错误，不提示 */ }
    });
  }
  const copy = $('#hero-copy-all');
  if (copy) {
    copy.addEventListener('click', async () => {
      const ok = await copyText(accentColor().hex);
      if (!ok) { setStatus('error', '复制失败：浏览器拒绝了剪贴板访问。', 6000); return; }
      flashCopied(copy);
      setStatus('ok', `已复制 ${accentColor().hex}`);
    });
  }
}

// --- 七项参数的展开 / 收起 ---

// localStorage 偏好记录的是「确认过没有」，不是「当前是不是收起」：
// 用户点过「确认这七项」之后，下次进入才默认收起；在那之前哪怕手动收了，
// 下次也应回到展开 —— 没看过的表不该被记住成「已看过」。
// 读写一律 try/catch：隐私模式 / 存储被禁用时不能因此让整页初始化失败。
const PARAMS_STORE_KEY = 'aesthetic-studio:params-collapsed';

function storeGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function storeSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* 静默失败 */ }
}

function paramsCollapsed() {
  // 默认展开：用户还没确认看过。确认过一次后默认收起，把面板还给 token 列表。
  return storeGet(PARAMS_STORE_KEY) === '1';
}

/**
 * 收起 / 展开。persist=true 时把「已确认过」写进偏好；
 * 手动收起不写 —— 否则用户只是嫌长收起来，下次却发现参数表不见了，
 * 而真正的原因（他没确认过）在界面上没有任何痕迹。
 */
function setParamsCollapsed(collapsed, { persist = false } = {}) {
  // 隐藏的是整个 body（说明 + 方向条 + 表格 + 确认按钮），
  // 而收起 / 展开按钮在外层 block-head 里，始终可达。
  const body = $('#params-body');
  const btn = $('#params-collapse');
  const stateTag = $('#params-state');
  if (body) body.hidden = collapsed;
  if (btn) {
    btn.textContent = collapsed ? '展开' : '收起';
    btn.setAttribute('aria-expanded', String(!collapsed));
  }
  if (stateTag) stateTag.textContent = collapsed ? '已收起' : '展开';
  if (persist) storeSet(PARAMS_STORE_KEY, collapsed ? '1' : '0');
}

/** 缩略条：7 个 28px 样本，点任一项展开并滚到对应行。 */
function renderStrip() {
  const host = $('#params-strip');
  if (!host) return;
  host.textContent = '';
  for (const [key, label] of DIM_KEYS) {
    const item = el('button', {
      type: 'button', class: 'strip-item', dataset: { key },
      'aria-label': `${label}：${paramShortValue(key)}。点击展开编辑`,
    },
    el('span', { class: 'strip-slot', 'aria-hidden': 'true' }),
    el('span', { class: 'strip-tip', 'aria-hidden': 'true' }));
    item.addEventListener('click', () => openParamRow(key));
    host.append(item);
  }
  renderParamsSpecimens();
}

/** 展开参数表、滚到某一行并聚焦它的输入框（不写偏好：这是一次临时查看）。 */
function openParamRow(key) {
  setParamsCollapsed(false);
  requestAnimationFrame(() => {
    const row = $(`.param-row[data-key="${key}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // 行内没有统一的「输入框」了：分段控件是 radio、字重是 select、
    // 圆角是 stepper。按 DOM 顺序找第一个可操作控件。
    const first = $('input:not([type="hidden"]), select, button, [tabindex="0"]', row);
    first?.focus({ preventScroll: true });
  });
}

// 确认状态：不是落盘，是「我逐项看过这组值」。任一项改动就失效。
// 放在 sessionStorage 之外的 state 里：刷新后由 localStorage 的收起偏好
// 表达「已经确认过」，按钮本身在刷新后回到未确认 —— 确认是对当下这组值的。
let paramsConfirmed = false;

function setParamsConfirmed(confirmed) {
  paramsConfirmed = confirmed;
  const btn = $('#btn-confirm-params');
  if (!btn) return;
  btn.dataset.confirmed = confirmed ? '1' : '';
  btn.textContent = confirmed ? '已确认' : '确认这七项';
  btn.setAttribute('aria-pressed', String(confirmed));
  // 确认后收起并记住偏好：把面板还给 token 列表，缩略条保留入口。
  // 只有确认这一条路径写偏好，手动收起 / 展开不写。
  if (confirmed) setParamsCollapsed(true, { persist: true });
}

function bindParamsControls() {
  const table = $('#params-table');
  // 默认状态由 localStorage 决定；首次进入（没存过）展开
  setParamsCollapsed(paramsCollapsed());

  $('#params-collapse')?.addEventListener('click', () => {
    setParamsCollapsed(!$('#params-body').hidden);
  });

  // 缩略条点击也要临时展开；不能经过 setParamsCollapsed 的 persist 分支
  // （openParamRow 里调用的是不带 persist 的版本）。

  $('#btn-confirm-params')?.addEventListener('click', () => {
    setParamsConfirmed(true);
    setStatus('ok', '已确认这七项参数。下一步：写入 decisions。');
  });
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

/**
 * decisions 的配色段与主题声明。
 *
 * meta.theme 与 color 里实际写了哪几套必须一致 —— 早先这里无条件写
 * `theme: 'light-dark'` 和 `{ light, dark }`，于是用户在 Phase 0 说过
 * 「本期不做暗色」也照样产出 11 个 dark token，build.mjs 的
 * `if (d.color?.dark)` 合同段落因此永远出现。
 *
 * 现在只按显式意图主题写：
 *   · 'light'      → meta.theme 'light'，color 只有 light（不写 dark 键本体）
 *   · 'light-dark' → meta.theme 'light-dark'，color 两套齐全
 * 只用 delete / 重新构造，不写 `dark: {}` —— schema 的 color 段
 * additionalProperties 要求每个主题至少有 bg / fg，空对象直接 422。
 *
 * weights 同理：单主题项目不把 weights.dark 写出去（它只是 Studio 内部的推导值）。
 */
function buildDecisions() {
  const clean = (set) => Object.fromEntries(Object.entries(set)
    .map(([k, v]) => [k, { oklch: v.oklch, hex: v.hex, l: v.l }]));
  const wantsDark = state.themeMode === 'light-dark';
  const color = { light: clean(colorSet('light')) };
  if (wantsDark) color.dark = clean(colorSet('dark'));
  const weights = structuredClone(state.weights);
  if (!wantsDark) delete weights.dark;
  return {
    meta: {
      schemaVersion: 1, theme: wantsDark ? 'light-dark' : 'light',
      generatedAt: new Date().toISOString(), generatorVersion: 'aesthetic-v2',
    },
    direction: ensureDirection(),
    translation: structuredClone(state.translation),
    color,
    surfaceLadder: { step: STEP },
    weightLadder: state.weightLadder,
    weights,
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
  if (mode === 'palette') {
    // 画廊里换了变体、而调色页 iframe 还载着旧 URL 时，切回来先同步。
    // 只在夹具预览下判断：项目预览没有变体 URL 可比。
    const onFixture = state.previewTarget !== 'project';
    if (onFixture && state.fixture === 'ready' && state.loadedFrameVariant !== activeVariant()) loadFrame();
    requestAnimationFrame(updateFrameSize);
  }
}

function setView(view) {
  state.view = view;
  updateFrameSize();
  // 画廊缩略图按新设计尺寸重算比例；已在打开的放大层同理。
  requestAnimationFrame(() => { layoutGalleryShots(); layoutZoom(); });
}

/** 把 Studio 主题推给同源 iframe 的 <html>；跨源时静默跳过。 */
function pushThemeToFrame(frame, theme) {
  try { frame.contentDocument.documentElement.dataset.theme = theme; } catch { /* 跨源 / 未就绪 */ }
}

/** 载入完成后补推当前主题。只挂一次：放大层会复用同一个 iframe 多次打开。 */
function hookFrameTheme(frame) {
  if (frame.dataset.themeHook) return;
  frame.dataset.themeHook = '1';
  frame.addEventListener('load', () => pushThemeToFrame(frame, state.theme));
}

/** 画廊缩略图与放大层：切主题时它们不会重新 load，必须主动推。 */
function syncGalleryTheme() {
  for (const frame of $$('#gallery-grid iframe, #zoom-frame')) pushThemeToFrame(frame, state.theme);
}

/**
 * 项目主题意图：'light'（单主题浅）或 'light-dark'（浅 + 深）。
 *
 * 它是**显式决定**，不是从配色数据反推的：旧 decisions 里有 dark 只说明
 * 上一轮做过，不说明这一轮还做。所以单主题时把 dark 数据清掉（写盘时
 * buildDecisions 也不会再写），切回浅+深时重新生成。
 *
 * 载入已有 decisions 时**不走这里**：applyRemoteDecisions 直接写 state.themeMode，
 * 由 syncControls() 同步控件 —— 载入不该产生「已切换」的提示或改动数据。
 */
function setThemeMode(mode) {
  const next = mode === 'light-dark' ? 'light-dark' : 'light';
  const prev = state.themeMode;
  state.themeMode = next;

  // 预览锁：单主题项目没有另一套颜色可看。把预览从 dark 拉回 light，
  // 否则画廊缩略图、实验室 iframe 还会渲染一套不会写入的暗色。
  if (next === 'light' && state.theme === 'dark') setTheme('light');

  // 单主题时丢掉内存里的暗色**配色**基线。留着它有两个坏处：
  //   1. 再次切回「浅 + 深」时会沿用旧项目（可能已被删掉）的 dark，
  //      而不是按当前浅色重新生成；
  //   2. 面板里 colorSet('dark') 仍能算出一套「看着像有暗色」的颜色。
  // 用户若反悔，切回「浅 + 深」会从变体暗色或兜底公式重建（见 colorSet）。
  //
  // weights.dark 不在这里删：它上面的 small / small-strong 是跨主题恒定的，
  // 删了再推导会丢掉。写入时 buildDecisions 会整段不发（单主题不写 dark），
  // 切回来时 deriveDarkWeights 会用浅色重算 body/strong/display。
  if (next === 'light' && state.remoteColor?.dark) delete state.remoteColor.dark;

  // 从单主题切到浅 + 深：dark 可能是 {} 或历史残留，按当前浅色基线重建。
  // 配色走 colorSet('dark') 的兜底 / 项目基线（见 colorSet 的 intended 分支），
  // 字重则从浅色重新降一档，保证 R5「严格更低」。
  if (next === 'light-dark') {
    // 单主题时正文可以取 300；切回「浅 + 深」后这个值没有更低的档位可降，
    // 必须先把浅色字重链夹回合法区间（正文 ≥ 400），再推导暗色。
    const cur = state.weights.light || {};
    const [body, strong, display] = clampWeightChain(cur.body, cur.strong, cur.display);
    state.weights.light = { ...cur, body, strong, display };
    // 转写表是「设计意图」的显示值，必须和实际 token 一起更新，
    // 否则参数表写着 300、导出的权重是 400。
    state.translation.weight.value = [body, strong, display];
    state.weights.dark = deriveDarkWeights(state.weights.light);
  }

  syncThemeModeControls();
  // 切模式会改变「对比度检查 / 字重下限 / 参数表提示」—— 面板整体重画。
  renderPanels();
  renderTranslation();
  if (prev !== next) markDirty();
  if (prev !== next) {
    setStatus('ok', next === 'light-dark'
      ? '项目主题已设为「浅 + 深」：写入 decisions 时会同时产出两套颜色。'
      : '项目主题已设为「单主题 · 浅」：写入 decisions 时只产出浅色，不再写暗色数据。');
  }
}

/** 把 themeMode / theme 同步到顶栏两个下拉，并锁住单主题下不可用的选项。 */
function syncThemeModeControls() {
  const modeSel = $('#theme-mode-select');
  if (modeSel && modeSel.value !== state.themeMode) modeSel.value = state.themeMode;
  const themeSel = $('#theme-select');
  if (!themeSel) return;
  const darkOpt = Array.from(themeSel.options).find((o) => o.value === 'dark');
  if (darkOpt) {
    // 不用隐藏：选项消失会让下拉宽度跳变，也让人不知道「还有暗色这回事」。
    // 文案点明原因，比一个禁用的「深」字更省一次猜测。
    darkOpt.disabled = state.themeMode !== 'light-dark';
    darkOpt.textContent = state.themeMode === 'light-dark' ? '深' : '深（未启用）';
  }
  if (themeSel.value !== state.theme) themeSel.value = state.theme;
}

function setTheme(theme) {
  // 单主题项目没有暗色可预览：即便有人从 URL / 脚本里把值塞进来也拉回浅色。
  if (theme === 'dark' && state.themeMode !== 'light-dark') theme = 'light';
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  // 预览下拉可能被脚本写过一个不成立的值（单主题下写 dark）—— 以 state 为准回填，
  // 否则下拉显示「深」而画面是浅色，两处矛盾。
  const sel = $('#theme-select');
  if (sel && sel.value !== theme) sel.value = theme;
  // 暗色下 accent 的项目 L 不同（跟随模式下 L 变了），色轮底图与明度值都要重算
  wheelDrawnFor = null;
  updatePaletteOutputs();
  applyPreview();
  try { $('#lab-frame').contentDocument.documentElement.dataset.theme = theme; } catch { /* ignore */ }
  syncGalleryTheme();
}

function setContent(content) {
  state.content = content;
  const route = FIXTURE_ROUTE[content] || 'dashboard';
  // 只改 hash：夹具自己按 hash 路由重渲染，不需要重载 iframe。
  // 路径本身不变（仍是 /studio/proxy/<当前变体>/index.html），所以不会丢变体。
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
//
// 每帧按设计尺寸（1440×900 等）渲染，再用 transform: scale 缩进卡片：
// 若改成 width:100% 让 iframe 自己收缩，夹具会按窄宽重新布局、触发响应式断点，
// 看到的就不再是「整页的缩小版」。缩放后 iframe 的命中测试仍按变换后坐标走，
// 所以卡片里的链接、输入框照样可以点。

let galleryBuilt = false;
let galleryIndex = null;
let galleryShots = [];           // [{ wrap, frame, variant }]
let zoomTarget = null;           // ?zoom=<id>，进入画廊后自动打开
let zoomVariant = null;
let lastZoomFocus = null;

/**
 * 缩略图是整页等比缩放，页面内容高于设计高度时 iframe 内部会露出自己的滚动条。
 * 不能用 scrolling="no" —— 那会把折叠线以下的交互一起关掉。同源（Studio 与夹具
 * 都来自同一个 Studio 服务）才能直接进 contentDocument 注入：保留滚动能力，只藏条。
 *
 * 用常驻 load 监听而不是 { once: true }：切换变体会换 src 重新加载，样式必须重新注入；
 * hash 路由（#/dashboard ↔ #/settings）不触发 load，但同一个 document 里的 style 还在。
 */
function hideFrameScrollbars(frame) {
  // 放大层每次打开都会调用；不设标记会叠加 N 个监听（虽然注入有去重，监听会累积）。
  if (frame.dataset.scrollbarHook) return;
  frame.dataset.scrollbarHook = '1';
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      if (!doc?.documentElement) return;
      if (doc.querySelector('style[data-studio-scrollbar]')) return;
      const style = doc.createElement('style');
      style.dataset.studioScrollbar = '';
      style.textContent = 'html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }';
      (doc.head || doc.documentElement).append(style);
    } catch { /* 跨源或文档未就绪时静默跳过 */ }
  });
}

/**
 * 变体 token → 与 decisions.color 同形的 { light: {...}, dark: {...} }。
 *
 * 为什么需要：调色页预览走 proxy 后，变体 CSS 已经生效；但 applyPreview() 会把
 * Studio 算出的内联 token 写到 documentElement 上（优先级最高）。若仍用项目
 * decisions 的颜色算，画面就是「新粗野主义的圆角/阴影 + 项目原来的蓝灰配色」，
 * 不是变体本来的样子。所以选变体时必须把它的 token 读进来当新基线。
 *
 * 只收 oklch 字面量；color-mix / 相对引用留给基础基线（merge 时不覆盖）。
 * 变体 CSS 都来自本地静态目录，注释先剥掉再按花括号截块。
 */
function parseVariantTokens(css, id) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => {
    const start = code.indexOf(selector);
    if (start < 0) return '';
    const open = code.indexOf('{', start);
    if (open < 0) return '';
    let depth = 0;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}' && --depth === 0) return code.slice(open + 1, i);
    }
    return '';
  };
  const read = (text) => {
    const out = {};
    for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      const value = m[2].trim();
      const p = value.match(OKLCH_PARTS);
      if (!p) continue;
      out[m[1].slice(2)] = { oklch: fmtOklch({ L: Number(p[1]), C: Number(p[2]), H: Number(p[3]) }) };
    }
    return out;
  };
  return {
    light: read(block(`:root[data-style="${id}"]`)),
    dark: read(block(`:root[data-style="${id}"][data-theme="dark"]`)),
  };
}

/** 把变体 CSS 读成配色基线；读取失败返回 null（保留项目基线，不阻塞选风格）。 */
async function loadVariantColor(id) {
  if (state.variantColorCache?.has(id)) return state.variantColorCache.get(id);
  try {
    const res = await fetch(`/studio/styles/${id}.css`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const parsed = parseVariantTokens(await res.text(), id);
    state.variantColorCache ??= new Map();
    state.variantColorCache.set(id, parsed);
    return parsed;
  } catch { return null; }
}

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

/** 缩略图：外层按设计宽高比撑开，iframe 以 transform: scale 缩到外层宽度。
 *  遍历所有已渲染的卡片，resize / 切换视图 / 内容变化都走这里。 */
function layoutGalleryShots() {
  const [dw, dh] = VIEWS[state.view];
  for (const shot of galleryShots) {
    const { wrap, frame } = shot;
    const width = wrap.clientWidth;
    // 画廊隐藏时 clientWidth 为 0，跳过；下一帧显示后会由 ResizeObserver 补算。
    // 缓存 key 同时含视图：设计尺寸变了但卡片宽度碰巧没变时也要重算比例。
    const key = `${state.view}|${width}`;
    if (!width || key === shot.lastKey) continue;
    shot.lastKey = key;
    const scale = width / dw;
    wrap.style.aspectRatio = `${dw} / ${dh}`;
    Object.assign(frame.style, {
      width: `${dw}px`, height: `${dh}px`,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    });
  }
}

/** 选中变体（画廊卡片与放大层共用）。 */
function pickVariant(v) {
  if (!v) return;
  state.styleCard = v.card;
  state.styleVariant = v.id;
  for (const card of $$('#gallery-grid .gallery-card')) {
    card.classList.toggle('is-picked', card.dataset.variant === v.id);
  }
  // 调色页预览的 URL 里带着变体：不重载的话，回来的画面还是旧风格。
  // 面板的色板也要换基线（变体自己的 token），否则显示的还是旧项目的蓝灰。
  state.variantPicked = true;
  const applyVariantColor = () => {
    state.variantColor = state.variantColorCache?.get(v.id) || null;
    // 滑块与色板一起换成新变体的基线：选风格就是换了一整套配色，
    // 只换画面不换控件会让「拖了会变什么」的参照物仍是旧项目。
    const a = parseParts(state.variantColor?.light?.accent);
    if (a) {
      state.accentHue = Math.round(a.H * 10) / 10;
      state.accentChroma = Math.round(a.C * 1000) / 1000;
      state.accentLight = null;             // 明度回到跟随
      // 中性温度：变体色相可能超出滑块量程（H 45 / H 95），直接钉住原值；
      // 滑块位置只表示最近的量程点，真正的值显示在 output 里。
      const bgH = parseParts(state.variantColor?.light?.bg)?.H;
      if (Number.isFinite(bgH)) {
        state.neutralPinned = bgH;
        state.neutral = Math.round(Math.min(100, Math.max(0, (250 - bgH) / 165 * 100)));
        $('#neutral-temp').value = String(state.neutral);
      }
    }
    wheelDrawnFor = null;
    updatePaletteOutputs();
    applyPreview();
    // 换风格会改 state.neutral / accentChroma，参数表的同名控件要跟着走
    syncParamControls();
  };
  if (state.mode === 'palette') {
    loadVariantColor(v.id).then(applyVariantColor);
    loadFrame();
    setStatus('ok', `已切到 ${v.name}，调色页预览已同步。点「写入 decisions」保存。`);
  } else {
    // 不在调色模式也先把颜色读好，切回来时面板不会先闪一下旧配色
    loadVariantColor(v.id).then(applyVariantColor);
    setStatus('ok', `已选 ${v.name}（${v.id}）。点「写入 decisions」保存。`);
  }
  // 不在这里改实验室标签：实验室的 iframe 还载着旧变体，提前改标签会让
  // 标签和画面不一致；等切到实验室、renderLab 重载后由 load 事件更新。
}

// --- 放大层 ---

/** 放大层内可聚焦的控件。哨兵本身不算 —— 它们只是边界的落点。 */
function zoomFocusables() {
  const shell = $('.zoom-shell');
  if (!shell) return [];
  return $$('a[href], button, input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])', shell)
    .filter((n) => !n.classList.contains('zoom-sentinel') && !n.disabled && n.getClientRects().length);
}

/** 放大 iframe 内部的可聚焦元素。同源才能读到；跨域时返回空数组。 */
function zoomFrameFocusables() {
  try {
    const doc = $('#zoom-frame').contentDocument;
    if (!doc) return [];
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
      + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', doc)
      .filter((n) => !n.closest('[inert]') && n.getClientRects().length);
  } catch { return []; }
}

/** 工具条上的真实控件（排除哨兵与 iframe 本身）。 */
const zoomBarFocusables = () => zoomFocusables().filter((n) => n.tagName !== 'IFRAME');

/**
 * 哨兵落点：
 *   start（Shift+Tab 越过工具条首项）→ 整个模态的最后一个可聚焦元素，即 iframe 内容末尾；
 *   end（Tab 越过 iframe 末尾）→ 工具条第一个控件。
 * 直接聚焦 iframe 元素不算进内容，所以这里要拿到它内部的元素。
 */
function zoomEdgeTarget(edge) {
  const bar = zoomBarFocusables();
  if (edge === 'start') {
    const inner = zoomFrameFocusables();
    return inner[inner.length - 1] || bar[bar.length - 1] || zoomFocusables()[0] || null;
  }
  if (bar.length) return bar[0];
  return zoomFrameFocusables()[0] || zoomFocusables()[0] || null;
}

/**
 * 焦点陷阱（哨兵法）。
 *
 * 放大层是 aria-modal 对话框，Tab 不能跑到背后的画廊上。两个 tabindex=0 的哨兵
 * 分别放在 shell 首尾（display:none 的元素不可聚焦，所以用 1px 透明块）：
 * 焦点一落到哨兵就把它送回另一端，形成闭环。
 * iframe 里的键盘事件不会冒泡到 Studio 的 document，所以 iframe 内部另挂一份：
 * 在它首/尾元素上 Tab 时把焦点交给哨兵，再由哨兵送回 Studio 的控件。
 */
function bindZoomFocusTrap() {
  for (const sentinel of $$('.zoom-sentinel')) {
    sentinel.addEventListener('focus', () => {
      if ($('#zoom').hidden) return;
      zoomEdgeTarget(sentinel.dataset.edge)?.focus();
    });
  }

  // 哨兵理论上不会停留焦点，但浏览器在 iframe 边界上的行为有差异；
  // 真落在哨兵上按 Tab 时也要兜住，不让默认行为把焦点带到背景页。
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || $('#zoom').hidden) return;
    const sentinel = document.activeElement;
    if (!sentinel?.classList?.contains('zoom-sentinel')) return;
    e.preventDefault();
    zoomEdgeTarget(sentinel.dataset.edge)?.focus();
  });
}

/**
 * iframe 内部的 Tab / Esc。每次 load 都重挂：换变体会换 document，旧 document 已不存在。
 * document 可能被同一 frame 重新加载多次，用 dataset 标记避免同一 document 挂两遍。
 */
function zoomFrameKeys() {
  const frame = $('#zoom-frame');
  try {
    const doc = frame.contentDocument;
    if (!doc || doc.documentElement?.dataset.zoomKeys) return;
    doc.documentElement.dataset.zoomKeys = '1';
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeZoom(); return; }
      if (e.key !== 'Tab') return;
      const items = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
        + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', doc)
        .filter((n) => !n.closest('[inert]') && n.getClientRects().length);
      if (!items.length) {
        // 页面里没有可聚焦元素：焦点直接交给出口哨兵，别让浏览器把焦点送出模态层。
        e.preventDefault();
        $('.zoom-sentinel[data-edge="end"]')?.focus();
        return;
      }
      const active = doc.activeElement;
      // 首元素 Shift+Tab / 尾元素 Tab：焦点本该离开 iframe，交给哨兵闭环。
      // activeElement 为 body 说明焦点还没落在任何控件上，Shift+Tab 同样从尾部进入。
      if (e.shiftKey && (active === items[0] || active === doc.body)) {
        e.preventDefault();
        $('.zoom-sentinel[data-edge="start"]')?.focus();
      } else if (!e.shiftKey && active === items[items.length - 1]) {
        e.preventDefault();
        $('.zoom-sentinel[data-edge="end"]')?.focus();
      }
    });
  } catch { /* 跨域时只能靠外层哨兵 */ }
}

/** 打开放大层：iframe 与缩略图同一 URL，按 90vw × 85vh 等比缩放放下整页。 */
function openZoom(variant) {
  if (!variant) return;
  lastZoomFocus = document.activeElement;
  zoomVariant = variant;
  const modal = $('#zoom');
  const frame = $('#zoom-frame');
  const [dw, dh] = VIEWS[state.view];
  $('#zoom-title').textContent = variant.name;
  $('#zoom-meta').textContent = `${variant.id} · ${dw} × ${dh}`;
  hideFrameScrollbars(frame);
  // 切换模式后才新建的 iframe 不会经过 setTheme()，载入完成时补推一次，
  // 否则深色 Studio 里打开的放大预览仍是浅色页面。
  hookFrameTheme(frame);
  frame.src = `/studio/proxy/${variant.id}/index.html#/${FIXTURE_ROUTE[state.content] || 'dashboard'}`;
  frame.style.width = `${dw}px`;
  frame.style.height = `${dh}px`;
  modal.hidden = false;
  // 锁 body 滚动：放大层自身不需要滚动，背景也不该跟着动。
  document.body.dataset.zoomOpen = 'true';
  document.documentElement.style.overflow = 'hidden';
  // iframe 里要有 Esc 与 Tab 两份监听：焦点在放大的页面里时 keydown 不会冒泡到
  // Studio 的 document，只挂外层等于 Esc 失效、Tab 也逃出模态层。
  // 不用 { once: true }：同一帧重新加载会换 document，旧监听留在已销毁的文档上。
  frame.addEventListener('load', zoomFrameKeys);
  layoutZoom();
  requestAnimationFrame(() => $('#zoom-close').focus());
}

function layoutZoom() {
  if ($('#zoom').hidden) return;
  const [dw, dh] = VIEWS[state.view];
  const bar = $('.zoom-bar');
  // 视口给的是「整页」的预算：宽度取 90vw，高度扣掉工具条和边框后 85vh，
  // 两个方向都放得下才不裁切。
  const availW = Math.min(window.innerWidth * 0.9, 2400);
  const availH = Math.max(240, window.innerHeight * 0.85 - (bar?.offsetHeight || 0) - 2);
  const scale = Math.min(availW / dw, availH / dh);
  $('#zoom-viewport').style.width = `${Math.round(dw * scale)}px`;
  $('#zoom-viewport').style.height = `${Math.round(dh * scale)}px`;
  $('#zoom-meta').textContent = `${zoomVariant?.id || ''} · ${dw} × ${dh} · ${Math.round(scale * 100)}%`;
  Object.assign($('#zoom-frame').style, {
    width: `${dw}px`, height: `${dh}px`,
    transform: `scale(${scale})`, transformOrigin: 'top left',
  });
}

function closeZoom() {
  if ($('#zoom').hidden) return;
  $('#zoom').hidden = true;
  $('#zoom-frame').src = 'about:blank';
  delete document.body.dataset.zoomOpen;
  document.documentElement.style.overflow = '';
  zoomVariant = null;
  lastZoomFocus?.focus?.();
}

async function renderGallery() {
  const grid = $('#gallery-grid');
  const load = $('#gallery-load')?.checked;
  if (galleryBuilt && grid.dataset.load === String(load)) return;

  const { variants } = await loadStyleIndex();
  galleryBuilt = true;
  grid.dataset.load = String(load);
  grid.textContent = '';
  galleryShots = [];

  if (!variants.length) {
    grid.dataset.count = '1';
    grid.append(el('div', { class: 'gallery-card' },
      el('header', {}, el('span', { class: 'g-num', text: '—' }), el('span', { text: '读不到风格索引' })),
      // 整段包进一个 <p>：flex 容器会把裸文本与 <code> 拆成多个匿名 flex 项，
      // 每项各自居中成一行，读起来像几条互不相干的句子。
      el('div', { class: 'g-body' },
        el('p', { html: '读不到 <code>assets/studio/styles/style-index.json</code>。'
          + '请确认 Studio 是由 <code>scripts/studio.mjs</code> 启动的。' }))));
    return;
  }

  let list = galleryCandidates(variants);
  if (!load) list = list.slice(0, 3);
  // 这里曾经有 list = list.slice(0, 6) 的硬上限：勾了「加载全部候选」也永远只有 6 张，
  // 三支玻璃变体被截掉。上限没有存在理由 —— 加载量由复选框决定。
  grid.dataset.count = String(list.length);

  list.forEach((variant, i) => {
    const [dw, dh] = VIEWS[state.view];
    const frame = el('iframe', {
      title: `${variant.name} 候选 ${i + 1}`,
      src: `/studio/proxy/${variant.id}/index.html#/${FIXTURE_ROUTE[state.content] || 'dashboard'}`,
      style: { width: `${dw}px`, height: `${dh}px`, transformOrigin: 'top left' },
      // 无头截图/懒加载场景下也别延期加载，否则卡片是白的
      loading: 'eager',
    });
    hideFrameScrollbars(frame);
    // 画廊缩略图跟随 Studio 主题：只改 iframe 内容的 data-theme，
    // .gallery-shot 的 #fff 白纸底不动（那是缩略图的画布，不是页面主题）。
    hookFrameTheme(frame);
    const shot = el('div', { class: 'gallery-shot' }, frame);
    const head = el('header', {},
      el('span', { class: 'g-num', text: String(i + 1).padStart(2, '0') }),
      el('span', { class: 'g-name', text: variant.name }));
    if (variant.engine === 'chromium-only') {
      head.append(el('span', { class: 'g-note', text: '仅 Chromium 折射' }));
    }
    const actions = el('span', { class: 'g-actions' },
      el('button', { type: 'button', class: 'g-zoom', dataset: { zoom: variant.id }, text: '放大' }),
      el('button', { type: 'button', class: 'g-pick', dataset: { pick: variant.id }, text: '选择' }));
    head.append(actions);
    grid.append(el('div', { class: 'gallery-card', dataset: { variant: variant.id } }, head, shot));
    galleryShots.push({ wrap: shot, frame, variant });
  });

  for (const btn of $$('#gallery-grid .g-pick')) {
    btn.addEventListener('click', () => pickVariant(list.find((x) => x.id === btn.dataset.pick)));
  }
  for (const btn of $$('#gallery-grid .g-zoom')) {
    btn.addEventListener('click', () => openZoom(list.find((x) => x.id === btn.dataset.zoom)));
  }

  // 卡片宽度由 grid 决定，首帧时 layout 还没完成，下一帧再量。
  requestAnimationFrame(layoutGalleryShots);
  // 注释：原来的「同步滚动」已删除。卡片现在显示的是缩放后的整页，
  // 自身不再滚动（外层 overflow: hidden），滚动位置也由 transform 缩放决定，
  // 没有可同步的滚动量；保留它只会在 iframe 内部误触发。

  // ?zoom=<id>：等卡片布局完再开，否则放大层的 90vw/85vh 预算还没算对。
  // 从完整索引里找，而不是从已渲染的 list —— 未勾选「加载全部」时
  // 卡片只有前 3 个，但 zoom 直链可能指向第 5 个（如 neo-brutalism）。
  if (zoomTarget) {
    const v = variants.find((x) => x.id === zoomTarget) || list[0];
    zoomTarget = null;
    requestAnimationFrame(() => openZoom(v));
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
// 总览用夹具原有的组件架路由：一次渲染按钮矩阵、输入框、开关、标签、徽章，
// 比只挂一个组件更能看出「这套 token 在整套组件上是否一致」。
const LAB_OVERVIEW = 'overview';

/** 当前实验台配置 → 夹具 URL。总览走 #/components，不拼 ?comp=。 */
function labSrc() {
  const comp = $('#lab-component').value;
  const variant = state.styleVariant || 'minimalism';
  if (comp === LAB_OVERVIEW) {
    // data-style 由 studio.mjs 的 proxy 路由注入，和画廊用同一条路径
    return `/studio/proxy/${variant}/index.html#/components`;
  }
  const params = new URLSearchParams({
    comp,
    variant: $('#lab-variant').value,
    state: $('#lab-state').value,
    size: $('#lab-size').value,
    bg: $('#lab-bg').value,
  });
  return `/studio/proxy/${variant}/index.html?${params}#/lab`;
}

let labFrameReady = false;

/** 总览下没有「某个组件」可固化：四个下拉与 recipe 区一起禁用。 */
const LAB_DEPENDENT_CTL = ['#lab-variant', '#lab-bg', '#lab-state', '#lab-size'];

/**
 * 工具条上的「当前生效风格」。
 * 优先用传入的 served —— 那是 iframe 里 <html data-style> 的真实值；
 * 拿不到时才退回 state.styleVariant。画廊选了 A 但实验室 iframe 仍载着 B 时，
 * state 会撒谎，只有 data-style 说真话。
 */
async function updateLabStyle(served) {
  const id = served || state.styleVariant || 'minimalism';
  const nameEl = $('#lab-style-name');
  const idEl = $('#lab-style-id');
  if (!nameEl || !idEl) return;
  idEl.textContent = `· ${id}`;
  const idx = await loadStyleIndex();
  const found = idx.variants.find((v) => v.id === id);
  nameEl.textContent = found?.name || id;
}

function renderLab() {
  const comp = $('#lab-component').value;
  const frame = $('#lab-frame');
  if (!frame) return;
  const overview = comp === LAB_OVERVIEW;

  // 变体下拉只对按钮 / 徽章 / 标签有意义；总览下所有状态类下拉都无意义。
  const variantCtl = $('#lab-variant');
  if (variantCtl) {
    variantCtl.disabled = overview || !LAB_VARIANT_COMPS.has(comp);
    variantCtl.closest('.ctl')?.toggleAttribute('data-dim', variantCtl.disabled);
  }
  for (const sel of LAB_DEPENDENT_CTL) {
    if (sel === '#lab-variant') continue;
    const ctl = $(sel);
    if (!ctl) continue;
    ctl.disabled = overview;
    ctl.closest('.ctl')?.toggleAttribute('data-dim', overview);
  }

  // 总览没有单一组件可写：recipe 输入与按钮禁用，hint 换成怎么回到单组件。
  $('#recipe-name').disabled = overview;
  $('#btn-recipe').disabled = overview;
  const recipeHint = $('#recipe-hint');
  if (overview) {
    recipeHint.textContent = '总览用来检查整套组件在当前 token 下是否一致。'
      + '要把某个组件固化成 recipe，在上面的「组件」里选它。';
  } else {
    // 切回单组件时恢复原始说明（历史上可能被写入成功的提示覆盖过）
    recipeHint.innerHTML = RECIPE_HINT_DEFAULT;
  }

  if (overview) {
    // 总览没有「组件名」可当文件名；留空让用户先选组件再写。
    $('#recipe-name').value = '';
    $('#recipe-path').textContent = '—';
  } else {
    $('#recipe-name').value = comp;
    $('#recipe-path').textContent = `assets/recipes/${comp}.css`;
  }

  frame.src = labSrc();
  labFrameReady = true;
  updateLabStyle();
}

/** 首次渲染时缓存，切回单组件时恢复，而不是硬编码两份文案。 */
const RECIPE_HINT_DEFAULT = $('#recipe-hint')?.innerHTML || '';


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
    // 实验室的 iframe 同样要跟顶栏主题走：夹具 app.js 只按 prefers-color-scheme 初始化，
    // 用户把 Studio 切到深色后，画布还亮着会让「当前 token」的观感失真。
    try { frame.contentDocument.documentElement.dataset.theme = state.theme; } catch { /* ignore */ }
    updateLabStyle(served);
    const comp = $('#lab-component').value;
    if (comp === LAB_OVERVIEW) {
      // 总览不渲染 #/lab，状态 / 尺寸 / 背景都不参与，别再报它们的值。
      hint.textContent = `真实渲染：当前 token + ${served} · 全部组件总览`;
      return;
    }
    const cmpLabel = $('#lab-component').selectedOptions?.[0]?.textContent || comp;
    hint.textContent = `真实渲染：当前 token + ${served} · ${cmpLabel} · `
      + `${$('#lab-state').value} / ${$('#lab-size').value} · 背景 ${$('#lab-bg').value}`;
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
  $('#palette-sub').textContent = colorSet(state.theme).bg.hex;
  syncPaletteInputs();
}

function syncControls() {
  $('#view-select').value = state.view;
  $('#content-select').value = state.content;
  $('#neutral-temp').value = String(state.neutral);
  // 载入 decisions 时 state.theme 可能被改成 dark（单主题深色文件），
  // 但 <html data-theme> 还停在 HTML 里的初值 —— 两处必须一起刷新。
  document.documentElement.dataset.theme = state.theme;
  syncThemeModeControls();
  updatePaletteOutputs();
}

const OKLCH_RE = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/;

/** 把已有 decisions 读进面板状态（色板控件位置由 OKLCH 反推）。 */
function applyRemoteDecisions(d) {
  for (const [key] of DIM_KEYS) {
    if (d.translation?.[key]) state.translation[key] = structuredClone(d.translation[key]);
  }
  // 保留项目真实的色值。colorSet() 只是「调色控件作用在什么基准上」，
  // 没有这份缓存它就会从硬编码的公式现场算一套，而不是读项目的 token。
  // 只要有任一主题就缓存：只有 dark 的历史文件也要保留它的 dark，
  // 不能因为缺 light 就把整份配色丢掉。
  if (d.color && Object.keys(d.color).length) state.remoteColor = structuredClone(d.color);

  // 项目主题意图从 meta.theme 反推（词表兼容）：
  //   'light'      → 单主题浅
  //   'light-dark' → 浅 + 深
  //   缺失         → 'light-dark'（缺省按旧行为，已有项目不会被静默降级成单主题）
  //   'dark'       → Studio 没有「单主题 · 深」这一档：schema 的 color 段
  //                  required: ["light"]，dark-only 的 decisions 会被
  //                  check-tokens 判 E002。按「浅 + 深」载入并明确提示，
  //                  而不是假装能原样保存。
  const storedTheme = d.meta?.theme;
  if (storedTheme === 'dark') {
    // 打开 Studio 直接进深色预览：文件声明的意图就是深色，先看到它本来的样子。
    state.themeMode = 'light-dark';
    state.theme = 'dark';
    setStatus('warn', '这份 decisions.json 声明为单主题深色，但项目的 schema 要求 '
      + 'color.light 必填——Studio 只能按「浅 + 深」载入；再次写入会补出浅色一套。', 0);
  } else {
    state.themeMode = storedTheme === 'light' ? 'light' : 'light-dark';
    // 声明为单主题浅色、却残留了 dark 段：以 meta.theme 的显式意图为准，
    // 丢掉残留的 dark 基线。否则用户切到「浅 + 深」时会原样捡回旧暗色，
    // 而不是按当前浅色重新生成。
    if (state.themeMode === 'light' && state.remoteColor?.dark) delete state.remoteColor.dark;
  }
  if (d.style) { state.styleCard = d.style.card || state.styleCard; state.styleVariant = d.style.variant || state.styleVariant; }
  if (d.weights) state.weights = { ...state.weights, ...structuredClone(d.weights) };
  if (d.direction) {
    state.direction = { ...state.direction, ...d.direction };
    // 只有 decisions.json 里真的有方向，方向条才去掉「示例」标签
    state.directionFromProject = true;
  }
  if (d.weightLadder) state.weightLadder = d.weightLadder;
  if (Array.isArray(d.overrides)) state.overrides = d.overrides;

  // 字重行必须显示「预览实际用的那三个值」。decisions.json 里 translation.weight
  // 是设计意图（400/500/600），weights.light 才是 tokens 与预览读的数（400/600/700）；
  // 两者历史上就不总一致。参数表是给人看「改这个会发生什么」的，显示意图值而
  // 右侧样本按实际值渲染，会变成一张自相矛盾的表。
  const lightW = d.weights?.light;
  if (lightW?.body && lightW?.strong && lightW?.display) {
    state.translation.weight = {
      ...(state.translation.weight || {}),
      value: [lightW.body, lightW.strong, lightW.display],
    };
  }

  const pick = (oklch, i) => Number(String(oklch || '').match(OKLCH_RE)?.[i] ?? NaN);
  const accent = d.color?.light?.accent?.oklch;
  const [c, h] = [pick(accent, 2), pick(accent, 3)];
  if (Number.isFinite(c)) state.accentChroma = c;
  if (Number.isFinite(h)) state.accentHue = h;
  const bgH = pick(d.color?.light?.bg?.oklch, 3);
  if (Number.isFinite(bgH)) {
    // 项目的中性色相未必落在滑块 250→85 的量程内；同样钉住原值，
    // 滑块一动就解钉（否则「读到的项目色相」会被滑块位置悄悄改写）。
    state.neutralPinned = bgH;
    state.neutral = Math.round(Math.min(100, Math.max(0, (250 - bgH) / 165 * 100)));
  }
}

async function loadState() {
  const commit = $('#btn-commit');
  // 状态未读回之前禁用「写入 decisions」：此时 artifacts 全是 false，
  // 但用户点下去仍会用默认参数和空的远端配色写盘 —— 真会覆盖项目的 decisions.json。
  if (commit) commit.disabled = true;
  try {
    const s = await get('/api/state');
    state.artifacts = { committed: !!s.artifacts?.decisions, tokens: !!s.artifacts?.tokens,
      injected: !!s.artifacts?.designBlock };
    if (s.decisions) applyRemoteDecisions(s.decisions);
    state.fixture = s.studio?.fixture ? 'ready' : 'missing';
    setArtifacts({});
    if (commit) commit.disabled = false;
  } catch (e) {
    // 失败时保持禁用：连项目现状都没读到，写回等于往未知文件上覆盖。
    if (commit) commit.disabled = true;
    setStatus('warn', `无法读取项目状态：${e.message}（可继续调色；写入已禁用，请确认 Studio 的 --project 路径后重试）`);
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
  on('#preview-target', 'change', (e) => {
    state.previewTarget = e.target.value;
    $('#preview-url').hidden = state.previewTarget !== 'project';
    loadFrame();
  });
  on('#preview-url', 'change', (e) => {
    state.previewUrl = e.target.value.trim();
    if (state.previewTarget === 'project') loadFrame();
  });
  // 两个主题下拉：mode 决定写什么，theme 决定看什么。
  on('#theme-mode-select', 'change', (e) => setThemeMode(e.target.value));
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
  window.addEventListener('resize', () => requestAnimationFrame(() => {
    updateFrameSize();
    layoutGalleryShots();
    layoutZoom();
  }));

  // 放大层：Esc、点遮罩、关闭按钮都能关；「选用这个风格」在放大层里也保留。
  on('#zoom-close', 'click', closeZoom);
  on('.zoom-backdrop', 'click', closeZoom);
  on('#zoom-pick', 'click', () => {
    pickVariant(zoomVariant);
    closeZoom();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#zoom').hidden) { e.preventDefault(); closeZoom(); }
  });

  // 卡片宽度由 grid 决定（换视图、窗口 resize、响应式断点都会变），
  // 统一用 ResizeObserver 跟着量，避免漏掉某条改动路径。
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => layoutGalleryShots()).observe($('#gallery-grid'));
  }

  slider('#accent-hue', (v) => { state.accentHue = v; });
  // 底部「彩度」改的是主色实际的 C，不是「彩度上限」（那是上限，两回事）。
  // 它只受上限约束，不写 translation.chromaCap —— 否则把主色调淡会连上限一起降。
  slider('#accent-chroma', (v) => { state.accentChroma = v; syncParamControls(); });
  // 中性温度则是同一个维度：底部滑块与参数表控件必须落到同一个 translation 值，
  // 否则拖完滑块，写进 decisions.json 的仍是旧值 —— 界面与产物不一致。
  slider('#neutral-temp', (v) => {
    state.neutral = v;
    state.neutralPinned = null;   // 用户一动滑块就解除变体色相的钉住
    state.translation.neutralTemp.value = `H ${Math.round(neutralHue())}, C ${neutralC()}`;
    setParamsConfirmed(false);
    syncParamControls();
  });
  // 明度滑块 = 手动覆盖。拖一格就退出「跟随主题」，语义由按钮 aria-pressed 表达。
  on('#accent-light', 'input', (e) => {
    state.accentLight = Number(e.target.value);
    wheelDrawnFor = null;          // 底图随 L 变，必须重画
    updatePaletteOutputs();
    markDirty();
    applyPreview();
  });
  bindPaletteInputs();
}

/**
 * URL 参数：?mode=palette|gallery|lab · ?all=1 · ?zoom=<variant-id>。
 * 存在的理由是无头截图验收与对话里直链 —— 不必手点三个下拉才能看到某个状态。
 * 参数只决定初始状态，不进 history，用户后续点击照常改 state。
 */
function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const mode = p.get('mode');
  return {
    mode: ['palette', 'gallery', 'lab'].includes(mode) ? mode : null,
    all: p.get('all') === '1',
    zoom: p.get('zoom'),
  };
}

async function init() {
  bindEvents();
  setArtifacts({});
  const params = readUrlParams();
  if (params.all) $('#gallery-load').checked = true;
  zoomTarget = params.zoom;
  await loadState();

  // 必须放在 loadState() 之后：applyRemoteDecisions() 只是把远程值写进 state，
  // 面板要重画才看得见。先画后载会让面板一直显示硬编码的默认值
  // —— 转写表写着别人的「依据」，色板也不是当前项目的主色。
  renderTranslation();
  syncControls();

  const ready = state.fixture === 'ready';
  $('#fixture-frame').hidden = !ready;
  // 外层视口也要一起隐藏：只设 iframe 时，#frame-viewport 仍占 705px 的空白。
  $('#frame-viewport').hidden = !ready;
  $('#fixture-fallback').hidden = ready;
  if (ready) loadFrame();
  applyPreview();
  updateFrameSize();
  bindZoomFocusTrap();
  bindLabHint();
  renderLab();

  // 模式放在最后：画廊要读 style-index、放大层要量卡片宽度，
  // 都依赖面板和顶栏已经完成布局；提前切会让 ?zoom 的预算算错。
  if (params.mode) setMode(params.mode);

  if (!TOKEN) {
    setStatus('error', '页面里没有一次性 token：请用 `node scripts/studio.mjs --project <dir>` 打印的 Studio URL 打开。'
      + '所有写回按钮都会被拒绝（HTTP 403）。', 0);
  }
}

init();
