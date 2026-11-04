# 赛博朋克

> 蓝紫黑底上的一台荧光显像管、一张印刷的终端样张——同一套语言，两种载体。

## 元信息

| 项 | 值 |
|---|---|
| id | `cyberpunk` |
| 变体 | `cyberpunk` |
| 一句话 | 荧光只走描边与高光，网格、扫描线、切角把界面钉成一台运行中的终端 |
| 最适合 | 游戏与娱乐产品、活动页、开发者工具的宣传页、音乐/影像类展示 |
| 不适合 | **正文阅读与数据密集场景**——长文本、报表、多列表单、设置页；这些页面需要稳定的底色与无干扰的字形 |
| 主要代价 | 两种载体各有各的失效方式：屏幕态辉光侵蚀字形边缘，印刷态网点与细字互相干扰；"廉价感"与"风格"之间只差一次配色失误 |

## 签名特征（3–5 条，缺一不可）

1. **两种载体，一套语言**。屏幕态（暗色）是主形态，`--bg` L ≤ 0.18、中性色带蓝紫（H 285–295，C 0.028）；印刷态（浅色）是同一套语言的纸上版本——半调网点、实心墨块、套准角标。两者共用同一组荧光色相与同一套等宽排版，不是"深色主题的反色"。
2. **两个荧光色，品红做主**：主荧光品红（H 320–335，暗底上 C ≥ 0.23）与副荧光青（H 190–200），只用于描边、高亮、细线与辉光，不做大面积填充。暗色下品红做主、青做通道分离；浅色下品红做墨、青做套印副版。**品红的彩度不能省**：L 0.72 时色域上限是 C 0.286，低于 0.20 就会在暗底上读成"紫灰"——那是紫色主题，不是霓虹。
3. **等宽字是正文，不是代码块的例外**。数字、标签、导航一律等宽；`font-variant-numeric: tabular-nums slashed-zero` 必须生效。
4. **辉光是 `text-shadow` / `box-shadow` 的彩色扩散**，不是渐变。每个元素最多两层；屏幕态只给"活跃"元素（悬停、焦点、当前项）发光，其余一律描边。
5. **结构性装饰按载体分工**：屏幕态是 3px 扫描线 + 40px 网格 + 切角 + 终端角标；印刷态是 5px 半调网点 + 实心墨条 + 套准十字。各自只有四样，不混用。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | 屏幕 H 290 / C 0.028（蓝紫黑；浓度低了品红像贴在纯黑上的贴纸）；印刷 H 200 / C 0.010（米青纸） |
| 彩度上限 | 荧光色 2 个（品红 C ≤ 0.26 + 青 C ≤ 0.15），其余全部低彩；品红必须接近色域上限 |
| 圆角 | `--r-sm` 0 · `--r-md` 2 · `--r-lg` 4 · `--r-full` 999；屏幕态切角用 `clip-path` / `corner-shape: bevel`，印刷态一律直角 |
| 边框 | 屏幕 1px `--line-1`，悬停换荧光；印刷 1px `--fg` 墨线 + 3px 套印偏移；输入框印刷态是 2px 实心墨框（R4 B 类） |
| 阴影 | 屏幕 8/18px 荧光扩散 + `--shadow-3` 黑投影；印刷 `--shadow-1` 0 1px 0 墨/.32 · `--shadow-2` 0 2px 0 墨/.40 · `--shadow-3` 同上浮层 |
| 字重 | 浅色 400 / 600 / 700 · 暗色 350 / 550 / 650；等宽字体在暗底上更"细"，不能继续降 |
| 字族 | 正文与标题都是 `"Cascadia Mono", "Cascadia Code", "SF Mono", Consolas, "Sarasa Mono SC", monospace`；中文落等线/雅黑 |
| 类型比例 | `11 / 12 / 14 / 17 / 22 / 30 / 40`；`--lh-tight` 1.08 · `--lh-snug` 1.32 · `--lh-body` 1.72；正文 `+0.02em`，小标签 `+0.12em` |
| 排版骨架 | 单列宽屏：统计卡 2×2，主分栏取消、两个区块上下叠成日志流；顶栏 48px、侧栏 192px |
| 动效 | 100–180ms `steps(2)` / `linear`；状态点 ≤ 1.2Hz 脉冲，扫描带 9s 一次；全部在 reduced-motion 下关闭 |

