# 赛博朋克

> 近黑底、荧光青与品红两条发光边、等宽字与扫描线——界面像一台还没关掉的终端。

## 元信息

| 项 | 值 |
|---|---|
| id | `cyberpunk` |
| 变体 | `cyberpunk` |
| 一句话 | 暗底上只留两束荧光，信息以终端行的形态逐条抵达，层级靠辉光而不是油墨 |
| 最适合 | 游戏与娱乐产品、活动页、开发者工具的宣传页、音乐/影像类展示 |
| 不适合 | **正文阅读与数据密集场景**——长文本、报表、多列表单、设置页；这些页面需要稳定的底色与无干扰的字形 |
| 主要代价 | 可读性天然受损：辉光会侵蚀字形边缘，等宽字在小字号下字距变宽，且"廉价感"与"风格"之间只差一次配色失误 |

## 签名特征（3–5 条，缺一不可）

1. **主模式的底色必须暗到 L ≤ 0.18**，且中性色带蓝紫（H 275–290），不是中性黑。浅色模式是同一套语言的"打印态"，不是主形态。
2. **两个荧光色**：主青（H 185–195）与次品红（H 320–335）。两者只用于描边、文字高亮、细线与辉光，不用于大面积填充。
3. **等宽字是正文，不是代码块的例外**。数字、标签、导航一律等宽；比例字只出现在大标题里。
4. **辉光是 `text-shadow` / `box-shadow` 的彩色扩散**，不是渐变。每个荧光元素最多两层辉光，第三层开始读成"糊"。
5. **结构性装饰只有两种**：1px 扫描线（重复线性渐变）与切角（`clip-path`）。不再加第三样。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 280 / C 0.020（蓝紫黑；纯中性黑会让荧光显得脏） |
| 彩度上限 | C ≤ 0.190；荧光色 2 个（青 + 品红），其余全部低彩 |
| 圆角 | `--r-sm` 0 · `--r-md` 2 · `--r-lg` 4 · `--r-full` 999（切角用 `clip-path`，圆角近乎为零） |
| 边框 | 1px solid，颜色用荧光或 `--line-1`；输入框内环 `--line-inset`（荧光版用 accent 55%）；悬停时边框换荧光并加 1 层辉光 |
| 阴影 | `--shadow-1` 0 0 8px 荧光/.35 · `--shadow-2` 0 0 18px /.30 · `--shadow-3` 0 8px 32px -8px 黑/.8 |
| 字重 | 浅色 400 / 600 / 700 · 暗色 350 / 550 / 650；等宽字体在暗底上会更"细"，不能继续降 |
| 动效 | 100–180ms `steps(2)` 或 `linear`；允许循环闪烁（≤ 1.2Hz），必须在 reduced-motion 下关闭 |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#EBF4F4` · `oklch(0.960 0.010 200)` | `#080912` · `oklch(0.145 0.020 280)` |
| surface-1 | `#E6EFEF` · `oklch(0.945 0.010 200)` | `#0D0E18` · `oklch(0.168 0.020 280)` |
| surface-2 | `#E0E9EA` · `oklch(0.928 0.010 200)` | `#12131D` · `oklch(0.192 0.020 280)` |
| surface-3 | `#D9E3E3` · `oklch(0.908 0.010 200)` | `#181923` · `oklch(0.217 0.020 280)` |
| fg | `#181928` · `oklch(0.220 0.030 280)` | `#E0F3F1` · `oklch(0.950 0.020 190)` |
| fg-muted | `#4B4E6D` · `oklch(0.435 0.050 280)` | `#9BBFC6` · `oklch(0.780 0.040 210)` |
| accent | `#A1319B` · `oklch(0.520 0.190 330)` | `#40EBE3` · `oklch(0.855 0.135 190)` |
| line-1 | `#5CAEB2` · `oklch(0.700 0.080 200)` | `#59417E` · `oklch(0.430 0.100 300)` |

