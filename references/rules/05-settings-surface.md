# 设置页 · R8 全文

> 什么时候读这份：做设置 / 偏好 / 账号 / 集成配置页，或任何"一列开关"形态的界面；`audit.mjs` 报设置行距或外层卡片。

R8 的一句话版在 [`00-non-negotiable.md`](00-non-negotiable.md) §3.8。

---

## 1. 设置页的两种退化

| 退化形态 | 表现 | 根因 |
|---|---|---|
| **仪表盘拼贴** | 每个设置组一张卡片：有边框、圆角、阴影、内边距 | 把"分组"理解成"装进盒子里" |
| **裸列表** | 一列无标题的行，靠 `gap: 12px` 分隔 | 把"去掉框"理解成"什么都不要" |

R8 要的是第三种：**页面即背景，用标题与留白分组，用 1px 细线分隔行**。

```
┌──────────────────────────────────────────────┐
│  偏好设置                                     │  ← 页面标题，无卡片
│                                              │
│  外观                                         │  ← 组标题（13–14px 次要色）
│  ─────────────────────────────────────────   │  ← 1px 细线（组首行上沿）
│  主题                           [ 浅色 ▾ ]   │
│  ─────────────────────────────────────────   │
│  强调色                        [ ● ● ● ● ]   │
│                                              │
│                                    ↕ 44px    │  ← 组间留白，不是 margin: 12px
│  通知                                         │
│  ─────────────────────────────────────────   │
│  桌面通知                        [ 开  ● ]   │
│  ─────────────────────────────────────────   │
│  邮件摘要                        [ 关  ○ ]   │
│                                              │
│                                    ↕ 44px    │
│  危险操作                                     │  ← 独立成组，有自己的标题
│  ─────────────────────────────────────────   │
│  删除账号                                     │
│  此操作不可撤销                 [ 删除 ]     │
└──────────────────────────────────────────────┘
```

---

## 2. 九条规则

| # | 规则 | 规格 | Token |
|---|---|---|---|
| 1 | **左名右控件** | 名称在左、控件在右，同一行 | — |
| 2 | **一行一项** | 每行只承载一个设置，不做两列并排 | — |
| 3 | **去掉最外层框** | 页面不套卡片；无 `border`、无 `box-shadow`、无外层 `background` | — |
| 4 | **组标题** | 每组一个标题，13–14px 次要色，语义上是 `<h2>` / `<h3>` | `--fs-sm` / `--fg-muted` |
| 5 | **组间 40–48px，组内 0** | 组之间大留白；组内行间只有细线 | `--s-6`(40) / `--s-7`(48) |
| 6 | **行间 1px 细线** | 不用 `gap`、不用斑马纹、不用每行一条边框 | `--line-hair` |
| 7 | **行高 52–56px，上下内距 12–14px** | 行是等高带，控件垂直居中 | `--row-h` / `--s-3` |
| 8 | **标签与控件间距 ≥24px** | 标签最多两行 | `--s-5` |
| 9 | **删除独立成组** | 单独一组、有标题、放最后、不与普通设置相邻 | — |

**控件右缘对齐到内容轴右缘，不是各自宽度。**

```
✓  主题                       [ 浅色 ▾ ]
   桌面通知                   [ 开  ● ]
   邮件摘要                   [ 关  ○ ]
                              ↑ 全部贴齐同一竖线
```

行用 `display: flex; justify-content: space-between`，控件 `flex: 0 0 auto`。不要给控件设固定宽度来"对齐"——开关、下拉、按钮宽度本来就不同，对齐的是**右缘**。

### 2.1 为什么去掉最外层框

| 加框的代价 | 说明 |
|---|---|
| 双重留白 | 卡片内边距 + 页面外边距，实际内容区变小 |
| 层级语义错误 | 卡片表示"浮在页面上的一块"，而设置页**就是**页面 |
| 与组标题冲突 | 卡片已有边界，组标题降级成卡片内的二级标题，纯噪音 |
| 嵌套风险 | 组再套卡片 → 卡片叠卡片，正是 R2 要避免的 |

去掉后，页面背景就是内容背景，分组完全交给标题 + 留白 + 细线。

---

## 3. 结构值 vs 光学值

这是 R8 最容易被误判成"违反 8pt"的地方。

| 类别 | 值 | 必须落 8pt | 走哪个 token |
|---|---|---|---|
| 结构值 | 组间 40 / 44 / 48 | 是（4 的倍数） | `--s-6` / `--s-7` / `--gap-group` |
| 结构值 | 组内 0 | 是 | — |
| 结构值 | 行高 52 / 56 | 是 | `--row-h` |
| 结构值 | 行内距 12 | 是 | `--s-3` |
| 结构值 | 标签↔控件 ≥24 | 是 | `--s-5` |
| 光学值 | 1px 细线 | **否** | `--line-hair` |
| 光学值 | 组标题 13–14px | **否** | `--fs-sm` 13 |
| 光学值 | 行内距 14 | **否** | 单独 token |

