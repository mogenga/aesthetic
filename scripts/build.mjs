#!/usr/bin/env node
/**
 * build.mjs — the single generation chain:
 *
 *   decisions.json  ──►  tokens.json / tokens.css  ──►  contract.md
 *
 * Every artifact carries a provenance header (sourceHash / generatedAt /
 * generatorVersion) so check-consistency.mjs can detect drift.
 *
 * Exit codes: 0 ok · 1 failed · 2 environment unavailable · 3 invalid input
 *
 * Usage:
 *   node build.mjs --project <dir> [--only tokens|contract|all]
 *                  [--dry-run] [--quiet]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  parseOklch, oklchToHex, formatOklch,
} from './lib/oklch.mjs';
import { hashDecisions } from './check-consistency.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const TEMPLATE = path.join(SKILL_ROOT, 'assets', 'templates', 'contract.md');

const OUT_DIR = 'design/aesthetic';
const GENERATOR = 'aesthetic-v2';
const EXIT = { OK: 0, FAIL: 1, ENV: 2, INPUT: 3 };

function parseArgs(argv) {
  const o = { project: null, only: 'all', dryRun: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') o.project = argv[++i];
    else if (a === '--only') o.only = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '-h' || a === '--help') {
      console.log('build.mjs --project <dir> [--only tokens|contract|all] [--dry-run]');
      process.exit(EXIT.OK);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(EXIT.INPUT);
    }
  }
  return o;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function atomicWrite(file, data, dryRun) {
  if (dryRun) return;
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(tmp, data.replace(/\r\n/g, '\n'), 'utf8');
  fs.renameSync(tmp, file);
}

/** Resolve a color entry to { oklch, hex, l, clipped }. */
function resolveColor(entry) {
  if (typeof entry === 'string') {
    const parsed = parseOklch(entry);
    const { hex, clipped } = oklchToHex(parsed);
    return { oklch: formatOklch(parsed), hex, l: round(parsed.L, 4), clipped };
  }
  const parsed = parseOklch(entry.oklch);
  const resolved = entry.hex ? { hex: entry.hex, clipped: false } : oklchToHex(parsed);
  return {
    oklch: formatOklch(parsed),
    hex: resolved.hex,
    l: typeof entry.l === 'number' ? entry.l : round(parsed.L, 4),
    clipped: resolved.clipped || !!entry.gamutClipped,
  };
}

const round = (v, p = 4) => Number(v.toFixed(p));

// ---------------------------------------------------------------------------
// tokens.json
// ---------------------------------------------------------------------------

function buildTokensJson(decisions, sourceHash) {
  const color = {};
  for (const theme of Object.keys(decisions.color || {})) {
    color[theme] = {};
    for (const [name, entry] of Object.entries(decisions.color[theme])) {
      color[theme][name] = resolveColor(entry);
    }
  }

  // Recompute the surface ladder ΔL from the resolved values.
  const ladder = [];
  for (const theme of Object.keys(color)) {
    const light = color[theme];
    const names = ['bg', ...Object.keys(light).filter((k) => /^surface-?\d+$/.test(k))
      .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))];
    for (let i = 1; i < names.length; i++) {
      ladder.push({
        theme,
        from: names[i - 1],
        to: names[i],
        deltaL: round(Math.abs(light[names[i - 1]].l - light[names[i]].l), 4),
      });
    }
  }

  return {
    schemaVersion: 1,
    sourceFile: `${OUT_DIR}/decisions.json`,
    sourceHash: `sha256:${sourceHash}`,
    generatedAt: decisions.meta?.generatedAt || new Date().toISOString(),
    generatorVersion: GENERATOR,
    style: decisions.style || null,
    color,
    surfaceLadder: ladder,
    weights: decisions.weights || null,
    weightLadder: decisions.weightLadder || null,
    translation: decisions.translation || null,
    overrides: decisions.overrides || [],
  };
}

// ---------------------------------------------------------------------------
// tokens.css
// ---------------------------------------------------------------------------

function cssVar(entry) {
  const comment = entry.clipped ? ' /* gamut-mapped */' : '';
  return `${entry.oklch}; /* ${entry.hex} */${comment}`;
}