- 表面 ΔL（浅）：bg→s1 **0.015** · s1→s2 **0.017** · s2→s3 **0.020**；（暗）0.023 / 0.024 / 0.025
- 对比度（浅）：`fg/bg` 15.5:1 · `fg-muted/bg` 7.2:1 · `accent/bg` 5.5:1
- 对比度（暗）：`fg/bg` 17.3:1 · `fg-muted/bg` 10.0:1 · `accent/bg` 13.4:1

**浅色是"褪色的终端"而不是纯白**：浅色模式保留青灰底与紫色文字，模拟纸张打印的终端截屏。不要把浅色做成白色 + 荧光——荧光在亮底上会直接掉到 2:1 以下。

**强调色按模式互换角色**：暗色用青做主荧光（13.4:1），浅色用品红（5.5:1）。因为浅底上青色荧光会发灰，而暗底上品红会发闷。

## 标志性 CSS

**1 · Token 覆盖**

```css
/* 与其余变体同一约定：基础块 = 浅色，[data-theme="dark"] = 暗色 */
:root[data-style="cyberpunk"] {
  --bg: oklch(0.960 0.010 200);
  --surface-1: oklch(0.945 0.010 200);
  --surface-2: oklch(0.928 0.010 200);
  --surface-3: oklch(0.908 0.010 200);
  --fg: oklch(0.220 0.030 280);
  --fg-muted: oklch(0.435 0.050 280);
  --accent: oklch(0.520 0.190 330);       /* 浅底上用品红 */
  --line-1: oklch(0.700 0.080 200);

  --cy-cyan: oklch(0.560 0.110 195);      /* 局部变量：浅底上的次色，不做文字 */
  --cy-magenta: oklch(0.520 0.190 330);

  --r-sm: 0px; --r-md: 2px; --r-lg: 4px; --r-full: 999px;

  --shadow-1: 0 0 8px color-mix(in oklab, var(--accent) 28%, transparent);
  --shadow-2: 0 0 18px color-mix(in oklab, var(--accent) 24%, transparent);
  --shadow-3: 0 8px 32px -8px rgb(0 0 0 / .35);

  --fw-body: 400; --fw-strong: 550; --fw-display: 650;
  --dur-fast: 100ms; --dur-base: 140ms; --dur-slow: 180ms;
}
:root[data-style="cyberpunk"][data-theme="dark"] {
  --bg: oklch(0.145 0.020 280);
  --surface-1: oklch(0.168 0.020 280);
  --surface-2: oklch(0.192 0.020 280);
  --surface-3: oklch(0.217 0.020 280);
  --fg: oklch(0.950 0.020 190);
  --fg-muted: oklch(0.780 0.040 210);
  --accent: oklch(0.855 0.135 190);       /* 暗底上换主荧光青 */
  --line-1: oklch(0.430 0.100 300);
  --cy-cyan: oklch(0.855 0.135 190);
  --cy-magenta: oklch(0.640 0.210 330);
  --shadow-3: 0 8px 32px -8px rgb(0 0 0 / .80);
  --fw-body: 350; --fw-strong: 500; --fw-display: 600;
}
/* 验收：暗色下 bg 的 L ≤ 0.18；浅色下 accent 与 bg 对比 ≥ 4.5:1 且无辉光 */
```

**2 · 两层辉光，不超过两层**

```css
.glow-text {
  color: var(--accent);
  text-shadow:
    0 0 1px color-mix(in oklab, var(--accent) 80%, transparent),
    0 0 12px color-mix(in oklab, var(--accent) 35%, transparent);
}
/* 第三层辉光开始，字形内孔会被填满，小字号直接不可读 */
/* 验收：任一元素上 text-shadow 的层数 ≤ 2 */
```

**3 · 扫描线：唯一的背景纹理**

```css
.scanlines::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgb(255 255 255 / .035) 0 1px,
    transparent 1px 3px
  );
  mix-blend-mode: overlay;
}
/* 验收：扫描线不覆盖交互层（pointer-events: none），且暗色下 alpha ≤ .04 */
```

**4 · 切角代替圆角**

```css
.panel {
  background: var(--surface-1);
  border: 1px solid var(--line-1);
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
}
/* 注意：clip-path 会裁掉 box-shadow 的外发光，需要面板外层再加一层 wrapper */
/* 验收：切角尺寸为 12px 或 8px，全站一致，不出现第三种 */
```

