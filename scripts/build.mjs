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
  parseOklch, oklchToHex, formatOklch, contrastHex,
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
  const resolved = entry.hex
    ? { hex: entry.hex.toLowerCase(), clipped: false }
    : oklchToHex(parsed);
  return {
    oklch: formatOklch(parsed),
    hex: resolved.hex.toLowerCase(),
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

/**
 * The template is a shell of headings + `<!-- BLOCK:name -->` slots.
 * Every variable piece of content is a block, so no `{{…}}` ever survives
 * into an artifact. Simple scalars use {{NAME}} and must be declared in VARS.
 */
function fillScalars(template, vars) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key]);
    throw new Error(`模板占位符未赋值：{{${key}}}`);
  });
}

function putBlock(text, name, body) {
  const marker = new RegExp(`<!--\\s*BLOCK:${name}\\s*-->`);
  if (!marker.test(text)) {
    throw new Error(`模板缺少 BLOCK:${name} 插槽`);
  }
  return text.replace(marker, () => body);
}

function buildContract(decisions, tokens) {
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error(`找不到模板：${TEMPLATE}`);
  }
  const d = decisions;
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');

  let out = fillScalars(tpl, {
    HASH: tokens.sourceHash.replace('sha256:', ''),
    ISO: tokens.generatedAt,
    PROJECT: d.projectName || d.meta?.project || '（未命名项目）',
    STATUS: d.status || '已定稿',
  });

  out = putBlock(out, 'overview', blockOverview(d));
  out = putBlock(out, 'translation', blockTranslation(d));
  out = putBlock(out, 'color-table', blockColorTable(tokens));
  out = putBlock(out, 'contrast', blockContrast(tokens));
  out = putBlock(out, 'gamut', blockGamut(tokens));
  out = putBlock(out, 'overrides', blockOverrides(d.overrides || []));
  out = putBlock(out, 'type', blockType(d));
  out = putBlock(out, 'radius', blockRadius(d));
  out = putBlock(out, 'non-negotiable', extractSection8FromDecisions(d));
  out = putBlock(out, 'consistency', blockConsistency(d));

  return out;
}

// -- blocks -----------------------------------------------------------------

function blockOverview(d) {
  const dir = d.direction || {};
  const mode = dir.mode || '—';
  const kw = (dir.keywords || []).join(' / ') || '—';
  const refs = (dir.references || []).map((r) => `「${r}」`).join('、') || '—';
  const anti = (dir.anti || []).map((r) => `「${r}」`).join('、') || '—';
  const tone = dir.tone || kw;

  return [
    '| 项 | 值 |',
    '|---|---|',
    `| 项目 | ${d.projectName || d.meta?.project || '（未命名项目）'} |`,
    `| 导演层 | ${directorLabel(dir.director)} |`,
    `| 页面模式 | ${mode} |`,
    `| 风格 | ${d.style?.card || '—'} / ${d.style?.variant || '—'} |`,
    `| 主题 | ${d.meta?.theme || 'light-dark'} |`,
    `| 日期 | ${(d.meta?.generatedAt || '').slice(0, 10) || '—'} |`,
    `| 一句话气质 | ${tone} |`,
    '',
    `**方向关键词**：${kw}`,
    '',
    `**参照物**：${refs}`,
    '',
    `**明确不要**：${anti}`,
  ].join('\n');
}

function blockTranslation(d) {
  const tr = d.translation || {};
  const dims = [
    ['neutralTemp', '中性色温度'],
    ['chromaCap', '彩度上限'],
    ['radius', '圆角'],
    ['border', '边框'],
    ['shadow', '阴影'],
    ['weight', '字重'],
    ['motion', '动效'],
  ];
  const fmtVal = (v) => (Array.isArray(v) ? v.join(' / ') : String(v));
  const rows = dims.map(([key, label]) => {
    const dim = tr[key];
    if (!dim) return `| ${label} | — | — | 缺失 |`;
    const from = dim.from == null ? '`null`（规则默认）' : `「${dim.from}」`;
    return `| ${label} | ${dim.value != null ? fmtVal(dim.value) : '—'} | ${from} |`;
  });

  const missing = dims.filter(([k]) => !tr[k]).map(([, l]) => l);
  const nulls = dims.filter(([k]) => tr[k] && tr[k].from == null).map(([, l]) => l);

  const lines = [
    '> 这一节是"导演层 → 编译层"的可追溯链。每个数字都应有出处；没有出处就写 `null`，表示取的是规则默认。',
    '',
    '| 维度 | 取值 | 依据 |',
    '|---|---|---|',
    ...rows,
  ];
  if (missing.length) lines.push('', `⚠ 缺失维度：${missing.join('、')}。G2 不算通过。`);
  if (nulls.length) lines.push('', `> 无方向依据、按规则取默认：${nulls.join('、')}。这也是信息——日后改方向时这几维不会被推翻。`);
  return lines.join('\n');
}

