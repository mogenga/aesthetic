#!/usr/bin/env node
/**
 * audit.mjs — L2 几何审计。把一段采集脚本注入页面，用 getComputedStyle +
 * getBoundingClientRect 取事实，再在 Node 侧判定。
 *
 * 规则（--rules 可只跑其中几条，接受 R1 或 R1-structure 两种写法）：
 *   R1-structure  作者声明的 margin / padding / gap 计算值应是 4 的倍数；
 *                 用 var(--label-gap) / var(--icon-shift) 等光学 token 供给的值放行。
 *                 UA 默认值（h1 的 21.44px、button 的 6px 外边距）不审——不是实现决定。
 *                 把 4pt 写存在某一侧（如 margin-bottom: -1px 规避）不在此规则内。warn
 *   R2-scale      :root 的 --surface-1..3 相邻层的 OKLCH ΔL ∈ [0.010, 0.030]。error
 *   R4-inset      input / textarea / select 的 box-shadow 必须同时有
 *                 一条非 inset 外投影与至少一条 inset 内环。error
 *   R5-dark       仅 --theme dark：--fw-body / --fw-strong / --fw-display
 *                 必须低于 light 基线。两个值都从 :root 计算值读。error
 *   R7-timer      .timer / [data-timer] 的 font-variant-numeric 必须含 tabular-nums。error
 *   R8-settings   [data-settings-row]：标签在左、控件在右；有下边框；行高 48–60px。error
 *   R9-form       [data-field]：标签在输入之上；输入宽度 / 容器内容宽 ≥ 0.95。error
 *
 * 前提：页面用 `document.documentElement.dataset.theme` 切换主题（与 shoot.mjs 一致）。
 * R5 会在同一次注入里临时切到 light 读基线，读完立刻还原，返回值前页面状态不变。
 *
 * 浏览器不可用（含 CDP Proxy 缺 Emulation 能力）时输出 manual-required，退出码 2，
 * 绝不伪造通过。不安装依赖、不下载、不启动浏览器。
 *
 * Exit codes: 0 无 error · 1 有 error · 2 环境不可用 · 3 输入非法
 *
 * Usage:
 *   node audit.mjs --project <dir> --url <url> [--view desktop|tablet|mobile]
 *                  [--theme light|dark] [--json] [--rules R1,R2,R4,R7,R8,R9]
 *                  [--port <n>]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { connect, CdpError } from './lib/cdp.mjs';
import { parseOklch, hexToRgb, rgbToOklch } from './lib/oklch.mjs';

const EXIT = { PASS: 0, VIOLATION: 1, ENV: 2, INPUT: 3 };

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};
const VIEW_NAMES = Object.keys(VIEWPORTS);
const THEMES = ['light', 'dark'];
const DPR = 2;

// 4pt 网格容差：亚像素舍入不该产生告警，13.333 这类真偏离必须保留。
const GRID_STEP = 4;
const GRID_EPS = 0.01;
const DL_MIN = 0.010;
const DL_MAX = 0.030;
const DL_EPS = 1e-9;
const ROW_MIN = 48;
const ROW_MAX = 60;
const FIELD_FULL_WIDTH = 0.95;
// 控制报告体量：每规则最多保留多少条违规 / 多少条通过
const MAX_VIOLATIONS = 50;
const MAX_PASSES = 40;

const RULES = [
  { alias: 'R1', id: 'R1-structure' },
  { alias: 'R2', id: 'R2-scale' },
  { alias: 'R4', id: 'R4-inset' },
  { alias: 'R5', id: 'R5-dark' },
  { alias: 'R7', id: 'R7-timer' },
  { alias: 'R8', id: 'R8-settings' },
  { alias: 'R9', id: 'R9-form' },
];
const RULE_IDS = RULES.map((r) => r.id);
const RULE_ORDER = new Map(RULE_IDS.map((id, i) => [id, i]));

// R1 例外条款里的光学值：1px 细线、标签→输入 6–8px、-0.125em 图标偏移。
// 显式名单 + 前缀扫描（页面里声明的 --label-* / --icon-* 也算）。
// --row-h 不在其中——行高是结构值，由 R8 单独校验 48–60px。
const OPTICAL_TOKEN_NAMES = ['--label-gap', '--icon-shift', '--line-hair'];
const OPTICAL_TOKEN_PREFIXES = ['--label-', '--icon-', '--optical-'];
const LENGTH_PROPS = [
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'row-gap', 'column-gap',
];

class InputError extends Error {}

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

function usage() {
  return [
    'audit.mjs --project <dir> --url <url> [--view desktop|tablet|mobile]',
    '          [--theme light|dark] [--json] [--rules R1,R2,R4,R7,R8,R9] [--port <n>]',
    '',
    '  --project  目标项目根目录（只用于校验路径，报告写到 stdout）',
    '  --url      要审计的页面地址',
    '  --view     desktop 1440×900 | tablet 834×1112 | mobile 390×844（默认 desktop）',
    '  --theme    light | dark（默认 light）',
    '  --rules    只跑指定规则，接受 R1 或 R1-structure；默认全部',
    '  --json     输出机器可读 JSON',
    '  --port     直连 DevTools 调试端口，默认 9222',
    '',
    '退出码：0 无 error · 1 有 error · 2 浏览器不可用（manual-required） · 3 输入非法',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    project: null, url: null, view: 'desktop', theme: 'light',
    json: false, rules: null, port: 9222, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') opts.project = argv[++i];
    else if (a === '--url' || a === '-u') opts.url = argv[++i];
    else if (a === '--view') opts.view = argv[++i];
    else if (a === '--theme') opts.theme = argv[++i];
    else if (a === '--rules' || a === '--rule') opts.rules = argv[++i];
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new InputError(`unknown argument: ${a}`);
  }
  return opts;
}

function resolveRules(spec) {
  if (!spec) return new Set(RULE_IDS);
  const picked = new Set();
  for (const raw of String(spec).split(',').map((s) => s.trim()).filter(Boolean)) {
    const upper = raw.toUpperCase();
    const byAlias = RULES.find((r) => r.alias.toUpperCase() === upper);
    const byId = RULES.find((r) => r.id.toUpperCase() === upper);
    const hit = byAlias || byId;
    if (!hit) {
      throw new InputError(`未知规则：${raw}（可用：${RULES.map((r) => r.alias).join(', ')}）`);
    }
    picked.add(hit.id);
  }
  if (!picked.size) throw new InputError('--rules 不能为空');
  return picked;
}

function buildConfig(opts) {
  if (!opts.project) throw new InputError('缺少 --project <目标项目路径>');
  if (!opts.url) throw new InputError('缺少 --url <页面地址>');

  const project = path.resolve(opts.project);
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) {
    throw new InputError(`项目目录不存在或不是目录：${project}`);
  }

  if (!VIEW_NAMES.includes(opts.view)) {
    throw new InputError(`--view 只能是 ${VIEW_NAMES.join('|')}，收到：${opts.view}`);
  }
  if (!THEMES.includes(opts.theme)) {
    throw new InputError(`--theme 只能是 ${THEMES.join('|')}，收到：${opts.theme}`);
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new InputError(`--port 必须是 1–65535 的整数，收到：${opts.port}`);
  }

  let url;
  try {
    const parsed = new URL(opts.url);
    if (!['http:', 'https:', 'file:', 'about:'].includes(parsed.protocol)) {
      throw new InputError(`--url 只支持 http/https/file/about，收到：${parsed.protocol}`);
    }
    url = parsed.href;
  } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError(`--url 不是合法 URL：${opts.url}`);
  }

  const rules = resolveRules(opts.rules);
  return {
    project, url, view: opts.view, theme: opts.theme,
    viewport: VIEWPORTS[opts.view], port: opts.port, json: opts.json, rules,
  };
}

// ---------------------------------------------------------------------------
// 采集：整段函数体被 toString() 注入页面，必须自包含（不能引用模块作用域的变量）
// ---------------------------------------------------------------------------

function collectFacts(cfg) {
  const out = {
    url: location.href,
    title: document.title,
    theme: cfg.theme,
    root: {},
    optical: [],
    weights: null,
    structure: [],
    structureChecked: 0,
    structureExplained: 0,
    structureOffGrid: 0,
    inputs: [],
    timers: [],
    settingsRows: [],
    fields: [],
    counts: { elements: 0, truncated: false },
  };

  const root = document.documentElement;
  const esc = (s) => {
    try {
      if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(String(s));
    } catch (e) { /* fallthrough */ }
    return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
  };
  const ANCHOR_ATTRS = ['data-settings-row', 'data-field', 'data-timer', 'data-label', 'data-control'];

  function selectorFor(el) {
    try {
      if (!el || el.nodeType !== 1) return '?';
      if (el.id && document.querySelectorAll('#' + esc(el.id)).length === 1) {
        return '#' + esc(el.id);
      }
      const parts = [];
      let node = el;
      let depth = 0;
      while (node && node.nodeType === 1 && depth < 6) {
        let part = node.tagName.toLowerCase();
        const anchor = ANCHOR_ATTRS.find((a) => node.hasAttribute(a));
        const cls = (node.getAttribute('class') || '').trim().split(/\s+/)
          .filter(Boolean).slice(0, 2);
        if (anchor) {
          part += '[' + anchor + ']';
        } else if (cls.length) {
          part += '.' + cls.map(esc).join('.');
        }
        const parent = node.parentElement;
        if (parent) {
          const sibs = Array.prototype.filter.call(
            parent.children, (c) => c.tagName === node.tagName,
          );
          if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
        }
        parts.unshift(part);
        if (node.id) {
          parts.length = 0;
          parts.push('#' + esc(node.id));
          break;
        }
        // 有 anchor 或 class 通常够用；仍不唯一时继续往上补一级，避免两条报告同选择器
        if (anchor || cls.length) {
          const candidate = parts.join(' > ');
          try {
            if (document.querySelectorAll(candidate).length === 1) return candidate;
          } catch (e) { return candidate; }
        }
        node = parent;
        depth++;
      }
      return parts.join(' > ');
    } catch (e) {
      return '?';
    }
  }

  const isVisible = (el) => {
    try {
      if (!el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    } catch (e) {
      return false;
    }
  };

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const round = (n, p) => {
    const f = Math.pow(10, p === undefined ? 2 : p);
    return Math.round(n * f) / f;
  };

  // ---- 主题：与 shoot.mjs 相同的约定
  if (cfg.theme) {
    root.dataset.theme = cfg.theme;
    void root.offsetHeight;
  }

  // ---- :root 上的自定义属性
  const rootStyle = getComputedStyle(root);
  const readVar = (name) => String(rootStyle.getPropertyValue(name) || '').trim();
  for (const name of cfg.customProps || []) {
    out.root[name] = readVar(name);
  }

  // ---- 光学 token 清单：显式名单 + 同源样式表里声明的前缀匹配项
  try {
    const seen = new Set();
    const push = (n) => { if (n && !seen.has(n)) seen.add(n); };
    (cfg.opticalTokens || []).forEach(push);
    for (let i = 0; i < document.styleSheets.length; i++) {
      let rules = null;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        const style = rules[j].style;
        if (!style) continue;
        for (let k = 0; k < style.length; k++) {
          const prop = style[k];
          if (!prop || prop.indexOf('--') !== 0) continue;
          if (cfg.opticalPrefixes.some((p) => prop.indexOf(p) === 0)) push(prop);
        }
      }
    }
    out.optical = [...seen];
  } catch (e) {
    out.optical = [...(cfg.opticalTokens || [])];
    out.opticalError = String(e && e.message ? e.message : e);
  }

  // ---- R5：dark 值 + 临时切到 light 读基线，读完立刻还原
  if (cfg.theme === 'dark') {
    const readWeights = () => {
      const cs = getComputedStyle(root);
      const pick = (n) => String(cs.getPropertyValue(n) || '').trim();
      return {
        body: pick('--fw-body'),
        strong: pick('--fw-strong'),
        display: pick('--fw-display'),
      };
    };
    const dark = readWeights();
    let light = null;
    try {
      // 临时切到 light 读基线，读完还原成 cfg.theme，页面状态与注入前一致
      root.dataset.theme = 'light';
      void root.offsetHeight;
      light = readWeights();
    } catch (e) {
      light = null;
    } finally {
      root.dataset.theme = cfg.theme;
      void root.offsetHeight;
    }
    out.weights = { dark, light };
  }

  // ---- R1：结构值
  const SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TEMPLATE: 1, NOSCRIPT: 1,
    TITLE: 1, HEAD: 1, BR: 1,
  };
  const all = document.body
    ? Array.prototype.slice.call(document.body.querySelectorAll('*'))
    : [];
  out.counts.elements = all.length;

  // 只审"作者声明过"的属性。UA 默认值（h1 的 21.44px、button 的 6px 外边距）
  // 不是实现决定，报了只会淹没有效信号。
  //
  // 做法：每条规则只跑一次 querySelectorAll 反查受影响元素，建 prop → Map<Element, 原始值>。
  // 逐元素 el.matches(所有选择器) 在大页面上是 O(元素 × 规则)，这里压到 O(规则 × 子树)。
  const declaredByProp = {};
  cfg.lengthProps.forEach((p) => { declaredByProp[p] = new Map(); });

  const ruleApplies = (rule) => {
    const cond = rule.conditionText;
    if (!cond) return true;
    try {
      if (typeof rule.media !== 'undefined' && rule.media) {
        return window.matchMedia(cond).matches;
      }
    } catch (e) { return false; }
    return true;
  };

  const visitRules = (rules, depth) => {
    if (!rules || depth > 6) return;
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];
      if (!rule) continue;
      if (typeof rule.cssRules !== 'undefined' && rule.cssRules
        && !rule.selectorText) {
        if (ruleApplies(rule)) visitRules(rule.cssRules, depth + 1);
        continue;
      }
      const style = rule.style;
      const sel = rule.selectorText;
      if (!style || !sel) continue;
      let nodes = null;
      for (let p = 0; p < cfg.lengthProps.length; p++) {
        const prop = cfg.lengthProps[p];
        const value = style.getPropertyValue(prop);
        if (!value) continue;
        if (nodes === null) {
          try { nodes = document.querySelectorAll(sel); } catch (e) { nodes = []; }
        }
        const map = declaredByProp[prop];
        for (let k = 0; k < nodes.length; k++) {
          if (!map.has(nodes[k])) map.set(nodes[k], value);
        }
      }
    }
  };

  for (let i = 0; i < document.styleSheets.length; i++) {
    let rules = null;
    try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
    visitRules(rules, 0);
  }
  // CSS-in-JS / Shadow DOM 库常用构造样式表
  try {
    const adopted = document.adoptedStyleSheets;
    if (adopted) {
      for (let i = 0; i < adopted.length; i++) visitRules(adopted[i].cssRules, 0);
    }
  } catch (e) { /* 不支持时跳过 */ }

  // 行内样式优先级最高
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const inline = el.style;
    if (!inline) continue;
    for (let p = 0; p < cfg.lengthProps.length; p++) {
      const prop = cfg.lengthProps[p];
      const value = inline.getPropertyValue(prop);
      if (value) declaredByProp[prop].set(el, value);
    }
  }

  // 作者是否声明过这个属性（含纯字面值）
  const authorDeclared = (el, prop) => declaredByProp[prop].has(el);

  // 该值是否由光学 token 供给：只认声明本身写了 var(--label-gap) 这类。
  // 不走"计算值与某个光学 token 的 px 恰好相等"的兜底——--label-gap 与 --s-2
  // 都可能是 8px，值比对会给出假通过。
  const opticalNames = new Set(out.optical || []);
  const opticalSource = (el, prop) => {
    const decl = declaredByProp[prop].get(el);
    if (!decl) return null;
    const m = String(decl).match(/var\(\s*(--[a-zA-Z0-9_-]+)/);
    if (!m || !opticalNames.has(m[1])) return null;
    return m[1];
  };

  const skipProps = { 'row-gap': 1, 'column-gap': 1 };
  let structureOverflow = false;
  for (let i = 0; i < all.length; i++) {
    if (i >= cfg.maxElements) {
      out.counts.truncated = true;
      break;
    }
    const el = all[i];
    if (SKIP_TAGS[el.tagName]) continue;
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    const display = cs.display;
    for (let p = 0; p < cfg.lengthProps.length; p++) {
      const prop = cfg.lengthProps[p];
      if (skipProps[prop] && display !== 'flex' && display !== 'grid'
        && display !== 'inline-flex' && display !== 'inline-grid') {
        continue;
      }
      if (!authorDeclared(el, prop)) continue;
      const value = num(cs.getPropertyValue(prop));
      if (value === null || value === 0) continue;
      out.structureChecked++;
      const token = opticalSource(el, prop);
      if (token) {
        out.structureExplained++;
        continue;
      }
      const offGrid = Math.abs(value - Math.round(value / cfg.gridStep) * cfg.gridStep);
      if (offGrid < cfg.gridEps) continue;
      out.structureOffGrid++;
      if (out.structure.length >= cfg.maxStructure) {
        structureOverflow = true;
        continue;
      }
      out.structure.push({
        selector: selectorFor(el),
        prop,
        value: round(value, 3),
        raw: String(cs.getPropertyValue(prop)).trim(),
      });
    }
  }
  if (structureOverflow) out.counts.truncated = true;

  // ---- R4：输入框
  const inputSel = 'input, textarea, select';
  const SKIP_INPUT_TYPES = {
    hidden: 1, submit: 1, reset: 1, button: 1, image: 1, file: 1,
    checkbox: 1, radio: 1, range: 1, color: 1,
  };
  Array.prototype.forEach.call(document.querySelectorAll(inputSel), (el) => {
    const type = String(el.getAttribute('type') || '').toLowerCase();
    if (type && SKIP_INPUT_TYPES[type]) return;
    if (!isVisible(el)) return;
    const cs = getComputedStyle(el);
    out.inputs.push({
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      type: type || null,
      boxShadow: String(cs.boxShadow || '').trim(),
      borderTop: String(cs.borderTopWidth || '') + ' ' + String(cs.borderTopStyle || ''),
    });
  });

  // ---- R7：计时器
  Array.prototype.forEach.call(document.querySelectorAll('.timer, [data-timer]'), (el) => {
    if (!isVisible(el)) return;
    const cs = getComputedStyle(el);
    out.timers.push({
      selector: selectorFor(el),
      fontVariantNumeric: String(cs.fontVariantNumeric || '').trim(),
      fontFamily: String(cs.fontFamily || '').trim(),
    });
  });

  // ---- R8：设置行
  const LABEL_SEL = 'label, [data-label], .label, .field-label, .settings-label, .row-label';
  const CONTROL_SEL = '[data-control], input, select, textarea, button, [role="switch"], '
    + '[role="checkbox"], [role="combobox"], .switch, .toggle, .control';
  Array.prototype.forEach.call(document.querySelectorAll('[data-settings-row]'), (row) => {
    if (!isVisible(row)) return;
    const cs = getComputedStyle(row);
    const rect = row.getBoundingClientRect();
    const label = row.querySelector(LABEL_SEL);
    const control = row.querySelector(CONTROL_SEL);
    const lr = label ? label.getBoundingClientRect() : null;
    const cr = control ? control.getBoundingClientRect() : null;
    out.settingsRows.push({
      selector: selectorFor(row),
      height: round(rect.height, 2),
      width: round(rect.width, 2),
      hasLabel: !!label,
      hasControl: !!control,
      labelLeft: lr ? round(lr.left, 2) : null,
      labelRight: lr ? round(lr.right, 2) : null,
      controlLeft: cr ? round(cr.left, 2) : null,
      controlRight: cr ? round(cr.right, 2) : null,
      rowLeft: round(rect.left, 2),
      rowRight: round(rect.right, 2),
      borderBottomStyle: String(cs.borderBottomStyle || '').trim(),
      borderBottomWidth: num(cs.borderBottomWidth),
      borderBottomColor: String(cs.borderBottomColor || '').trim(),
    });
  });

  // ---- R9：表单字段
  Array.prototype.forEach.call(document.querySelectorAll('[data-field]'), (field) => {
    if (!isVisible(field)) return;
    const cs = getComputedStyle(field);
    const label = field.querySelector(LABEL_SEL);
    const input = field.querySelector('input:not([type="hidden"]), textarea, select');
    const fr = field.getBoundingClientRect();
    const padL = num(cs.paddingLeft) || 0;
    const padR = num(cs.paddingRight) || 0;
    const contentWidth = Math.max(0, field.clientWidth - padL - padR);
    const lr = label ? label.getBoundingClientRect() : null;
    const ir = input ? input.getBoundingClientRect() : null;
    out.fields.push({
      selector: selectorFor(field),
      hasLabel: !!label,
      hasInput: !!input,
      labelBottom: lr ? round(lr.bottom, 2) : null,
      labelLeft: lr ? round(lr.left, 2) : null,
      inputTop: ir ? round(ir.top, 2) : null,
      inputLeft: ir ? round(ir.left, 2) : null,
      inputWidth: ir ? round(ir.width, 2) : null,
      containerWidth: round(contentWidth, 2),
      containerBorderWidth: round(fr.width, 2),
      gapLabelToInput: lr && ir ? round(ir.top - lr.bottom, 2) : null,
    });
  });

  return out;
}

