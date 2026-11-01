import { icon } from "../content.js";

const reqChip = (on) => `<span class="field__req">${on ? "必填" : "选填"}</span>`;

function helpAndError(field, id) {
  const help = `<p class="field__help" id="${id}-help" ${field.invalid ? "hidden" : ""}>${field.help}</p>`;
  if (!field.error) return help;
  return `${help}
    <p class="field__error" id="${id}-error" ${field.invalid ? "" : "hidden"} role="alert">
      ${icon("alert")}<span>${field.error}</span>
    </p>`;
}

/** 错误态用错误文本替换帮助文本（R9），aria-describedby 只指向可见的那条 */
function describedBy(field, id) {
  return field.error && field.invalid ? `${id}-error` : `${id}-help`;
}

/** 所有输入共享的属性串 */
function inputAttrs(field, id, extra = "") {
  const req = field.required ? 'aria-required="true"' : "";
  const invalid = field.invalid ? 'aria-invalid="true"' : "";
  return `${req} ${invalid} aria-describedby="${describedBy(field, id)}" ${extra}`.trim();
}

function textField(field, id) {
  return `<input class="field-control" type="text" id="${id}" name="${field.id}"
    value="${field.value ?? ""}" placeholder="${field.placeholder ?? ""}"
    ${inputAttrs(field, id)}>`;
}

function textareaField(field, id) {
  return `<textarea class="field-control" id="${id}" name="${field.id}" rows="5"
    placeholder="${field.placeholder ?? ""}" ${inputAttrs(field, id)}>${field.value ?? ""}</textarea>`;
}

function selectField(field, id) {
  const options = field.options
    .map((o) => `<option${o === field.value ? " selected" : ""}>${o}</option>`)
    .join("");
  return `<select class="field-control" id="${id}" name="${field.id}" ${inputAttrs(field, id)}>
    ${options}</select>`;
}

function dateField(field, id) {
  return `<input class="field-control" type="date" id="${id}" name="${field.id}"
    value="${field.value ?? ""}" ${inputAttrs(field, id)}>`;
}

function switchField(field, id) {
  return `<div class="field-row">
      <span class="field__label" id="${id}-label">${field.label}${reqChip(field.required)}</span>
      <label class="switch" for="${id}">
        <input type="checkbox" id="${id}" name="${field.id}" role="switch"
          ${field.checked ? "checked" : ""} aria-labelledby="${id}-label"
          aria-describedby="${describedBy(field, id)}">
        <span class="switch__track" aria-hidden="true"></span>
        <span class="visually-hidden">${field.label}</span>
      </label>
    </div>`;
}

function checkboxField(field, id) {
  return `<label class="checkbox">
      <input type="checkbox" id="${id}" name="${field.id}"
        ${field.checked ? "checked" : ""} ${field.invalid ? 'aria-invalid="true"' : ""}
        aria-describedby="${describedBy(field, id)}">
      <span class="checkbox__box" aria-hidden="true">${icon("check")}</span>
      <span class="field__label">${field.label}${reqChip(field.required)}</span>
    </label>`;
}

const BODIES = {
  text: textField,
  textarea: textareaField,
  select: selectField,
  date: dateField,
  switch: switchField,
  checkbox: checkboxField,
};

function field(field) {
  const id = `field-${field.id}`;
  // switch / checkbox 自带标签；其余字段用外部 label（R9：标签在上）
  const selfLabelled = field.type === "switch" || field.type === "checkbox";
  const label = selfLabelled
    ? ""
    : `<label class="field__label" for="${id}">${field.label}${reqChip(field.required)}</label>`;
  const body = (BODIES[field.type] || (() => ""))(field, id);

  return `
    <div class="field${field.type === "checkbox" ? " checkbox-field" : ""}" data-field="${field.id}">
      ${label}${body}${helpAndError(field, id)}
    </div>`;
}

/** @param {typeof import("../content.js").form} content */
export default function render(content) {
  return `
  <div class="view view--form">
    <header class="view-head">
      <div class="view-head__text">
        <h1>${content.heading}</h1>
        <p>${content.lede}</p>
      </div>
      <span class="tag" data-tone="neutral">草稿</span>
    </header>

    <div class="form-layout">
      <form class="form" novalidate>
        ${content.fields.map(field).join("")}
        <div class="form-actions">
          <button class="btn" data-variant="secondary" type="button">
            <span class="btn__label">${content.actions.secondary}</span>
          </button>
          <button class="btn" data-variant="primary" type="button" data-submit>
            ${icon("plus")}<span class="btn__label">${content.actions.primary}</span>
          </button>
        </div>
      </form>

      <aside class="form-aside" aria-labelledby="form-aside-title">
        <h2 id="form-aside-title">${content.aside.title}</h2>
        <ol>${content.aside.items.map((item) => `<li>${item}</li>`).join("")}</ol>
      </aside>
    </div>
  </div>`;
}
