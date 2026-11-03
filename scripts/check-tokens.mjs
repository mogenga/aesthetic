#!/usr/bin/env node
/**
 * check-tokens.mjs — static lint for the aesthetic contract.
 *
 * Exit codes: 0 pass · 1 violations · 2 environment unavailable · 3 invalid input
 *
 * Usage:
 *   node check-tokens.mjs --project <dir> [--json] [--scan <glob>]... [--strict]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  parseOklch, oklchToHex, hexToRgb, contrastHex, contrastRatio,
} from './lib/oklch.mjs';
import { validate } from './lib/schema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const SCHEMA_FILE = path.join(SKILL_ROOT, 'schemas', 'decisions.schema.json');

const OUT_DIR = 'design/aesthetic';

const EXIT = { PASS: 0, VIOLATION: 1, ENV: 2, INPUT: 3 };

const DEFAULT_SCAN_EXT = ['.css', '.scss', '.less', '.tsx', '.jsx', '.ts', '.js',
  '.vue', '.svelte', '.astro', '.html'];

// Opaque pure-black literal forms. Alpha forms (rgb(0 0 0 / .2)) are allowed in
// shadows and hairlines per R3; L1 must judge by context, not by literal.
const PURE_BLACK = [
  /#000\b/i, /#000000\b/i,
  /rgb\(\s*0\s*[, ]\s*0\s*[, ]\s*0\s*\)/i,
  /oklch\(\s*0(?:\.0+)?\s+0\s+[\d.]+\s*\)/i,
];

const HEX_LITERAL = /#[0-9a-f]{3,8}\b/gi;
const RGB_LITERAL = /\brgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?(?:\s*[/,]\s*[\d.]+%?)?\s*\)/gi;
const OKLCH_LITERAL = /oklch\([^)]+\)/gi;

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { project: null, json: false, strict: false, scan: [], quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') opts.project = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--scan') opts.scan.push(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`check-tokens.mjs --project <dir> [--json] [--strict] [--scan <glob>]`);
      process.exit(EXIT.PASS);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(EXIT.INPUT);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// findings
// ---------------------------------------------------------------------------

class Report {
  constructor() { this.items = []; }
  add(level, rule, file, line, message, detail) {
    this.items.push({ level, rule, file, line, message, detail });
  }
  error(rule, file, line, message, detail) { this.add('error', rule, file, line, message, detail); }
  warn(rule, file, line, message, detail) { this.add('warn', rule, file, line, message, detail); }
  get errors() { return this.items.filter((i) => i.level === 'error'); }
  get warnings() { return this.items.filter((i) => i.level === 'warn'); }
}

// ---------------------------------------------------------------------------
// token loading
// ---------------------------------------------------------------------------

function loadDecisions(project, report) {
  const file = path.join(project, OUT_DIR, 'decisions.json');
  if (!fs.existsSync(file)) {
    report.error('E000', file, 0,
      'decisions.json 不存在。阶段未开始或路径错误。',
      '先跑 Phase 4，或在 --project 指向的项目里生成 decisions.json。');
    return null;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    report.error('E001', file, 0, `decisions.json 不是合法 JSON：${e.message}`);
    return null;
  }
  validateSchema(data, file, report);
  return { data, file };
}

function validateSchema(data, file, report) {
  // 1. JSON Schema — structural contract.
  if (fs.existsSync(SCHEMA_FILE)) {
    try {
      const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
      const res = validate(schema, data);
      for (const msg of res.errors) {
        report.error('E002', file, 0, `decisions.json 不符合 schema：${msg}`);
      }
    } catch (e) {
      report.warn('E002', file, 0, `schema 校验器不可用（${e.message}），跳过结构校验`);
    }
  } else {
    report.warn('E002', file, 0, `未找到 schemas/decisions.schema.json，跳过结构校验`);
  }

  // 2. semantic checks the schema can't express
  // translation must not be empty — this is the G2 gate's trace.
  if (data.translation && Object.keys(data.translation).length === 0) {
    report.error('R0', file, 0,
      'translation 为空：转写闸门（G2）被跳过。',
      'Phase 2.2 要求七维转写表有内容，即使某一维的 from 为 null。');
  }
  if (data.translation) {
    const required = ['neutralTemp', 'chromaCap', 'radius', 'border', 'shadow', 'weight', 'motion'];
    const missing = required.filter((k) => !(k in data.translation));
    if (missing.length) {
      report.warn('R0', file, 0, `translation 缺少维度：${missing.join(', ')}`);
    }
    for (const [k, v] of Object.entries(data.translation)) {
      if (v && typeof v === 'object' && !('from' in v)) {
        report.warn('T1', file, 0,
          `translation.${k} 缺少 \`from\` 字段；无方向依据时应显式写 null。`);
      }
    }
  }
  if (Array.isArray(data.overrides)) {
    checkOverrides(data, file, report);
  }
}

// ---------------------------------------------------------------------------
// overrides: 豁免必须能被机器复算
// ---------------------------------------------------------------------------
//
// 为什么要有 guard：`reason` 是自然语言，写「无」也能通过旧 schema。豁免如果
// 不能落成一条脚本能重算的断言，它就只是给偷懒盖了个章。guard 把「凭什么」
// 拆成 key: value 断言，由本文件重新推导——写得出 guard 的覆盖通常经得起看，
// 写不出的往往说明 guard 本身不成立。

const OVERRIDE_FIELDS = ['rule', 'scope', 'requestedValue', 'effectiveValue',
  'reason', 'guard', 'approvedBy', 'createdAt', 'expiresAt', 'verification'];

// 黑名单按「整条 / 整句」匹配，不做子串匹配：中文里「无」出现在
// 「无过渡边缘」这种正常理由里，子串会把好理由误杀。
// 后两项按规格只在「单独成句」时才算套话——「用户要求把描边加深」是有效
// 信息，不能因为出现了这个词就判死。
const REASON_BLACKLIST = ['无', '按需', '暂时', '以后再说', 'TODO',
  '设计需要', '品牌需要', '用户要求', '保持一致性'];
const STANDALONE_ONLY = new Set(['用户要求', '保持一致性']);

const GUARD_KEYS = new Set(['token', 'contrast', 'deltaL', 'surface']);
const SURFACE_NAME = /^(bg|surface-[123]|surface-sunken)$/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function checkOverrides(data, file, report) {
  const tokenSet = collectTokenNames(data, file);
  const seenRuleScope = new Map();
  const seenReason = new Map();

  data.overrides.forEach((o, i) => {
    const at = `overrides[${i}]`;
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      report.error('OV1', file, 0,
        `${at} 不是对象，无法登记豁免。`,
        'overrides[] 的每一项必须是含十字段的对象。');
      return;
    }

    // OV1 — 十字段缺一即未登记。
    const miss = OVERRIDE_FIELDS.filter((k) => !(k in o));
    if (miss.length) {
      report.error('OV1', file, 0,
        `${at} 缺字段：${miss.join(', ')}`,
        '缺任一项即视为未登记覆盖，G4 不通过。');
    }

    checkReason(o, i, at, file, report, seenReason);
    checkGuardField(o, at, data, tokenSet, file, report);

    // OV3 — agent 不能给自己批豁免。
    if (typeof o.approvedBy === 'string' &&
      /^(agent|claude|assistant|ai|模型)$/i.test(o.approvedBy.trim())) {
      report.error('OV3', file, 0,
        `${at}.approvedBy = "${o.approvedBy}"：豁免必须由用户批准。`,
        '只能写 user 或具体人名；agent 自批等于没批。');
    }

    // OV4 — 同规则同 scope 只能登记一次。同一规则不同 scope 是合法的：
    // R3 对不同 token 各登记一条，正是 scope 存在的意义。
    if (typeof o.rule === 'string' && typeof o.scope === 'string') {
      const key = `${o.rule}\u0000${o.scope}`;
      if (seenRuleScope.has(key)) {
        report.error('OV4', file, 0,
          `${at} 与 overrides[${seenRuleScope.get(key)}] 重复：rule ${o.rule} + scope "${o.scope}"。`,
          '同一豁免只能登记一次；不同 scope 请分成不同条目。');
      } else {
        seenRuleScope.set(key, i);
      }
    }
  });
}

function checkReason(o, i, at, file, report, seenReason) {
  if (typeof o.reason !== 'string') return; // 类型错误由 schema 报

  // 按 Unicode 码点计数：CJK 算 1，不要用 UTF-16 code unit 数。
  const reason = o.reason.trim();
  const len = [...reason].length;
  if (len < 24) {
    report.error('OV1', file, 0,
      `${at}.reason 只有 ${len} 个字符，少于 24。`,
      '写清为什么必须覆盖、覆盖的代价是什么；「无」「按需」这类登记不算留痕。');
  }

  // 整条或整句恰好是套话才算命中。TODO 例外：它出现在哪都说明没写完。
  const norm = (s) => s.trim().replace(/[。．.!！?？;；,，、\s]+$/u, '');
  const sentences = reason.split(/[。．.!！?？;；\n]+/u).map(norm).filter(Boolean);
  const whole = norm(reason);
  const hit = REASON_BLACKLIST.find((entry) => {
    const e = norm(entry).toLowerCase();
    // TODO 出现在哪都说明没写完，不需要单独成句。
    if (e === 'todo' && /\btodo\b/i.test(reason)) return true;
    if (whole.toLowerCase() === e) return true;
    if (sentences.some((s) => s.toLowerCase() === e)) return true;
    if (STANDALONE_ONLY.has(entry)) return false;
    // 非「单独成句」项：以套话开头再接逗号/顿号（如「设计需要，别问」）同样是
    // 空话，但后面必须紧跟标点，避免把「无可奉告的具体理由……」误伤。
    return new RegExp(`^${escapeRe(entry)}\\s*[，,、:：]`).test(reason);
  });
  if (hit) {
    report.error('OV1', file, 0,
      `${at}.reason 命中套话黑名单："${hit}"。`,
      '套话无法说明决策，三个月后没人能判断这是决策还是偷懒。');
  }

  // 两条 override 逐字相同 = 复制粘贴，不是两个独立决策。
  // 用原文比较（不 trim），「逐字」就该按原文算。
  const key = o.reason;
  if (key.trim() && seenReason.has(key)) {
    report.error('OV1', file, 0,
      `${at}.reason 与 overrides[${seenReason.get(key)}] 完全相同。`,
      '每条覆盖的代价不同，理由不应该复制粘贴。');
  } else if (key.trim()) {
    seenReason.set(key, i);
  }
}

/** token 名集合：decisions.color 的任一主题 + 已生成的 tokens.json。 */
function collectTokenNames(data, decisionsFile) {
  const names = new Set();
  const add = (color) => {
    for (const theme of Object.keys(color || {})) {
      for (const name of Object.keys(color[theme] || {})) names.add(name);
    }
  };
  add(data.color);
  // tokens.json 是派生物，可能还没生成；缺失时 decisions.color 已经够用。
  if (decisionsFile) {
    try {
      const tokens = JSON.parse(
        fs.readFileSync(path.join(path.dirname(decisionsFile), 'tokens.json'), 'utf8'),
      );
      add(tokens.color);
    } catch { /* 没有派生物不阻断 */ }
  }
  return names;
}