// ---------------------------------------------------------------------------
// 颜色解析（Node 侧，判定 R2 用）
// ---------------------------------------------------------------------------

function parseCssColor(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  try {
    if (s.startsWith('#')) {
      return rgbToOklch(hexToRgb(s));
    }
    if (/^oklch\(/i.test(s)) {
      const { L, C, H } = parseOklch(s);
      return { L, C, H };
    }
    // oklab(L a b) 是 OKLCH 的直角坐标形式：C = hypot(a,b)，H = atan2(b,a)。
    // color-mix() 在现代浏览器里就回落成这种格式，不认它会让 R2 断链。
    const lab = s.match(/^oklab\(\s*([\d.]+%?)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i);
    if (lab) {
      const L = lab[1].endsWith('%') ? parseFloat(lab[1]) / 100 : parseFloat(lab[1]);
      const a = parseFloat(lab[2]);
      const b = parseFloat(lab[3]);
      if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
      const C = Math.hypot(a, b);
      const H = C < 1e-6 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
      return { L, C, H };
    }
    const m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const parts = m[1].replace(/\//g, ' ').split(/[,\s]+/).filter(Boolean);
      if (parts.length < 3) return null;
      const chan = (v) => {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) return null;
        return v.includes('%') ? n / 100 : n / 255;
      };
      const rgb = [chan(parts[0]), chan(parts[1]), chan(parts[2])];
      if (rgb.some((v) => v === null)) return null;
      return rgbToOklch(rgb);
    }
    // color(srgb ...) / 其它：无法可靠解析
    return null;
  } catch {
    return null;
  }
}

// box-shadow 按顶层逗号切分（rgb() 里的逗号不能切）
function splitShadowList(expr) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(expr || '')) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------

