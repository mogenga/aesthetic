import { icon } from "../content.js";

function sparkBars(points) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  return points
    .map((p) => {
      const h = Math.round(((p - min) / span) * 70) + 12;
      return `<span style="height:${h}%"></span>`;
    })
    .join("");
}

function statCard(s) {
  const trendIcon = s.trend === "down" ? "down" : "up";
  return `
    <article class="stat" data-stat="${s.id}">
      <p class="stat__label">${s.label}</p>
      <p class="stat__value">${s.value}</p>
      <p class="stat__foot">
        <span class="delta" data-trend="${s.trend}">
          ${icon(trendIcon)}
          ${s.delta}
        </span>
        <span>${s.note}</span>
      </p>
      <div class="stat__spark" aria-hidden="true">${sparkBars(s.spark)}</div>
    </article>`;
}

function surfaceLayer(layer) {
  return `
    <div class="surface-layer" data-surface="${layer.level}">
      <p class="surface-layer__title">
        第 ${layer.level} 层 · ${layer.title}
      </p>
      <p class="surface-layer__meta"><code>${layer.token}</code><br>ΔL ${layer.delta}</p>
      <p class="surface-layer__body">${layer.body}</p>
    </div>`;
}

/** @param {typeof import("../content.js").dashboard} content */
export default function render(content) {
  const { surfaceStack } = { surfaceStack: content.surfaces };

  return `
  <div class="view view--dashboard">
    <header class="view-head">
      <div class="view-head__text">
        <p class="eyebrow">${content.eyebrow}</p>
        <h1>${content.heading}</h1>
        <p>${content.lede}</p>
      </div>
      <div class="view-head__actions">
        <label class="visually-hidden" for="range-select">时间范围</label>
        <select class="settings-select" id="range-select" data-range>
          ${content.range.options
            .map(
              (o) =>
                `<option${o === content.range.label ? " selected" : ""}>${o}</option>`,
            )
            .join("")}
        </select>
      </div>
    </header>

    <section class="stat-grid" aria-label="核心指标">
      ${content.stats.map(statCard).join("")}
    </section>

    <div class="dash-split">
      <section class="card" aria-labelledby="surfaces-title">
        <div class="card__head">
          <div>
            <h2 class="card__title" id="surfaces-title">${content.surfaces.title}</h2>
            <p class="card__sub">${content.surfaces.lede}</p>
          </div>
          ${icon("layers")}
        </div>
        <div class="surface-stack">
          <div class="surface-stack__page">
            ${surfaceStack.layers.map(surfaceLayer).join("")}
          </div>
          <p class="card__sub">${content.surfaces.footNote}</p>
        </div>
      </section>

      <section class="card" aria-labelledby="timeline-title">
        <div class="card__head">
          <h2 class="card__title" id="timeline-title">${content.timeline.title}</h2>
          <span class="tag" data-tone="neutral">今天</span>
        </div>
        <ol class="timeline">
          ${content.timeline.items
            .map(
              (item) => `
            <li class="timeline__item">
              <span class="timeline__time">${item.time}</span>
              <span class="timeline__marker"><span class="dot" data-tone="${item.tone === "warn" ? "warn" : item.tone === "ok" ? "ok" : item.tone === "info" ? "accent" : "neutral"}"></span></span>
              <div>
                <p class="timeline__title">${item.title}</p>
                <p class="timeline__body">${item.body}</p>
              </div>
            </li>`,
            )
            .join("")}
        </ol>
      </section>
    </div>

    <section aria-labelledby="states-title">
      <div class="section-head">
        <h2 id="states-title">空态与错误态</h2>
        <p>同一个页面里的两种非正常状态，高度预留避免跳动。</p>
      </div>
      <div class="state-grid">
        <div class="state-panel" data-state-panel="empty">
          <span class="state-panel__art">${icon("inbox")}</span>
          <h3>${content.empty.title}</h3>
          <p>${content.empty.body}</p>
          <button class="btn" data-variant="primary" type="button">
            ${icon("plus")}<span class="btn__label">${content.empty.action}</span>
          </button>
          <p class="state-panel__hint">${content.empty.hint}</p>
        </div>
        <div class="state-panel" data-tone="error" data-state-panel="error">
          <span class="state-panel__art">${icon("alert")}</span>
          <h3>${content.error.title}</h3>
          <p>${content.error.body}</p>
          <button class="btn" data-variant="secondary" type="button">
            ${icon("refresh")}<span class="btn__label">${content.error.action}</span>
          </button>
          <p class="state-panel__code">${content.error.detail}</p>
        </div>
      </div>
    </section>
  </div>`;
}
