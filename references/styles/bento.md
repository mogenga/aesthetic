# 便当盒

> 用尺寸不同的格子讲内容的主次，一屏之内的"排版"就是信息架构本身。

## 元信息

| 项 | 值 |
|---|---|
| id | `bento` |
| 变体 | `bento` |
| 一句话 | 同一种卡片语言铺满一屏，靠 2×1、1×2、2×2 的格子比例分出重点与陪衬 |
| 最适合 | 产品首页、功能总览、仪表盘头部、发布页与作品集 |
| 不适合 | 长表单、设置页、聊天流；这些页面没有"格子比例"可用，强行套会变成杂乱拼贴 |
| 主要代价 | 格子比例没调好就退化成仪表盘拼贴；内容稍多就不得不加第二屏，破坏"一屏讲完"的前提 |

## 签名特征（3–5 条，缺一不可）

1. **一个固定栅格，至少两种跨度**。桌面 12 列（或 4×4 单元），格子只能占 1×1 / 2×1 / 1×2 / 2×2，不允许 3×1 这种"半格"。
2. **所有格子共享同一套卡片语言**：同一个圆角、同一条边框规则、同一档阴影。差异只来自尺寸与内部内容，不来自边框颜色。
3. **格子间距显著小于格子内距**。栏距 16px，卡内距 24–32px，视觉上格子"粘"在一起但仍可分。
4. **每格只讲一件事**：一个数字、一句结论、一个可视化、一个入口。格子里出现两个并列主题就是错的。
5. **首屏即全貌**：桌面 1440×900 内不出现纵向滚动条；窄屏才允许格子自然堆叠。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 80 / C 0.006（暖中性；与极简的差别在 C 高了 3 倍，格子需要一点温度才不像后台） |
| 彩度上限 | C ≤ 0.140；每个 2×2 主格可以有一个自己的色相，其余格子共用中性 + 主强调 |
| 圆角 | `--r-sm` 8 · `--r-md` 12 · `--r-lg` 20 · `--r-full` 999（卡片统一用 `--r-lg`） |
| 边框 | 1px · `--line-1`，浅到几乎只是"阴影的替代品"；输入框内环 `--line-inset`；hover 不改边框色，只提亮 `--surface-2` |
| 阴影 | `--shadow-1` 0 1px 2px -1px / .05 · `--shadow-2` 0 2px 8px -2px / .06 · `--shadow-3` 浮层单独一档 |
| 字重 | 浅色 400 / 550 / 700 · 暗色 350 / 500 / 650（Bento 的标题需要一点重量，否则格子里压不住） |
| 动效 | 160–220ms `ease-out`；只允许卡片背景与内部图形动，卡片本身不位移、不缩放 |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#FBF9F5` · `oklch(0.982 0.006 80)` | `#141210` · `oklch(0.185 0.006 80)` |
| surface-1 | `#F7F4F0` · `oklch(0.968 0.006 80)` | `#191715` · `oklch(0.207 0.006 80)` |
| surface-2 | `#F1EFEB` · `oklch(0.952 0.006 80)` | `#1F1D1A` · `oklch(0.231 0.006 80)` |
| surface-3 | `#EBE9E5` · `oklch(0.934 0.006 80)` | `#252320` · `oklch(0.257 0.006 80)` |
| fg | `#1A1A19` · `oklch(0.2174 0.0019 106.6)` | `#EEECEA` · `oklch(0.945 0.004 80)` |
| fg-muted | `#5D5A56` · `oklch(0.470 0.008 80)` | `#AAA7A2` · `oklch(0.730 0.008 80)` |
| accent | `#A94620` · `oklch(0.520 0.140 40)` | `#F59569` · `oklch(0.760 0.130 45)` |
| line-1 | `#E2DFDB` · `oklch(0.905 0.006 80)` | `#34332F` · `oklch(0.320 0.006 80)` |

- 表面 ΔL（浅）：bg→s1 **0.014** · s1→s2 **0.016** · s2→s3 **0.018**；（暗）0.022 / 0.024 / 0.026
- 对比度（浅）：`fg/bg` 16.5:1 · `fg-muted/bg` 6.5:1 · `accent/bg` 5.6:1
- 对比度（暗）：`fg/bg` 15.9:1 · `fg-muted/bg` 7.8:1 · `accent/bg` 8.3:1