## 典型配色

| 角色 | 浅色（印刷态） | 暗色（屏幕态） |
|---|---|---|
| bg | `#EBF4F4` · `oklch(0.960 0.010 200)` | `#0A0815` · `oklch(0.145 0.028 290)` |
| surface-1 | `#E6EFEF` · `oklch(0.945 0.010 200)` | `#0F0D1A` · `oklch(0.168 0.028 290)` |
| surface-2 | `#E0E9EA` · `oklch(0.928 0.010 200)` | `#141220` · `oklch(0.192 0.028 290)` |
| surface-3 | `#D9E3E3` · `oklch(0.908 0.010 200)` | `#1A1826` · `oklch(0.217 0.028 290)` |
| fg | `#181928` · `oklch(0.220 0.030 280)` | `#E0F3F1` · `oklch(0.950 0.020 190)` |
| fg-muted | `#4B4E6D` · `oklch(0.435 0.050 280)` | `#9BBFC6` · `oklch(0.780 0.040 210)` |
| accent | `#AB0FA5` · `oklch(0.520 0.230 330)` | `#F852F0` · `oklch(0.720 0.260 330)` |
| accent-2 | `#017272` · `oklch(0.500 0.085 195)` | `#20F1F2` · `oklch(0.870 0.145 195)` |
| line-1 | `#5CAEB2` · `oklch(0.700 0.080 200)` | `#7E4D8A` · `oklch(0.500 0.110 320)` |

- 表面 ΔL（浅）：bg→s1 **0.015** · s1→s2 **0.017** · s2→s3 **0.020**；（暗）0.023 / 0.024 / 0.025
- 对比度（浅）：`fg/bg` 15.5:1 · `fg-muted/bg` 7.2:1 · `accent/bg` 5.6:1；（暗）17.3 / 10.1 / 7.0
- 叠加纹理后的有效对比度：暗色扫描线下 `fg-muted/bg` **9.1:1**；浅色网点下 `fg-muted/bg` **5.2:1**（正文更低，均 ≥ 4.5）

**浅色是"印刷的终端"而不是纯白后台**：米青纸底、深紫墨字、半调网点、实心墨块、四角套准标。不要做成白色 + 荧光——荧光在亮底上掉到 2:1 以下，纸也不会发光。**两个荧光色在两种载体里角色不变**：品红始终是主色（暗 7.0:1 / 浅 5.6:1），青始终是副光——浅底上青做不了主（相对亮度接近纸，掉到 2:1），暗底上青做主又会把品红挤成装饰。

### 状态色

| 角色 | 浅色（印刷） | 暗色（屏幕） | 说明 |
|---|---|---|---|
| danger | `#B32322` · `oklch(0.500 0.180 27)` | `#FF655A` · `oklch(0.700 0.190 27)` | 朱红，H 27；不能用品红——主色现在就是品红 |
| danger-hover | `#A20711` · `oklch(0.450 0.180 27)` | `#FE8C80` · `oklch(0.760 0.140 27)` | |
| on-danger | `#EBF4F4` · `oklch(0.960 0.010 200)` | `#0A0815` · `oklch(0.145 0.028 290)` | 印刷态用纸色，不用纯白 |
| success | `#2C6C47` · `oklch(0.480 0.090 155)` | `#06EDE4` · `oklch(0.854 0.140 190)` | 暗色回落主青（副光），浅色换青绿避开与主色同区 |
| warning | `#805A01` · `oklch(0.494 0.102 80)` | `#FCC564` · `oklch(0.854 0.130 80)` | 荧光黄，第三档 |

**danger 必须与主色不同色相。** 早先 danger 直接复用主色（品红），当时主色是青，所以分得开；现在主色是品红，继续复用的话"这是主按钮"和"这里出错了"就成了同一个颜色。状态色不新增装饰色相：danger 用朱红、success 用青绿/青、warning 用荧光黄，只在状态上出现。

## 标志性 CSS

**1 · Token 覆盖：基础块 = 印刷态，暗色块 = 屏幕态**