function checkGuardField(o, at, data, tokenSet, file, report) {
  if (typeof o.guard !== 'string') return; // 缺失/类型错误由 OV1 + schema 报
  checkGuardSegments(o.guard, data, tokenSet, at, file, report);
}

/**
 * 逐段复算 guard。测试走 CLI（临时项目），不从这里 import——本文件底部会
 * 直接执行 main()，import 会带着进程退出。
 * 至少一条可识别断言通过才算数；一条都过不了就别登记了。
 */
function checkGuardSegments(guard, data, tokenSet, at, file, report) {
  // 中文输入法下分号常被打成全角「；」，语义相同，一并接受，避免一条
  // 格式正确的 guard 因为标点被判成「无法复算」。
  const segments = String(guard).split(/[;；]/).map((s) => s.trim()).filter(Boolean);
  let passed = 0;

  for (const seg of segments) {
    const m = seg.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
    if (!m) {
      report.warn('ADVISORY', file, 0,
        `${at}.guard 段无法复算："${seg}"`,
        '每段应为 `key: value`；无法识别的段不阻断，但也不构成证据。');
      continue;
    }
    const key = m[1];
    const raw = m[2].trim();
    if (!GUARD_KEYS.has(key)) {
      report.warn('ADVISORY', file, 0,
        `${at}.guard 无法复算的 guard 段："${seg}"`,
        `只识别 ${[...GUARD_KEYS].join(' / ')} 四种 key。`);
      continue;
    }
    if (runGuardAssertion(key, raw, data, tokenSet, at, file, report)) passed++;
  }

  // 硬规则：至少一条可识别断言必须通过。不通过的断言已经各自报过 OV2，
  // 这里再补一条总判，保证「全部不成立」时也有一条一眼能看到的结论。
  if (passed === 0) {
    report.error('OV2', file, 0,
      `OV2: guard 无法复算 — ${at}.guard 没有任何一条可识别断言通过。`,
      'guard 必须是脚本能重算的断言，如 `token: bg; contrast: fg/bg >= 4.5`。');
  }
  return passed;
}

