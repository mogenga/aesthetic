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
  parseOklch, oklchToHex, contrastHex,
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
    const REQUIRED = ['rule', 'scope', 'requestedValue', 'effectiveValue',
      'reason', 'approvedBy', 'createdAt', 'expiresAt', 'verification'];
    data.overrides.forEach((o, i) => {
      const miss = REQUIRED.filter((k) => !(k in o));
      if (miss.length) {
        report.error('O1', file, 0,
          `overrides[${i}] 缺字段：${miss.join(', ')}`,
          '缺任一项即视为未登记覆盖，G4 不通过。');
      }
    });
  }
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
    const checks = [
      ['fg', 4.5, '正文'],
      ['fg-muted', 4.5, '次要文本'],
      ['accent', 3.0, '非文本控件/焦点'],
    ];
    for (const [name, min, label] of checks) {
      if (!c[name]) continue;
      const fgHex = toHex(c[name]);
      if (!bgHex || !fgHex) continue;
      const ratio = contrastHex(fgHex, bgHex);
      if (ratio < min) {
        report.error('A11Y', file, 0,
          `${theme}.${name}（${label}）对 bg 的对比度 ${ratio.toFixed(2)}:1 < ${min}:1。`);
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
          '暗色下字重必须降一档。');
      }
    }
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
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comment-only lines

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
        const shadowContext = /shadow|inset|border|outline|filter|::?before|::?after/i.test(line);
        if (!shadowContext) {
          report.warn('T2', rel, lineNo,
            `裸 rgb()/rgba() 值 ${m[0]}；非阴影/边框场景建议改用 token。`);
        }
      }
      for (const re of PURE_BLACK) {
        if (re.test(line)) {
          const ctx = /shadow|inset|color-mix|rgba?\(|oklch\([^)]*\/|transparent/i.test(line);
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