**5 · 等宽正文 + 宽松字距**

```css
body, .term {
  font-family: ui-monospace, "JetBrains Mono", "Sarasa Mono SC", monospace;
  font-size: var(--fs-md);
  letter-spacing: 0.02em;                 /* 等宽字在暗底上需要一点缝才不粘连 */
  line-height: 1.7;
  font-variant-numeric: tabular-nums slashed-zero;
}
/* 验收：正文 computed font-family 的首项为等宽族；计时器无位移 */
```

**6 · 必做：reduced-motion 与对比度兜底**

```css
@keyframes flicker { 0%, 100% { opacity: 1 } 50% { opacity: .72 } }
.term-cursor { animation: flicker 1.1s steps(2) infinite; }

@media (prefers-reduced-motion: reduce) {
  .term-cursor, [class*="glitch"] { animation: none; }
  .scanlines::before { display: none; }
}
@media (prefers-contrast: more) {
  .glow-text { text-shadow: none; }        /* 辉光在提高对比度时先被牺牲 */
  .panel { border-color: var(--fg); }
}
/* 验收：reduced-motion 下无循环动画；prefers-contrast: more 下辉光全部移除 */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 大段正文（> 3 行）用辉光字 | 辉光是围绕字形的低透明度像素，经过 3 行以上累积后行间空隙被填满，字距与行距的区分消失 |
| 三种以上荧光色 | 荧光的光谱窄，多一种就有一对相邻色相互相"污染"；两色是视觉可分辨与"电子感"的平衡点 |
| 在浅色底上用青色荧光 | 亮底上青色的相对亮度接近背景，对比度掉到 2:1；浅色模式必须换品红并取消辉光 |
| 全屏扫描线 + 全屏噪点 + 全屏 glitch | 三者叠加会持续触发重绘，低端设备掉帧，且在动画期间文字完全不可读 |
| 高饱和渐变做背景 | 渐变会与辉光的柔和边缘融合，最终读成"紫色雾"，而不是"荧光" |
| 正文小于 13px | 等宽字 + 辉光在小字号下笔画粘连，`i` / `l` / `1` 无法区分 |
| 用 `filter: drop-shadow` 做文字辉光 | 它会同时作用于子元素与伪元素，且无法分别控制内层锐边与外层扩散 |

## 验收：怎么判断这个风格做对了

- [ ] 暗色 `bg` 的 OKLCH L ≤ 0.18，且 H 落在 275–290
- [ ] 荧光色恰好 2 个，每个元素上的辉光层数 ≤ 2
- [ ] 正文使用等宽字族，`font-variant-numeric: tabular-nums` 生效
- [ ] 浅色模式下辉光全部关闭或降到不影响对比度的程度
- [ ] `prefers-reduced-motion` 下没有循环动画与扫描线
- [ ] 扫描线层 `pointer-events: none`，不拦截任何点击
- [ ] 所有正文对比度 ≥ 4.5:1（在**已叠加扫描线**的实际像素上采样）
- [ ] 切角尺寸全站一致，只有一种
- [ ] 弹窗 / 下拉使用 `--shadow-3`（黑色单向投影），而不是荧光扩散

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 把它当"暗色模式"用 | 赛博朋克是有主张的暗色，不是主题开关；把普通后台切到暗色再调成青色不构成这个风格 |
| 页面塞满"glitch""404""ACCESS DENIED"装饰 | 这些是叙事层内容，不是视觉系统；内容一多就从"氛围"变成"素材堆" |
| 用赛博朋克承载数据报表 | **明确不适合**：荧光 + 扫描线 + 等宽字三重干扰下，数值比较与列对齐的认知成本翻倍 |
| 只做暗色，不做浅色 | 打印、无障碍高对比模式、部分企业环境需要浅色；浅色是"终端截屏"而不是"白底荧光" |
| 所有元素都发光 | 辉光的语义是"这一处重要"；全页发光等于全页没有重点，且性能与可读性双输 |
