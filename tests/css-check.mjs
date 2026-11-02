#!/usr/bin/env node
/**
 * tests/css-check.mjs — structural lint for the 12 style variants.
 *
 * Checks that a variant CSS file can actually be dropped onto the fixture:
 *   • braces / strings / comments balance
 *   • every file is scoped by :root[data-style="<id>"] (never a bare :root)
 *   • a dark block exists
 *   • the file only overrides / adds — never defines structural layout
 *   • token names stay inside the shared semantic set
 *   • the id inside the file matches the filename
 *   • style-index.json covers exactly these files
 *
 * Exit codes: 0 pass · 1 violations · 3 invalid input
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STYLES = path.join(ROOT, 'assets', 'studio', 'styles');
const INDEX = path.join(ROOT, 'references', 'styles', 'style-index.json');
const STUDIO_INDEX = path.join(STYLES, 'style-index.json');

const SEMANTIC_TOKENS = new Set([
  '--bg', '--surface-1', '--surface-2', '--surface-3', '--surface-sunken',
  '--fg', '--fg-muted', '--accent', '--accent-hover', '--accent-soft', '--accent-2',
  '--on-accent', '--danger', '--danger-hover', '--danger-soft', '--on-danger',
  '--success', '--warning',
  '--line-1', '--line-2', '--line-inset',
  '--shadow-1', '--shadow-2', '--shadow-3',
  '--shadow-field-outer', '--shadow-field-inner',
  '--s-1', '--s-2', '--s-3', '--s-4', '--s-5', '--s-6', '--s-7', '--s-8',
  '--r-sm', '--r-md', '--r-lg', '--r-full',
  '--fs-xs', '--fs-sm', '--fs-md', '--fs-lg', '--fs-xl', '--fs-2xl', '--fs-3xl',
  '--lh-tight', '--lh-snug', '--lh-body',
  '--fw-body', '--fw-strong', '--fw-display',
  '--dur-fast', '--dur-base', '--dur-slow',
  '--ease-out', '--ease-inout',
  '--font-body', '--font-display', '--font-mono', '--font-sans',
  '--border-w', '--border-w-strong',
  '--control-h', '--btn-h', '--rail-item-h', '--row-h', '--group-gap', '--field-gap',
  '--switch-w', '--switch-h', '--switch-knob', '--avatar', '--badge-h', '--dot',
  '--icon-box', '--content-max', '--topbar-h', '--rail-w', '--rail-w-collapsed',
  '--ai-bubble-max', '--line-hair', '--label-gap', '--icon-shift', '--focus-ring',
  '--stat-value-size', '--grid-gap', '--px', '--cut',
]);

const findings = [];

function add(level, file, line, msg) {
  findings.push({ level, file, line, msg });
}

/** Strip comments, then walk braces and strings. */
function scan(text) {
  const out = { balanced: true, openAtLine: 0, depth: 0, code: '' };
  let depth = 0, line = 1, i = 0;
  let inBlock = false, inLine = false, quote = null;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === '\n') {
      line++;
      inLine = false;
      out.code += c;
      i++;
      continue;
    }
    if (inLine) { i++; continue; }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i += 2; continue; }
      i++;
      continue;
    }
    if (quote) {
      out.code += c;
      if (c === '\\') { out.code += n ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '/' && n === '*') { inBlock = true; i += 2; continue; }
    if (c === '/' && n === '/') { inLine = true; i += 2; continue; }
    if (c === '"' || c === "'") { quote = c; out.code += c; i++; continue; }
    if (c === '{') { depth++; if (!out.openAtLine) out.openAtLine = line; }
    if (c === '}') {
      depth--;
      if (depth < 0) {
        out.balanced = false;
        add('error', null, line, '多余的 }');
        depth = 0;
      }
    }
    out.code += c;
    i++;
  }
  out.depth = depth;
  if (depth !== 0) out.balanced = false;
  return out;
}