```css
/* 基础块 = 浅色（与其余变体同一约定）；暗色块才是本卡的主形态 */
:root[data-style="cyberpunk"] {
  color-scheme: light;
  --bg: oklch(0.960 0.010 200);          /* 米青纸 */ --fg: oklch(0.220 0.030 280);  /* 深紫墨 */
  --accent: oklch(0.520 0.230 330);      /* 品红墨 */   --accent-2: oklch(0.500 0.085 195); /* 青墨 */
  --on-accent: oklch(0.960 0.010 200);   /* 实心墨块上的字用纸色 */
  --surface-1: oklch(0.945 0.010 200); --surface-2: oklch(0.928 0.010 200);
  --surface-3: oklch(0.908 0.010 200); --fg-muted: oklch(0.435 0.050 280);
  --line-1: oklch(0.700 0.080 200);
  --r-sm: 0px; --r-md: 0px; --r-lg: 0px; --r-full: 999px;
  --shadow-1: 0 1px 0 color-mix(in oklab, var(--fg) 32%, transparent);
  --shadow-2: 0 2px 0 color-mix(in oklab, var(--fg) 40%, transparent);
  --shadow-3: 0 8px 24px -8px rgb(0 0 0 / .40);
  --fw-body: 400; --fw-strong: 600; --fw-display: 700;
}
:root[data-style="cyberpunk"][data-theme="dark"] {
  color-scheme: dark;
  --bg: oklch(0.145 0.028 290);          /* L 0.145 ≤ 0.18，H 290 蓝紫黑 */
  --surface-1: oklch(0.168 0.028 290); --surface-2: oklch(0.192 0.028 290);
  --surface-3: oklch(0.217 0.028 290); --fg: oklch(0.950 0.020 190);
  --fg-muted: oklch(0.780 0.040 210); --line-1: oklch(0.520 0.120 320);
  --accent: oklch(0.720 0.260 330);      /* 主荧光品红，C 顶到色域上限附近 */
  --accent-2: oklch(0.870 0.145 195);    /* 副荧光青，只做通道分离 */
  --fw-body: 350; --fw-strong: 550; --fw-display: 650;
}
/* 验收：暗色 bg 的 L ≤ 0.18 且 H ∈ 285–295；accent 的 C ≥ 0.23；
   浅色 accent/bg ≥ 4.5:1 且无辉光 */
```

**2 · 扫描线、扫描带与网格：屏幕态的三层纹理**

```css
/* 页面底：40px 网格，随 accent 变色 */
[data-theme="dark"] body {
  background-image:
    linear-gradient(to right,  color-mix(in oklab, var(--accent) 7%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklab, var(--accent) 7%, transparent) 1px, transparent 1px);
  background-size: 40px 40px; background-attachment: fixed;
}
/* 静态扫描线：3px 周期、1px 亮线、alpha .035，覆盖整屏且不拦点击 */
[data-theme="dark"] body::before {
  content: ""; position: fixed; inset: 0; z-index: 999; pointer-events: none;
  background: repeating-linear-gradient(to bottom,
    transparent 0 2px, rgb(255 255 255 / .035) 2px 3px);
}
/* 扫描带：22vh 高的高光，9s 一次自上而下扫过——"正在运行"的那一层 */
[data-theme="dark"] body::after {
  content: ""; position: fixed; left: 0; right: 0; top: 0; height: 22vh;
  z-index: 999; pointer-events: none;
  background: linear-gradient(to bottom, transparent 0,
    color-mix(in oklab, var(--accent) 5%, transparent) 60%,
    color-mix(in oklab, var(--accent) 8%, transparent) 88%, transparent 100%);
  animation: cyber-scan 9s linear infinite;
}
@keyframes cyber-scan {
  from { transform: translateY(-25vh); } to { transform: translateY(115vh); }
}
/* 验收：扫描线 alpha = .035；reduced-motion 下 ::after 的 animation 为 none */
```

**3 · 切角 + 终端角标：屏幕态的容器语言**

```css
/* 切角只属于屏幕：底线用 clip-path，Chrome 139+ 换成 corner-shape（外发光不被裁） */
[data-theme="dark"] .card, [data-theme="dark"] .stat {
  --cut: 18px; position: relative; border-radius: 0;
  clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut),
    100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
}
@supports (corner-shape: bevel) {
  [data-theme="dark"] .card, [data-theme="dark"] .stat {
    clip-path: none; border-radius: 0 var(--cut) 0 var(--cut); corner-shape: bevel; }
}
/* 终端角标：左上 ┌、右下 ┘，两条边，不参与布局、不拦点击 */
.card::before, .card::after {
  content: ""; position: absolute; width: 10px; height: 10px;
  pointer-events: none; color: color-mix(in oklab, var(--accent) 55%, transparent); }
.card::before { top: 6px; left: 6px; border-top: 1px solid currentColor; border-left: 1px solid currentColor; }
.card::after  { right: 6px; bottom: 6px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; }
/* 验收：暗色 border-radius 在 @supports 分支里是 0 18px 的斜角；角标 pointer-events: none */
```

