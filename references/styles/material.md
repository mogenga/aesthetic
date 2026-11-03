# 材料设计

> 借用 Material 的高度语义与状态模型——但**不使用**它的默认蓝、默认阴影和默认圆角。

## 元信息

| 项 | 值 |
|---|---|
| id | `material` |
| 变体 | `material` |
| 一句话 | 用"高度 = 重要性"的层叠语义组织界面，表面色用暖中性，强调色是唯一的青绿 |
| 最适合 | 企业工具、跨平台应用、可用性优先的产品、需要成熟交互惯例的界面 |
| 不适合 | 需要强品牌调性的活动页（会被误认为某平台系统应用）；也**不适合**只想"看起来像 Google 示例站"的项目——那正是本卡要避免的 |
| 主要代价 | 撞脸风险最高：高度语义 + FAB + 顶部应用栏这套组合太成熟，稍不留神就是 Google 的示例站 |

## 签名特征（3–5 条，缺一不可）

1. **高度分级而不是阴影分级**：`--shadow-1..3` 对应 elevation 1 / 3 / 8，语义是"这个元素离页面的距离"，而不是"它是否重要"。
2. **状态层（state layer）叠加**：hover / focus / pressed 用同一种强调色以 8% / 12% / 16% 的透明度**叠加在当前表面之上**，而不是换一个新颜色。
3. **表面色承担容器语义**：`--surface-1` 是卡片，`--surface-2` 是浮动操作区，`--surface-3` 是模态；同一层级的容器不允许不同底色。
4. **强调色不是蓝**：默认给青绿（H 175），并且**只出现在 3 处**——主按钮、选中指示器、焦点环。
5. **圆角是中等且单一**：`--r-md` 12px 覆盖按钮、输入、卡片，用同一个值建立"系统感"；只有模态与底部抽屉用 `--r-lg`。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 45 / C 0.008（暖中性；Material 默认是冷灰或纯白，换暖是为了脱离"系统模板"） |
| 彩度上限 | C ≤ 0.110；强调色 1 个（青绿），状态色用低彩度变体 |
| 圆角 | `--r-sm` 8 · `--r-md` 12 · `--r-lg` 28 · `--r-full` 999（28 是"模态"专用的超大圆角） |
| 边框 | 0（靠高度与表面色分层）；`outlined` 变体用 1px `--line-1`；fill 输入框内环 `--line-inset` |
| 阴影 | 三档 elevation，**全部重新调过**，见下方 CSS；与 Material 默认的 `0 1px 3px rgba(0,0,0,.12), ...` 不同 |
| 字重 | 浅色 400 / 500 / 600 · 暗色 350 / 450 / 550（Material 的默认类型系统依赖 500，暗色必须降） |
| 动效 | 200–300ms `cubic-bezier(.2,0,0,1)`；状态层用 100ms；elevation 变化不能做动画（会导致连续重绘阴影） |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#FCF5F2` · `oklch(0.975 0.008 45)` | `#140F0D` · `oklch(0.175 0.010 45)` |
| surface-1 | `#F6F0ED` · `oklch(0.958 0.008 45)` | `#1A1412` · `oklch(0.198 0.010 45)` |
| surface-2 | `#EFE9E6` · `oklch(0.938 0.008 45)` | `#1F1A17` · `oklch(0.222 0.010 45)` |
| surface-3 | `#E8E1DF` · `oklch(0.915 0.008 45)` | `#25201D` · `oklch(0.248 0.010 45)` |
| fg | `#201916` · `oklch(0.220 0.012 45)` | `#EDE6E3` · `oklch(0.930 0.008 45)` |
| fg-muted | `#5D5551` · `oklch(0.455 0.012 45)` | `#AAA39F` · `oklch(0.720 0.010 45)` |
| accent | `#036654` · `oklch(0.455 0.085 175)` | `#68D1B7` · `oklch(0.790 0.105 175)` |
| line-1 | `#DCD6D3` · `oklch(0.880 0.008 45)` | `#37312F` · `oklch(0.320 0.010 45)` |