function checkFile(file) {
  const name = path.basename(file, '.css');
  const src = fs.readFileSync(file, 'utf8');
  const { balanced, depth, code } = scan(src);

  if (!balanced) {
    add('error', name, 0, `括号不平衡（剩余深度 ${depth}）`);
  }

  // every file must be scoped to its own data-style
  const scopeRe = new RegExp(`\\[data-style="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]`);
  if (!scopeRe.test(code)) {
    add('error', name, 0, `没有 :root[data-style="${name}"] 作用域，会污染其它变体`);
  }

  // must have a dark block
  if (!/\[data-theme="dark"\]/.test(code)) {
    add('error', name, 0, '缺少 [data-theme="dark"] 覆盖（R5 无法生效）');
  }

  // no bare :root (unscoped) declarations
  code.split('\n').forEach((line, i) => {
    if (/^\s*:root\s*\{/.test(line)) {
      add('error', name, i + 1, '裸 :root 块 —— 必须带 [data-style=…] 作用域');
    }
    if (/^\s*body\s*\{/.test(line) && !/data-style/.test(code.slice(0, 0))) {
      // body rules are allowed but only inside a scoped ancestor; can't tell
      // lexically without a parser, so just warn.
      add('warn', name, i + 1, '顶层 body 规则 —— 请确认它被 :root[data-style] 包裹');
    }
  });

  // structural layout must not be redefined here — except for variants whose
  // signature *is* a layout (bento's grid), which are declared up front.
  const LAYOUT_IS_SIGNATURE = new Set(['bento']);
  if (!LAYOUT_IS_SIGNATURE.has(name)) {
    const forbidden = [
      [/\bdisplay\s*:\s*(grid|flex)\b/, 'display: grid/flex（结构性布局应由 base.css 负责）'],
    ];
    for (const [re, label] of forbidden) {
      if (re.test(code)) add('warn', name, 0, `出现 ${label}`);
    }
  }

  // custom properties declared must be in the semantic set or clearly local
  const declared = new Set();
  for (const m of code.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declared.add(m[1].toLowerCase());
  for (const t of declared) {
    const isLocal = t.startsWith('--glass-') || t.startsWith('--aurora-') ||
      t.startsWith('--tint-') || t.startsWith('--text-scrim') || t.startsWith('--edge-') ||
      t.startsWith('--fallback-') || t === '--cut' || t === '--px' || t === '--grid-gap' ||
      t === '--bento-cols' || t === '--hyalite' || t === '--hyalite-edge' ||
      // 声明字体可用字重的元 token：供 audit.mjs 识别单字重字体（R5 例外）
      t === '--font-weights-declared';
    if (!SEMANTIC_TOKENS.has(t) && !isLocal) {
      add('warn', name, 0, `新增了非语义 token ${t}（确认 base.css 会消费它）`);
    }
  }

  // hard-coded colours outside token declarations
  code.split('\n').forEach((line, i) => {
    if (/^\s*--/.test(line)) return;                    // token declarations may hold literals
    if (/^(\.|:root|\s*@)/.test(line) === false && !/=/.test(line)) return;
    const hex = line.match(/#[0-9a-f]{6}\b/i);
    if (hex && !/var\(/.test(line)) {
      add('warn', name, i + 1, `非 token 行出现色字面量 ${hex[0]}`);
    }
  });

  return name;
}

function main() {
  if (!fs.existsSync(STYLES)) {
    console.error(`找不到 ${STYLES}`);
    process.exit(3);
  }
  const files = fs.readdirSync(STYLES).filter((f) => f.endsWith('.css')).sort();
  const names = files.map((f) => checkFile(path.join(STYLES, f)));

  // style-index coverage — both indexes must agree with disk and with each other
  let indexCheck = 'skipped';
  const onDisk = files.slice().sort();

  if (fs.existsSync(INDEX)) {
    const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    const fromIndex = (idx.variants || []).map((v) => v.css).sort();
    const missing = fromIndex.filter((f) => !onDisk.includes(f));
    const extra = onDisk.filter((f) => !fromIndex.includes(f));
    if (missing.length) add('error', 'style-index', 0, `记录里有但磁盘没有：${missing.join(', ')}`);
    if (extra.length) add('error', 'style-index', 0, `磁盘有但记录没有：${extra.join(', ')}`);
    if (idx.cards?.length !== 10) add('error', 'style-index', 0, `cards 应为 10，实际 ${idx.cards?.length}`);
    if (idx.variants?.length !== 12) add('error', 'style-index', 0, `variants 应为 12，实际 ${idx.variants?.length}`);
    indexCheck = `${idx.cards?.length} 卡 / ${idx.variants?.length} 变体`;
  }

  // the studio-side index (the one the UI actually reads) must match
  if (fs.existsSync(STUDIO_INDEX)) {
    const s = JSON.parse(fs.readFileSync(STUDIO_INDEX, 'utf8'));
    const sv = s.variants || [];
    const sFiles = sv.map((v) => v.css).sort();
    const missing = sFiles.filter((f) => !onDisk.includes(f));
    const extra = onDisk.filter((f) => !sFiles.includes(f));
    if (missing.length) add('error', 'studio/style-index', 0, `记录里有但磁盘没有：${missing.join(', ')}`);
    if (extra.length) add('error', 'studio/style-index', 0, `磁盘有但记录没有：${extra.join(', ')}`);
    if (sv.length !== 12) add('error', 'studio/style-index', 0, `variants 应为 12，实际 ${sv.length}`);
    const cards = new Set(sv.map((v) => v.card));
    if (cards.size !== 10) add('error', 'studio/style-index', 0, `card 应为 10 张，实际 ${cards.size}`);

    // cross-check against the reference index
    if (fs.existsSync(INDEX)) {
      const r = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
      const a = sv.map((v) => v.id).sort().join(',');
      const b = (r.variants || []).map((v) => v.id).sort().join(',');
      if (a !== b) {
        add('error', 'style-index', 0, `两份索引的 variant id 不一致\n  studio: ${a}\n  参照:   ${b}`);
      }
    }
  }

  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  for (const f of findings) {
    const sym = f.level === 'error' ? '✗' : '⚠';
    console.log(`${sym} ${f.file}${f.line ? `:${f.line}` : ''} — ${f.msg}`);
  }
  console.log('');
  console.log(`${files.length} 个变体，索引 ${indexCheck}`);
  console.log(`${errors.length} error(s), ${warns.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

main();
