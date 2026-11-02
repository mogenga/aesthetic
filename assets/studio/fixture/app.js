/**
 * app.js —— 夹具的渲染、hash 路由与交互。
 * 原生 ESM、无构建、无依赖；file:// 直接打开可用（全部相对 import，无 fetch）。
 * 视图只返回字符串，这里负责挂载、事件与计时。
 */

import * as content from "./content.js";
import { icon, brand, nav, topbar } from "./content.js";
import renderDashboard from "./views/dashboard.js";
import renderSettings from "./views/settings.js";
import renderForm from "./views/form.js";
import renderAi from "./views/ai.js";
import renderComponents from "./views/components.js";
import renderLab from "./views/lab.js";

const ROUTES = {
  dashboard: { title: "总览", render: renderDashboard, data: content.dashboard },
  settings: { title: "设置", render: renderSettings, data: content.settings },
  form: { title: "发布活动", render: renderForm, data: content.form },
  ai: { title: "智能助理", render: renderAi, data: content.ai },
  components: { title: "组件架", render: renderComponents, data: content.components },
  // Studio 组件实验台的裸渲染：只挂一个组件，视觉完全由当前 token + 变体决定。
  // 路由是 #/lab，参数从 query 读（见 views/lab.js）。
  lab: { title: "实验台", render: renderLab, data: null, bare: true },
};
const DEFAULT_ROUTE = "dashboard";

const doc = document.documentElement;
const app = document.getElementById("app");
const main = document.querySelector("[data-main]");
const navList = document.querySelector("[data-nav]");
const routeAnnounce = document.querySelector("[data-route-announce]");
const timerEl = document.querySelector("[data-timer]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const railToggle = document.querySelector("[data-rail-toggle]");
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const prefersReduce = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- 主题 ---- */

const THEME_KEY = "aesthetic-fixture-theme";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null; // file:// 或隐私模式下 storage 可能不可用
  }
}

function applyTheme(theme, persist = false) {
  doc.dataset.theme = theme;
  const isDark = theme === "dark";
  themeToggle?.setAttribute("aria-pressed", String(isDark));
  themeToggle?.setAttribute("aria-label", isDark ? "切换到浅色" : "切换到深色");
  if (themeLabel) themeLabel.textContent = isDark ? "浅色" : "深色";
  if (!persist) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 忽略 */
  }
}

themeToggle?.addEventListener("click", () => {
  applyTheme(doc.dataset.theme === "dark" ? "light" : "dark", true);
});

// 用户没有手动选择时跟随系统
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
  if (!readTheme()) applyTheme(e.matches ? "dark" : "light");
});

/* ------------------------------------------------------------ 路由与挂载 ---- */

