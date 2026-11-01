#!/usr/bin/env node
/**
 * shoot.mjs — 定尺寸全页截图（L3 知觉复核的取材工具）。
 *
 * 视口：desktop 1440×900 / tablet 834×1112 / mobile 390×844，dpr 2。
 * 每对 (view, theme) 截一张全页图，落到 <out>，文件名 {name}-{view}-{theme}.png。
 * 主题通过 document.documentElement.dataset.theme 注入；--style 同时写 dataset.style。
 *
 * 浏览器不可用（含 CDP Proxy 缺 Emulation 能力）时输出 manual-required 并以 2 退出，
 * 绝不伪造成功。本脚本不安装依赖、不下载、不启动浏览器。
 *
 * Exit codes: 0 成功 · 1 失败（非浏览器原因） · 2 环境不可用 · 3 输入非法
 *
 * Usage:
 *   node shoot.mjs --project <dir> --url <url> [--out <dir>]
 *                  [--view desktop|tablet|mobile|all] [--theme light|dark|all]
 *                  [--style <variant>] [--name <basename>] [--json] [--port <n>]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { connect, CdpError } from './lib/cdp.mjs';

const EXIT = { PASS: 0, FAIL: 1, ENV: 2, INPUT: 3 };

const OUT_DIR = path.join('design', 'aesthetic', 'shots');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};
const VIEW_NAMES = Object.keys(VIEWPORTS);
const THEMES = ['light', 'dark'];
const DPR = 2;

class InputError extends Error {}

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

function usage() {
  return [
    'shoot.mjs --project <dir> --url <url> [--out <dir>]',
    '          [--view desktop|tablet|mobile|all] [--theme light|dark|all]',
    '          [--style <variant>] [--name <basename>] [--json] [--port <n>]',
    '',
    '  --project  目标项目根目录（默认输出到 <project>/design/aesthetic/shots）',
    '  --url      要截图的页面地址',
    '  --out      输出目录，默认 <project>/design/aesthetic/shots',
    '  --view     desktop 1440×900 | tablet 834×1112 | mobile 390×844 | all（默认 desktop）',
    '  --theme    light | dark | all（默认 light）',
    '  --style    写入 document.documentElement.dataset.style',
    '  --name     文件名前缀，默认 shot',
    '  --json     输出机器可读 JSON',
    '  --port     直连 DevTools 调试端口，默认 9222',
    '',
    '退出码：0 成功 · 1 失败 · 2 浏览器不可用（manual-required） · 3 输入非法',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    project: null, url: null, out: null, view: 'desktop', theme: 'light',
    style: null, name: 'shot', json: false, port: 9222, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') opts.project = argv[++i];
    else if (a === '--url' || a === '-u') opts.url = argv[++i];
    else if (a === '--out' || a === '-o') opts.out = argv[++i];
    else if (a === '--view') opts.view = argv[++i];
    else if (a === '--theme') opts.theme = argv[++i];
    else if (a === '--style') opts.style = argv[++i];
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new InputError(`unknown argument: ${a}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

function expand(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  if (!allowed.includes(value)) {
    throw new InputError(`--${flag} 只能是 ${allowed.join('|')}|all，收到：${value}`);
  }
  return [value];
}

function buildConfig(opts) {
  if (!opts.project) throw new InputError('缺少 --project <目标项目路径>');
  if (!opts.url) throw new InputError('缺少 --url <页面地址>');

  const project = path.resolve(opts.project);
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) {
    throw new InputError(`项目目录不存在或不是目录：${project}`);
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

  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new InputError(`--port 必须是 1–65535 的整数，收到：${opts.port}`);
  }

  const outDir = opts.out
    ? path.resolve(project, opts.out)
    : path.resolve(project, OUT_DIR);

  const safeName = String(opts.name || 'shot').replace(/[\\/:*?"<>|\s]+/g, '-');
  if (!safeName) throw new InputError('--name 不能为空');

  return {
    project,
    url,
    outDir,
    view: opts.view,
    theme: opts.theme,
    views: expand(opts.view, VIEW_NAMES, 'view'),
    themes: expand(opts.theme, THEMES, 'theme'),
    style: opts.style || null,
    name: safeName,
    port: opts.port,
    json: opts.json,
  };
}

function planShots(cfg) {
  const shots = [];
  for (const view of cfg.views) {
    for (const theme of cfg.themes) {
      const vp = VIEWPORTS[view];
      shots.push({
        path: path.resolve(cfg.outDir, `${cfg.name}-${view}-${theme}.png`),
        view,
        theme,
        width: vp.width,
        height: vp.height,
      });
    }
  }
  return shots;
}

// ---------------------------------------------------------------------------
// page state
// ---------------------------------------------------------------------------

// 在页面里注入主题与风格。集中在一个表达式里，避免两次 evaluate 之间出现中间态。
function stateExpression(theme, style) {
  const lines = [
    '(() => {',
    '  const root = document.documentElement;',
    `  root.dataset.theme = ${JSON.stringify(theme)};`,
  ];
  if (style) lines.push(`  root.dataset.style = ${JSON.stringify(style)};`);
  lines.push(
    '  window.scrollTo(0, 0);',
    '  void root.offsetHeight;',
    '  return true;',
    '})()',
  );
  return lines.join('\n');
}

// 两帧 + 一小段，让主题过渡、字体回退与重排落定后再截图。
const SETTLE_EXPRESSION =
  'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(' +
  '() => setTimeout(() => r(true), 80))))';

async function applyState(conn, theme, style) {
  await conn.evaluate(stateExpression(theme, style));
  await conn.evaluate(SETTLE_EXPRESSION);
}

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

function isBrowserFailure(e) {
  return e instanceof CdpError || ['ENOENT', 'ETIMEDOUT', 'EPROTO'].includes(e?.code);
}

function reasonFor(e) {
  const code = e?.code ? `${e.code}: ` : '';
  const base = `${code}${e?.message || String(e)}`;
  const hint = '可改用 Chromium 111+ 以 --remote-debugging-port=9222 启动后重试；'
    + 'CDP Proxy 不提供 Emulation 端点，无法设置视口。'
    + 'L3 知觉复核必须人工完成，不能记为自动通过。';
  return `${base}。${hint}`;
}

async function capture(cfg, planned) {
  let conn;
  try {
    conn = await connect({
      port: cfg.port,
      timeoutMs: 15000,
      // proxy 缺 setViewport/fullPageScreenshot，会被自动跳过
      need: ['setViewport', 'fullPageScreenshot'],
    });
  } catch (e) {
    if (isBrowserFailure(e)) {
      return { status: 'manual-required', reason: reasonFor(e), shots: planned };
    }
    throw e;
  }

  const done = [];
  let failure = null;
  try {
    fs.mkdirSync(cfg.outDir, { recursive: true });
    await conn.navigate(cfg.url);

    for (const shot of planned) {
      try {
        await conn.setViewport(shot.width, shot.height, DPR);
        await applyState(conn, shot.theme, cfg.style);
        const png = await conn.screenshot({ fullPage: true });
        fs.writeFileSync(shot.path, png);
        done.push({
          path: shot.path, view: shot.view, theme: shot.theme,
          width: shot.width, height: shot.height,
        });
      } catch (e) {
        if (!isBrowserFailure(e)) throw e;
        failure = e;
        break;
      }
    }
  } finally {
    await conn.close().catch(() => {});
  }

  if (failure) {
    const reason = `${reasonFor(failure)}（已完成 ${done.length}/${planned.length} 张）`;
    return { status: 'manual-required', reason, shots: planned, done };
  }
  return { status: 'ok', shots: done, upstream: conn.upstream, endpoint: conn.endpoint };
}

// ---------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------

function emitManual(result, cfg) {
  const payload = {
    status: 'manual-required',
    reason: result.reason,
    shots: result.shots.map((s) => ({
      path: s.path, view: s.view, theme: s.theme, width: s.width, height: s.height,
    })),
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!cfg.json) {
    console.error(`! manual-required — ${result.reason}`);
    console.error('  L3 知觉复核必须人工完成，不能记为自动通过。');
  }
  process.exit(EXIT.ENV);
}

function emitOk(result, cfg, startedAt) {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (cfg.json) {
    console.log(JSON.stringify({
      status: 'ok',
      shots: result.shots.map((s) => ({
        path: s.path, view: s.view, theme: s.theme, width: s.width, height: s.height,
      })),
    }, null, 2));
    return;
  }
  console.log(`→ ${cfg.url}`);
  console.log(`→ ${cfg.outDir}`);
  for (const s of result.shots) {
    console.log(`✓ ${path.basename(s.path)} ${s.width}×${s.height} ${s.theme}`);
  }
  console.log(`${result.shots.length} shot(s) in ${elapsed}s`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();

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

  const planned = planShots(cfg);

  let result;
  try {
    result = await capture(cfg, planned);
  } catch (e) {
    console.error(`! 截图失败：${e?.message || e}`);
    if (!cfg.json) console.error('  这不是浏览器不可用，而是本地错误（例如目录不可写）。');
    process.exit(EXIT.FAIL);
  }

  if (result.status === 'manual-required') emitManual(result, cfg);
  emitOk(result, cfg, startedAt);
  process.exit(EXIT.PASS);
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]).toLowerCase() === path.resolve(self).toLowerCase();
})();

if (isDirectRun) {
  main().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(EXIT.FAIL);
  });
}
