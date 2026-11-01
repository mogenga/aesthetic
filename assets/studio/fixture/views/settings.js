import { icon } from "../content.js";

function selectControl(row, ids) {
  return `
    <select class="settings-select" id="${ids.input}" aria-labelledby="${ids.name}" aria-describedby="${ids.desc}">
      ${row.options
        .map((o) => `<option${o === row.value ? " selected" : ""}>${o}</option>`)
        .join("")}
    </select>`;
}

function swatchControl(row, ids) {
  return `
    <div class="swatch-row" role="group" id="${ids.input}" aria-labelledby="${ids.name}" aria-describedby="${ids.desc}">
      ${row.swatches
        .map(
          (s) => `
        <button
          class="swatch"
          type="button"
          data-swatch="${s}"
          aria-pressed="${s === row.selected}"
          aria-label="${row.name} · 选项 ${s}"
        ></button>`,
        )
        .join("")}
    </div>`;
}

function switchControl(row, ids) {
  return `
    <label class="switch" for="${ids.input}">
      <input
        type="checkbox"
        id="${ids.input}"
        role="switch"
        ${row.checked ? "checked" : ""}
        aria-labelledby="${ids.name}"
        aria-describedby="${ids.desc}"
      >
      <span class="switch__track" aria-hidden="true"></span>
      <span class="visually-hidden">${row.name}</span>
    </label>`;
}

function statusControl(row) {
  return `
    <span class="settings-status" data-tone="${row.tone}">
      <span class="dot" data-tone="${row.tone === "ok" ? "ok" : "neutral"}"></span>
      ${row.status}
    </span>
    <button class="btn btn--sm" data-variant="ghost" type="button" aria-label="${row.name}：${row.action}">
      <span class="btn__label">${row.action}</span>
    </button>`;
}

function buttonControl(row) {
  return `
    <button class="btn" data-variant="danger" type="button" aria-describedby="${row.id}-danger-desc">
      ${icon("trash")}<span class="btn__label">${row.action}</span>
    </button>`;
}

function control(row, ids) {
  switch (row.control) {
    case "select":
      return selectControl(row, ids);
    case "swatch":
      return swatchControl(row, ids);
    case "switch":
      return switchControl(row, ids);
    case "status":
      return statusControl(row);
    case "button":
      return buttonControl(row);
    default:
      return "";
  }
}

function settingsRow(row) {
  const ids = { name: `row-${row.id}-name`, desc: `row-${row.id}-desc`, input: `row-${row.id}-input` };
  return `
    <div class="settings-row" data-settings-row data-row-id="${row.id}">
      <div class="settings-row__text">
        <span class="settings-row__name" id="${ids.name}">${row.name}</span>
        <p class="settings-row__desc" id="${ids.desc}">${row.desc}</p>
      </div>
      <div class="settings-row__control">${control(row, ids)}</div>
    </div>`;
}

function settingsGroup(group) {
  if (group.isolated) {
    const row = group.rows[0];
    return `
      <section class="settings-group settings-group--danger" aria-labelledby="group-${group.id}">
        <h2 class="settings-group__title" id="group-${group.id}">${group.title}</h2>
        <div class="danger-card">
          <div class="danger-card__text">
            <p class="danger-card__name">${row.name}</p>
            <p class="danger-card__desc" id="${row.id}-danger-desc">${row.desc}</p>
          </div>
          ${buttonControl(row)}
        </div>
      </section>`;
  }
  return `
    <section class="settings-group" aria-labelledby="group-${group.id}">
      <h2 class="settings-group__title" id="group-${group.id}">${group.title}</h2>
      <div class="settings-rows">
        ${group.rows.map(settingsRow).join("")}
      </div>
    </section>`;
}

/** @param {typeof import("../content.js").settings} content */
export default function render(content) {
  return `
  <div class="view view--settings">
    <header class="view-head">
      <div class="view-head__text">
        <h1>${content.heading}</h1>
        <p>${content.lede}</p>
      </div>
    </header>

    <div class="settings">
      ${content.groups.map(settingsGroup).join("")}
    </div>
  </div>`;
}