/** 复算一条断言，返回是否成立；不成立时在这里单独报 OV2。 */
function runGuardAssertion(key, raw, data, tokenSet, at, file, report) {
  const pass = () => true;
  const fail = () => false;

  if (key === 'token') {
    const name = raw.replace(/^--/, '');
    if (!tokenSet.has(name)) {
      report.error('OV2', file, 0,
        `${at}.guard：token "${name}" 不在 color 任一分主题或 tokens.json 的 token 列表里。`,
        '引用不存在的 token 不构成豁免依据。');
      return fail();
    }
    return pass();
  }

  if (key === 'contrast') {
    const m = raw.match(/^(\S+)\s*\/\s*(\S+)\s*(>=|≥)\s*([0-9]*\.?[0-9]+)$/);
    if (!m) {
      report.error('OV2', file, 0,
        `${at}.guard：contrast 断言格式应为 \`fg/bg >= 4.5\`（或 ≥），实际 "${raw}"。`);
      return fail();
    }
    const [, a, b, , minRaw] = m;
    const pair = resolveColorPair(data, a, b);
    if (!pair) {
      report.error('OV2', file, 0,
        `${at}.guard：contrast 引用的 ${a}/${b} 不是同一主题下的 color token。`,
        '两个名字都必须出现在 decisions.color 的同一主题里。');
      return fail();
    }
    const hexA = toHex(pair.a);
    const hexB = toHex(pair.b);
    if (!hexA || !hexB) {
      report.error('OV2', file, 0,
        `${at}.guard：${a}/${b} 无法转成 sRGB，对比度不能复算。`);
      return fail();
    }
    const min = Number(minRaw);
    const ratio = contrastRatio(hexToRgb(hexA), hexToRgb(hexB));
    if (ratio < min - 1e-9) {
      report.error('OV2', file, 0,
        `${at}.guard：${a}/${b} 实测 ${ratio.toFixed(2)}:1 < ${min}:1（${pair.theme}）。`,
        'guard 断言的对比度必须真的达标。');
      return fail();
    }
    return pass();
  }

  if (key === 'deltaL') {
    const m = raw.match(/^([0-9]*\.?[0-9]+)\s*-\s*([0-9]*\.?[0-9]+)$/);
    if (!m) {
      report.error('OV2', file, 0,
        `${at}.guard：deltaL 断言格式应为 \`0.010-0.030\`，实际 "${raw}"。`);
      return fail();
    }
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    const steps = data.surfaceLadder?.step;
    if (!Array.isArray(steps) || !steps.length) {
      report.error('OV2', file, 0,
        `${at}.guard：deltaL 断言无法复算——surfaceLadder.step 缺失。`);
      return fail();
    }
    let ok = true;
    steps.forEach((s, j) => {
      if (typeof s !== 'number' || s < lo - 1e-9 || s > hi + 1e-9) {
        ok = false;
        report.error('OV2', file, 0,
          `${at}.guard：surfaceLadder.step[${j}] = ${s}，不在断言区间 [${lo}, ${hi}] 内。`);
      }
    });
    return ok ? pass() : fail();
  }

  if (key === 'surface') {
    // 只校验名字形态。surface-sunken 在部分项目里是可选 token，要求它必须
    // 存在会把合法的 R4 豁免挡掉；名字写错（surface-4、surface 之类）才是
    // 这里要抓的。
    if (!SURFACE_NAME.test(raw)) {
      report.error('OV2', file, 0,
        `${at}.guard：surface "${raw}" 不是合法表面名（bg / surface-1/2/3 / surface-sunken）。`);
      return fail();
    }
    return pass();
  }

  return fail();
}