function buildTokensCss(tokens, decisions) {
  const L = [];
  L.push('/*');
  L.push(' * tokens.css — 由 decisions.json 派生，请勿手改。');
  L.push(` * sourceHash: sha256:${tokens.sourceHash.replace('sha256:', '')}`);
  L.push(` * generatedAt: ${tokens.generatedAt}`);
  L.push(` * generatorVersion: ${GENERATOR}`);
  L.push(' */');
  L.push('');

  const themes = Object.keys(tokens.color);
  for (const theme of themes) {
    const selector = theme === 'light' ? ':root' : `:root[data-theme="${theme}"]`;
    L.push(`${selector} {`);
    L.push('  /* color */');
    for (const [name, entry] of Object.entries(tokens.color[theme])) {
      L.push(`  --${name}: ${cssVar(entry)}`);
    }

    if (theme === 'light') {
      L.push('');
      L.push('  /* space — 8pt 结构值 */');
      L.push('  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;');
      L.push('  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;');
      L.push('');
      L.push('  /* radius */');
      L.push('  --r-sm: 4px; --r-md: 8px; --r-lg: 16px; --r-full: 999px;');
      L.push('');
      L.push('  /* line — 光学值 */');
      L.push('  --line-hair: 1px solid var(--line-1);');
      L.push('  --line-inset: color-mix(in oklab, var(--fg) 8%, transparent);');
      L.push('  --label-gap: 8px;');
      L.push('  --icon-shift: -0.125em;');
      L.push('  --focus-ring: 3px;');
      L.push('');
      L.push('  /* type */');
      L.push('  --fs-xs: 12px; --fs-sm: 13px; --fs-md: 15px; --fs-lg: 18px;');
      L.push('  --fs-xl: 24px; --fs-2xl: 32px; --fs-3xl: 44px;');
      L.push('  --lh-tight: 1.15; --lh-snug: 1.35; --lh-body: 1.65;');
      L.push('');
      L.push('  /* motion */');
      L.push('  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;');
      L.push('  --ease-out: cubic-bezier(.2,.7,.2,1);');
      L.push('  --ease-inout: cubic-bezier(.4,0,.2,1);');
    }

    const w = tokens.weights?.[theme];
    if (w) {
      L.push('');
      L.push(`  /* type weight — R5 ${theme === 'dark' ? '降一档' : '基准'} */`);
      L.push(`  --fw-body: ${w.body};`);
      L.push(`  --fw-strong: ${w.strong};`);
      L.push(`  --fw-display: ${w.display};`);
    }

    L.push('}');
    L.push('');
  }

  // Reference values that no theme overrides.
  if (!tokens.color.light) {
    // no-op; light is required by schema
  }

  return L.join('\n');
}

// ---------------------------------------------------------------------------
// contract.md
// ---------------------------------------------------------------------------

function fill(template, vars) {
  return template.replace(/\{\{([A-Za-z0-9_一-龥]+)\}\}/g, (m, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m;
  });
}

function buildContract(decisions, tokens) {
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error(`找不到模板：${TEMPLATE}`);
  }
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');

  const d = decisions;
  const tr = d.translation || {};
  const wl = d.weights?.light || {};
  const wd = d.weights?.dark || {};
  const light = d.color?.light || {};
  const dark = d.color?.dark || {};

  const s8 = extractSection8FromDecisions(d);

  const vars = {
    项目名: d.projectName || d.meta?.project || '（未命名项目）',
    HASH: tokens.sourceHash.replace('sha256:', ''),
    ISO: tokens.generatedAt,
    '已定稿 / 已定稿，待实现 / 已实现': d.status || '已定稿',
    风格: d.style?.card || '—',
    导演层: directorLabel(d.direction?.director),
    页面模式: d.direction?.mode || '—',
    主题: d.meta?.theme || 'light-dark',
    YYYYMMDD: (tokens.generatedAt || '').slice(0, 10),
    'YYYY-MM-DD': (tokens.generatedAt || '').slice(0, 10),
    一句话气质: d.direction?.tone || '（未填写）',
    '…': '—',
    '—': '—',
    '✓': '✓',
    '700': wl.display ?? '700',
    '600': wl.strong ?? '600',
    '400': wl.body ?? '400',
    '350': wd.body ?? '350',
    '500': wd.strong ?? '500',
    '6': '6',
    '10': '10',
    '16': '16',
    '999': '999',
    '300 / 400 / 500 / 600 / 700': (d.weightLadder?.available || []).join(' / ') || '—',
    '350 → 400，与 --fw-body 同档；已在 tokens.json 记 actualWeight': actualWeightNote(d),
    '工业感': tr.radius?.from || '—',
    '像瑞士铁路时刻表': tr.neutralTemp?.from || '—',
    '不要糖水感': tr.chromaCap?.from || '—',
    '像图纸': tr.border?.from || '—',
    '不要大字报': tr.weight?.from || '—',
    '44': pickPx(s8, '组间', 44),
    '54': pickPx(s8, '行高', 54),
    '8': pickPx(s8, '标签→输入', 8),
    '24': pickPx(s8, '字段→字段', 24),
    '30': pickPx(s8, '错峰', 30),
    '120ms': (d.translation?.motion?.value || '120ms'),
    '200ms': '200ms',
    '280ms': '280ms',
    '12px': '12px',
    '（未填写）': '（未填写）',
  };

  const color = light.bg ? `oklch(${stripOklch(tokens.color.light.bg.oklch)})` : 'oklch(…)';
  vars['oklch(…)'] = color;

  let out = fill(tpl, vars);

  // Replace the whole §8 block with the derived one (source of truth).
  out = replaceSection8(out, s8);

  // Replace the color table with real values.
  out = replaceColorTable(out, tokens);
  out = replaceWeights(out, wl, wd);
  out = replaceOverrideTable(out, d.overrides || []);

  return out;
}