function parseHash() {
  const id = window.location.hash.replace(/^#\/?/, "").trim().split("/")[0];
  return ROUTES[id] ? id : DEFAULT_ROUTE;
}

function renderNav(activeId) {
  if (!navList) return;
  navList.innerHTML = nav
    .map(
      (item) => `
      <li><a class="nav-link" href="#/${item.id}" data-route-link="${item.id}" ${
        item.id === activeId ? 'aria-current="page"' : ""
      }>
        ${icon(item.icon)}
        <span class="nav-link__text">${item.label}</span>
        <span class="nav-link__hint">${item.hint}</span>
      </a></li>`,
    )
    .join("");
}

function mount(view) {
  const route = ROUTES[view];
  // 裸渲染路由（组件实验台）不挂顶栏/侧栏，让组件在纯背景上被看
  if (app) app.dataset.bare = route.bare ? "true" : "false";
  renderNav(view);
  document.title = `${route.title} · ${brand.name} ${brand.product}`;
  const sub = document.querySelector("[data-brand-sub]");
  if (sub) sub.textContent = `${brand.product} · ${route.title}`;

  main.innerHTML = route.render(route.data);
  main.dataset.view = view;
  // 窄屏换页时收起抽屉；桌面端保留用户选择的 collapsed
  if (window.innerWidth <= 600) setDrawer(false);
  else if (!app.dataset.rail) app.dataset.rail = "expanded";

  updateRailButton();
  if (routeAnnounce) routeAnnounce.textContent = `已切换到${route.title}`;
  if (view === "ai") bindAiView(); // 只在新视图上绑定流式与思考框
  bindViewToggles();
}

function handleRoute() {
  mount(parseHash());
  main.focus({ preventScroll: true }); // 键盘用户能立刻继续
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* ---------------------------------------------------------------- 侧栏 ---- */
/* 注意：railOpenBtn 必须在 mount() 首次运行前初始化，所以这一段放在路由调用之前。 */

const railOpenBtn = document.querySelector("[data-rail-open]");

function setDrawer(open) {
  // 抽屉只表达「窄屏侧栏可见与否」，不覆盖桌面端的 collapsed / expanded
  if (window.innerWidth <= 600) app.dataset.rail = open ? "open" : "closed";
  else if (open) app.dataset.rail = "expanded";
  else if (app.dataset.rail === "closed") app.dataset.rail = "expanded";
  railOpenBtn?.setAttribute("aria-expanded", String(!!open));
}

function updateRailButton() {
  if (!railToggle) return;
  const state = app.dataset.rail;
  railToggle.setAttribute("aria-expanded", String(state !== "collapsed"));
  railToggle.setAttribute("aria-label", state === "collapsed" ? "展开侧栏" : "折叠侧栏");
}

railToggle?.addEventListener("click", () => {
  if (app.dataset.rail === "closed") app.dataset.rail = "open";
  else app.dataset.rail = app.dataset.rail === "collapsed" ? "expanded" : "collapsed";
  updateRailButton();
});

railOpenBtn?.addEventListener("click", () => setDrawer(app.dataset.rail !== "open"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setDrawer(false);
});

/* ------------------------------------------- 计时器（R7：等宽、不位移） ---- */

let elapsed = topbar.timerStart ?? 0;
let tickHandle = null;
let tickReset = null;

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function paintTimer() {
  if (!timerEl) return;
  timerEl.textContent = formatClock(elapsed);
  if (prefersReduce()) return; // 减弱动效时不做透明度微变
  timerEl.dataset.tick = "true";
  window.clearTimeout(tickReset);
  tickReset = window.setTimeout(() => {
    timerEl.dataset.tick = "false";
  }, 90);
}

function startTimer() {
  if (tickHandle) return;
  paintTimer();
  tickHandle = window.setInterval(() => {
    elapsed += 1;
    paintTimer();
  }, 1000);
}

function stopTimer() {
  window.clearInterval(tickHandle);
  tickHandle = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopTimer();
  else startTimer();
});

/* ------------------------------------------------- AI 流式与思考框（R6） ---- */

const GLYPH_LIMIT = 60;
const GLYPH_INTERVAL = 30;
const CJK_PUNCT = /[，。！？、；：（）「」『』…—]/u;

function splitGraphemes(text) {
  if (typeof Intl?.Segmenter !== "function") return Array.from(text);
  const seg = new Intl.Segmenter("zh", { granularity: "grapheme" });
  return [...seg.segment(text)].map((s) => s.segment);
}

function bindAiView() {
  const sendBtn = main.querySelector("[data-send]");
  const composer = main.querySelector("[data-composer]");
  const streamMsg = main.querySelector("[data-stream-msg]");
  const stream = main.querySelector("[data-stream]");
  const announce = main.querySelector("[data-stream-announce]");
  const toggle = main.querySelector("[data-think-toggle]");
  const think = main.querySelector("[data-think]");

  toggle?.addEventListener("click", () => {
    const open = think.dataset.open === "true";
    think.dataset.open = String(!open);
    toggle.setAttribute("aria-expanded", String(!open));
  });

  if (!sendBtn || !composer || !streamMsg || !stream) return;

  let running = false;
  let handle = null;

  // 只 append 新 span；换行与标点不生成 glyph，不参与错峰
  function appendGlyph(char, index) {
    if (char === "\n") {
      stream.appendChild(document.createTextNode(" "));
      return;
    }
    if (CJK_PUNCT.test(char)) {
      stream.appendChild(document.createTextNode(char));
      return;
    }
    const span = document.createElement("span");
    span.className = "glyph";
    span.textContent = char;
    span.style.setProperty("--i", String(index % GLYPH_LIMIT));
    stream.appendChild(span);
  }

  const caret = main.querySelector("[data-stream-caret]");

  function setBusy(busy) {
    if (busy) {
      sendBtn.setAttribute("data-state", "loading");
      sendBtn.setAttribute("aria-busy", "true");
    } else {
      sendBtn.removeAttribute("data-state");
      sendBtn.removeAttribute("aria-busy");
    }
    if (caret) caret.hidden = !busy;
  }

  // 流式结束后提前合并已完成的字符，只保留最新 30 字可动
  function settle() {
    const glyphs = [...stream.querySelectorAll(".glyph")];
    glyphs.forEach((el, idx) => {
      if (idx < glyphs.length - 30) el.style.willChange = "auto";
    });
  }

  function streamText(text) {
    const glyphs = splitGraphemes(text).slice(0, GLYPH_LIMIT);
    let i = 0;

    streamMsg.hidden = false;
    setBusy(true);
    running = true;

    const announceNow = () => {
      if (announce) announce.textContent = glyphs.slice(0, i).join("");
    };

    handle = window.setInterval(() => {
      appendGlyph(glyphs[i], i);
      i += 1;
      // 每 8 字更新一次 aria-live，避免读屏逐字播报
      if (i % 8 === 0 || i >= glyphs.length) announceNow();
      if (i < glyphs.length) return;

      window.clearInterval(handle);
      handle = null;
      running = false;
      setBusy(false);
      settle();
    }, GLYPH_INTERVAL);
  }

  function send() {
    if (running) return;
    stream.textContent = "";
    if (announce) announce.textContent = "";
    streamMsg.hidden = true;
    window.setTimeout(() => streamText(content.ai.composer.streamingText), 80);
  }

  sendBtn.addEventListener("click", send);
  composer.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    send();
  });
  main.querySelectorAll("[data-suggestion]").forEach((btn) => {
    btn.addEventListener("click", () => {
      composer.value = btn.textContent.trim();
      composer.focus();
    });
  });
}