class Findings {
  constructor() {
    this.items = [];
    this.skipped = [];
  }
  push(rule, status, selector, expected, actual, message) {
    this.items.push({ rule, status, expected, actual, selector, message });
  }
  error(rule, selector, expected, actual, message) {
    this.push(rule, 'error', selector, expected, actual, message);
  }
  warn(rule, selector, expected, actual, message) {
    this.push(rule, 'warn', selector, expected, actual, message);
  }
  pass(rule, selector, expected, actual, message) {
    this.push(rule, 'pass', selector, expected, actual, message);
  }
  skip(rule, reason) {
    this.skipped.push({ rule, reason });
  }
  get errors() { return this.items.filter((i) => i.status === 'error'); }
  get warnings() { return this.items.filter((i) => i.status === 'warn'); }
}

const fmt = (n, p = 2) => (typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(p)) : n);

function checkR1(facts, findings, rules) {
  const rule = 'R1-structure';
  if (!rules.has(rule)) return;
  const rows = facts.structure || [];
  const checked = Number(facts.structureChecked) || 0;
  const explained = Number(facts.structureExplained) || 0;

  // 同一元素同一数值的四个方向（padding: 10px）合成一条，属性名并列出来
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.selector}|${row.value}`;
    if (!groups.has(key)) groups.set(key, { selector: row.selector, value: row.value, props: [] });
    const g = groups.get(key);
    if (!g.props.includes(row.prop)) g.props.push(row.prop);
  }
  const violations = groups.size;
  for (const g of groups.values()) {
    findings.warn(rule, g.selector,
      '4 的倍数',
      `${fmt(g.value, 3)}px`,
      `${g.props.join(' / ')} ${fmt(g.value, 3)}px 不在 4pt 网格上，且不来自光学 token`);
  }

  if (!checked) {
    findings.skip(rule, '页面上没有作者声明的可测 margin / padding / gap');
    return;
  }
  const offGrid = Number(facts.structureOffGrid) || violations;
  const onGrid = Math.max(0, checked - explained - offGrid);
  // 有偏离时这条是汇总行（不是纯通过），用状态反映真实结论
  const status = offGrid ? 'warn' : 'pass';
  findings.push(rule, status, ':root',
    '结构值对齐 4pt 网格',
    `${onGrid}/${checked} 对齐，${explained} 个走光学 token，${offGrid} 个偏离`,
    `检查 ${checked} 个作者声明的结构值：${onGrid} 个对齐，`
    + `${explained} 个走光学 token，${offGrid} 个偏离`
    + (facts.counts?.truncated ? '（页面过大，明细已截断）' : ''));
}

function checkR2(facts, findings, rules) {
  const rule = 'R2-scale';
  if (!rules.has(rule)) return;
  const names = ['--surface-1', '--surface-2', '--surface-3'];
  const resolved = facts.surfaces || {};

  const missing = names.filter((n) => !resolved[n]);
  if (missing.length === names.length) {
    findings.skip(rule, `:root 上读不到 ${names.join(' / ')}（页面没有表面阶梯？）`);
    return;
  }
  if (missing.length) {
    findings.warn(rule, missing[0],
      'surface 阶梯完整',
      `缺 ${missing.join(', ')}`,
      `表面阶梯不完整，只能检查已有层级`);
  }

  // 逐层相邻比较。中间任何一层解析不了就断链——不能跨层拿 1 和 3 相比，
  // 那会把"缺少一层"误报成"ΔL 越界"。
  let prev = null;
  let compared = 0;
  for (const name of names) {
    const raw = resolved[name];
    if (!raw) { prev = null; continue; }
    const lch = parseCssColor(raw);
    if (!lch) {
      findings.warn(rule, name,
        '可解析的颜色值',
        String(raw).slice(0, 60),
        `无法解析为 sRGB / oklch / oklab，${name} 与下一层之间的 ΔL 未校验`);
      prev = null;
      continue;
    }
    const cur = { name, L: lch.L };
    if (prev) {
      const d = Math.abs(prev.L - cur.L);
      const ok = d >= DL_MIN - DL_EPS && d <= DL_MAX + DL_EPS;
      const expected = `ΔL ∈ [${DL_MIN.toFixed(3)}, ${DL_MAX.toFixed(3)}]`;
      const actual = `ΔL ${fmt(d, 4)}`;
      compared++;
      if (ok) {
        findings.pass(rule, cur.name, expected, actual, `${prev.name} → ${cur.name} ΔL ${fmt(d, 4)}`);
      } else {
        findings.error(rule, cur.name, expected, actual,
          `ΔL ${fmt(d, 4)} 超出 [${DL_MIN.toFixed(3)},${DL_MAX.toFixed(3)}]`);
      }
    }
    prev = cur;
  }
  if (!compared) findings.skip(rule, '相邻表面层不足两项可解析，无法计算 ΔL');
}

function checkR4(facts, findings, rules) {
  const rule = 'R4-inset';
  if (!rules.has(rule)) return;
  const inputs = facts.inputs || [];
  if (!inputs.length) {
    findings.skip(rule, '页面上没有可见的 input / textarea / select');
    return;
  }
  for (const el of inputs) {
    const shadows = splitShadowList(el.boxShadow);
    const isNone = shadows.length === 1 && shadows[0].toLowerCase() === 'none';
    const outer = isNone ? [] : shadows.filter((s) => !/\binset\b/i.test(s));
    const inset = isNone ? [] : shadows.filter((s) => /\binset\b/i.test(s));

    const problems = [];
    if (!outer.length) problems.push('缺外投影');
    if (!inset.length) problems.push('缺 inset 内环');

    if (!problems.length) {
      findings.pass(rule, el.selector, '外投影 + inset 内环', `${shadows.length} 层 shadow`);
      continue;
    }
    const actual = isNone ? 'box-shadow: none' : `外投影 ${outer.length} 层 / inset ${inset.length} 层`;
    findings.error(rule, el.selector,
      '外投影 + 至少一条 inset 内环',
      actual,
      `${problems.join('，')}：${actual}`);
  }
}

function checkR5(facts, findings, rules, theme) {
  const rule = 'R5-dark';
  if (!rules.has(rule)) return;
  if (theme !== 'dark') {
    findings.skip(rule, '--theme 不是 dark；R5 只在暗色下可判');
    return;
  }
  const w = facts.weights;
  if (!w || !w.dark) {
    findings.skip(rule, '页面没有返回 --fw-* 计算值');
    return;
  }
  const roles = [
    { key: 'body', token: '--fw-body', min: 300 },
    { key: 'strong', token: '--fw-strong', min: 0 },
    { key: 'display', token: '--fw-display', min: 0 },
  ];
  for (const { key, token, min } of roles) {
    const darkVal = parseFloat(String(w.dark[key] ?? '').trim());
    const lightVal = parseFloat(String(w.light?.[key] ?? '').trim());
    const darkRaw = String(w.dark[key] ?? '').trim() || '(空)';
    const lightRaw = String(w.light?.[key] ?? '').trim() || '(空)';

    if (!Number.isFinite(darkVal)) {
      findings.error(rule, ':root', `${token} 有数值`, darkRaw,
        `读不到 ${token} 的 dark 计算值`);
      continue;
    }
    if (!Number.isFinite(lightVal)) {
      findings.warn(rule, ':root', `${token} 有 light 基线`, lightRaw,
        `读不到 ${token} 的 light 基线，无法比较降档`);
    } else if (darkVal >= lightVal) {
      findings.error(rule, ':root',
        `${token} dark < light (${lightVal})`,
        `${darkVal}`,
        `${token} 暗色 ${darkVal} 未低于 light 基线 ${lightVal}：字重没有降一档`);
    } else {
      findings.pass(rule, ':root',
        `${token} dark < light (${lightVal})`,
        `${darkVal}`,
        `${token} ${lightVal} → ${darkVal}`);
    }
    if (min && darkVal < min) {
      findings.error(rule, ':root', `${token} ≥ ${min}`, `${darkVal}`,
        `${token} 暗色 ${darkVal} 低于护栏 ${min}`);
    }
  }
}

function checkR7(facts, findings, rules) {
  const rule = 'R7-timer';
  if (!rules.has(rule)) return;
  const timers = facts.timers || [];
  if (!timers.length) {
    findings.skip(rule, '页面上没有 .timer / [data-timer]');
    return;
  }
  for (const el of timers) {
    const value = el.fontVariantNumeric || '';
    const ok = /tabular-nums/i.test(value);
    if (ok) {
      findings.pass(rule, el.selector, '含 tabular-nums', value);
    } else {
      findings.error(rule, el.selector, 'font-variant-numeric 含 tabular-nums',
        value || '(空 / normal)',
        `计时器没有 tabular-nums：数字会随字形宽度跳动（字体 ${el.fontFamily || '未知'}）`);
    }
  }
}

function checkR8(facts, findings, rules) {
  const rule = 'R8-settings';
  if (!rules.has(rule)) return;
  const rows = facts.settingsRows || [];
  if (!rows.length) {
    findings.skip(rule, '页面上没有 [data-settings-row]');
    return;
  }
  for (const row of rows) {
    const problems = [];

    if (!row.hasLabel || !row.hasControl) {
      problems.push(!row.hasLabel ? '找不到标签' : '找不到控件');
    } else if (!(row.labelLeft < row.controlLeft)) {
      problems.push(`标签不在控件左侧（label.left ${fmt(row.labelLeft)} ≥ control.left ${fmt(row.controlLeft)}）`);
    }

    const hasBorder = (row.borderBottomWidth || 0) > 0
      && !['none', 'hidden'].includes(String(row.borderBottomStyle || '').toLowerCase());
    if (!hasBorder) {
      problems.push(`缺下边框（border-bottom ${fmt(row.borderBottomWidth || 0)}px ${row.borderBottomStyle || 'none'}）`);
    }

    const h = row.height;
    if (!(h >= ROW_MIN - 0.5 && h <= ROW_MAX + 0.5)) {
      problems.push(`行高 ${fmt(h)}px 不在 ${ROW_MIN}–${ROW_MAX}px`);
    }

    if (!problems.length) {
      findings.pass(rule, row.selector,
        `标签在左 / 有下边框 / 行高 ${ROW_MIN}–${ROW_MAX}px`,
        `${fmt(h)}px`,
        `label.left ${fmt(row.labelLeft)} < control.left ${fmt(row.controlLeft)}`);
    } else {
      findings.error(rule, row.selector,
        `标签在左 / 有下边框 / 行高 ${ROW_MIN}–${ROW_MAX}px`,
        `行高 ${fmt(h)}px`,
        problems.join('；'));
    }
  }
}

function checkR9(facts, findings, rules) {
  const rule = 'R9-form';
  if (!rules.has(rule)) return;
  const fields = facts.fields || [];
  if (!fields.length) {
    findings.skip(rule, '页面上没有 [data-field]');
    return;
  }
  for (const f of fields) {
    const problems = [];
    if (!f.hasLabel || !f.hasInput) {
      problems.push(!f.hasLabel ? '找不到标签' : '找不到输入控件');
    } else {
      if (!(f.labelBottom <= f.inputTop + 0.5)) {
        problems.push(`标签不在输入之上（label.bottom ${fmt(f.labelBottom)} > input.top ${fmt(f.inputTop)}）`);
      }
      const ratio = f.containerWidth > 0 ? f.inputWidth / f.containerWidth : 0;
      if (ratio < FIELD_FULL_WIDTH) {
        problems.push(`输入未全宽（${fmt(f.inputWidth)} / ${fmt(f.containerWidth)} = ${fmt(ratio, 3)} < ${FIELD_FULL_WIDTH}）`);
      }
    }

    if (!problems.length) {
      const ratio = f.inputWidth / f.containerWidth;
      findings.pass(rule, f.selector,
        `标签在上 / 输入全宽 ≥ ${FIELD_FULL_WIDTH}`,
        `宽度比 ${fmt(ratio, 3)}，标签→输入 ${fmt(f.gapLabelToInput)}px`,
        `label.bottom ${fmt(f.labelBottom)} ≤ input.top ${fmt(f.inputTop)}`);
    } else {
      findings.error(rule, f.selector,
        `标签在上 / 输入全宽 ≥ ${FIELD_FULL_WIDTH}`,
        `input ${fmt(f.inputWidth)} / container ${fmt(f.containerWidth)}`,
        problems.join('；'));
    }
  }
}

function evaluateRules(facts, rules, theme) {
  const findings = new Findings();
  checkR1(facts, findings, rules);
  checkR2(facts, findings, rules);
  checkR4(facts, findings, rules);
  checkR5(facts, findings, rules, theme);
  checkR7(facts, findings, rules);
  checkR8(facts, findings, rules);
  checkR9(facts, findings, rules);
  return findings;
}

// ---------------------------------------------------------------------------
// 浏览器
// ---------------------------------------------------------------------------

// 浏览器不可用 = 环境问题（退出码 2）。页面加载失败不是环境问题，
// 不能拿 manual-required 掩盖过去（退出码 1）。
function isBrowserFailure(e) {
  if (e instanceof CdpError && e.detail?.navigationFailure) return false;
  return e instanceof CdpError || ['ENOENT', 'ETIMEDOUT', 'EPROTO'].includes(e?.code);
}

function reasonFor(e) {
  const code = e?.code ? `${e.code}: ` : '';
  const base = `${code}${e?.message || String(e)}`;
  // 只有"找到了上游但能力不足"才提 Proxy 的限制；完全找不到浏览器是另一回事
  const incompatible = /缺少能力/.test(base);
  let hint = '用 Chromium 111+ 以 --remote-debugging-port=9222 启动后重试（或用 --port 指向已有端口）。';
  if (incompatible) {
    hint = 'CDP Proxy 不提供 Emulation 端点，无法设置视口，'
      + '需改用 Chromium 111+ 以 --remote-debugging-port=9222 启动后重试。';
  }
  return `${base}。${hint}L2 几何审计必须人工完成或换环境重跑，不能记为自动通过。`;
}

const SETTLE_EXPRESSION =
  'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(' +
  '() => setTimeout(() => r(true), 80))))';

function collectConfig(cfg) {
  return {
    theme: cfg.theme,
    gridStep: GRID_STEP,
    gridEps: GRID_EPS,
    maxElements: 4000,
    maxStructure: 400,
    lengthProps: LENGTH_PROPS,
    opticalTokens: OPTICAL_TOKEN_NAMES,
    opticalPrefixes: OPTICAL_TOKEN_PREFIXES,
    customProps: [
      '--surface-1', '--surface-2', '--surface-3',
      '--fw-body', '--fw-strong', '--fw-display',
    ],
  };
}

async function audit(cfg) {
  let conn;
  try {
    conn = await connect({
      port: cfg.port,
      timeoutMs: 15000,
      need: ['setViewport'],
    });
  } catch (e) {
    if (isBrowserFailure(e)) return { status: 'manual-required', reason: reasonFor(e) };
    throw e;
  }

  try {
    await conn.setViewport(cfg.viewport.width, cfg.viewport.height, DPR);
    await conn.navigate(cfg.url);
    await conn.evaluate(SETTLE_EXPRESSION);

    const script = `(${collectFacts.toString()})(${JSON.stringify(collectConfig(cfg))})`;
    let facts;
    try {
      facts = await conn.evaluate(script);
    } catch (e) {
      if (e instanceof CdpError && e.detail?.exceptionDetails) {
        return {
          status: 'manual-required',
          reason: `采集脚本在页面里抛错：${e.message}`,
        };
      }
      throw e;
    }
    if (!facts || typeof facts !== 'object') {
      return { status: 'manual-required', reason: '采集脚本没有返回事实对象' };
    }

    // 表面色：优先用 :root 上的原始 token（hex / oklch 都能直接解析）。
    // 解析不了时（var() 间接、color-mix、命名色），让浏览器先算成 rgb() 再取回来。
    const SURFACES = ['--surface-1', '--surface-2', '--surface-3'];
    facts.surfaces = {};
    for (const n of SURFACES) facts.surfaces[n] = facts.root?.[n] || null;

    const unresolved = SURFACES.filter(
      (n) => facts.surfaces[n] && !parseCssColor(facts.surfaces[n]),
    );
    if (unresolved.length) {
      try {
        const expr = `(${((names) => {
          const probe = document.createElement('div');
          probe.style.cssText = 'position:absolute;left:-99999px;top:0;width:0;height:0;';
          document.documentElement.appendChild(probe);
          const out = {};
          try {
            for (const n of names) {
              probe.style.color = '';
              probe.style.color = `var(${n})`;
              out[n] = getComputedStyle(probe).color;
            }
          } finally {
            if (probe.parentNode) probe.parentNode.removeChild(probe);
          }
          return out;
        }).toString()})(${JSON.stringify(unresolved)})`;
        const resolved = await conn.evaluate(expr);
        for (const n of unresolved) {
          if (resolved?.[n]) facts.surfaces[n] = resolved[n];
        }
      } catch { /* 解析失败时让 checkR2 如实报"无法解析" */ }
    }

    return { status: 'ok', facts, upstream: conn.upstream, endpoint: conn.endpoint };
  } catch (e) {
    if (isBrowserFailure(e)) return { status: 'manual-required', reason: reasonFor(e) };
    throw e;
  } finally {
    await conn.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

function sortFindings(items) {
  return items.slice().sort((a, b) => {
    const ra = RULE_ORDER.get(a.rule) ?? 99;
    const rb = RULE_ORDER.get(b.rule) ?? 99;
    if (ra !== rb) return ra - rb;
    const rank = { error: 0, warn: 1, pass: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return String(a.selector).localeCompare(String(b.selector));
  });
}

function capFindings(items) {
  const byRule = new Map();
  for (const it of items) {
    if (!byRule.has(it.rule)) byRule.set(it.rule, []);
    byRule.get(it.rule).push(it);
  }
  const out = [];
  for (const [, list] of byRule) {
    let errors = 0;
    let passes = 0;
    for (const it of list) {
      if (it.status === 'pass') {
        if (passes >= MAX_PASSES) continue;
        passes++;
      } else {
        if (errors >= MAX_VIOLATIONS) continue;
        errors++;
      }
      out.push(it);
    }
  }
  return out;
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function report(cfg, result) {
  const checkedAt = new Date().toISOString();

  if (result.status === 'manual-required') {
    if (!cfg.json) {
      // 非 JSON 模式：人读的一行 + 机读块，CI 与终端都能直接消费
      console.error(`! manual-required — ${result.reason}`);
      console.error('  L2 几何审计未执行，不能记为通过。');
    }
    printJson({
      status: 'manual-required',
      gate: 'L2',
      checkedAt,
      view: cfg.view,
      theme: cfg.theme,
      reason: result.reason,
      findings: [],
      errorCount: 0,
      warningCount: 0,
    });
    return EXIT.ENV;
  }

  const findings = evaluateRules(result.facts, cfg.rules, cfg.theme);
  const sorted = capFindings(sortFindings(findings.items));
  const errors = findings.errors;
  const warnings = findings.warnings;

  if (cfg.json) {
    printJson({
      status: errors.length ? 'fail' : 'pass',
      gate: 'L2',
      checkedAt,
      view: cfg.view,
      theme: cfg.theme,
      url: result.facts.url || cfg.url,
      upstream: result.upstream,
      findings: sorted.map((f) => ({
        rule: f.rule,
        status: f.status,
        expected: f.expected,
        actual: f.actual,
        selector: f.selector,
        message: f.message,
      })),
      skipped: findings.skipped,
      errorCount: errors.length,
      warningCount: warnings.length,
    });
  } else {
    console.log(`audit · ${cfg.view} ${cfg.theme} · ${result.facts.url || cfg.url}`);
    console.log('');
    const sym = { pass: '✓', warn: '⚠', error: '✗' };
    for (const f of sorted) {
      const tail = f.message ? ` ${f.message}` : '';
      console.log(`${sym[f.status]} ${f.rule} ${f.selector}${tail}`);
    }
    for (const s of findings.skipped) {
      console.log(`— ${s.rule} 跳过：${s.reason}`);
    }
    console.log('');
    console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
    if (errors.length) console.log('L2 未通过：error 必须归零，G4 不能判 pass。');
  }

  return errors.length ? EXIT.VIOLATION : EXIT.PASS;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
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
    console.error(e.message);
    console.error(usage());
    process.exit(EXIT.INPUT);
  }

  let result;
  try {
    result = await audit(cfg);
  } catch (e) {
    console.error(`! 审计失败：${e?.message || e}`);
    process.exit(EXIT.VIOLATION);
  }

  process.exit(report(cfg, result));
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]).toLowerCase() === path.resolve(self).toLowerCase();
})();

if (isDirectRun) {
  main().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(EXIT.VIOLATION);
  });
}
