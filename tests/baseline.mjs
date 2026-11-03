#!/usr/bin/env node
/**
 * tests/baseline.mjs — baseline.mjs 的行为测试。
 *
 * 用系统和临时目录里的 fixture 跑真实 CLI，验证「录 → 比」的核心承诺：
 *   • 不改动 → 通过
 *   • hard 项丢失 → 退出 1
 *   • soft 项丢失 → 只警告，退出 0
 *   • 合法豁免注释 → 该项不再报
 *   • 项目不存在 / 无基线 → 退出 2
 *   • 重复录制不加 --force → 拒绝且旧基线不变
 *
 * 零依赖，直接运行：node tests/baseline.mjs
 * 退出码：0 全过 · 1 有失败
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '..', 'scripts', 'baseline.mjs');

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
const failures = [];
const tempDirs = [];

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('.');
  } catch (e) {
    failed++;
    failures.push({ name, error: e });
    process.stdout.write(RED('F'));
  }
}

function tempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesthetic-baseline-'));
  tempDirs.push(dir);
  return dir;
}

function write(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

/** 跑 CLI，返回 { code, stdout, stderr }。任何退出码都不抛。 */
function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
}

function baselineFile(dir) {
  return path.join(dir, 'design', 'aesthetic', 'baseline.json');
}

function readBaseline(dir) {
  return JSON.parse(fs.readFileSync(baselineFile(dir), 'utf8'));
}

// 一个够小的 fixture：每类至少一条，删改时不会牵一发动全身。
const FIXTURE_HTML = `<!doctype html>
<html>
<head><title>Fixture</title></head>
<body>
  <h1>Welcome Home</h1>
  <h2>Pricing</h2>
  <nav>
    <a href="/pricing">Pricing</a>
    <a href="#top">Top</a>
    <a href="mailto:hi@example.com">Mail</a>
  </nav>
  <form action="/subscribe" method="POST">
    <input name="email">
    <select name="plan"><option>Basic</option></select>
    <textarea name="message"></textarea>
  </form>
  <img src="/hero.png" alt="hero">
  <button onclick="buy()">Buy</button>
</body>
</html>
`;

const FIXTURE_JS = `const el = document.getElementById('phone');
const card = document.querySelector('.card .title');
`;

function makeFixture({ html = FIXTURE_HTML, js = FIXTURE_JS } = {}) {
  const dir = tempProject();
  write(dir, 'index.html', html);
  if (js !== null) write(dir, 'app.jsx', js);
  return dir;
}

function record(dir, extra = []) {
  return run(['--project', dir, '--record', ...extra]);
}

// ---------------------------------------------------------------------------
// 1. 录 → 不改 → 通过
// ---------------------------------------------------------------------------

test('录基线后不改动，check 退出 0', () => {
  const dir = makeFixture();
  const rec = record(dir);
  assert.strictEqual(rec.code, 0, `record 应退出 0，实际 ${rec.code}\n${rec.stderr}`);

  const base = readBaseline(dir);
  assert.ok(base.items.links.length >= 2, '应录到链接');
  assert.ok(base.items.fields.length === 3, `应录到 3 个字段，实际 ${base.items.fields.length}`);
  assert.ok(base.items.handlers.length >= 1, '应录到事件处理器');
  assert.ok(base.items.selectors.length === 2, '应录到 2 个选择器');

  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 0, `check 应退出 0，实际 ${chk.code}\n${chk.stdout}${chk.stderr}`);
  assert.match(chk.stdout, /Baseline kept/);
  assert.match(chk.stdout, /通过/);
});

test('--check --json 输出机读结构', () => {
  const dir = makeFixture();
  record(dir);
  const chk = run(['--project', dir, '--check', '--json']);
  assert.strictEqual(chk.code, 0);
  const data = JSON.parse(chk.stdout);
  assert.strictEqual(data.ok, true);
  assert.deepStrictEqual(data.hard.missing, []);
  assert.strictEqual(typeof data.hard.total, 'number');
  assert.strictEqual(typeof data.soft.total, 'number');
  assert.strictEqual(data.words.before, data.words.after);
  assert.deepStrictEqual(data.waived, []);
});

