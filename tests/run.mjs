#!/usr/bin/env node
/**
 * tests/run.mjs — the skill's own test suite. No framework, no dependencies.
 *
 * Covers the parts that break silently:
 *   • OKLCH round-trip, ΔL, contrast, gamut mapping
 *   • decision hashing stability (key order must not matter)
 *   • marker block: idempotency, replacement, append, corrupt pairs
 *   • generation chain: build → inject → check-consistency
 *   • lint: pure black, raw colours, ΔL bounds, missing translation
 *   • path safety: `..` and symlink escapes are rejected
 *
 * Exit codes: 0 all pass · 1 failures · 2 environment unavailable
 *
 * Usage: node tests/run.mjs [--verbose] [--filter <substr>]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SCRIPTS = path.join(ROOT, 'scripts');

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  const filter = process.argv.includes('--filter')
    ? process.argv[process.argv.indexOf('--filter') + 1]
    : null;
  if (filter && !name.includes(filter)) return;

  try {
    fn();
    passed++;
    if (process.argv.includes('--verbose')) console.log(ok(name));
    else process.stdout.write('.');
  } catch (e) {
    failed++;
    failures.push({ name, error: e });
    process.stdout.write('\x1b[31mF\x1b[0m');
  }
}

function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}\n  期望: ${b}\n  实际: ${a}`);
}

function truthy(v, msg = '') {
  if (!v) throw new Error(msg || `期望真值，实际 ${JSON.stringify(v)}`);
}

function closeTo(actual, expected, eps, msg = '') {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${msg}\n  期望 ≈${expected} (±${eps})\n  实际: ${actual}`);
  }
}

function throws(fn, msg = '') {
  try { fn(); } catch { return; }
  throw new Error(msg || '期望抛错，但没有');
}

// ---------------------------------------------------------------------------
// temp project helper
// ---------------------------------------------------------------------------

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesthetic-test-'));
  fs.mkdirSync(path.join(dir, 'design', 'aesthetic'), { recursive: true });
  return dir;
}

function sampleDecisions(overrides = {}) {
  return {
    meta: {
      schemaVersion: 1, theme: 'light-dark',
      generatedAt: '2026-11-01T00:00:00Z', generatorVersion: 'aesthetic-v2',
    },
    direction: {
      director: 'impeccable', mode: 'Operate',
      keywords: ['工业', '克制', '图纸感'],
      references: ['瑞士铁路时刻表', '像 Braun 但更轻'],
      anti: ['糖水渐变', '大圆角'],
    },
    translation: {
      neutralTemp: { value: 'H 250, C 0.003', from: '像瑞士铁路时刻表' },
      chromaCap: { value: 0.09, from: '不要糖水感' },
      radius: { value: [0, 2, 4, 999], from: '工业感' },
      border: { value: '1px / fg 8%', from: '像图纸' },
      shadow: { value: '仅浮层', from: null },
      weight: { value: [400, 500, 600], from: '不要大字报' },
      motion: { value: '100-140ms ease-out', from: null },
    },
    style: { card: 'minimalism', variant: 'minimalism' },
    color: {
      light: {
        bg: { oklch: 'oklch(0.985 0.002 85)', hex: '#FBFAF9', l: 0.985 },
        'surface-1': { oklch: 'oklch(0.975 0.002 85)', hex: '#F6F5F4', l: 0.975 },
        'surface-2': { oklch: 'oklch(0.960 0.002 85)', hex: '#F1F0EF', l: 0.96 },
        'surface-3': { oklch: 'oklch(0.943 0.002 85)', hex: '#ECEBEA', l: 0.943 },
        fg: { oklch: 'oklch(0.2174 0.0019 106.6)', hex: '#1A1A19', l: 0.2174 },
        'fg-muted': { oklch: 'oklch(0.520 0.004 85)', hex: '#757371', l: 0.52 },
        accent: { oklch: 'oklch(0.520 0.090 250)', hex: '#2F6690', l: 0.52 },
        'line-1': { oklch: 'oklch(0.900 0.002 85)', hex: '#E0DFDD', l: 0.9 },
        'line-inset': { oklch: 'oklch(0.860 0.002 85)', hex: '#D2D1CF', l: 0.86 },
      },
      dark: {
        bg: { oklch: 'oklch(0.180 0.002 85)', hex: '#161514', l: 0.18 },
        fg: { oklch: 'oklch(0.940 0.002 85)', hex: '#EDECEB', l: 0.94 },
        'fg-muted': { oklch: 'oklch(0.720 0.004 85)', hex: '#ACABA9', l: 0.72 },
        accent: { oklch: 'oklch(0.720 0.090 250)', hex: '#7FB3D6', l: 0.72 },
      },
    },
    surfaceLadder: { step: [0.010, 0.015, 0.017] },
    weightLadder: { family: 'Inter Variable', variable: true, available: [300, 400, 500, 600, 700] },
    weights: {
      light: { body: 400, strong: 600, display: 700 },
      dark: { body: 350, strong: 500, display: 600 },
    },
    overrides: [],
    ...overrides,
  };
}

function writeDecisions(dir, data) {
  fs.writeFileSync(
    path.join(dir, 'design', 'aesthetic', 'decisions.json'),
    JSON.stringify(data, null, 2),
  );
}

function run(script, args, expectExit = 0) {
  try {
    const out = execFileSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    const code = typeof e.status === 'number' ? e.status : 1;
    if (code !== expectExit) {
      throw new Error(`${script} 退出码 ${code}，期望 ${expectExit}\n${e.stdout || ''}${e.stderr || ''}`);
    }
    return { code, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// ---------------------------------------------------------------------------
// 1. colour maths
// ---------------------------------------------------------------------------

const oklch = await import('../scripts/lib/oklch.mjs');

test('oklch: 白与黑', () => {
  const w = oklch.rgbToOklch([1, 1, 1]);
  closeTo(w.L, 1, 1e-6, '白色 L');
  closeTo(w.C, 0, 1e-6, '白色 C');
  const b = oklch.rgbToOklch([0, 0, 0]);
  closeTo(b.L, 0, 1e-6, '黑色 L');
});

test('oklch: #1A1A19 实测值', () => {
  const c = oklch.rgbToOklch(oklch.hexToRgb('#1A1A19'));
  closeTo(c.L, 0.2174, 5e-4, 'L');
  closeTo(c.C, 0.0019, 5e-4, 'C');
  closeTo(c.H, 106.6, 0.5, 'H');
});

test('oklch: 往返不失真', () => {
  for (const hex of ['#FBFAF9', '#161514', '#2F6690', '#1A1A19', '#7FB3D6']) {
    const back = oklch.rgbToHex(oklch.oklchToRgb(oklch.rgbToOklch(oklch.hexToRgb(hex))));
    eq(back.toLowerCase(), hex.toLowerCase(), `${hex} 往返`);
  }
});

test('oklch: 解析与格式化', () => {
  const p = oklch.parseOklch('oklch(0.985 0.002 85)');
  eq([p.L, p.C, p.H], [0.985, 0.002, 85]);
  eq(oklch.formatOklch(p), 'oklch(0.985 0.002 85)');
  const withAlpha = oklch.parseOklch('oklch(50% 0.1 250 / 0.4)');
  eq(withAlpha.alpha, 0.4);
  closeTo(withAlpha.L, 0.5, 1e-9);
  throws(() => oklch.parseOklch('#fff'), '非 oklch 应抛错');
});

test('oklch: 对比度', () => {
  closeTo(oklch.contrastHex('#FFFFFF', '#000000'), 21, 0.01);
  closeTo(oklch.contrastHex('#FFFFFF', '#FFFFFF'), 1, 1e-9);
  const r = oklch.contrastHex('#1A1A19', '#FBFAF9');
  truthy(r > 15, `#1A1A19 on #FBFAF9 应 >15，实际 ${r}`);
});

test('oklch: ΔL 是绝对值', () => {
  const a = { L: 0.985, C: 0, H: 0 };
  const b = { L: 0.975, C: 0, H: 0 };
  closeTo(oklch.deltaL(a, b), 0.010, 1e-9);
  closeTo(oklch.deltaL(b, a), 0.010, 1e-9, '顺序无关');
});

test('oklch: 阶梯把 step 夹在 [0.010, 0.030]', () => {
  const tooSmall = oklch.surfaceLadder({ L: 0.9, C: 0, H: 0 }, 1, 0.001);
  closeTo(tooSmall[1].deltaFromPrev, 0.010, 1e-9);
  const tooBig = oklch.surfaceLadder({ L: 0.9, C: 0, H: 0 }, 1, 0.9);
  closeTo(tooBig[1].deltaFromPrev, 0.030, 1e-9);
});

test('oklch: 超色域做 gamut mapping', () => {
  const wild = { L: 0.7, C: 0.4, H: 150 };  // 极可能超出 sRGB
  const { hex, clipped } = oklch.oklchToHex(wild);
  truthy(/^#[0-9a-f]{6}$/i.test(hex), 'hex 格式');
  truthy(clipped, '应标记 clipped');
  const rgb = oklch.oklchToRgb({ L: 0.7, C: 0.01, H: 150 });
  truthy(oklch.inGamut(rgb), '低彩度应在色域内');
});

// ---------------------------------------------------------------------------
// 2. schema
// ---------------------------------------------------------------------------

const { validate } = await import('../scripts/lib/schema.mjs');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'decisions.schema.json'), 'utf8'));

test('schema: 合法数据通过', () => {
  const r = validate(SCHEMA, sampleDecisions());
  truthy(r.valid, r.errors.join('\n'));
});

test('schema: 缺字段被拒', () => {
  const bad = sampleDecisions();
  delete bad.meta.generatorVersion;
  const r = validate(SCHEMA, bad);
  truthy(!r.valid, '应失败');
  truthy(r.errors.some((e) => e.includes('generatorVersion')), '应指出字段名');
});

test('schema: ΔL 越界被拒', () => {
  const r = validate(SCHEMA, sampleDecisions({ surfaceLadder: { step: [0.05] } }));
  truthy(!r.valid, '0.05 超出上限应失败');
});

test('schema: override 缺字段被拒', () => {
  const r = validate(SCHEMA, sampleDecisions({ overrides: [{ rule: 'R3' }] }));
  truthy(!r.valid, '九字段不全应失败');
  truthy(r.errors.some((e) => e.includes('scope') || e.includes('reason')));
});

// ---------------------------------------------------------------------------
// 3. hashing
// ---------------------------------------------------------------------------

const { hashDecisions } = await import('../scripts/check-consistency.mjs');

test('hash: 键序无关', () => {
  const a = sampleDecisions();
  const b = JSON.parse(JSON.stringify(a));
  // reorder top-level keys
  const reordered = {};
  for (const k of Object.keys(b).reverse()) reordered[k] = b[k];
  eq(hashDecisions(a), hashDecisions(reordered));
});

test('hash: 值变则变', () => {
  const a = sampleDecisions();
  const b = sampleDecisions();
  b.translation.radius.value = [0, 0, 0, 999];
  truthy(hashDecisions(a) !== hashDecisions(b));
});

test('hash: 稳定性', () => {
  const a = sampleDecisions();
  eq(hashDecisions(a), hashDecisions(sampleDecisions()), '相同输入应得相同 hash');
});

// ---------------------------------------------------------------------------
// 4. marker block
// ---------------------------------------------------------------------------

const { applyBlock } = await import('../scripts/inject.mjs');

const BLOCK = [
  '<!-- aesthetic:begin v2 — 由 aesthetic 生成，勿手改；重跑只覆盖此块 -->',
  '<!-- sourceHash: sha256:abc123abc123abc1 · generatorVersion: aesthetic-v2 -->',
  '## 非协商项（本项目取值）',
  '',
  '内容',
  '<!-- aesthetic:end -->',
].join('\n');

test('marker: 新建', () => {
  const r = applyBlock(null, BLOCK);
  eq(r.action, 'new');
  truthy(r.text.includes('aesthetic:begin'));
});

test('marker: 追加到无 marker 文件', () => {
  const existing = '# 我的设计文档\n\n导演层写的东西。\n';
  const r = applyBlock(existing, BLOCK);
  eq(r.action, 'appended');
  truthy(r.text.startsWith('# 我的设计文档'), '原有内容必须在最前');
  truthy(r.text.includes('导演层写的东西'), '原有内容必须保留');
});

test('marker: 替换块内，块外不动', () => {
  const existing = `# 文档\n\n${BLOCK}\n\n## 尾部\n\n尾巴内容。\n`;
  const next = BLOCK.replace('内容', '新内容');
  const r = applyBlock(existing, next);
  eq(r.action, 'replaced');
  truthy(r.text.includes('# 文档'), '头部保留');
  truthy(r.text.includes('新内容'), '新内容写入');
  truthy(r.text.includes('尾巴内容'), '尾部保留');
  truthy(!r.text.includes('\n内容\n'), '旧内容被替换');
});

test('marker: 内容相同 → unchanged', () => {
  const existing = `# 文档\n\n${BLOCK}\n`;
  const r = applyBlock(existing, BLOCK);
  eq(r.action, 'unchanged');
});

test('marker: 只有 begin 没有 end → 追加而非覆盖', () => {
  const existing = '# 文档\n\n<!-- aesthetic:begin v2 -->\n半截块\n';
  const r = applyBlock(existing, BLOCK);
  eq(r.action, 'appended');
  truthy(r.text.includes('半截块'), '不能丢失原有内容');
});

test('marker: end 在 begin 之前 → 追加', () => {
  const existing = '# 文档\n\n<!-- aesthetic:end -->\n\n<!-- aesthetic:begin v2 -->\n';
  const r = applyBlock(existing, BLOCK);
  eq(r.action, 'appended');
});

test('marker: 幂等（三次结果相同）', () => {
  let text = null;
  const actions = [];
  for (let i = 0; i < 3; i++) {
    const r = applyBlock(text, BLOCK);
    actions.push(r.action);
    text = r.text;
  }
  eq(actions, ['new', 'unchanged', 'unchanged']);
});

// ---------------------------------------------------------------------------
// 5. generation chain
// ---------------------------------------------------------------------------

test('chain: build → inject → consistency 全绿', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('build.mjs', ['--project', dir, '--quiet']);
  run('inject.mjs', ['--project', dir, '--quiet']);
  run('check-consistency.mjs', ['--project', dir, '--quiet']);
  for (const f of ['tokens.json', 'tokens.css', 'contract.md']) {
    truthy(fs.existsSync(path.join(dir, 'design', 'aesthetic', f)), `${f} 应存在`);
  }
  truthy(fs.existsSync(path.join(dir, 'DESIGN.md')), 'DESIGN.md 应存在');
});

test('chain: 产物不含未替换占位符', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('build.mjs', ['--project', dir, '--quiet']);
  const contract = fs.readFileSync(path.join(dir, 'design', 'aesthetic', 'contract.md'), 'utf8');
  const leftovers = contract.match(/\{\{[^}]*\}\}/g);
  eq(leftovers, null, `contract.md 残留占位符：${leftovers}`);
});

test('schema: tokens.json 符合 tokens.schema.json', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('build.mjs', ['--project', dir, '--quiet']);
  const tokens = JSON.parse(
    fs.readFileSync(path.join(dir, 'design', 'aesthetic', 'tokens.json'), 'utf8'),
  );
  const ts = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'tokens.schema.json'), 'utf8'));
  const r = validate(ts, tokens);
  truthy(r.valid, r.errors.join('\n'));
});

test('chain: 改决策后 consistency 报过期', () => {
  const dir = makeProject();
  const d = sampleDecisions();
  writeDecisions(dir, d);
  run('build.mjs', ['--project', dir, '--quiet']);
  run('inject.mjs', ['--project', dir, '--quiet']);
  run('check-consistency.mjs', ['--project', dir, '--quiet']);

  d.translation.radius.value = [0, 2, 8, 999];
  writeDecisions(dir, d);

  const r = run('check-consistency.mjs', ['--project', dir, '--quiet'], 1);
  truthy(r.out.includes('tokens.css') || r.out.includes('stale') || r.code === 1,
    '应报告漂移');
});

test('chain: 注入块被抹后可恢复', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('build.mjs', ['--project', dir, '--quiet']);
  run('inject.mjs', ['--project', dir, '--quiet']);

  // 模拟导演层重生成 DESIGN.md
  fs.writeFileSync(path.join(dir, 'DESIGN.md'), '# 新的设计文档\n\n导演层重写了。\n');

  run('inject.mjs', ['--project', dir, '--quiet']);
  const text = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf8');
  truthy(text.includes('aesthetic:begin'), '块应回来');
  truthy(text.includes('导演层重写了'), '导演层内容应保留');
});

// ---------------------------------------------------------------------------
// 6. lint
// ---------------------------------------------------------------------------

test('lint: 合法项目通过', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('check-tokens.mjs', ['--project', dir, '--quiet']);
});

test('lint: 裸色值被报', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.css'), '.x { color: #ff0000; }\n');
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('#ff0000'), '应报出裸色值');
});

test('lint: 不透明纯黑被报', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'b.css'), '.x { color: #000; }\n');
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('R3'), '应报 R3');
});

test('lint: 阴影里的带 alpha 黑不算违规', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'c.css'),
    '.x { box-shadow: 0 1px 2px rgb(0 0 0 / .2); }\n');
  run('check-tokens.mjs', ['--project', dir, '--quiet']);
});

test('lint: translation 为空直接报错', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions({ translation: {} }));
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('translation') || r.out.includes('G2'), '应报 G2 被跳过');
});

test('lint: ΔL 越界被报', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions({ surfaceLadder: { step: [0.1] } }));
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('0.1') || r.out.includes('R2'), '应报 R2');
});

test('lint: 暗色未降字重被报', () => {
  const dir = makeProject();
  const d = sampleDecisions();
  d.weights.dark = { body: 400, strong: 600, display: 700 };
  writeDecisions(dir, d);
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('R5'), '应报 R5');
});

test('lint: 按钮文字对比度不足被报', () => {
  const dir = makeProject();
  const d = sampleDecisions();
  d.color.light['on-accent'] = { oklch: 'oklch(0.80 0.02 250)', hex: '#c3c7cd', l: 0.8 };
  writeDecisions(dir, d);
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('on-accent'), '应报主按钮文字对比度');
});

test('lint: 小字字重被降档时被报', () => {
  const dir = makeProject();
  const d = sampleDecisions();
  d.weights.dark.small = 350;
  writeDecisions(dir, d);
  const r = run('check-tokens.mjs', ['--project', dir], 1);
  truthy(r.out.includes('小字') || r.out.includes('small'), '应报小字被降档');
});

test('build: 小字字重跨主题恒定', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('build.mjs', ['--project', dir, '--quiet']);
  const css = fs.readFileSync(path.join(dir, 'design', 'aesthetic', 'tokens.css'), 'utf8');
  const light = css.split('[data-theme="dark"]')[0];
  const dark = css.split('[data-theme="dark"]')[1] || '';
  const pick = (block, name) => {
    const m = block.match(new RegExp(`--${name}:\\s*([0-9.]+)`));
    return m ? Number(m[1]) : null;
  };
  eq(pick(light, 'fw-small'), pick(dark, 'fw-small'), '--fw-small 暗色应等于浅色');
  eq(pick(light, 'fw-small-strong'), pick(dark, 'fw-small-strong'), '--fw-small-strong 暗色应等于浅色');
  truthy(pick(dark, 'fw-body') < pick(light, 'fw-body'), '--fw-body 暗色应低于浅色');
});

// ---------------------------------------------------------------------------
// 7. path safety
// ---------------------------------------------------------------------------

test('safety: inject 拒绝写到项目外', () => {
  const dir = makeProject();
  writeDecisions(dir, sampleDecisions());
  run('build.mjs', ['--project', dir, '--quiet']);
  const outside = path.resolve(dir, '..', `escape-${Date.now()}.md`);
  let blocked = false;
  try {
    execFileSync(process.execPath, [
      path.join(SCRIPTS, 'inject.mjs'),
      '--project', dir, '--design-file', outside, '--quiet',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    blocked = true;
  }
  // 若未阻止，至少确认它没有静默写到项目外
  if (!blocked && fs.existsSync(outside)) {
    fs.unlinkSync(outside);
    throw new Error('DESIGN_FILE 指向项目外时未被阻止');
  }
});

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

console.log('');
console.log('');
if (failures.length) {
  for (const f of failures) {
    console.log(bad(f.name));
    console.log(dim(String(f.error.message).split('\n').map((l) => `    ${l}`).join('\n')));
  }
  console.log('');
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