### 3.1 关于 52–56 与 12–14 的区间

| 值 | 在 4px 网格 | 怎么用 |
|---|---|---|
| **52** | ✓ | `--row-h` 的 token 值，行 `min-height` |
| **56** | ✓ | 标签两行时的自然高度，或宽松密度 |
| **54** | ✗ | **区间中点，不是 token 值。** 是行被内容撑开后量出来的结果高度 |
| 12 | ✓ | `--row-pad-y` |
| 14 | ✗ | 只在需要光学居中时用，必须单独 token |

**把 54 写进 `min-height` 是常见错误。** 54 不是 4 的倍数，`audit.mjs` 会报未对齐的结构值。用 52 加内容自然撑开，得到的往往就是 54——那没问题，因为**它不是设定值，是结果值**。审计读 `min-height` 与 `padding`，不读 `getBoundingClientRect().height`。

### 3.2 字号不受网格约束

`--fs-sm` 13px、`--fs-xs` 12px 都不是 4 的倍数，但它们不受 R1 网格约束——字号由**字号阶梯**管，网格管间距与尺寸。

```
网格（4px）  → 间距、容器尺寸、行高、组件高
字号阶梯     → 12 / 13 / 15 / 18 / 24 / 32 / 44
```

两套系统各自自洽。**不要为了"对齐网格"把 13px 的组标题改成 16px**——那会破坏字号阶梯的层级差。

---

## 4. 可复制 CSS

```css
/* ---------- 容器：无外层框 ---------- */
.settings {
  max-width: 720px;              /* 设置页不需要宽内容轴 */
  padding-block: var(--s-7);     /* 48 */
  margin-inline: auto;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.settings__title {
  font-size: var(--fs-2xl);      /* 32 */
  font-weight: var(--fw-display);
  line-height: var(--lh-tight);
  margin: 0 0 var(--s-7);        /* 48 */
}

/* ---------- 组 ---------- */
.settings__group { margin-bottom: var(--s-6); }   /* 40 */
.settings__group:last-child { margin-bottom: 0; }
.settings__group + .settings__group { margin-top: var(--gap-group); }

.settings__group-title {
  font-size: var(--fs-sm);       /* 13 */
  font-weight: var(--fw-strong);
  color: var(--fg-muted);
  letter-spacing: .01em;
  margin: 0 0 var(--s-3);        /* 12 */
}

/* ---------- 行 ---------- */
.settings__list {
  margin: 0; padding: 0; list-style: none;
  border-top: var(--line-hair);  /* 组首行上沿一条细线 */
}
.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-5);               /* 24：标签与控件最小间距 */
  min-height: var(--row-h);      /* 52 */
  padding: var(--s-3) 0;         /* 12 上下 */
  border-bottom: var(--line-hair);
}
.settings__label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--fs-md);       /* 15 */
  font-weight: var(--fw-body);
  line-height: var(--lh-snug);   /* 1.35 */
  display: -webkit-box;
  -webkit-line-clamp: 2;         /* 标签最多两行 */
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.settings__hint {
  display: block;
  font-size: var(--fs-sm);       /* 13 */
  color: var(--fg-muted);
  margin-top: var(--s-1);        /* 4 */
}
.settings__control {
  flex: 0 0 auto;                /* 不被拉伸，右缘对齐 */
  display: flex;
  align-items: center;
  gap: var(--s-2);               /* 8 */
}

/* ---------- 危险操作组 ---------- */
.settings__group--danger { margin-top: var(--s-7); }   /* 48，比普通组多一档 */
.settings__group--danger .settings__group-title { color: var(--danger); }
.settings__group--danger .settings__list { border-top-color: color-mix(in oklab, var(--danger) 32%, transparent); }
.settings__group--danger .settings__row  { border-bottom-color: color-mix(in oklab, var(--danger) 32%, transparent); }

/* ---------- 触控目标 ---------- */
.settings__row .switch,
.settings__row .btn { min-height: 32px; min-width: 44px; }
@media (pointer: coarse) {
  .settings__row .switch,
  .settings__row .btn { min-height: 44px; min-width: 44px; }
}
@media (max-width: 640px) {
  .settings { padding-block: var(--s-6); }
  .settings__row { min-height: 56px; }
}
```

```css
:root {
  --row-h: 52px;        /* 结构值 */
  --row-pad-y: 12px;    /* 结构值 */
  --gap-group: 44px;    /* 区间 [40,48] 内的光学选择 */
}
```

`--line-hair` 已由 `build.mjs` 写进 `tokens.css` 的光学值段，不要重复定义。

---

## 5. 结构骨架