// ---------------------------------------------------------------------------
// 2. 删链接 → hard missing，退出 1
// ---------------------------------------------------------------------------

test('删掉一个链接，check 报 hard missing 并退出 1', () => {
  const dir = makeFixture();
  record(dir);
  const html = FIXTURE_HTML.replace('    <a href="/pricing">Pricing</a>\n', '');
  write(dir, 'index.html', html);

  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 1, `应退出 1，实际 ${chk.code}\n${chk.stdout}`);
  assert.match(chk.stdout, /links · \/pricing · index\.html/);
  assert.match(chk.stdout, /不通过/);

  const json = JSON.parse(run(['--project', dir, '--check', '--json']).stdout);
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.hard.missing.length, 1);
  assert.strictEqual(json.hard.missing[0].value, '/pricing');
  assert.strictEqual(json.hard.missing[0].file, 'index.html');
  assert.strictEqual(json.hard.missing[0].kind, 'links');
});

test('删掉一个有 name 的字段也退出 1', () => {
  const dir = makeFixture();
  record(dir);
  write(dir, 'index.html', FIXTURE_HTML.replace('<input name="email">', ''));
  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 1);
  assert.match(chk.stdout, /fields · email · index\.html/);
});

// ---------------------------------------------------------------------------
// 3. 删 heading → 只警告，退出 0
// ---------------------------------------------------------------------------

test('删掉一个 heading 只产生 warn，退出 0', () => {
  const dir = makeFixture();
  record(dir);
  write(dir, 'index.html', FIXTURE_HTML.replace('  <h2>Pricing</h2>\n', ''));

  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 0, `soft 丢失不应失败，实际 ${chk.code}\n${chk.stdout}`);
  assert.match(chk.stdout, /headings · Pricing · index\.html/);

  const json = JSON.parse(run(['--project', dir, '--check', '--json']).stdout);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.soft.missing.length, 1);
  assert.strictEqual(json.soft.missing[0].value, 'Pricing');
  assert.strictEqual(json.hard.missing.length, 0);
});

// ---------------------------------------------------------------------------
// 4. 豁免注释
// ---------------------------------------------------------------------------

test('合法豁免注释让丢失的 hard 项不再报', () => {
  const dir = makeFixture();
  record(dir);
  const html = FIXTURE_HTML
    .replace('    <a href="/pricing">Pricing</a>\n', '')
    + '\n<!-- aesthetic · dropped /pricing · 定价页并入了产品页，路由重定向 -->\n';
  write(dir, 'index.html', html);

  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 0, `豁免后应通过\n${chk.stdout}`);
  assert.doesNotMatch(chk.stdout, /! links · \/pricing/);

  const json = JSON.parse(run(['--project', dir, '--check', '--json']).stdout);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.waived.length, 1);
  assert.strictEqual(json.waived[0].value, '/pricing');
  assert.match(json.waived[0].reason, /定价页并入/);
});

test('JS 块注释豁免同样生效', () => {
  const dir = makeFixture();
  record(dir);
  // 只删掉 querySelector 那条，用块注释豁免；getElementById 保留
  write(dir, 'app.jsx',
    `const el = document.getElementById('phone');\n`
    + `/* aesthetic · dropped .card .title · 卡片标题改为由组件库内部生成 */\n`);
  const json = JSON.parse(run(['--project', dir, '--check', '--json']).stdout);
  assert.strictEqual(json.ok, true, JSON.stringify(json.hard.missing));
  assert.strictEqual(json.waived.length, 1);
  assert.strictEqual(json.waived[0].value, '.card .title');
});