Bento 的"彩色"通常来自格内插画或图表，而不是表面色。因此 `--accent` 只承担链接与选中态；每个主格允许一个**格内局部色**（写在卡片局部变量里，不进 token 表），但必须满足：与 `--surface-1` 的对比 ≥ 3:1，且同一屏最多两格使用局部色。

### 状态色

| 角色 | 浅色 | 暗色 | 说明 |
|---|---|---|---|
| danger | `#AB413E` · `oklch(0.520 0.140 25)` | `#FE8B83` · `oklch(0.760 0.140 25)` | 比极简稍艳，仍不越过 0.140 |
| danger-hover | `oklch(0.475 0.145 25)` | `oklch(0.810 0.125 25)` | |
| on-danger | `#FCFCFC` · `oklch(0.990 0 0)` | `oklch(0.185 0.010 25)` | |
| success | `#007533` · `oklch(0.492 0.136 150)` | `#68CA80` · `oklch(0.760 0.140 150)` | |
| warning | `#935701` · `oklch(0.514 0.115 65)` | `#ED9D44` · `oklch(0.760 0.140 65)` | |

状态色的明度与 accent 同带（浅 0.52 / 暗 0.76）。琥珀 warning 的 C 收到 0.115，避免与 accent 的橙（H 40）在同一个格子里读成第二种强调色。

## 标志性 CSS

**1 · Token 覆盖**

```css
:root[data-style="bento"] {
  --bg: oklch(0.982 0.006 80);
  --surface-1: oklch(0.968 0.006 80);
  --surface-2: oklch(0.952 0.006 80);
  --surface-3: oklch(0.934 0.006 80);
  --fg: oklch(0.2174 0.0019 106.6);
  --fg-muted: oklch(0.470 0.008 80);
  --accent: oklch(0.520 0.140 40);
  --line-1: oklch(0.905 0.006 80);

  --r-sm: 8px; --r-md: 12px; --r-lg: 20px; --r-full: 999px;

  --shadow-1: 0 1px 2px -1px rgb(0 0 0 / .05);
  --shadow-2: 0 2px 8px -2px rgb(0 0 0 / .06);
  --shadow-3: 0 12px 32px -12px rgb(0 0 0 / .18);

  --fw-body: 400; --fw-strong: 550; --fw-display: 700;
  --dur-fast: 120ms; --dur-base: 180ms; --dur-slow: 220ms;
}
:root[data-style="bento"][data-theme="dark"] {
  --bg: oklch(0.185 0.006 80);
  --surface-1: oklch(0.207 0.006 80);
  --surface-2: oklch(0.231 0.006 80);
  --surface-3: oklch(0.257 0.006 80);
  --fg: oklch(0.945 0.004 80);
  --fg-muted: oklch(0.730 0.008 80);
  --accent: oklch(0.760 0.130 45);
  --line-1: oklch(0.320 0.006 80);
  --fw-body: 350; --fw-strong: 500; --fw-display: 650;
}
/* 验收：暗色下三个字重各降一档且 body ≥ 300、<16px 文字 ≥ 400 */
```

**2 · 栅格：只允许四种跨度**

```css
.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 120px;          /* 行高固定，格子按行数计高 */
  gap: var(--s-4);                /* 16px：栏距 */
  container-type: inline-size;
}
.bento > .cell          { grid-column: span 3; grid-row: span 1; }
.bento > .cell--wide    { grid-column: span 6; grid-row: span 1; }
.bento > .cell--tall    { grid-column: span 3; grid-row: span 2; }
.bento > .cell--hero    { grid-column: span 6; grid-row: span 2; }
/* 验收：所有 cell 的 grid-column / grid-row span 乘积 ∈ {1,2,4} */
```

**3 · 卡片语言：一套，不按尺寸改**

```css
.cell {
  background: var(--surface-1);
  border: 1px solid var(--line-1);
  border-radius: var(--r-lg);
  padding: var(--s-5);            /* 24px 内距，所有尺寸一致 */
  box-shadow: var(--shadow-1);
  display: flex; flex-direction: column; gap: var(--s-2);
  min-width: 0;
}
.cell--hero { padding: var(--s-6); }   /* 唯一例外：主格 32px */
/* 验收：任意两个 .cell 的 border-radius 与 border-width 完全相等 */
```

