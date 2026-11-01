#!/usr/bin/env node
/**
 * inject.mjs — write/refresh the aesthetic marker block in a DESIGN.md.
 *
 * Everything outside `<!-- aesthetic:begin … -->` … `<!-- aesthetic:end -->`
 * is byte-for-byte untouched.
 *
 * Exit codes: 0 ok · 1 failed · 2 environment unavailable · 3 invalid input
 *
 * Usage:
 *   node inject.mjs --project <dir> [--design-file <path>] [--content <file>]
 *                   [--check] [--dry-run] [--quiet]
 *
 *   --content   markdown to inject (default: derive from design/aesthetic/contract.md §8)
 *   --check     exit 1 if the block is missing or out of date; never writes
 *   --dry-run   print the result instead of writing
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EXIT = { OK: 0, FAIL: 1, ENV: 2, INPUT: 3 };
const OUT_DIR = 'design/aesthetic';
const BEGIN_RE = /<!--\s*aesthetic:begin[^>]*-->/;
const END_RE = /<!--\s*aesthetic:end\s*-->/;
const VERSION = 'v2';

function parseArgs(argv) {
  const o = { project: null, designFile: null, content: null, check: false, dryRun: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') o.project = argv[++i];
    else if (a === '--design-file') o.designFile = argv[++i];
    else if (a === '--content') o.content = argv[++i];
    else if (a === '--check') o.check = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '-h' || a === '--help') {
      console.log(`inject.mjs --project <dir> [--design-file <p>] [--content <f>] [--check] [--dry-run]`);
      process.exit(EXIT.OK);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(EXIT.INPUT);
    }
  }
  return o;
}

// ---------------------------------------------------------------------------
// derive block content from contract.md §8
// ---------------------------------------------------------------------------

/** Extract the "## 8. 非协商项取值" section body from contract.md. */
export function extractSection8(contractText) {
  const lines = contractText.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s*8\./.test(lines[i].trim())) { start = i + 1; break; }
  }
  if (start < 0) return null;

  const body = [];
  for (let i = start; i < lines.length; i++) {
    if (/^##\s*\d+\./.test(lines[i].trim())) break;
    body.push(lines[i]);
  }
  return body.join('\n').trim() || null;
}