**4 · 通道分离 + 辉光：只给标题、焦点与活跃元素**

```css
/* 大标题：品红右偏 2px、青左偏 2px。14px 正文上同样的偏移会直接糊成重影 */
[data-theme="dark"] .view-head h1 {
  text-shadow:
     2px 0 color-mix(in oklab, var(--accent-2) 85%, transparent),
    -2px 0 color-mix(in oklab, var(--accent) 85%, transparent);
}
/* 按钮焦点：文字分离收到 1px（11px 等宽字）；焦点环走 inset，
   因为按钮被 clip-path 裁过，外扩的 outline 会被一起裁掉 */
[data-theme="dark"] .btn:focus-visible .btn__label {
  text-shadow: 1px 0 var(--accent-2), -1px 0 var(--accent);
}
.btn:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--accent); }
/* 卡片常驻极淡描边不发光；发光 = "这一处现在可操作" */
[data-theme="dark"] .card {
  border: 1px solid color-mix(in oklab, var(--line-1) 80%, var(--accent) 20%);
  box-shadow: 0 0 28px -18px color-mix(in oklab, var(--accent) 70%, transparent);
}
[data-theme="dark"] .card:hover, [data-theme="dark"] .card:focus-within {
  border-color: color-mix(in oklab, var(--accent) 65%, var(--line-1) 35%);
  box-shadow: 0 0 24px -8px color-mix(in oklab, var(--accent) 45%, transparent),
              inset 0 0 24px -18px color-mix(in oklab, var(--accent) 50%, transparent);
}
/* 验收：h1 的 text-shadow 有两层、颜色不同且 X 偏移异号；正文 text-shadow 为 none；
   同一时刻发光的卡片 ≤ 1 张 */
```

**5 · 印刷态：半调网点、实心墨块、套准角标**

```css
/* 网点属于"露出来的纸"：铺在 body 背景层，卡片是压在纸上的实心墨，自然盖住它 */
body {
  background-image: radial-gradient(circle at center,
    color-mix(in oklab, var(--fg) 16%, transparent) 1.1px, transparent 1.15px);
  background-size: 5px 5px; background-attachment: fixed;
}
/* 主按钮：实心品红墨块 + 3px 套印偏移，不是描边 */
.btn[data-variant="primary"] {
  background: var(--accent); border-color: var(--accent);
  color: var(--on-accent); box-shadow: 3px 3px 0 var(--fg);
}
/* 卡头：实心墨条 + 反白标题；指标卡用 stat__label 做同一条墨条 */
.card > .card__head {
  margin: calc(var(--s-5) * -1) calc(var(--s-5) * -1) var(--s-2);
  padding: var(--s-2) var(--s-5); background: var(--fg); color: var(--bg);
}
/* 提示：浅色 body 一旦有 background-image，field-control 就必须走 R4 的
   B 类（≥2px 实心边框 + 外投影），不能用「底色更深」的 D 类兜底 */
/* 验收：浅色 body background-image 含 radial-gradient 且 background-size 为 5px；
   primary 按钮 background 为实心 accent、box-shadow 含 3px 3px 0 */
```

**6 · 必做：reduced-motion、对比度与降级**