- 表面 ΔL（浅）：bg→s1 **0.017** · s1→s2 **0.020** · s2→s3 **0.023**；（暗）0.023 / 0.024 / 0.026
- 对比度（浅）：`fg/bg` 16.1:1 · `fg-muted/bg` 6.8:1 · `accent/bg` 6.5:1
- 对比度（暗）：`fg/bg` 15.4:1 · `fg-muted/bg` 7.6:1 · `accent/bg` 10.3:1

**不照搬的三样东西**（这是本卡的核心约束）：

| Material 默认 | 本卡取值 | 为什么换 |
|---|---|---|
| 主色 `#6200EE` 类紫 / 蓝 | 青绿 `H 175`，C 0.085 | 默认紫蓝是"这是 Material 应用"的最强信号 |
| 表面白 `#FFFFFF` + 冷灰 | 暖中性 `H 45, C 0.008` | 纯白 + 冷灰是站点模板的默认组合；暖中性让它像"自有产品" |
| 阴影 `0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.24)` | 见下方 CSS，三档重新调参，带 1px 边缘暗线 | 默认阴影在浅底上偏灰、在暗底上完全失效 |

### 状态色

| 角色 | 浅色 | 暗色 | 说明 |
|---|---|---|---|
| danger | `#893A33` · `oklch(0.454 0.110 27)` | `#F99F94` · `oklch(0.790 0.110 27)` | C 不超过 0.110 |
| danger-hover | `oklch(0.414 0.115 27)` | `oklch(0.840 0.100 27)` | |
| on-danger | `#FCFCFC` · `oklch(0.990 0 0)` | `oklch(0.175 0.010 27)` | |
| success | `#1A6733` · `oklch(0.454 0.110 150)` | `#85CF95` · `oklch(0.790 0.110 150)` | |
| warning | `#784B01` · `oklch(0.454 0.098 70)` | `#E8AE69` · `oklch(0.790 0.110 70)` | |

状态色从 accent 的青绿（H 175）推导：保持同一明度带（浅 0.454 / 暗 0.790）与同一彩度上限（C 0.110），只换色相。危险按钮用 filled tonal 语义（`--danger` 底 + `--on-danger` 字），不走 accent 的状态层。

## 标志性 CSS

**1 · Token 覆盖（高度语义占满 `--shadow-*`）**

```css
:root[data-style="material"] {
  --bg: oklch(0.975 0.008 45);
  --surface-1: oklch(0.958 0.008 45);
  --surface-2: oklch(0.938 0.008 45);
  --surface-3: oklch(0.915 0.008 45);
  --fg: oklch(0.220 0.012 45);
  --fg-muted: oklch(0.455 0.012 45);
  --accent: oklch(0.455 0.085 175);
  --line-1: oklch(0.880 0.008 45);

  --r-sm: 8px; --r-md: 12px; --r-lg: 28px; --r-full: 999px;

  /* elevation 1 / 3 / 8 —— 每档都带一条 1px 边缘暗线，这是脱离 Material 默认的关键 */
  --shadow-1: 0 1px 2px -1px rgb(60 40 30 / .14), 0 0 0 1px rgb(60 40 30 / .05);
  --shadow-2: 0 4px 10px -4px rgb(60 40 30 / .16), 0 0 0 1px rgb(60 40 30 / .06);
  --shadow-3: 0 18px 48px -16px rgb(60 40 30 / .24), 0 0 0 1px rgb(60 40 30 / .08);

  --fw-body: 400; --fw-strong: 500; --fw-display: 600;
  --dur-fast: 100ms; --dur-base: 220ms; --dur-slow: 300ms;
  --ease-out: cubic-bezier(.2, 0, 0, 1);
}
:root[data-style="material"][data-theme="dark"] {
  --bg: oklch(0.175 0.010 45);
  --surface-1: oklch(0.198 0.010 45);
  --surface-2: oklch(0.222 0.010 45);
  --surface-3: oklch(0.248 0.010 45);
  --fg: oklch(0.930 0.008 45);
  --fg-muted: oklch(0.720 0.010 45);
  --accent: oklch(0.790 0.105 175);
  --line-1: oklch(0.320 0.010 45);
  /* 暗色高度靠"提高表面 L"表达，阴影只做辅助 */
  --shadow-1: 0 1px 2px -1px rgb(0 0 0 / .55), 0 0 0 1px rgb(255 245 240 / .04);
  --shadow-2: 0 4px 12px -4px rgb(0 0 0 / .60), 0 0 0 1px rgb(255 245 240 / .06);
  --shadow-3: 0 18px 56px -16px rgb(0 0 0 / .70), 0 0 0 1px rgb(255 245 240 / .08);
  --fw-body: 350; --fw-strong: 450; --fw-display: 550;
}
/* 验收：暗色下阴影不是把浅色的 rgb(60 40 30) 直接搬过来，而是换成黑色 + 亮边缘 */
```