test('理由不足 12 字时豁免无效并给出 warn', () => {
  const dir = makeFixture();
  record(dir);
  const html = FIXTURE_HTML
    .replace('    <a href="/pricing">Pricing</a>\n', '')
    + '\n<!-- aesthetic · dropped /pricing · 合并了 -->\n';
  write(dir, 'index.html', html);

  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 1, '理由太短应仍然失败');
  assert.match(chk.stdout, /豁免不在案/);
});

test('同一个值在多文件丢失，一条豁免即可覆盖', () => {
  const dir = makeFixture();
  write(dir, 'second.html', '<a href="/pricing">Pricing</a>\n<h1>Second</h1>');
  record(dir);
  // 两个文件里的 /pricing 都删掉，只在 index.html 写一次豁免
  write(dir, 'index.html',
    FIXTURE_HTML.replace('    <a href="/pricing">Pricing</a>\n', '')
    + '\n<!-- aesthetic · dropped /pricing · 定价页并入了产品页，路由重定向 -->\n');
  write(dir, 'second.html', '<h1>Second</h1>');

  const json = JSON.parse(run(['--project', dir, '--check', '--json']).stdout);
  assert.strictEqual(json.ok, true, JSON.stringify(json.hard.missing));
  assert.strictEqual(json.hard.missing.length, 0);
  assert.strictEqual(json.waived.length, 1);
  assert.strictEqual(json.waived[0].value, '/pricing');
});

test('同一条 hard 项豁免两次时提示重复', () => {
  const dir = makeFixture();
  record(dir);
  const html = FIXTURE_HTML
    .replace('    <a href="/pricing">Pricing</a>\n', '')
    + '\n<!-- aesthetic · dropped /pricing · 定价页并入了产品页，路由重定向 -->\n'
    + '\n<!-- aesthetic · dropped /pricing · 又一次的重复豁免注释内容 -->\n';
  write(dir, 'index.html', html);

  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 0, '第一条有效豁免应生效');
  assert.match(chk.stdout, /重复豁免/);
});

// ---------------------------------------------------------------------------
// 5. 项目不存在 → 退出 2
// ---------------------------------------------------------------------------

test('项目目录不存在时退出 2', () => {
  const missing = path.join(os.tmpdir(), `aesthetic-missing-${process.pid}-${Date.now()}`);
  const r = run(['--project', missing, '--record']);
  assert.strictEqual(r.code, 2, `应退出 2，实际 ${r.code}\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /项目目录不存在/);
});

// ---------------------------------------------------------------------------
// 6. --check 但无基线 → 退出 2
// ---------------------------------------------------------------------------

test('--check 时没有基线，退出 2 并提示先 --record', () => {
  const dir = makeFixture();
  const r = run(['--project', dir, '--check']);
  assert.strictEqual(r.code, 2, `应退出 2，实际 ${r.code}\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /找不到基线/);
  assert.match(r.stderr, /--record/);
});

// ---------------------------------------------------------------------------
// 7. 重复录制
// ---------------------------------------------------------------------------

test('重复 --record 不加 --force 时拒绝，旧基线原样保留', () => {
  const dir = makeFixture();
  assert.strictEqual(record(dir).code, 0);
  const before = fs.readFileSync(baselineFile(dir), 'utf8');
  const old = JSON.parse(before);

  // 改项目后再录：如果静默覆盖，条目数会变
  write(dir, 'index.html', '<p>empty</p>');
  const again = record(dir);
  assert.strictEqual(again.code, 2, `应拒绝覆盖并退出 2，实际 ${again.code}`);
  assert.match(again.stderr, /基线已存在/);
  assert.match(again.stderr, /--force/);

  const after = fs.readFileSync(baselineFile(dir), 'utf8');
  assert.strictEqual(after, before, '旧基线必须逐字保留');
  assert.strictEqual(JSON.parse(after).recordedAt, old.recordedAt);
});