function stripOklch(s) {
  const m = String(s).match(/^oklch\((.*)\)$/);
  return m ? m[1] : s;
}

function directorLabel(id) {
  return { impeccable: 'impeccable', 'frontend-design': 'frontend-design', self: '自导（Studio 画廊）' }[id] || '—';
}

function pickPx(section, needle, fallback) {
  if (!section) return fallback;
  const re = new RegExp(`${needle}[^\\d]{0,8}(\\d+)`);
  const m = section.match(re);
  return m ? m[1] : fallback;
}

function actualWeightNote(d) {
  const avail = d.weightLadder?.available || [];
  const want = d.weights?.dark?.body;
  if (!Array.isArray(avail) || !avail.length || typeof want !== 'number') return '—';
  if (avail.includes(want)) return `${want} 为字体原生字重，无需映射`;
  const nearest = avail.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
  return `${want} → ${nearest}（字体无该字重，映射到最近可用值；已在 tokens.json 记 actualWeight）`;
}

/** §8 text derived from decisions so contract and injected block agree. */
function extractSection8FromDecisions(d) {
  const s = d.overrides || [];
  const px = (v, fb) => (typeof v === 'number' ? v : fb);
  const layout = d.layout || {};
  const ai = d.ai || {};
  const wd = d.weights?.dark || {};
  const lines = [];
  lines.push(`**设置页**：名称在左、控件在右，一行一项；无外层卡片，页面即背景；组标题 + 组间 ${px(layout.settingsGroupGap, 44)}px / 组内 0；行间仅 1px 细线；行高 ${px(layout.settingsRowH, 54)}px；危险操作单独成组置于最后。`);
  lines.push('');
  lines.push(`**表单**：标签在上、输入区在下、输入区全宽；标签→输入 ${px(layout.labelGap, 8)}px，字段→字段 ${px(layout.fieldGap, 24)}px；错误文本替换帮助文本并预留同高。`);
  lines.push('');
  lines.push(`**AI 界面**：流式文字逐字 ${px(ai.staggerMs, 30)}ms 错峰、高斯模糊→瞬间对焦；正文行内图标 \`vertical-align: -0.125em\`；思考框用 \`0fr → 1fr\` 网格撑开。`);
  lines.push('');
  lines.push(`**暗色模式**：全站文字字重降一档（body ${wd.body ?? 350} / strong ${wd.strong ?? 500} / display ${wd.display ?? 600}），正文不低于 300，小于 16px 不低于 400。`);
  lines.push('');
  lines.push('**色彩**：表面层级 ΔL ∈ [0.010, 0.030]；禁止场景不用纯黑，正文用 `#1A1A19`。');
  lines.push('');
  lines.push('**输入框**：不用亮线，外投影 + inset 内环咬合。');
  lines.push('');
  lines.push('**计时器**：`font-variant-numeric: tabular-nums`（无 `tnum` 时改用等宽字族）。');
  lines.push('');
  lines.push('**视觉对齐**：结构值对齐 8pt 网格；光学值走独立 token；实现须与签样逐项对齐。');
  if (s.length) {
    lines.push('');
    lines.push(`> 已登记 ${s.length} 条 override，详见 §3.4。`);
  }
  return lines.join('\n');
}

function replaceSection8(text, body) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^##\s*8\./.test(l.trim()));
  if (start < 0) return text;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s*\d+\./.test(lines[i].trim())) { end = i; break; }
  }
  const next = [
    ...lines.slice(0, start + 1),
    '',
    '> 这一节是注入块（`DESIGN.md` 的 marker 块）的唯一来源。**改这里不会生效——改 `decisions.json`。**',
    '',
    body,
    '',
    ...lines.slice(end),
  ];
  return next.join('\n');
}

