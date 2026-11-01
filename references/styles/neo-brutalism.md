# 新粗野主义

> 硬边框、厚偏移阴影、撞色——把界面做得像一张从墙上撕下来的海报，还敢把字印到框外面。

## 元信息

| 项 | 值 |
|---|---|
| id | `neo-brutalism` |
| 变体 | `neo-brutalism` |
| 一句话 | 零圆角 + 2px 实心描边 + 无模糊硬阴影，用两种高饱和撞色把注意力钉在一个点上 |
| 最适合 | 作品集、活动落地页、创意工具、面向年轻人的消费产品 |
| 不适合 | 数据密集后台、长文本阅读、需要安静的企业界面；多列表单也会被边框噪音淹没 |
| 主要代价 | 信息密度必然下降：每条描边都在跟内容抢注意力，所以同屏能放的东西比极简少一半 |

## 签名特征（3–5 条，缺一不可）

1. **零圆角**，`--r-sm/md/lg` 全为 0；`--r-full` 只留给头像与徽章，且徽章也常用方角。
2. **所有可交互元素都有 2px 实心描边**，颜色是 `--fg`（不是浅灰），描边承担"可点"的全部语义。
3. **硬阴影无模糊**：`4px 4px 0`；按下时位移到 `2px 2px` 并把阴影收到 `2px 2px 0`，模拟"压进纸面"。
4. **撞色只有两种**：底色家族（米白 / 深墨）+ 一个高饱和撞色（黄、柠绿、品红之一）。第三种彩色只允许出现在贴纸式装饰上。
5. **超大标题**，字重 800+，字距收紧到 `-0.03em`，允许标题溢出容器并被裁切。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 90 / C 0.020（暖米黄纸感；C 比常规高一个量级，因为底色要参与撞色） |
| 彩度上限 | C ≤ 0.160；高饱和色 1 个，允许 1 个辅助撞色用于装饰块 |
| 圆角 | `--r-sm` 0 · `--r-md` 0 · `--r-lg` 0 · `--r-full` 999（仅头像/徽章） |
| 边框 | 2px solid `--fg`；输入框聚焦时改为 2px `--accent` + 4px 外环 |
| 阴影 | `--shadow-1` 4px 4px 0 · `--shadow-2` 6px 6px 0 · `--shadow-3` 浮层 8px 8px 0 |
| 字重 | 浅色 400 / 700 / 800 · 暗色 350 / 650 / 750（粗野靠字号与描边，暗色仍需降档） |
| 动效 | 80–120ms，无缓动（`linear` 或 `steps`）；只做位移，不做淡入 |

R3 例外：新粗野主义允许**不透明纯黑**用于 2px 描边。理由见下方声明；使用时必须登记 override。

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#F5F0E1` · `oklch(0.955 0.020 90)` | `#16140C` · `oklch(0.190 0.015 90)` |
| surface-1 | `#F0EBDC` · `oklch(0.940 0.020 90)` | `#1B1911` · `oklch(0.212 0.015 90)` |
| surface-2 | `#EAE5D7` · `oklch(0.922 0.020 90)` | `#211E16` · `oklch(0.236 0.015 90)` |
| surface-3 | `#E4DED0` · `oklch(0.902 0.020 90)` | `#27241C` · `oklch(0.262 0.015 90)` |
| fg | `#15140F` · `oklch(0.190 0.010 90)` | `#F0EEE7` · `oklch(0.950 0.010 95)` |
| fg-muted | `#4C473C` · `oklch(0.400 0.020 90)` | `#AEABA0` · `oklch(0.740 0.015 90)` |
| accent | `#F2D045` · `oklch(0.862 0.155 95)` | `#F3D350` · `oklch(0.870 0.150 95)` |
| line-1 | `#15140F` · `oklch(0.190 0.010 90)` | `#F0EEE7` · `oklch(0.950 0.010 95)` |

- 表面 ΔL（浅）：bg→s1 **0.015** · s1→s2 **0.018** · s2→s3 **0.020**；（暗）0.022 / 0.024 / 0.026
- 对比度（浅）：`fg/bg` 16.2:1 · `fg-muted/bg` 8.1:1 · `accent/fg` 12.2:1
- 对比度（暗）：`fg/bg` 16.0:1 · `fg-muted/bg` 8.0:1 · `accent/bg` 12.5:1