**2 · 状态层：叠加而不是换色**

```css
.btn, .nav-item, .list-row {
  position: relative;
  isolation: isolate;
}
.btn::after {
  content: ""; position: absolute; inset: 0;
  border-radius: inherit; pointer-events: none;
  background: var(--accent); opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.btn:hover::after   { opacity: .08; }
.btn:focus-visible::after { opacity: .12; }
.btn:active::after  { opacity: .16; }
/* 验收：hover 后的背景是 accent 叠加，不是一个新的十六进制色 */
```

**3 · 高度语义：谁用哪一档**

```css
.card, .list-row            { background: var(--surface-1); box-shadow: var(--shadow-1); }
.fab, .app-bar--scrolled,
.picker-surface             { background: var(--surface-2); box-shadow: var(--shadow-2); }
.dialog, .bottom-sheet      { background: var(--surface-3); box-shadow: var(--shadow-3); border-radius: var(--r-lg); }
/* 验收：每个元素都有确定的 elevation 档位，不存在"介于两档之间"的自定义阴影 */
```

**4 · 按钮：三级，全部去掉默认蓝**

```css
.btn--filled {
  background: var(--accent); color: var(--bg);
  border-radius: var(--r-full); min-height: 40px; padding-inline: 24px;
}
.btn--tonal {
  background: color-mix(in oklab, var(--accent) 14%, var(--surface-1));
  color: var(--accent);
}
.btn--text { background: transparent; color: var(--accent); }
.btn[disabled] { opacity: .38; box-shadow: none; }
/* 验收：按钮上文字与底的对比 ≥ 4.5:1；filled 按钮在暗色下用 bg 作前景 */
```

**5 · 输入框：Material 的 fill 语义 + R4 的咬合**

Material 的 fill 输入框把"咬合"放在**底部指示线**上：上方是容器底、下方是页面底，控件靠底部线"落"在页面上。R4 的三件套仍然保留（只是外投影更薄），否则 `audit.mjs` 报缺 inset 内环：

```css
.field {
  background: var(--surface-2);
  border: 0;
  border-radius: var(--r-sm) var(--r-sm) 0 0;   /* fill 变体：底部方角 */
  box-shadow:
    0 1px 2px -1px rgb(60 40 30 / .10),          /* 非 inset：嵌入页面 */
    0 1px 0 0 var(--line-1),                    /* 底部指示线 */
    inset 0 1px 2px rgb(60 40 30 / .08),        /* 内投影：上沿吃光 */
    inset 0 0 0 1px color-mix(in oklab, var(--fg) 6%, transparent);
}
.field:focus-visible {
  box-shadow:
    0 1px 2px -1px rgb(60 40 30 / .10),
    0 2px 0 0 var(--accent),                    /* 指示线变粗并换 accent */
    inset 0 1px 2px rgb(60 40 30 / .08),
    inset 0 0 0 1px color-mix(in oklab, var(--accent) 55%, transparent);
}
/* outlined 变体：1px --line-1 + --r-md；两者不可同时出现在一页 */
/* 验收：R4 override 已登记，verification 指向本段"2px 底部指示线" */
```

