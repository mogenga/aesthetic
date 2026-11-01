import { icon } from "../content.js";

function thinkingBlock(think) {
  return `
    <div class="think" data-open="true" data-think>
      <div class="think__body">
        <div class="think__inner">
          <p><strong>${think.title}</strong> · <span class="think__meta">${think.meta}</span></p>
          ${think.body.map((p) => `<p>${p}</p>`).join("")}
        </div>
      </div>
    </div>
    <button
      class="think__toggle"
      type="button"
      data-think-toggle
      aria-expanded="true"
      aria-controls="think-1"
    >
      ${icon("chevron")}
      <span>思考过程</span>
      <span class="think__meta">${think.body.length} 步</span>
    </button>`;
}

function toolStrip(tools) {
  return `
    <div class="toolbar-strip" role="list" aria-label="工具调用">
      ${tools
        .map(
          (t) => `
        <div class="toolcall" role="listitem">
          ${icon("terminal")}
          <span class="toolcall__name">${t.name}</span>
          <span class="toolcall__arg">${t.arg}</span>
          <span class="toolcall__status" data-state="${t.state}">
            ${icon("check")}${t.status}
          </span>
        </div>`,
        )
        .join("")}
    </div>`;
}

function assistantBody(message) {
  const paragraphs = message.body.map((p) => `<p>${p}</p>`).join("");
  // R6.2：正文中的行内小图标
  const inline =
    message.id === "m2"
      ? `<p>补充一个口径提醒：这里的留存按<strong>注册当天</strong>记作第 0 天${icon(
          "info",
          "ico-inline",
        )}，与增长团队用的「激活后次日」口径相差半天，比较时不要混用。</p>`
      : "";

  return `
    <div class="prose">
      ${paragraphs}
      ${inline}
    </div>
    <div class="msg__refs">
      ${message.refs
        .map(
          (r) => `
        <span class="ref-chip">${icon("external")}${r.label}<span>${r.meta}</span></span>`,
        )
        .join("")}
    </div>
    <p class="msg__more">${message.more}</p>`;
}

function message(message) {
  const isUser = message.role === "user";
  return `
    <article class="msg" data-role="${message.role}" data-msg-id="${message.id}">
      <div class="msg__who">
        <span class="msg__avatar" data-role="${message.role}">${
          isUser ? "林" : icon("spark")
        }</span>
        <span>${isUser ? "你" : "Northwind 助理"}</span>
      </div>
      ${isUser ? `<div class="msg__bubble">${message.text}</div>` : ""}
      ${
        !isUser
          ? `${message.think ? thinkingBlock(message.think) : ""}
             ${message.tools ? toolStrip(message.tools) : ""}
             ${assistantBody(message)}`
          : ""
      }
    </article>`;
}

/** @param {typeof import("../content.js").ai} content */
export default function render(content) {
  return `
  <div class="view view--ai">
    <header class="view-head">
      <div class="view-head__text">
        <h1>${content.heading}</h1>
        <p>${content.lede}</p>
      </div>
      <span class="tag" data-tone="accent">只读模式</span>
    </header>

    <div class="chat">
      <div class="chat__log" data-chat-log aria-live="polite" aria-relevant="additions text">
        ${content.messages.map(message).join("")}

        <article class="msg" data-role="assistant" data-stream-msg hidden>
          <div class="msg__who">
            <span class="msg__avatar" data-role="assistant">${icon("spark")}</span>
            <span>Northwind 助理</span>
          </div>
          <div class="prose">
            <p><span class="stream" data-stream aria-hidden="true"></span><span class="stream__caret" data-stream-caret hidden></span></p>
            <p class="visually-hidden" data-stream-announce></p>
          </div>
        </article>
      </div>

      <div class="suggestions" aria-label="推荐提问">
        ${content.suggestions
          .map(
            (s) => `<button class="suggestion" type="button" data-suggestion>${s}</button>`,
          )
          .join("")}
      </div>

      <div class="composer">
        <div class="composer__row">
          <label class="visually-hidden" for="composer-input">向助理提问</label>
          <textarea
            class="field-control"
            id="composer-input"
            data-composer
            rows="1"
            placeholder="${content.composer.placeholder}"
          ></textarea>
          <button class="btn" data-variant="primary" type="button" data-send>
            ${icon("send")}<span class="btn__label">${content.composer.send}</span>
          </button>
        </div>
        <div class="composer__foot">
          <span>${content.composer.hint}</span>
          <span>上下文 14 条 · 已用 12%</span>
        </div>
      </div>
    </div>
  </div>`;
}