/** 优先浅色；同一主题下两个 token 都存在才算一对。 */
function resolveColorPair(data, a, b) {
  for (const theme of ['light', 'dark']) {
    const c = data.color?.[theme];
    if (c && c[a] && c[b]) return { theme, a: c[a], b: c[b] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// color policy checks
// ---------------------------------------------------------------------------

function collectColorEntries(color) {
  const out = [];
  for (const theme of Object.keys(color || {})) {
    for (const [name, val] of Object.entries(color[theme] || {})) {
      if (val && typeof val === 'object' && typeof val.oklch === 'string') {
        out.push({ theme, name, ...val });
      }
    }
  }
  return out;
}

function checkColorPolicy(data, file, report) {
  const entries = collectColorEntries(data.color);

  // R3: no opaque pure black in text / background / border roles.
  for (const e of entries) {
    const hex = (e.hex || '').toLowerCase();
    const isOpaqueBlack =
      hex === '#000' || hex === '#000000' ||
      /^oklch\(\s*0(?:\.0+)?\s+0\s+[\d.]+/.test(e.oklch || '');
    if (isOpaqueBlack) {
      const exempt = (data.overrides || []).find(
        (o) => o.rule === 'R3' && String(o.scope || '').includes(e.name)
      );
      if (!exempt) {
        report.error('R3', file, 0,
          `${e.theme}.${e.name} 是不透明纯黑（${e.hex || e.oklch}）。`,
          '改用 #1A1A19，或登记 override 并在 scope 里写明该 token。');
      }
    }
  }

  // R2: surface ladder ΔL ∈ [0.010, 0.030].
  const ladder = data.surfaceLadder;
  if (ladder && Array.isArray(ladder.step)) {
    ladder.step.forEach((s, i) => {
      if (typeof s !== 'number' || Number.isNaN(s)) {
        report.error('R2', file, 0, `surfaceLadder.step[${i}] 不是数字`);
      } else if (s < 0.010 - 1e-9 || s > 0.030 + 1e-9) {
        report.error('R2', file, 0,
          `surfaceLadder.step[${i}] = ${s}，超出 [0.010, 0.030]。`,
          'ΔL = |L₁ − L₂|，是 OKLCH L 的绝对差值，不是相对百分比。');
      }
    });
  }

  // Recompute ΔL from the actual light-theme surface tokens when present.
  const light = data.color?.light || {};
  const surfaces = Object.keys(light)
    .filter((k) => /^surface-?\d+$/.test(k))
    .sort((a, b) => num(a) - num(b));
  const bg = light.bg;
  if (bg && surfaces.length) {
    const chain = [bg, ...surfaces.map((k) => light[k])];
    for (let i = 1; i < chain.length; i++) {
      const prev = readL(chain[i - 1]);
      const cur = readL(chain[i]);
      if (prev == null || cur == null) continue;
      const d = Math.abs(prev - cur);
      if (d < 0.010 - 1e-9 || d > 0.030 + 1e-9) {
        report.error('R2', file, 0,
          `${surfaces[i - 1]} 相对上一层的实际 ΔL = ${d.toFixed(4)}，超出 [0.010, 0.030]。`);
      }
    }
  }

  // Contrast: text roles must pass WCAG 2.2 AA.
  for (const theme of Object.keys(data.color || {})) {
    const c = data.color[theme];
    if (!c || !c.bg || !c.fg) continue;
    const bgHex = toHex(c.bg);
    // R4: the focus ring must be measurable against the control surface, not
    // just against the page. `--line-inset` is deliberately a *low-contrast*
    // hairline (fg 8%) — it is the "咬合" line, not the 3:1 boundary. The 3:1
    // boundary is the focus ring, so that is what we check.
    const sunkenHex = toHex(c['surface-sunken']) || bgHex;
    const checks = [
      ['fg', 4.5, '正文', bgHex],
      ['fg-muted', 4.5, '次要文本', bgHex],
      ['accent', 3.0, '焦点指示 / 非文本控件', bgHex],
      ['accent', 3.0, '焦点内环 vs 输入框底', sunkenHex],
    ];
    // Filled controls put text on a saturated ground. Comparing fg/bg says
    // nothing about them, and this is exactly where a palette breaks silently.
    if (c['on-accent']) checks.push(['on-accent', 4.5, '主按钮文字', toHex(c.accent)]);
    if (c['on-danger']) checks.push(['on-danger', 4.5, '危险按钮文字', toHex(c.danger)]);
    if (c['on-danger'] && !c.danger) {
      report.warn('A11Y', file, 0,
        `${theme}.on-danger 已定义但 ${theme}.danger 没有，无法校验按钮文字对比度。`);
    }
    for (const [name, min, label, against] of checks) {
      if (!c[name]) continue;
      const fgHex = toHex(c[name]);
      const bgForCheck = against || bgHex;
      if (!bgForCheck || !fgHex) continue;
      const ratio = contrastHex(fgHex, bgForCheck);
      if (ratio < min) {
        const surface = name === 'on-accent' ? 'accent'
          : name === 'on-danger' ? 'danger'
            : bgForCheck === sunkenHex && against !== bgHex ? '输入框底' : 'bg';
        report.error('A11Y', file, 0,
          `${theme}.${name}（${label}）对 ${surface} 的对比度 ${ratio.toFixed(2)}:1 < ${min}:1。`);
      }
    }
  }
}

const num = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || 0;

function readL(entry) {
  if (!entry) return null;
  if (typeof entry.l === 'number') return entry.l;
  if (typeof entry.oklch === 'string') {
    try { return parseOklch(entry.oklch).L; } catch { return null; }
  }
  return null;
}

function toHex(entry) {
  if (!entry) return null;
  if (entry.hex) return entry.hex;
  if (entry.oklch) {
    try { return oklchToHex(parseOklch(entry.oklch)).hex; } catch { return null; }
  }
  return null;
}

// ---------------------------------------------------------------------------
// R5: dark-mode weight downgrade must exist
// ---------------------------------------------------------------------------

function checkDarkWeights(data, file, report) {
  const hasDark = !!(data.color && data.color.dark);
  if (!hasDark) return;

  const weights = data.weightLadder?.available;
  if (Array.isArray(weights) && weights.length === 0) {
    report.error('R5', file, 0, 'weightLadder.available 为空');
    return;
  }

  const darkWeights = data.weights?.dark;
  if (!darkWeights) {
    report.error('R5', file, 0,
      '启用了暗色模式但 decisions.json 里没有 weights.dark。',
      'R5 要求暗色下全站文字字重降一档（body / strong / display 三档）。');
    return;
  }
  for (const role of ['body', 'strong', 'display']) {
    if (typeof darkWeights[role] !== 'number') {
      report.error('R5', file, 0, `weights.dark.${role} 缺失或不是数字`);
      continue;
    }
    const v = darkWeights[role];
    if (role === 'body' && v < 300) {
      report.error('R5', file, 0, `weights.dark.body = ${v}，低于护栏 300。`);
    }
    // A variable font can hit any weight; a static family can only hit the
    // discrete values it ships. Only the latter needs a mapping record.
    const isVariable = data.weightLadder?.variable === true;
    if (!isVariable && Array.isArray(weights) && weights.length && !weights.includes(v)) {
      report.warn('R5', file, 0,
        `weights.dark.${role} = ${v} 不在 weightLadder.available 里（静态字重）。`,
        `可用值：${weights.join(' / ')}。应映射到最近可用值并在 tokens.json 记 actualWeight。`);
    }
  }
  const lightW = data.weights?.light;
  if (lightW) {
    for (const role of ['body', 'strong', 'display']) {
      if (typeof lightW[role] === 'number' && typeof darkWeights[role] === 'number'
        && darkWeights[role] >= lightW[role]) {
        report.error('R5', file, 0,
          `weights.dark.${role} (${darkWeights[role]}) 未低于 weights.light.${role} (${lightW[role]})。`,
          '暗色下大字号字重必须降一档。');
      }
    }
  }

  // R5 only touches text at or above 16px. Small text keeps the light-mode
  // weight: halation correction scales with stroke width, so dropping 15px from
  // 400 to 350 doesn't read as "one step lighter" — it just goes soft.
  const smallDark = data.weights?.dark?.small;
  if (smallDark !== undefined) {
    const expected = Math.max(400, data.weights?.light?.body ?? 400);
    if (typeof smallDark !== 'number') {
      report.error('R5', file, 0, `weights.dark.small 必须是数字，实际 ${typeof smallDark}`);
    } else if (smallDark !== expected) {
      report.error('R5', file, 0,
        `weights.dark.small = ${smallDark}，应为 ${expected}（与浅色同值，不降档）。`,
        '小于 16px 的文字不参与 R5 降档。');
    }
  } else {
    report.warn('R5', file, 0,
      'weights.dark.small 未声明。',
      `建议显式写 ${Math.max(400, data.weights?.light?.body ?? 400)}，表示小字不降档——` +
      '否则 --fw-small 只能靠 build.mjs 推断，绕过这层校验。');
  }
}

// ---------------------------------------------------------------------------
// source scan: raw color literals outside the token table
// ---------------------------------------------------------------------------

function walkFiles(root, exts) {
  const out = [];
  const stack = [root];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    '.impeccable', 'design']);
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!skip.has(ent.name)) stack.push(p);
      } else if (exts.some((e) => ent.name.endsWith(e))) {
        out.push(p);
      }
    }
  }
  return out;
}

