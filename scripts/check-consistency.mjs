#!/usr/bin/env node
/**
 * check-consistency.mjs — verify that every derived artifact still matches
 * decisions.json, via sourceHash + schemaVersion + generatorVersion.
 *
 * The only editable source is `design/aesthetic/decisions.json`.
 * Derived: tokens.json, tokens.css, contract.md, the DESIGN.md marker block.
 *
 * Exit codes: 0 consistent · 1 drift found · 2 environment unavailable · 3 invalid input
 *
 * Usage:
 *   node check-consistency.mjs --project <dir> [--design-file <p>] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const OUT_DIR = 'design/aesthetic';
const EXIT = { PASS: 0, DRIFT: 1, ENV: 2, INPUT: 3 };
const GENERATOR = 'aesthetic-v2';

// Matches both `sourceHash: sha256:<hex>` (comment form, .css/.md)
// and `"sourceHash": "sha256:<hex>"` (JSON form, .json).
const HASH_RE = /"?sourceHash"?\s*:\s*"?sha256:([0-9a-f]{16,64})/i;
const META_BLOCK_RE = /<!--\s*contract-meta([\s\S]*?)-->/i;

function parseArgs(argv) {
  const o = { project: null, designFile: null, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') o.project = argv[++i];
    else if (a === '--design-file') o.designFile = argv[++i];
    else if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '-h' || a === '--help') {
      console.log('check-consistency.mjs --project <dir> [--design-file <p>] [--json]');
      process.exit(EXIT.PASS);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(EXIT.INPUT);
    }
  }
  return o;
}

/**
 * Hash of the *decision content*, not the bytes.
 * Key order and whitespace must not create false drift.
 */
export function hashDecisions(data) {
  const canonical = canonicalize(data);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readHash(text) {
  if (typeof text !== 'string') return null;
  const block = text.match(META_BLOCK_RE);
  const scope = block ? block[1] : text;
  const m = scope.match(HASH_RE);
  return m ? m[1] : null;
}

function readGenerator(text) {
  if (typeof text !== 'string') return null;
  // comment form (`generatorVersion: aesthetic-v2`) or JSON (`"generatorVersion": "aesthetic-v2"`)
  const m = text.match(/"?generatorVersion"?\s*:\s*"?([A-Za-z0-9._-]+)"?/i);
  return m ? m[1] : null;
}

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
    const msg = `找不到 ${path.relative(project, decisionsFile)}`;
    if (o.json) console.log(JSON.stringify({ status: 'fail', reason: 'missing-source', message: msg }));
    else console.error(`✗ ${msg}`);
    process.exit(EXIT.INPUT);
  }

  let decisions;
  try {
    decisions = JSON.parse(fs.readFileSync(decisionsFile, 'utf8'));
  } catch (e) {
    const msg = `decisions.json 不是合法 JSON：${e.message}`;
    if (o.json) console.log(JSON.stringify({ status: 'fail', reason: 'bad-source', message: msg }));
    else console.error(`✗ ${msg}`);
    process.exit(EXIT.DRIFT);
  }

  const expected = hashDecisions(decisions);
  const short = expected.slice(0, 16);
  const findings = [];

  const checks = [
    { name: 'tokens.json', file: path.join(outDir, 'tokens.json') },
    { name: 'tokens.css', file: path.join(outDir, 'tokens.css') },
    { name: 'contract.md', file: path.join(outDir, 'contract.md') },
    {
      name: 'DESIGN.md 注入块',
      file: path.resolve(o.designFile || path.join(project, 'DESIGN.md')),
      optional: true,
    },
  ];

  for (const c of checks) {
    if (!fs.existsSync(c.file)) {
      findings.push({
        artifact: c.name, file: path.relative(project, c.file),
        status: c.optional ? 'absent' : 'missing',
        message: c.optional
          ? '文件不存在（尚未注入，可接受）'
          : '派生物缺失',
      });
      continue;
    }
    const text = fs.readFileSync(c.file, 'utf8');
    const got = readHash(text);
    const gen = readGenerator(text);
    if (!got) {
      findings.push({
        artifact: c.name, file: path.relative(project, c.file),
        status: 'no-hash', message: '缺少 sourceHash；派生物未带 provenance 头',
      });
    } else if (!got.startsWith(short) && !short.startsWith(got)) {
      findings.push({
        artifact: c.name, file: path.relative(project, c.file),
        status: 'stale',
        message: `sourceHash 不匹配（期望 ${short}…，实际 ${got.slice(0, 16)}…）`,
      });
    } else if (gen !== GENERATOR) {
      findings.push({
        artifact: c.name, file: path.relative(project, c.file),
        status: 'wrong-generator',
        message: `generatorVersion 为 ${gen ?? '缺失'}，期望 ${GENERATOR}`,
      });
    }
  }

  const bad = findings.filter((f) => f.status !== 'absent');
  const status = bad.length === 0 ? 'pass' : 'fail';

  if (o.json) {
    console.log(JSON.stringify({
      status,
      sourceHash: expected,
      generatorVersion: GENERATOR,
      findings,
    }, null, 2));
  } else if (!o.quiet) {
    console.log(`源：${path.relative(project, decisionsFile)}`);
    console.log(`sourceHash: sha256:${expected}`);
    console.log('');
    const icon = { pass: '✓', stale: '✗', missing: '✗', 'no-hash': '✗', 'wrong-generator': '✗', absent: '·' };
    for (const f of findings) {
      console.log(`${icon[f.status]} ${f.artifact} — ${f.message}`);
    }
    console.log('');
    console.log(status === 'pass'
      ? '✓ 所有派生物与 decisions.json 一致'
      : `✗ ${bad.length} 处漂移：G3 不通过`);
  }

  process.exit(status === 'pass' ? EXIT.PASS : EXIT.DRIFT);
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) main();