/* ------------------------------------------------------ 视图级轻交互 ---- */

function bindViewToggles() {
  main.querySelectorAll("[data-settings-row] .switch input").forEach((input) => {
    input.addEventListener("change", () => {
      input.closest("[data-settings-row]")?.setAttribute("data-dirty", "true");
    });
  });

  main.querySelector("[data-submit]")?.addEventListener("click", (e) => {
    const form = e.currentTarget.closest(".form");
    const invalid = [...form.querySelectorAll('[aria-invalid="true"]')];
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    e.currentTarget.setAttribute("data-state", "loading");
    window.setTimeout(() => e.currentTarget.removeAttribute("data-state"), 900);
  });
}

/* ---------------------------------------------------------------- 启动 ---- */

function boot() {
  applyTheme(readTheme() ?? (prefersDark() ? "dark" : "light"));

  const nameEl = document.querySelector("[data-brand-name]");
  if (nameEl) nameEl.textContent = brand.name;
  const timerLabel = document.querySelector("[data-timer-label]");
  if (timerLabel) timerLabel.textContent = topbar.timerLabel;
  const search = document.querySelector("[data-search]");
  if (search) search.placeholder = topbar.searchPlaceholder;

  if (!window.location.hash) window.history.replaceState(null, "", `#/${DEFAULT_ROUTE}`);
  window.addEventListener("hashchange", handleRoute);
  // 实验台靠 query 切组件；Studio 改 iframe src 会触发 load，但同一文档内改
  // search 只发 popstate，所以这里也监听一次。
  window.addEventListener("popstate", () => {
    if (parseHash() === "lab") mount("lab");
  });
  handleRoute();
  startTimer();
}

boot();

// 供人工排查与自动化验收：控制台可直接切主题、看登记表
window.__fixture = {
  ROUTES,
  GLYPH_LIMIT,
  formatClock,
  setTheme: (theme) => applyTheme(theme === "dark" ? "dark" : "light", true),
  getTheme: () => doc.dataset.theme,
  route: () => main.dataset.view,
};