**4 · 格子内部：一个数字 / 一句结论 / 一个图形**

```css
.cell__value {
  font-size: clamp(24px, 4cqi, 44px);   /* 随容器缩放，不是随视口 */
  font-weight: var(--fw-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.cell__label { font-size: var(--fs-sm); color: var(--fg-muted); }
.cell__foot  { margin-top: auto; font-size: var(--fs-xs); color: var(--fg-muted); }
/* 验收：值字号用 cqi 而不是 vw，侧栏宽度变化时数字不会溢出 */
```

**5 · hover 只提亮表面，不位移**

```css
.cell--interactive { cursor: pointer; }
.cell--interactive:hover { background: var(--surface-2); }
.cell--interactive:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* 验收：hover 前后 getBoundingClientRect 完全相等（无缩放、无位移） */
```

**6 · 窄屏：格子降为单列，主格优先**

```css
@container (max-width: 640px) {
  .bento { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 96px; }
  .bento > .cell        { grid-column: span 4; }
  .bento > .cell--hero  { grid-column: span 4; grid-row: span 2; }
  .bento > .cell--tall  { grid-column: span 2; grid-row: span 2; }
  .bento > .cell--wide  { grid-column: span 4; }
}
/* 验收：390px 下无横向滚动，主格仍在首位 */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 每格不同的圆角 / 边框色 | 格子语言一散，页面就读成"卡片拼贴"而不是"一个布局"；连贯性是这个风格唯一的秩序来源 |
| 三种以上跨度组合 | 2×1 与 1×2 已经足够表达主次；再加 3×1 会让栅格失去可预测性，响应式时只能整体重写 |
| 卡片内再套卡片 | 双层圆角会在视觉上产生"凹槽"，且在 16px 栏距下形成看不懂的细缝 |
| 卡片位移 / 缩放的 hover | 栅格有固定栏距，位移会让相邻格子露出 1–2px 的缝，看起来像布局抖动 |
| 主格里塞两个主题 | 尺寸大 = 优先级高；塞两件事等于宣布两件事都不重要 |
| 首屏纵向滚动 | Bento 的承诺是"一屏讲完"；滚动之后用户看不到格子比例的全貌，这个风格就只剩圆角卡片 |
| 用 `vw` 给格内数字定字号 | 侧栏或缩放变化时数字会溢出格子，且 `clamp` 的下界会被击穿 |

## 验收：怎么判断这个风格做对了

- [ ] 桌面 1440×900 下首屏无纵向滚动条，且至少出现三种跨度
- [ ] 所有格子 `border-radius` 与 `border-width` 完全一致（主格只允许 padding 不同）
- [ ] 栏距（16px）严格小于卡内距（24px），比值 ≤ 0.67
- [ ] 每格只有一个主数字或一句结论，不存在并列主题
- [ ] hover 时格子外框尺寸不变（无 transform、无 margin 变化）
- [ ] 390px 断点下变为单列，主格仍排第一，无横向溢出
- [ ] 暗色下格内局部色的对比度仍 ≥ 3:1
- [ ] 同一屏内使用格内局部色的卡片 ≤ 2 个
- [ ] 用容器查询而非媒体查询控制格内字号

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 把它做成"网格化仪表盘" | 仪表盘的格子是为了容纳图表，Bento 的格子是为了讲一个叙事序列；前者要求等高，后者要求有主角 |
| 主格用更粗的边框或更深的底色来强调 | 强调应该来自尺寸；再加一层颜色强调，会让"大格子"与"重颜色"两个信号互相稀释 |
| 每个格子都配图标 + 标题 + 描述 | 这是功能列表的写法，塞进 Bento 后每格信息密度相同，尺寸差异就失去意义 |
| 从 Figma 直接导出固定像素格子 | 固定像素在 834 断点必然溢出；格子必须由栅格推导，不能由设计稿坐标推导 |
| 只抄圆角与配色，不抄跨度系统 | 没有跨度规则的 Bento 只是"圆角卡片网格"，任何模板都能冒充 |