**6 · 动效：elevation 不做过渡**

```css
.dialog[open] { animation: dialog-in var(--dur-base) var(--ease-out); }
@keyframes dialog-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to   { opacity: 1; transform: none; }
}
.card { transition: background-color var(--dur-fast) var(--ease-out); }
.card { box-shadow: var(--shadow-1); }        /* 不写 box-shadow 的 transition */
/* 验收：所有 transition-property 不含 box-shadow；模态进出 ≤ 300ms */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| Material 默认紫 / 蓝（`#6200EE`、`#3F51B5` 一类） | 这两个色号是最强的"我在用 Material 默认主题"信号，一眼就把产品读成示例站 |
| 默认的 `0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.24)` | 在暖底上偏灰、在暗底上彻底消失；本卡三档全部带 1px 边缘暗线 |
| 每张卡片都 elevation 1 + 每种浮层都 elevation 3 | 高度必须稀缺才携带信息；全页所有元素都浮起时，"高度"退化成装饰 |
| 同层容器不同底色 | 表面色是层级语义，不是配色自由度；同层两色会让用户以为它们不同层级 |
| 全局 4dp 圆角（Material 2 的默认） | 配合本卡的暖表面与青绿强调，小圆角会读成"没改完的旧版 Material" |
| 阴影做 hover 过渡 | 阴影插值每帧都要重绘模糊，中低端设备会掉帧；高度变化应在状态切换时瞬时完成 |
| 同一页混用 fill 与 outlined 两种输入框 | 两套表面语义并存，用户无法从中读出"这个字段是否必填/是否已填" |

## 验收：怎么判断这个风格做对了

- [ ] 全页没有 `#6200EE` / `#3F51B5` 一类的 Material 默认主色
- [ ] 任意元素的 `box-shadow` 都包含一条 1px 边缘暗线（浅）或亮线（暗）
- [ ] 每个容器都有明确的 elevation 档位（1/3/8 之一），不存在第四种阴影
- [ ] hover 后的背景色等于 accent 以 8% 叠加在当前表面上（`color-mix` 结果），不是新色号
- [ ] 全页圆角只有 `--r-md`（12）与 `--r-lg`（28）两种，按钮与输入为 8 或 full
- [ ] 输入框全页统一是 fill 或 outlined 一种变体
- [ ] 暗色下阴影重算，未复用浅色阴影色
- [ ] `transition-property` 里没有 `box-shadow`
- [ ] 主按钮、选中指示器、焦点环之外，没有第四处使用 `--accent`
- [ ] 类型阶梯是 400/500/600（浅），暗色 350/450/550，不存在 700 以上

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 原样使用 `@material/web` 默认主题 | 换掉 token 但仍保留默认阴影与默认蓝，结果是"带品牌色的 Google 示例站"——正是本卡要避免的结果 |
| 把 elevation 当"重要性"用 | 高度表达的是**与页面的物理距离**；用高度表达重要性会让"重要但内联"的内容无法表达 |
| 用 FAB 做"快速新建"而不评估场景 | FAB 是强烈平台惯例，出现即意味着"移动优先 + 单一主动作"；桌面后台用它会误导用户 |
| 把状态层做成换色 | 换新颜色会让同一个按钮在不同表面上有不同底色，表面语义崩坏；必须叠加 |
| 只抄配色不抄状态模型 | 色彩可以随便换，真正定义 Material 的是"高度 + 状态层 + 表面语义"三角，缺一条就只是"圆角卡片" |
