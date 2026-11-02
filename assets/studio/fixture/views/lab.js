/**
 * views/lab.js —— 组件实验台的裸渲染视图。
 *
 * 这个视图存在的唯一理由：让 Studio 的组件实验室能在**真实 token** 下预览。
 * 它可以被 URL query 参数直接驱动（?comp=button&variant=primary&state=hover&size=md），
 * 所以 Studio 只要把它的 iframe src 换掉就能切换组件，不需要自己复制一份组件 CSS。
 *
 * 关键约束：这里只用 base.css 的结构性类名，不写任何视觉值。
 * 组件长什么样，完全由 tokens.css + 当前 data-style 的变体 CSS 决定。
 */

import { icon } from "../content.js";

const BUTTON_TEXT = "保存更改";

function qs() {
  const p = new URLSearchParams(window.location.search);
  return {
    comp: p.get("comp") || "button",
    variant: p.get("variant") || "primary",
    state: p.get("state") || "default",
    size: p.get("size") || "md",
    bg: p.get("bg") || "surface",
    label: p.get("label") || "",
  };
}

/** 状态用 data-state 强制，与夹具组件架保持同一套约定（audit.mjs 也按它找）。 */
function button(o) {
  const attrs = [
    `class="btn btn--${o.size}"`,
    `data-variant="${o.variant}"`,
    `data-state="${o.state}"`,
    o.state === "disabled" ? "disabled" : "",
    o.state === "loading" ? 'aria-busy="true"' : "",
  ].filter(Boolean).join(" ");
  const label = o.state === "loading"
    ? '<span class="btn__label"><span class="lab-spinner" aria-hidden="true"></span>处理中</span>'
    : `<span class="btn__label">${o.label || BUTTON_TEXT}</span>`;
  return `<button type="button" data-lab-target data-lab-control ${attrs}>${label}</button>`;
}

function input(o) {
  const invalid = o.state === "error";
  return `
    <div class="field" data-field="lab" data-state="${o.state}" data-lab-target>
      <label class="field__label" for="lab-input">项目名称</label>
      <input class="field-control" data-lab-control id="lab-input" type="text"
        value="${invalid ? "admin@" : "Northwind 运营控制台"}"
        ${o.state === "disabled" ? "disabled" : ""}
        ${invalid ? 'aria-invalid="true"' : ""}>
      <p class="field__help">${invalid ? "邮箱格式不完整。" : "外投影 + inset 内环 + 内投影三件套。"}</p>
    </div>`;
}

function switchEl(o) {
  const on = o.state !== "off";
  const disabled = o.state === "disabled";
  return `
    <button class="switch" data-lab-target data-lab-control type="button" role="switch"
      aria-checked="${on}" data-state="${o.state}"
      ${disabled ? 'disabled aria-disabled="true"' : ""}>
      <span class="switch__track" aria-hidden="true"><span class="switch__knob"></span></span>
      <span class="visually-hidden">桌面通知</span>
    </button>`;
}

function card(o) {
  return `
    <div class="card" data-lab-target data-lab-control data-state="${o.state}">
      <div class="card__head">
        <h3 class="card__title">卡片标题</h3>
        <span class="tag" data-tone="neutral">标签</span>
      </div>
      <p class="card__sub">卡片正文使用次要色。阴影、圆角与间距全部来自 token。</p>
    </div>`;
}

function badge(o) {
  return `<span class="badge" data-lab-target data-lab-control data-tone="${o.variant}" data-state="${o.state}">12</span>`;
}

function tag(o) {
  return `<span class="tag" data-lab-target data-lab-control data-tone="${o.variant}" data-state="${o.state}">进行中</span>`;
}

const RENDERERS = { button, input, switch: switchEl, card, badge, tag };

/** @param {object} _content 未使用；签名与其它视图一致，便于路由统一调用 */
export default function render(_content) {
  const o = qs();
  const fn = RENDERERS[o.comp] || button;
  // 舞台背景通过 app 上的 data-lab-bg 生效（见 base.css 的 .app[data-bare]）
  const app = document.getElementById("app");
  if (app) app.dataset.labBg = o.bg;
  return `
    <div class="view lab-view" data-lab-comp="${o.comp}" data-lab-state="${o.state}" data-lab-size="${o.size}">
      <div class="lab-mount">${fn(o)}</div>
    </div>`;
}