function buildAllowedSet(data) {
  const set = new Set();
  for (const e of collectColorEntries(data.color)) {
    if (e.hex) set.add(e.hex.toLowerCase());
    if (e.oklch) set.add(e.oklch.replace(/\s+/g, ' ').trim().toLowerCase());
  }
  return set;
}

function scanSources(project, files, allowed, report) {
  const tokenFileHint = path.join(OUT_DIR, 'tokens.css');
  for (const file of files) {
    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const rel = path.relative(project, file).replace(/\\/g, '/');
    if (rel === tokenFileHint) continue; // the generated token file defines them

    const lines = src.split(/\r?\n/);

    // 多行声明的上下文：`box-shadow:` 换行后，阴影值在下一行，
    // 逐行判上下文会把它们误报成「非阴影场景的裸色」。这里回溯到声明开头。
    const declHead = (idx) => {
      for (let i = idx; i >= 0 && i >= idx - 12; i--) {
        const l = lines[i];
        if (/^\s*[a-z-]+\s*:/.test(l)) return l;       // 找到属性名所在行
        if (/[;{}]/.test(l)) break;                     // 越过声明边界就停
      }
      return '';
    };

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comment-only lines
      const context = line + ' ' + declHead(idx);

      for (const m of line.matchAll(HEX_LITERAL)) {
        const v = m[0].toLowerCase();
        if (v.length === 4 || v.length === 7) {
          if (!allowed.has(v) && !allowed.has(expand3(v))) {
            report.error('T2', rel, lineNo,
              `裸色值 ${m[0]} 不在 token 表内。`,
              '所有颜色必须来自 tokens.css；确需新值时先改 decisions.json。');
          }
        }
      }
      for (const m of line.matchAll(OKLCH_LITERAL)) {
        const norm = m[0].replace(/\s+/g, ' ').trim().toLowerCase();
        const isAllowed = [...allowed].some((a) => a.startsWith('oklch(') &&
          sameOklch(a, norm));
        if (!isAllowed) {
          report.warn('T2', rel, lineNo, `裸 oklch() 值 ${m[0]} 不在 token 表内。`);
        }
      }
      for (const m of line.matchAll(RGB_LITERAL)) {
        // rgb()/rgba() in shadows and hairlines is legal (R3 exemption).
        const shadowContext = /shadow|inset|border|outline|filter|::?before|::?after/i.test(context);
        if (!shadowContext) {
          report.warn('T2', rel, lineNo,
            `裸 rgb()/rgba() 值 ${m[0]}；非阴影/边框场景建议改用 token。`);
        }
      }
      for (const re of PURE_BLACK) {
        if (re.test(line)) {
          const ctx = /shadow|inset|color-mix|rgba?\(|oklch\([^)]*\/|transparent/i.test(context);
          const transparentBlack = /rgba\(\s*0\s*[, ]\s*0\s*[, ]\s*0\s*[,/]\s*0?\.\d+/.test(line);
          if (!ctx && !transparentBlack) {
            report.error('R3', rel, lineNo,
              `不透明纯黑出现在非阴影场景：${line.trim().slice(0, 80)}`,
              '文字/背景/边框/图标不得用 #000。');
          }
        }
      }
    });
  }
}