function replaceColorTable(text, tokens) {
  const rows = [];
  const names = new Set();
  for (const theme of Object.keys(tokens.color)) {
    for (const n of Object.keys(tokens.color[theme])) names.add(n);
  }
  const order = ['bg', 'surface-1', 'surface-2', 'surface-3', 'fg', 'fg-muted', 'accent', 'line-1', 'line-inset'];
  const sorted = [...names].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const dl = new Map();
  for (const l of tokens.surfaceLadder) dl.set(l.to, l.deltaL.toFixed(3));

  for (const n of sorted) {
    const li = tokens.color.light?.[n];
    const da = tokens.color.dark?.[n];
    const cell = (e) => (e ? `\`${e.oklch}\` / \`${e.hex}\`` : '—');
    const purpose = {
      bg: '页面底', fg: '正文', 'fg-muted': '次要', accent: '强调',
      'line-1': '细线', 'line-inset': '输入框内环',
    }[n] || `表面 ${n.replace(/\D/g, '')}`;
    rows.push(`| \`--${n}\` | ${cell(li)} | ${cell(da)} | ${purpose} | ${dl.get(n) || '—'} |`);
  }

  const block = [
    '| Token | 浅色 | 暗色 | 用途 | ΔL |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');

  return replaceBetweenMarker(text, '### 3.1 令牌表', '### 3.2', block);
}

function replaceWeights(text, wl, wd) {
  const block = [
    '| 项 | 浅色 | 暗色 |',
    '|---|---|---|',
    `| \`--fw-body\` | ${wl.body ?? '—'} | ${wd.body ?? '—'} |`,
    `| \`--fw-strong\` | ${wl.strong ?? '—'} | ${wd.strong ?? '—'} |`,
    `| \`--fw-display\` | ${wl.display ?? '—'} | ${wd.display ?? '—'} |`,
  ].join('\n');
  return replaceBetweenMarker(text, '## 4. 字体', '**字重阶梯**', block);
}

function replaceOverrideTable(text, overrides) {
  const rows = overrides.length
    ? overrides.map((o) => `| ${o.rule} | ${o.scope} | \`${fmt(o.requestedValue)}\` | \`${fmt(o.effectiveValue)}\` | ${o.reason} | ${o.approvedBy} | ${o.verification} |`)
    : ['| — | — | — | — | 无 override | — | — |'];
  const block = [
    '| 规则 | 范围 | 请求值 | 生效值 | 原因 | 批准人 | 验证方式 |',
    '|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
  return replaceBetweenMarker(text, '### 3.4 override 登记', '---', block);
}

const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Replace the body between a heading line and the next marker line. */
function replaceBetweenMarker(text, startMarker, endMarker, body) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith(startMarker) || l.trim() === startMarker);
  if (start < 0) return text;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith(endMarker) || lines[i].trim() === endMarker) { end = i; break; }
  }
  const next = [...lines.slice(0, start + 1), '', body, '', ...lines.slice(end)];
  return next.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.project) {
    console.error('缺少 --project <目标项目路径>');
    process.exit(EXIT.INPUT);
  }
  const project = path.resolve(o.project);
  const outDir = path.join(project, OUT_DIR);
  const decisionsFile = path.join(outDir, 'decisions.json');

  if (!fs.existsSync(decisionsFile)) {
    console.error(`找不到 ${path.relative(project, decisionsFile)}`);
    process.exit(EXIT.INPUT);
  }

  let decisions;
  try {
    decisions = JSON.parse(fs.readFileSync(decisionsFile, 'utf8'));
  } catch (e) {
    console.error(`decisions.json 不是合法 JSON：${e.message}`);
    process.exit(EXIT.INPUT);
  }

  const sourceHash = hashDecisions(decisions);
  const tokens = buildTokensJson(decisions, sourceHash);
  const written = [];

  try {
    if (o.only === 'all' || o.only === 'tokens') {
      atomicWrite(path.join(outDir, 'tokens.json'), `${JSON.stringify(tokens, null, 2)}\n`, o.dryRun);
      written.push('tokens.json');
      atomicWrite(path.join(outDir, 'tokens.css'), buildTokensCss(tokens, decisions), o.dryRun);
      written.push('tokens.css');
    }
    if (o.only === 'all' || o.only === 'contract') {
      const contract = buildContract(decisions, tokens);
      atomicWrite(path.join(outDir, 'contract.md'), `${contract.replace(/\n{3,}/g, '\n\n')}\n`, o.dryRun);
      written.push('contract.md');
    }
  } catch (e) {
    console.error(`生成失败：${e.message}`);
    process.exit(EXIT.FAIL);
  }

  if (!o.quiet) {
    console.log(`${o.dryRun ? '(dry run) ' : ''}sourceHash: sha256:${sourceHash.slice(0, 16)}…`);
    for (const f of written) console.log(`✓ ${o.dryRun ? 'would write' : 'wrote'} ${OUT_DIR}/${f}`);
    if (!o.dryRun) console.log('\n下一步：node scripts/inject.mjs --project <dir>');
  }
  process.exit(EXIT.OK);
}

main();