**强调色是亮黄，对比度要看"它上面的字"**：`accent/bg` 只有 1.33:1（浅）/ 12.5:1（暗），所以强调色**永远不能承载小字正文**，只能做按钮底色配 `--fg` 文字（12.2:1），或做装饰块。这条是这个风格最容易被误用的地方。

**R3 纯黑例外声明**：本卡允许 `#000` 出现在 2px 描边与硬阴影中。原因：硬阴影需要与浅色米底形成无过渡的硬边，任何灰度的阴影在 1x 屏幕上都会因为次像素抗锯齿出现一条浅灰缝，正是这个风格最不能容忍的东西。使用前必须在 `decisions.json.overrides` 登记：

```
rule: R3 · scope: neo-brutalism.border · requestedValue: #000 · effectiveValue: #000
reason: 硬边阴影的 AA 缝 · approvedBy: user · verification: check-tokens --allow-black-border
```

## 标志性 CSS

**1 · Token 覆盖**

```css
:root[data-style="neo-brutalism"] {
  --bg: oklch(0.955 0.020 90);
  --surface-1: oklch(0.940 0.020 90);
  --surface-2: oklch(0.922 0.020 90);
  --surface-3: oklch(0.902 0.020 90);
  --fg: oklch(0.190 0.010 90);
  --fg-muted: oklch(0.400 0.020 90);
  --accent: oklch(0.862 0.155 95);
  --line-1: oklch(0.190 0.010 90);

  --r-sm: 0px; --r-md: 0px; --r-lg: 0px; --r-full: 999px;

  --brut-shadow: 4px 4px 0 var(--fg);   /* 局部变量：本风格阴影的基数 */
  --shadow-1: 4px 4px 0 var(--fg);
  --shadow-2: 6px 6px 0 var(--fg);
  --shadow-3: 8px 8px 0 var(--fg);

  --fw-body: 400; --fw-strong: 700; --fw-display: 800;
  --dur-fast: 80ms; --dur-base: 100ms; --dur-slow: 120ms;
  --ease-out: linear;
}
:root[data-style="neo-brutalism"][data-theme="dark"] {
  --bg: oklch(0.190 0.015 90);
  --surface-1: oklch(0.212 0.015 90);
  --surface-2: oklch(0.236 0.015 90);
  --surface-3: oklch(0.262 0.015 90);
  --fg: oklch(0.950 0.010 95);
  --fg-muted: oklch(0.740 0.015 90);
  --accent: oklch(0.870 0.150 95);
  --line-1: oklch(0.950 0.010 95);
  --fw-body: 350; --fw-strong: 650; --fw-display: 750;
}
/* 验收：computed --r-md 必须是 0px；暗色下 --line-1 仍是 fg 色而不是灰 */
```

**2 · 硬阴影 + 按压位移**

```css
.btn {
  border: 2px solid var(--fg);
  border-radius: 0;
  background: var(--accent);
  color: var(--fg);
  box-shadow: var(--shadow-1);
  transition: transform var(--dur-fast) linear,
              box-shadow var(--dur-fast) linear;
}
.btn:hover    { box-shadow: var(--shadow-2); transform: translate(-2px, -2px); }
.btn:active   { box-shadow: 2px 2px 0 var(--fg); transform: translate(2px, 2px); }
/* 验收：hover 与 active 的 shadow offset 之和恒定（6px），元素不"变重" */
```

**3 · 描边即语义：可点的都有边，不可点的都没有**

```css
:where(a, button, input, select, textarea, [role="button"], [tabindex="0"]) {
  border: 2px solid var(--fg);
  border-radius: 0;
}
.card { border: 2px solid var(--fg); background: var(--surface-1); }
.card--flat { border: 0; }             /* 纯信息块：无边，明确不可点 */
/* 验收：所有可聚焦元素的 computed border-width 为 2px */
```

**4 · 标题溢出，用裁切制造张力**