function blockColorTable(tokens) {
  const order = ['bg', 'surface-1', 'surface-2', 'surface-3', 'surface-sunken',
    'fg', 'fg-muted', 'accent', 'line-1', 'line-inset'];
  const names = new Set();
  for (const theme of Object.keys(tokens.color)) {
    for (const n of Object.keys(tokens.color[theme])) names.add(n);
  }
  const sorted = [...names].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const lightLadder = tokens.surfaceLadder.filter((l) => l.theme === 'light');
  const darkLadder = tokens.surfaceLadder.filter((l) => l.theme === 'dark');
  const dl = new Map();
  for (const l of (lightLadder.length ? lightLadder : darkLadder)) {
    dl.set(l.to, l.deltaL.toFixed(3));
  }

  const purposeOf = {
    bg: '页面底', fg: '正文', 'fg-muted': '次要', accent: '强调',
    'line-1': '细线', 'line-inset': '输入框内环', 'surface-sunken': '输入框凹陷底',
  };

  const rows = sorted.map((n) => {
    const li = tokens.color.light?.[n];
    const da = tokens.color.dark?.[n];
    const cell = (e) => (e
      ? `\`${e.oklch}\`<br>\`${e.hex}\`${e.clipped ? ' ⚠' : ''}`
      : '—');
    const purpose = purposeOf[n]
      || `表面 ${n.replace(/[^\d]/g, '')}`;
    return `| \`--${n}\` | ${cell(li)} | ${cell(da)} | ${purpose} | ${dl.get(n) || '—'} |`;
  });

  const lines = [
    '| Token | 浅色 | 暗色 | 用途 | ΔL |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '> `ΔL = |L₁ − L₂|`，OKLCH L 通道绝对差值，取值区间 `[0.010, 0.030]`。"1%–3%"只是通俗叫法。',
  ];
  if (darkLadder.length) {
    lines.push(`> 表中 ΔL 为浅色主题；暗色主题为 ${darkLadder
      .map((l) => `${l.to} ${l.deltaL.toFixed(3)}`).join(' / ')}。`);
  }
  if (tokens.color.light && Object.values(tokens.color.light).some((e) => e.clipped)) {
    lines.push('> ⚠ 标记表示该色超出 sRGB，已按 CSS Color 4 做 gamut mapping（降 C，保 L 与 H）。');
  }
  return lines.join('\n');
}

function blockContrast(tokens) {
  const rows = [];
  const base = tokens.color.light;
  const darkBase = tokens.color.dark;
  const checks = [
    ['fg', 4.5, '正文'],
    ['fg-muted', 4.5, '次要文本'],
    ['accent', 3.0, '焦点/非文本'],
    ['line-inset', 3.0, '控件边界'],
  ];
  for (const [name, min, label] of checks) {
    const cell = (themeBase) => {
      const fg = themeBase?.[name];
      const bg = themeBase?.bg;
      if (!fg || !bg) return '—';
      const r = contrastHex(fg.hex, bg.hex);
      const ok = r >= min ? '✓' : '✗';
      return `${r.toFixed(2)}:1 ${ok}`;
    };
    rows.push(`| \`--${name}\` / \`--bg\` | ${cell(base)} | ${cell(darkBase)} | ${min}:1 | ${label} |`);
  }
  return [
    '| 前景 / 背景 | 浅色 | 暗色 | 阈值 | 用途 |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '> 表面 ΔL 不能替代可读性检查。四类分别验收：正文、次要文本、焦点指示、非文本控件。',
  ].join('\n');
}

function blockGamut(tokens) {
  const clipped = [];
  for (const theme of Object.keys(tokens.color)) {
    for (const [name, e] of Object.entries(tokens.color[theme])) {
      if (e.clipped) clipped.push(`${theme}.${name}（${e.hex}）`);
    }
  }
  if (!clipped.length) {
    return '所有 `oklch()` 均落在 sRGB 色域内，无需映射。';
  }
  return [
    '以下 token 超出 sRGB，已按 CSS Color 4 做 gamut mapping（降低 C 直到进入色域，保持 L 与 H）：',
    '',
    ...clipped.map((c) => `- ${c}`),
    '',
    '`tokens.json` 中对应条目带 `gamutClipped: true`。',
  ].join('\n');
}