```html
<main class="settings">
  <h1 class="settings__title">偏好设置</h1>

  <section class="settings__group" aria-labelledby="g-appearance">
    <h2 class="settings__group-title" id="g-appearance">外观</h2>
    <ul class="settings__list">
      <li class="settings__row">
        <span class="settings__label" id="l-theme">主题</span>
        <div class="settings__control"><select aria-labelledby="l-theme">…</select></div>
      </li>
      <li class="settings__row">
        <span class="settings__label" id="l-accent">强调色</span>
        <div class="settings__control"><div role="radiogroup" aria-labelledby="l-accent">…</div></div>
      </li>
    </ul>
  </section>

  <section class="settings__group settings__group--danger" aria-labelledby="g-danger">
    <h2 class="settings__group-title" id="g-danger">危险操作</h2>
    <ul class="settings__list">
      <li class="settings__row">
        <span class="settings__label" id="l-delete">
          删除账号
          <span class="settings__hint">此操作不可撤销</span>
        </span>
        <div class="settings__control">
          <button class="btn btn--danger" aria-describedby="l-delete">删除</button>
        </div>
      </li>
    </ul>
  </section>
</main>
```

**用 `<section>` + `aria-labelledby`，不要用 `fieldset`。** `fieldset` 在 `display: flex` 下的默认样式与布局行为各引擎差异大，且自带边框需要额外清除；语义上 `<section>` + 标题已经足够。

---

## 6. 组间留白为什么是 40–48

这个区间不是审美偏好，是**分组感知**的下限与上限。

| 间距 | 用户读到的 | 问题 |
|---|---|---|
| 8–16px | "这些都是同一个组的" | 分组失效 |
| 20–32px | "可能分组了，但不确定" | 模糊区，最糟 |
| **40–48px** | **"这是新的一组"** | — |
| 56–80px | "这是另一个页面" | 页面被切碎 |

`--s-6`(40) 与 `--s-7`(48) 都在网格上，直接取最省事。44 是区间中点，需要单独定义 `--gap-group: 44px`，属于区间内的光学选择，要在合同里登记。

**组内必须是 0。** 行与行之间只有 1px 细线，没有 `gap`、没有 `margin`。任何非零的组内间距都会让"线"变成"线 + 空白"，读作"每行是一张卡片"，退回仪表盘拼贴。

---

## 7. 危险操作组

| 要求 | 理由 |
|---|---|
| **单独成组** | 与普通设置混排会被误触 |
| **有自己的标题**（"危险操作" / "删除"） | 让用户知道接下来不可撤销 |
| **放在最后** | 常用的在上，罕见的在下 |
| **不复用普通组颜色** | 标题用 `--danger` |
| **与上一组间距 ≥ 48** | 比普通组间多一档 |

**危险色必须过 3:1。** `--danger` = `oklch(0.640 0.190 30)` / `#E9523F`，对 `--bg` 实测 3.51:1，对 `--surface-sunken` 3.33:1。若项目主色偏红，危险组会与主色混淆——此时改用"灰底 + 明确文案"，不是换更红的红。

---

## 8. 反例

| 反例 | 为什么错 |
|---|---|
| 整页一张 `<div class="card">` 套所有组 | 页面即背景变成卡片即页面；双重留白 |
| 每组一张卡片（圆角 + 阴影） | 卡片叠卡片；组间留白失去意义 |
| 组内 `gap: 12px` | 线 + 空白 = 每行一张小卡片 |
| 每组用 `border-radius` 包围 | 分组靠形状而不是标题与留白，层级被形状劫持 |
| 组标题与行文字同字号同色 | 标题不成立，退化成一行普通文本 |
| 控件各自宽度，右缘参差 | 视线无法形成一条竖线，扫读变慢 |
| 控件被 `flex: 1` 拉伸 | 输入框撑满行，开关变形 |
| 删除按钮与普通按钮同色 | 无危险信号 |
| 删除放在设置组中间 | 误触风险 |
| 行高写 54px | 不在 4px 网格，`audit.mjs` 报未对齐 |
| 用斑马纹替代细线 | 斑马纹暗示"表格"，与"一行一项"的语义冲突 |

---

## 9. 验收

`audit.mjs`（L2）：

```
1. .settings / 页面主容器：borderWidth 全 0、boxShadow = none
2. 相邻 .settings__row 之间只有 1px 细线，没有 gap
3. 同组内 .settings__control 的 getBoundingClientRect().right 全部相等
4. .settings__row 的 min-height 是 4 的倍数（52 / 56）
5. 相邻组的垂直间距 ∈ [40, 48]
6. .settings__group-title 字号 ∈ [13, 14]
7. 危险组在 DOM 顺序上是最后一组
```

人工复核（L3）：

- [ ] 遮住组标题还能看出分组吗（应该 **不能**——分组靠标题与留白，不靠框）
- [ ] 100% / 200% 缩放下控件右缘仍对齐
- [ ] 触控设备上每行可点区域 ≥ 44×44
- [ ] 标签两行时行高自然撑开，且与相邻行等高
- [ ] 暗色下细线仍可见（`--line-1` 暗色值必须重新取，不是复用浅色）

```bash
node scripts/check-tokens.mjs --project <dir>
```