```css
@media (prefers-reduced-motion: reduce) {
  .dot { animation: none !important; }
  body::after { animation: none !important; opacity: 0 !important; }
}
@media (prefers-contrast: more) {
  body::before, body::after { display: none; }   /* 纹理先被牺牲 */
  .view-head h1 { text-shadow: none; }           /* 然后是通道分离 */
  .card, .stat { border-color: var(--fg); }
}
@media (forced-colors: active) {
  .card, .surface, .stat, .btn { clip-path: none; border: 1px solid CanvasText !important; }
}
/* 验收：reduced-motion 下扫描带 animation 为 none 且 opacity 为 0；
   prefers-contrast: more 下 h1 text-shadow 为 none、body::before 的 display 为 none */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 正文使用通道分离 / 辉光字 | 2px 的色彩偏移在 14px 等宽字上会与笔画宽度同量级，`i` / `l` / `1` 直接不可辨；正文只用一个颜色 |
| 三种以上荧光色 | 荧光的光谱窄，多一种就有一对相邻色相互相"污染"；两色是视觉可分辨与"电子感"的平衡点 |
| 在浅色底上用青色荧光 | 亮底上青色的相对亮度接近背景，对比度掉到 2:1；浅色模式必须换品红并取消辉光 |
| 全屏扫描线 + 全屏噪点 + 全屏 glitch | 三者叠加会持续触发重绘，低端设备掉帧，且在动画期间文字完全不可读 |
| 高饱和渐变做背景 | 渐变会与辉光的柔和边缘融合，最终读成"紫色雾"，而不是"荧光" |
| 正文小于 13px | 等宽字 + 辉光在小字号下笔画粘连，`i` / `l` / `1` 无法区分 |
| 印刷态使用切角或辉光 | 切角是显像管切掉管角的结果，纸没有管角；发光是屏幕行为，纸不会发光——两者都会立刻暴露"假印刷" |
| 用 `filter: drop-shadow` 做文字辉光 | 它同时作用于子元素与伪元素，无法分别控制内层锐边与外层扩散 |

## 验收：怎么判断这个风格做对了

- [ ] 暗色 `bg` 的 OKLCH L ≤ 0.18，且 H 落在 285–295；主色 `accent` 的 C ≥ 0.23（品红必须够艳，否则读成紫灰）
- [ ] 暗色 `body::before` 的 computed `background-image` 含 `repeating-linear-gradient`，透明层 alpha ≥ 0.025
- [ ] 暗色至少一个元素（`h1`）的 `text-shadow` 有两层、X 偏移异号、颜色不同；正文 `text-shadow` 为 `none`
- [ ] 暗色 `body::after` 的 `animation-name` 为 `cyber-scan`，`prefers-reduced-motion` 下变为 `none`
- [ ] 正文 `fg/bg`、`fg-muted/bg` 对比度 ≥ 4.5:1，且在**已叠加扫描线 / 网点**的实际像素上采样仍达标
- [ ] 浅色 `body` 的 `background-image` 含 `radial-gradient`，`background-size` 为 5px；`body::before` 的 `content` 为 `none`
- [ ] 浅色没有切角（`clip-path: none`）也没有辉光（所有 shadow 的 blur 为 0）
- [ ] 切角在暗色下只有一种尺寸（`--cut: 18px`），全站一致
- [ ] 正文 computed `font-family` 首项是 Cascadia Mono / SF Mono 一类等宽族，`tabular-nums` 生效
- [ ] 正文字距 `+0.02em`，小标签 `+0.12em`；`--lh-body` = 1.72
- [ ] 扫描层 `pointer-events: none`，不拦截任何点击
- [ ] 弹窗 / 下拉使用 `--shadow-3`（黑色单向投影），而不是荧光扩散

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 把它当"暗色模式"用 | 赛博朋克是有主张的暗色，不是主题开关；把普通后台切到暗色再调出一支青色不构成这个风格 |
| 浅色做成"白色 + 荧光" | 荧光在亮底上掉到 2:1，且丢失"纸"这个载体；浅色必须是米青纸 + 深紫墨 + 半调网点 + 实心墨块 |
| 品红只给描边、主色留给青 | 霓虹的主体是品红。把品红降成 C 0.18 的"紫灰"只做通道分离，页面就退回普通暗色主题——彩度是这支风格的载体，不是可选项 |
| 浅色直接复用暗色的结构装饰 | 切角、扫描线、外发光都是屏幕的物理属性；纸上要换成套准标、网点、硬边套印偏移，否则是"深色主题换了底色" |
| 页面塞满"glitch""404""ACCESS DENIED"装饰 | 这些是叙事层内容，不是视觉系统；内容一多就从"氛围"变成"素材堆" |
| 用赛博朋克承载数据报表 | **明确不适合**：荧光 + 扫描线 + 等宽字三重干扰下，数值比较与列对齐的认知成本翻倍 |
| 所有元素都发光 | 辉光的语义是"这一处重要"；全页发光等于全页没有重点，且性能与可读性双输 |
