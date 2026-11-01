import { icon } from "../content.js";

function buttonCell(variant, state, label) {
  const attrs = [
    `data-variant="${variant.id}"`,
    `data-state="${state.id}"`,
    state.id === "disabled" ? "disabled" : "",
    state.id === "loading" ? 'aria-busy="true"' : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="btn-matrix__cell">
      <button class="btn" type="button" ${attrs}>
        <span class="btn__label">${label}</span>
      </button>
    </div>`;
}

function buttonRow(variant, content) {
  return `
    <div class="btn-matrix__row">
      <div class="btn-matrix__row-head">
        <span class="btn-matrix__variant">${variant.label}</span>
        <span class="tag" data-tone="neutral">${variant.id}</span>
      </div>
      ${content.buttonStates.map((s) => buttonCell(variant, s, content.buttonText)).join("")}
    </div>`;
}

function stateHeaderRow(content) {
  return `
    <div class="btn-matrix__row">
      <span></span>
      ${content.buttonStates
        .map((s) => `<span class="btn-matrix__state">${s.label}</span>`)
        .join("")}
    </div>`;
}

function inputSpec(item) {
  const id = `cmp-${item.id}`;
  return `
    <div class="field">
      <label class="field__label" for="${id}">${item.label}</label>
      <input
        class="field-control"
        id="${id}"
        type="text"
        value="${item.value ?? ""}"
        placeholder="${item.placeholder ?? ""}"
        ${item.disabled ? "disabled" : ""}
        ${item.error ? 'aria-invalid="true"' : ""}
      >
      <p class="field__help">${item.error ?? "外投影 + inset 内环 + 内投影三件套。"}</p>
    </div>`;
}

function switchSpec(item) {
  const id = `cmp-${item.id}`;
  return `
    <label class="switch" for="${id}">
      <input
        type="checkbox"
        id="${id}"
        role="switch"
        ${item.checked ? "checked" : ""}
        ${item.disabled ? "disabled" : ""}
      >
      <span class="switch__track" aria-hidden="true"></span>
      <span>${item.label}</span>
    </label>`;
}

/** @param {typeof import("../content.js").components} content */
export default function render(content) {
  return `
  <div class="view view--components">
    <header class="view-head">
      <div class="view-head__text">
        <h1>${content.heading}</h1>
        <p>${content.lede}</p>
      </div>
    </header>

    <section class="spec" aria-labelledby="btn-spec-title">
      <div class="spec__title">
        <h2 id="btn-spec-title">按钮</h2>
        <span>5 变体 × 6 状态</span>
      </div>
      <div class="btn-matrix">
        ${stateHeaderRow(content)}
        ${content.buttonVariants.map((v) => buttonRow(v, content)).join("")}
      </div>
    </section>

    <div class="spec-grid">
      <section class="spec" aria-labelledby="input-spec-title">
        <div class="spec__title">
          <h2 id="input-spec-title">输入框</h2>
          <span>R4</span>
        </div>
        <div class="form">
          ${content.inputs.map(inputSpec).join("")}
        </div>
      </section>

      <section class="spec" aria-labelledby="switch-spec-title">
        <div class="spec__title">
          <h2 id="switch-spec-title">开关</h2>
          <span>3 状态</span>
        </div>
        <div class="spec-row">
          ${content.switches.map(switchSpec).join("")}
        </div>
        <hr class="spec__rule">
        <div class="spec__title"><h2>标签与徽章</h2><span>5 + 4</span></div>
        <div class="spec-row">
          ${content.tags
            .map((t) => `<span class="tag" data-tone="${t.tone}">${t.label}</span>`)
            .join("")}
        </div>
        <div class="spec-row">
          ${content.badges
            .map((b) => `<span class="badge" data-tone="${b.tone}">${b.label}</span>`)
            .join("")}
          <span class="badge">99+</span>
        </div>
      </section>
    </div>

    <section class="spec" aria-labelledby="token-spec-title">
      <div class="spec__title">
        <h2 id="token-spec-title">本页用到的结构值</h2>
        <span>全部来自 var(--…)</span>
      </div>
      <div class="token-table" role="table" aria-label="结构 token 示例">
        <div class="token-table__row" role="row"><span role="columnheader">Token</span><span role="columnheader">取值</span><span role="columnheader">用途</span></div>
        ${content.tokens
          .map(
            (t) => `
          <div class="token-table__row" role="row"><code role="cell">${t.name}</code><span role="cell">${t.value}</span><span role="cell">${t.role}</span></div>`,
          )
          .join("")}
      </div>
      <p class="spec__note">
        ${icon("info", "ico-inline")} 悬停与聚焦状态在真实控件上由伪类触发；这里的第二、三列是为了让静态验收能一次看到全部状态。
      </p>
    </section>
  </div>`;
}