function expand3(hex) {
  if (hex.length !== 4) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function sameOklch(a, b) {
  try {
    const pa = parseOklch(a), pb = parseOklch(b);
    return Math.abs(pa.L - pb.L) < 1e-4 &&
      Math.abs(pa.C - pb.C) < 1e-4 &&
      Math.abs(pa.H - pb.H) < 0.1;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.project) {
    console.error('缺少 --project <目标项目路径>');
    process.exit(EXIT.INPUT);
  }
  const project = path.resolve(opts.project);
  if (!fs.existsSync(project)) {
    console.error(`项目目录不存在：${project}`);
    process.exit(EXIT.INPUT);
  }

  const report = new Report();
  const loaded = loadDecisions(project, report);
  if (loaded) {
    const { data, file } = loaded;
    checkColorPolicy(data, file, report);
    checkDarkWeights(data, file, report);

    const exts = opts.scan.length
      ? opts.scan
      : DEFAULT_SCAN_EXT;
    const candidates = opts.scan.length
      ? opts.scan.map((g) => path.resolve(project, g))
      : walkFiles(project, exts);
    const files = candidates.filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    scanSources(project, files, buildAllowedSet(data), report);
  }

  const errors = report.errors;
  const warnings = report.warnings;
  const failOnWarn = opts.strict && warnings.length > 0;

  if (opts.json) {
    console.log(JSON.stringify({
      status: errors.length || failOnWarn ? 'fail' : 'pass',
      errorCount: errors.length,
      warningCount: warnings.length,
      findings: report.items,
    }, null, 2));
  } else {
    const sym = { error: '✗', warn: '⚠' };
    for (const i of report.items) {
      const loc = i.file ? `${i.file}${i.line ? `:${i.line}` : ''}` : '';
      console.log(`${sym[i.level]} [${i.rule}] ${loc}${loc ? ' — ' : ''}${i.message}`);
      if (i.detail) console.log(`    ${i.detail}`);
    }
    if (!opts.quiet) {
      console.log('');
      console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
    }
  }

  process.exit(errors.length || failOnWarn ? EXIT.VIOLATION : EXIT.PASS);
}

main();