function blockOverrides(overrides) {
  if (!overrides.length) return '本次无 override。';
  const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
  return [
    '| 规则 | 范围 | 请求值 | 生效值 | 原因 | 批准人 | 验证方式 | 到期 |',
    '|---|---|---|---|---|---|---|---|',
    ...overrides.map((o) => `| ${o.rule} | ${o.scope} | \`${fmt(o.requestedValue)}\` | \`${fmt(o.effectiveValue)}\` | ${o.reason} | ${o.approvedBy} | ${o.verification} | ${o.expiresAt || '无'} |`),
    '',
    '> 九字段缺一即视为未登记覆盖，G4 不通过。',
  ].join('\n');
}

function blockType(d) {
  const wl = d.weights?.light || {};
  const wd = d.weights?.dark || {};
  const avail = d.weightLadder?.available || [];
  const family = d.weightLadder?.family || '（未指定）';
  const variable = d.weightLadder?.variable;

  return [
    '| 项 | 浅色 | 暗色 |',
    '|---|---|---|',
    '| 显示字族 | 见下 | 同 |',
    '| 正文字族 | 见下 | 同 |',
    `| \`--fw-display\` | ${wl.display ?? '—'} | ${wd.display ?? '—'} |`,
    `| \`--fw-strong\` | ${wl.strong ?? '—'} | ${wd.strong ?? '—'} |`,
    `| \`--fw-body\` | ${wl.body ?? '—'} | ${wd.body ?? '—'} |`,
    '',
    `**字族**：${family}${variable === true ? '（可变字体）' : variable === false ? '（静态字重）' : ''}`,
    '',
    `**可用字重阶梯**：${avail.length ? avail.join(' / ') : '（未指定）'}`,
    '',
    `**映射记录**：${actualWeightNote(d)}`,
  ].join('\n');
}

function blockRadius(d) {
  const r = d.translation?.radius?.value;
  if (Array.isArray(r) && r.length >= 3) {
    return [
      '| Token | 值 |',
      '|---|---|',
      `| \`--r-sm\` | ${r[0]}px |`,
      `| \`--r-md\` | ${r[1]}px |`,
      `| \`--r-lg\` | ${r[2]}px |`,
      `| \`--r-full\` | ${r[3] ?? 999}px |`,
      '',
      '> 四级必须不同（除非全 0）。`sm = md = lg` 等于放弃形状层级。',
    ].join('\n');
  }
  return '圆角取值未在转写表中定义。';
}

function blockConsistency(d) {
  const tr = d.translation || {};
  const dir = d.direction || {};
  const derived = [];
  const fromDirector = [];

  const rows = [];
  rows.push(`| 色彩基调 | ${dir.director === 'self' ? '自导' : '导演层'} | ${dir.director === 'self' ? '来自 Studio 画廊所选卡' : '来自 `PRODUCT.md` / `DESIGN.md`，未改动'} |`);
  rows.push(`| 字体选择 | ${dir.director === 'self' ? '自导' : '导演层'} | — |`);
  rows.push(`| 层级阶梯 | aesthetic 补足 | 导演层未定义，由 R2 生成 |`);
  rows.push(`| 暗色映射 | aesthetic 补足 | — |`);
  rows.push('| 动效 | 规则默认 | 方向里无依据，`translation.motion.from` 为 null |');
  if (d.style?.card) {
    rows.push(`| 风格卡 | ${dir.director === 'self' ? '自导' : '导演层'} | \`${d.style.card}\` → \`${d.style.variant}\` |`);
  }
  void derived; void fromDirector;

  return [
    '| 项 | 来源 | 说明 |',
    '|---|---|---|',
    ...rows,
    '',
    '> 后续 agent：**"刻意偏离"是决策，不是错误。** 不要"修正"回导演层的值。',
    `> ${Object.values(tr).filter((v) => v && v.from == null).length} 个维度无方向依据，按规则取默认——改方向时这些不会被推翻。`,
  ].join('\n');
}

function directorLabel(id) {
  return { impeccable: 'impeccable', 'frontend-design': 'frontend-design', self: '自导（Studio 画廊）' }[id] || '—';
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