```css
.hero-title {
  font-size: clamp(2.5rem, 9vw, 6rem);
  font-weight: var(--fw-display);
  letter-spacing: -0.03em;
  line-height: 0.92;
  text-transform: uppercase;
  overflow: clip;                        /* 故意裁切，不是 bug */
}
/* 验收：1440 下标题不被压缩换行，超出部分被裁而不是缩小 */
```

**5 · 焦点环：方角，且不依赖 outline 的圆角默认值**

```css
:where(a, button, input, select, textarea):focus-visible {
  outline: 3px solid var(--fg);
  outline-offset: 3px;
  border-radius: 0;
}
.field:focus-visible { border-color: var(--accent); }
/* 验收：焦点环是方角，宽度 ≥ 3px，与背景对比 ≥ 3:1 */
```

**6 · 压制与 R4 的等价方案**

```css
/* 输入框不用 inset 内环，改用"外围加硬边 + 按下位移"表达嵌入 */
.field {
  background: var(--bg);
  border: 2px solid var(--fg);
  box-shadow: inset 2px 2px 0 color-mix(in oklab, var(--fg) 18%, transparent);
}
.field:focus-visible {
  border-color: var(--fg);
  box-shadow: inset 2px 2px 0 color-mix(in oklab, var(--fg) 18%, transparent),
              3px 3px 0 var(--accent);
}
/* 验收：R4 override 已登记，verification 指向本段"inset 硬边 + 偏移外影" */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 任何模糊的阴影 | 一条 `blur` 就足以让整页从"海报"退回"卡片模板"；硬边阴影的像素对齐是这个风格的身份证 |
| 玻璃 / `backdrop-filter` | 半透明与模糊是粗野主义的结构反面；遮住背后的硬边后，2px 描边会读成"发虚的细线" |
| 大圆角（> 8px） | 圆角与硬阴影同框时，阴影的方角会从圆角外"露出来"，形成脏边 |
| 三种以上高饱和色 | 撞色的记忆点来自**两色**的张力；第三色出现后每块面积都在争抢，注意力被均分 |
| 300 字以上的连续正文 | 描边与高对比让每行都在跳动，长文本阅读疲劳度是极简的 2–3 倍 |
| 装饰性渐变 | 渐变与无模糊硬边不兼容：同一个元素上"软"和"硬"两种材质语言打架 |
| 小于 2px 的描边 | 1px 描边在粗野主义里读成"表格线"，可点性语义丢失 |

## 验收：怎么判断这个风格做对了

- [ ] 全页没有一处 `blur` 半径大于 0 的 `box-shadow`（浮层与 toast 除外，且需单独登记）
- [ ] 所有可点元素都有 2px 描边，且描边色等于 `--fg`
- [ ] 所有 `border-radius` 为 0，`--r-full` 只出现在头像 / 徽章
- [ ] 高饱和色 ≤ 2 种，且第二种只出现在装饰块，面积占比 < 10%
- [ ] 正文行数 ≤ 8 行/屏：任何文本块超过这个量就说明页面选错了风格
- [ ] 按压时元素位移与阴影收缩量相等（视觉上"压进"而非"缩小"）
- [ ] 焦点环为方角、≥ 3px、对比度 ≥ 3:1
- [ ] 纯黑只出现在描边与硬阴影，正文仍是 `#1A1A19` 类深灰
- [ ] 暗色下 `--line-1` 是反白，而不是降成灰色

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 只做了粗描边，没做硬阴影 | 描边只给"边界"，硬阴影才给"层叠"；缺了阴影后页面读起来像 2000 年代的表格 |
| 把所有元素都加描边，包括纯文本块 | 描边是"可点"的语义；给不可点的段落也加边，可点性信号立即失效 |
| 用高饱和色做正文 | 撞色的 L 与 C 都高，作为正文时与底的对比不足且刺眼；强调色只做底、不做字 |
| 用旋转、贴纸、涂鸦堆砌"粗野感" | 这些是装饰层的加法，风格的内核是结构层的减法：零圆角、硬边、两色 |
| 在密集表格上套用 | 每个单元格 2px 描边后，表格变成网格纸，行列扫读彻底失效；这是排除项不是难点 |
| 把暗色当作浅色的简单反相 | 纯黑底 + 纯白边会产生明显的光晕（halation），暗色必须改用微暖白并降字重 |