test('--record --force 允许覆盖', () => {
  const dir = makeFixture();
  assert.strictEqual(record(dir).code, 0);
  write(dir, 'index.html', '<h1>Only</h1>');
  const forced = record(dir, ['--force']);
  assert.strictEqual(forced.code, 0, forced.stderr);
  const base = readBaseline(dir);
  assert.strictEqual(base.items.links.length, 0);
  assert.strictEqual(base.files.length, 2);
});

// ---------------------------------------------------------------------------
// 8. 边界与覆盖类别
// ---------------------------------------------------------------------------

test('基线录了 .jsx 而项目只剩 .tsx 时给出未覆盖警告', () => {
  const dir = makeFixture();
  record(dir);
  fs.rmSync(path.join(dir, 'app.jsx'));
  write(dir, 'app.tsx', FIXTURE_JS);
  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 0);
  assert.match(chk.stdout, /未覆盖 \.jsx/);
});

test('words 骤减超过 40% 时给出 warn', () => {
  const dir = makeFixture();
  record(dir);
  // 保留全部 hard 接线，只把文本掏空
  const stripped = FIXTURE_HTML
    .replace('<h1>Welcome Home</h1>', '<h1></h1>')
    .replace('<h2>Pricing</h2>', '<h2></h2>')
    .replace('<a href="/pricing">Pricing</a>', '<a href="/pricing"></a>')
    .replace('>Mail<', '><')
    .replace('<option>Basic</option>', '<option></option>');
  write(dir, 'index.html', stripped);
  const chk = run(['--project', dir, '--check']);
  assert.strictEqual(chk.code, 0);
  assert.match(chk.stdout, /words 比基线少/);
});

test('JSX 属性里的箭头函数不会截断后面的属性', () => {
  const dir = tempProject();
  write(dir, 'page.jsx', [
    'export default function Page() {',
    '  return (',
    '    <section>',
    '      <button onClick={() => go(\'x\')} id="cta">Go</button>',
    '      <a href="/after-arrow" to="/route-after">Next</a>',
    '      <input name="afterArrow" />',
    '    </section>',
    '  );',
    '}',
  ].join('\n'));
  record(dir);
  const base = readBaseline(dir);
  assert.deepStrictEqual(base.items.links.map((l) => l.value).sort(), ['/after-arrow', '/route-after']);
  assert.deepStrictEqual(base.items.ids.map((l) => l.value), ['cta']);
  assert.deepStrictEqual(base.items.fields.map((l) => l.value), ['afterArrow']);
  assert.deepStrictEqual(base.items.handlers.map((l) => l.value), ['onclick']);
});

test('跳过 node_modules 与 design/aesthetic', () => {
  const dir = makeFixture();
  write(dir, 'node_modules/pkg/a.html', '<a href="/from-dep">dep</a>');
  write(dir, 'design/aesthetic/contract.html', '<a href="/from-own-output">out</a>');
  write(dir, '.hidden/x.html', '<a href="/from-hidden">hidden</a>');
  record(dir);
  const base = readBaseline(dir);
  const values = base.items.links.map((l) => l.value);
  assert.ok(!values.includes('/from-dep'), 'node_modules 应被跳过');
  assert.ok(!values.includes('/from-own-output'), 'design/aesthetic 应被跳过');
  assert.ok(!values.includes('/from-hidden'), '点目录应被跳过');
});

test('--help 打印用法并以 0 退出', () => {
  const r = run(['--help']);
  assert.strictEqual(r.code, 0);
  assert.match(r.stdout, /--record/);
  assert.match(r.stdout, /--check/);
  assert.match(r.stdout, /静态扫描不覆盖运行时注入的 DOM/);
});

// ---------------------------------------------------------------------------
// cleanup + report
// ---------------------------------------------------------------------------

for (const dir of tempDirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* best effort */ }
}

console.log('');
console.log('');
if (failures.length) {
  for (const f of failures) {
    console.log(RED('✗ ') + f.name);
    console.log(DIM(String(f.error.message).split('\n').map((l) => `    ${l}`).join('\n')));
  }
  console.log('');
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