function buildBlock(inner, { outDir = OUT_DIR, sourceHash = null } = {}) {
  const head = `<!-- aesthetic:begin ${VERSION} — 由 aesthetic 生成，勿手改；重跑只覆盖此块 -->`;
  const foot = '<!-- aesthetic:end -->';
  const provenance = sourceHash
    ? `<!-- sourceHash: sha256:${sourceHash} · generatorVersion: aesthetic-v2 -->\n`
    : '';
  const title = '## 非协商项（本项目取值）';
  const pointer = `> 完整合同：\`${outDir}/contract.md\` · 令牌：\`${outDir}/tokens.css\``;
  const body = inner.trim()
    .replace(/^\s*##\s*非协商项（本项目取值）\s*$/m, '')
    .replace(/<!--\s*sourceHash:[\s\S]*?-->\s*/i, '')
    .trim();
  return `${head}\n${provenance}${title}\n\n${pointer}\n\n${body}\n${foot}`;
}

// ---------------------------------------------------------------------------
// marker handling
// ---------------------------------------------------------------------------

/**
 * Apply the block to existing text.
 * Returns { text, action } where action ∈ new | replaced | appended | unchanged.
 */
export function applyBlock(existing, block) {
  if (existing == null) {
    return { text: `${block}\n`, action: 'new' };
  }

  const beginMatch = existing.match(BEGIN_RE);
  const endMatch = existing.match(END_RE);

  if (beginMatch && endMatch) {
    const from = beginMatch.index;
    const to = endMatch.index + endMatch[0].length;
    if (to < from) {
      // end before begin — treat as corrupt, fall through to append
      return { text: `${existing.replace(/\s*$/, '')}\n\n${block}\n`, action: 'appended' };
    }
    const before = existing.slice(0, from);
    const after = existing.slice(to);
    const next = `${before}${block}${after}`;
    return { text: next, action: next === existing ? 'unchanged' : 'replaced' };
  }

  // No (complete) marker pair: append, never overwrite the file.
  const sep = existing.length && !existing.endsWith('\n') ? '\n\n' : '\n';
  return { text: `${existing}${sep}${block}\n`, action: 'appended' };
}

// ---------------------------------------------------------------------------
// atomic write
// ---------------------------------------------------------------------------

function atomicWrite(file, data, { backup = true } = {}) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  if (backup && fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak`);
  }
  fs.writeFileSync(tmp, data.replace(/\r\n/g, '\n'), 'utf8');
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------------------

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.project) {
    console.error('缺少 --project <目标项目路径>');
    process.exit(EXIT.INPUT);
  }
  const project = path.resolve(o.project);
  if (!fs.existsSync(project)) {
    console.error(`项目目录不存在：${project}`);
    process.exit(EXIT.INPUT);
  }

  const designFile = path.resolve(o.designFile || path.join(project, 'DESIGN.md'));

  let inner;
  if (o.content) {
    if (!fs.existsSync(o.content)) {
      console.error(`--content 文件不存在：${o.content}`);
      process.exit(EXIT.INPUT);
    }
    inner = fs.readFileSync(o.content, 'utf8');
  } else {
    const contract = path.join(project, OUT_DIR, 'contract.md');
    if (!fs.existsSync(contract)) {
      console.error(`找不到 ${path.relative(project, contract)}；先跑 Phase 4 生成合同，或用 --content 指定内容。`);
      process.exit(EXIT.INPUT);
    }
    inner = extractSection8(fs.readFileSync(contract, 'utf8'));
    if (!inner) {
      console.error('contract.md 里找不到 "## 8. 非协商项取值" 段落。');
      process.exit(EXIT.INPUT);
    }
  }

  // sourceHash comes from decisions.json when present, so the block can be
  // checked for staleness by check-consistency.mjs.
  let sourceHash = null;
  const decisionsFile = path.join(project, OUT_DIR, 'decisions.json');
  if (fs.existsSync(decisionsFile)) {
    try {
      const { hashDecisions } = await import('./check-consistency.mjs');
      sourceHash = hashDecisions(JSON.parse(fs.readFileSync(decisionsFile, 'utf8')));
    } catch { /* hash is optional; inject still works */ }
  }

  const block = buildBlock(inner, { sourceHash });
  const existing = fs.existsSync(designFile) ? fs.readFileSync(designFile, 'utf8') : null;
  const { text, action } = applyBlock(existing, block);

  if (o.check) {
    const ok = action === 'unchanged';
    if (!o.quiet) {
      console.log(ok
        ? '✓ 注入块内容与源一致'
        : `✗ 注入块需要刷新（当前状态：${action}）`);
      if (!ok) console.log('  运行 `node inject.mjs --project <dir>` 刷新。');
    }
    process.exit(ok ? EXIT.OK : EXIT.FAIL);
  }

  if (o.dryRun) {
    if (!o.quiet) {
      console.log(`--- dry run (${action}) → ${path.relative(project, designFile)} ---`);
      console.log(text);
    }
    process.exit(EXIT.OK);
  }

  if (action === 'unchanged') {
    if (!o.quiet) console.log(`= 未变化：${path.relative(project, designFile)}`);
    process.exit(EXIT.OK);
  }

  try {
    atomicWrite(designFile, text);
  } catch (e) {
    console.error(`写入失败：${e.message}`);
    process.exit(EXIT.FAIL);
  }

  if (!o.quiet) {
    const label = { new: '新建', replaced: '替换块内', appended: '追加到末尾' }[action] || action;
    console.log(`✓ ${label}：${path.relative(project, designFile)}`);
    if (action !== 'new') console.log(`  备份：${path.relative(project, designFile)}.bak`);
  }
  process.exit(EXIT.OK);
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) main();
