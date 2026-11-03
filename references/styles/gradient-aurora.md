# 渐变 · 弥散光

> 大块柔光色斑在页面上缓慢游动，内容浮在光之上而不是贴在纸之上。

## 元信息

| 项 | 值 |
|---|---|
| id | `gradient-aurora` |
| 变体 | `gradient-aurora` |
| 一句话 | 用十几团失焦的冷色光分四层铺出氛围底，前景表面半透，让内容成为光里的实体 |
| 最适合 | 品牌首页、AI 产品与生成类工具、发布页、需要在 3 秒内建立"贵"的印象的落地页 |
| 不适合 | 长文档、数据密集后台、需要长时间阅读的界面；色斑会持续争夺注意力并干扰表格对齐 |
| 主要代价 | 背景抢戏：色斑的动态范围一大，文字就得靠半透卡托住；而实色卡一多，弥散光就只剩边角 |

## 签名特征（3–5 条，缺一不可）

1. **背景由多团径向渐变色斑分四层叠成**：合计 13 团，每层 2–5 团，尺寸与长宽比各不相同（最长 84vmax、最短 10vmax），边缘必须完全失焦（无可见圆边），且不能读成"几个大圆"。
2. **四层各有自己的失焦半径与不透明度**：远雾 150px / 0.20、中雾 68px / 0.40、光核 44px / 0.55、提亮 110px / 0.60。深度差靠"层不透明度"表达，不靠单团色标 alpha。
3. **前景表面是半透明白**（`color-mix` 后再叠背景），让色斑透上来一点点——完全不透就失去风格，太透就丢对比度。
4. **色相只走冷调**：紫 300 → 靛 268 → 蓝 238 → 青 205 → 淡紫 322，跨度 125° 且不跨过黄与红；暖色斑会让整页读成"营销模板"。
5. **暗色用 `screen` 叠加并单独抬高不透明度**：不是把浅色压暗，而是重新选的一组"暗而饱和"的色斑，在深底上相加成光。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 300 / C 0.012（浅紫中性；比纯灰更有"光感"，但 C 不能更高否则表面发脏） |
| 彩度上限 | 表面与文字 C ≤ 0.03；色斑本身浅色 C 0.070–0.105、暗色 C 0.092–0.190（受 sRGB 色域限制，见下） |
| 圆角 | `--r-sm` 10 · `--r-md` 16 · `--r-lg` 24 · `--r-full` 999（大圆角配合大色斑，形状语言统一为"软"） |
| 边框 | 不描边：靠 `inset 0 1px 0 rgb(255 255 255 / .62)` 的顶光 + `inset 0 0 0 1px accent 10%` 的彩色内环；输入框另给 `--line-inset` |
| 阴影 | `--shadow-1` 0 1px 2px -1px / .06 · `--shadow-2` 0 8px 24px -12px / .16 · `--shadow-3` 0 24px 64px -24px / .28 |
| 字重 | 浅色 400 / 500 / 600 · 暗色 350 / 450 / 550；display 建议 600，不做 800 |
| 字族 | 标题细衬线 `"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Songti SC", serif`；正文 `"Gill Sans MT", "Gill Sans", "Segoe UI", "PingFang SC"` |
| 类型比例 | `12 / 14 / 16 / 19 / 26 / 38 / 50`；`--lh-tight` 1.06 · `--lh-snug` 1.38 · `--lh-body` 1.75（海报上的段落）；标题字距 `-0.01em`，eyebrow `+0.14em` |
| 排版骨架 | 窄栏 208 + 居中窄幅（`--content-max` 1040）；统计卡 2×2，主分栏取消为单列，让色斑从两侧露出来 |
| 动效 | 240–360ms `cubic-bezier(.2,.7,.2,1)`；背景四层各 43–61s 线性循环，reduced-motion 下完全静止 |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#F8F5FE` · `oklch(0.975 0.012 300)` | `#0C0B1A` · `oklch(0.160 0.030 285)` |
| surface-1 | `#F2EFF8` · `oklch(0.958 0.012 300)` | `#11111F` · `oklch(0.185 0.030 285)` |
| surface-2 | `#EBE9F2` · `oklch(0.938 0.012 300)` | `#161625` · `oklch(0.208 0.030 285)` |
| surface-3 | `#E4E2EA` · `oklch(0.916 0.012 300)` | `#1C1C2B` · `oklch(0.233 0.030 285)` |
| fg | `#1F1D2D` · `oklch(0.240 0.030 290)` | `#EBEAF5` · `oklch(0.940 0.015 290)` |
| fg-muted | `#595769` · `oklch(0.465 0.030 290)` | `#A7A6B4` · `oklch(0.730 0.020 290)` |
| accent | `#8053C0` · `oklch(0.545 0.165 300)` | `#E4A0F4` · `oklch(0.800 0.135 320)` |
| line-1 | `#E0DBEA` · `oklch(0.900 0.020 300)` | `#343344` · `oklch(0.330 0.030 285)` |

- 表面 ΔL（浅）：bg→s1 **0.017** · s1→s2 **0.020** · s2→s3 **0.022**；（暗）0.025 / 0.023 / 0.025
- 对比度（浅）：`fg/bg` 15.4:1 · `fg-muted/bg` 6.5:1 · `accent/bg` 5.0:1
- 对比度（暗）：`fg/bg` 16.3:1 · `fg-muted/bg` 8.1:1 · `accent/bg` 9.9:1

**色斑的五色 + 一枚提亮核心（局部变量，不进 token 表）**：

| 名称 | 浅色 | 暗色 | 用在 |
|---|---|---|---|
| `--aurora-violet` | `oklch(0.850 0.086 300)` · `#D7C3FF` | `oklch(0.540 0.190 300)` · `#824ACA` | 远雾左上、中雾左上、光核左缘 |
| `--aurora-indigo` | `oklch(0.855 0.070 268)` · `#BDCFFE` | `oklch(0.500 0.180 265)` · `#2F58C8` | 远雾右下、中雾左缘 |
| `--aurora-blue` | `oklch(0.865 0.074 238)` · `#A5DAFE` | `oklch(0.480 0.118 245)` · `#07629B` | 远雾中部、中雾顶边、提亮右侧 |
| `--aurora-cyan` | `oklch(0.870 0.105 205)` · `#77E8F5` | `oklch(0.550 0.092 210)` · `#10808F` | 中雾右下、光核右上 |
| `--aurora-lilac` | `oklch(0.895 0.078 322)` · `#F3CDFB` | `oklch(0.580 0.170 330)` · `#AF4DA9` | 中雾底边、光核底部 |
| `--aurora-glow` | `oklch(0.985 0.010 320)` · `#FDF8FE` | `oklch(0.600 0.160 320)` · `#A95CBB` | 提亮顶部那束天光 |

浅色下色斑要**亮而淡**（L 0.85–0.895），暗色下要**暗而饱和**（L 0.48–0.60）。直接把浅色色斑放到暗色背景上会变成几块发光的脏斑。

> **色域提醒（踩过的坑）**：sRGB 在蓝 / 青区域的彩度天花板远低于紫。`L 0.86 / H 268` 最多只能到 C 0.068，`L 0.48 / H 245` 最多 0.121，`L 0.55 / H 210` 最多 0.095。写出超界的 C 不会报错，只会被浏览器就地映射——看起来更灰、色相也漂了。上表的 C 都是按各自 (L, H) 的天花板取的安全值。

### 状态色

| 角色 | 浅色 | 暗色 | 说明 |
|---|---|---|---|
| danger | `#A83886` · `oklch(0.528 0.170 342)` | `#FF94D9` · `oklch(0.800 0.151 342)` | **紫红**，不是红 |
| danger-hover | `oklch(0.482 0.175 342)` | `oklch(0.850 0.139 342)` | |
| on-danger | `#FCFCFC` · `oklch(0.990 0 0)` | `oklch(0.160 0.030 285)` | |
| success | `#016E6E` · `oklch(0.488 0.083 195)` | `#00D8D9` · `oklch(0.800 0.137 195)` | 冷调青 |
| warning | `#345CC4` · `oklch(0.506 0.170 265)` | `#9EBDFF` · `oklch(0.800 0.100 265)` | **靛蓝**，不是黄 |

本卡与标准状态色冲突最大：「色相只走冷调，不跨过黄与红」。所以 danger 用紫红 H 342（落在紫→品红的冷侧，不进入橙红区间），success 用冷调另一端的青 H 195，warning 用靛蓝 H 265——「警告」的语义改由文案与形状承担，而不是黄。三种色相全部落在卡片声明的冷调区间内（342 为紫红的邻近延伸，仍在品红侧）。

## 标志性 CSS

**1 · Token 覆盖**

```css
:root[data-style="gradient-aurora"] {
  --bg: oklch(0.975 0.012 300);
  --surface-1: oklch(0.958 0.012 300);
  --surface-2: oklch(0.938 0.012 300);
  --surface-3: oklch(0.916 0.012 300);
  --fg: oklch(0.240 0.030 290);
  --fg-muted: oklch(0.465 0.030 290);
  --accent: oklch(0.545 0.165 300);
  --line-1: oklch(0.900 0.020 300);

  /* 色斑五色：L 0.85–0.895 / C 0.070–0.105，全部在 sRGB 内 */
  --aurora-violet: oklch(0.850 0.086 300);
  --aurora-indigo: oklch(0.855 0.070 268);
  --aurora-blue:   oklch(0.865 0.074 238);
  --aurora-cyan:   oklch(0.870 0.105 205);
  --aurora-lilac:  oklch(0.895 0.078 322);
  --aurora-glow:   oklch(0.985 0.010 320);   /* 提亮核心，不是色斑 */

  /* 四层各自的失焦半径 */
  --aurora-blur-far: 150px;
  --aurora-blur-mid: 68px;
  --aurora-blur-near: 44px;
  --aurora-blur-glow: 110px;

  /* 首屏「雾中空地」 */
  --text-scrim: color-mix(in oklab, var(--surface-1) 72%, transparent);

  --r-sm: 10px; --r-md: 16px; --r-lg: 24px; --r-full: 999px;

  --shadow-1: 0 1px 2px -1px rgb(60 30 90 / .06);
  --shadow-2: 0 8px 24px -12px rgb(60 30 90 / .16);
  --shadow-3: 0 24px 64px -24px rgb(60 30 90 / .28);

  --fw-body: 400; --fw-strong: 500; --fw-display: 600;
  --dur-base: 280ms; --dur-slow: 360ms;
  --ease-out: cubic-bezier(.2, .7, .2, 1);
}
:root[data-style="gradient-aurora"][data-theme="dark"] {
  --bg: oklch(0.160 0.030 285);
  --surface-1: oklch(0.185 0.030 285);
  --surface-2: oklch(0.208 0.030 285);
  --surface-3: oklch(0.233 0.030 285);
  --fg: oklch(0.940 0.015 290);
  --fg-muted: oklch(0.730 0.020 290);
  --accent: oklch(0.800 0.135 320);
  --line-1: oklch(0.330 0.030 285);

  /* 暗色不是把浅色压暗：L 0.48–0.60 / C 0.092–0.190 */
  --aurora-violet: oklch(0.540 0.190 300);
  --aurora-indigo: oklch(0.500 0.180 265);
  --aurora-blue:   oklch(0.480 0.118 245);
  --aurora-cyan:   oklch(0.550 0.092 210);
  --aurora-lilac:  oklch(0.580 0.170 330);
  --aurora-glow:   oklch(0.600 0.160 320);

  --text-scrim: color-mix(in oklab, var(--bg) 82%, transparent);
  --fw-body: 350; --fw-strong: 450; --fw-display: 550;
}
/* 验收：暗色色斑 L 在 0.48–0.60，浅色在 0.85–0.895；两组色相完全一致 */
```

**2 · 底色画在 `html` 上，`body` 必须透明**

```css
:root[data-style="gradient-aurora"]      { background: var(--bg); }
:root[data-style="gradient-aurora"] body { background: transparent; }
```

四层色斑都是 `z-index` 为负的固定伪元素。`body` 若自带不透明背景，它会在负 z 的伪元素之后绘制，把除 `html::before` 之外的整组光斑全盖掉——只剩最远的一层能看见。这个坑很隐蔽：背景「有颜色」但只剩一团光。

**3 · 四层色斑：13 团、4 种失焦半径**

```css
/* 伪元素统一 inset: 0；负 inset 会放大 radial-gradient 的百分比坐标，
   把色斑中心推出可视区，最后只剩四角偏暗的"脏"而不是光。 */

/* 远雾：3 团，blur 150px，层不透明度 0.20 */
:root[data-style="gradient-aurora"]::before {
  content: ""; position: fixed; inset: 0; z-index: -4;
  pointer-events: none;
  filter: blur(var(--aurora-blur-far));
  opacity: .20;
  transform: rotate(-6deg) scale(1.02);
  will-change: transform;
  background:
    radial-gradient(84vmax 68vmax at 8% 4%,   var(--aurora-violet), transparent 70%),
    radial-gradient(66vmax 58vmax at 98% 92%, var(--aurora-indigo), transparent 72%),
    radial-gradient(46vmax 34vmax at 52% 42%, var(--aurora-blue),   transparent 70%);
  animation: aurora-far 61s linear infinite;
}

/* 中雾：5 团，blur 68px，层不透明度 0.40。
   长宽比 1.29 / 1.33 / 0.58 / 1.35 / 1.90，没有一个是正圆 */
:root[data-style="gradient-aurora"] body::before {
  content: ""; position: fixed; inset: 0; z-index: -3;
  pointer-events: none;
  filter: blur(var(--aurora-blur-mid));
  opacity: .40;
  transform: rotate(9deg) scale(1.04);
  will-change: transform;
  background:
    radial-gradient(44vmax 34vmax at 15% 20%, var(--aurora-violet) 0%, color-mix(in oklab, var(--aurora-violet) 50%, transparent) 36%, transparent 66%),
    radial-gradient(32vmax 24vmax at 64% 2%,  var(--aurora-blue)   0%, color-mix(in oklab, var(--aurora-blue)   54%, transparent) 32%, transparent 64%),
    radial-gradient(22vmax 38vmax at 0% 52%,  var(--aurora-indigo) 0%, color-mix(in oklab, var(--aurora-indigo) 52%, transparent) 32%, transparent 68%),
    radial-gradient(42vmax 31vmax at 88% 80%, var(--aurora-cyan)   0%, color-mix(in oklab, var(--aurora-cyan)   60%, transparent) 30%, transparent 66%),
    radial-gradient(38vmax 20vmax at 26% 100%,var(--aurora-lilac)  0%, color-mix(in oklab, var(--aurora-lilac)  44%, transparent) 34%, transparent 70%);
  animation: aurora-mid 47s linear infinite;
}

/* 光核：3 团，blur 44px，层不透明度 0.55 —— 只负责"这里有一个光源" */
:root[data-style="gradient-aurora"] .app::before {
  content: ""; position: fixed; inset: 0; z-index: -2;
  pointer-events: none;
  filter: blur(var(--aurora-blur-near));
  opacity: .55;
  transform: rotate(-12deg);
  will-change: transform;
  background:
    radial-gradient(15vmax 12vmax at 76% 26%, var(--aurora-cyan),   transparent 62%),
    radial-gradient(12vmax 16vmax at 8% 44%,  var(--aurora-violet), transparent 64%),
    radial-gradient(10vmax  8vmax at 34% 86%, var(--aurora-lilac),  transparent 62%);
  animation: aurora-near 43s linear infinite;
}

/* 提亮：2 束「天光」，blur 110px，层不透明度 0.60 */
:root[data-style="gradient-aurora"] body::after {
  content: ""; position: fixed; inset: 0; z-index: -1;
  pointer-events: none;
  filter: blur(var(--aurora-blur-glow));
  opacity: .60;
  transform: rotate(5deg);
  will-change: transform;
  background:
    radial-gradient(30vmax 10vmax at 32% 4%,  var(--aurora-glow), transparent 72%),
    radial-gradient(14vmax  8vmax at 92% 54%, var(--aurora-blue), transparent 74%);
  animation: aurora-glow 52s linear infinite;
}

/* 暗色：四层 screen 相加，重叠处是更亮的光而不是更脏的色；
   浅色保持正常 alpha —— 白底上 screen 会直接洗白。
   screen 在深底上的亮度增益远小于浅底，所以暗色单独抬高各层 opacity。 */
:root[data-style="gradient-aurora"][data-theme="dark"]::before,
:root[data-style="gradient-aurora"][data-theme="dark"] body::before,
:root[data-style="gradient-aurora"][data-theme="dark"] .app::before,
:root[data-style="gradient-aurora"][data-theme="dark"] body::after { mix-blend-mode: screen; }
:root[data-style="gradient-aurora"][data-theme="dark"]::before      { opacity: .42; }
:root[data-style="gradient-aurora"][data-theme="dark"] body::before { opacity: .62; }
:root[data-style="gradient-aurora"][data-theme="dark"] .app::before { opacity: .78; }
:root[data-style="gradient-aurora"][data-theme="dark"] body::after  { opacity: .80; }
```

为什么是"层不透明度"而不是"每个色标写 alpha"：同一层里所有色斑共享一个不透明度，叠出来才是同一片雾；如果每团各写 alpha，最亮的一团会跳出雾层，读成一盏灯，整体又退回"三个圆"。层 opacity 还让暗色能整体提亮而不必改动 13 组颜色。

**4 · 前景：半透表面，边靠内高光**

```css
.card, .surface, .stat, .state-panel, .form-aside {
  border: none;
  border-radius: var(--r-lg);
  background: color-mix(in oklab, var(--surface-1) 84%, transparent);
  box-shadow:
    var(--shadow-2),
    inset 0 1px 0 rgb(255 255 255 / .62),                 /* 顶光 */
    inset 0 0 0 1px color-mix(in oklab, var(--accent) 10%, transparent); /* 彩色内环 */
}
:root[data-theme="dark"] .card,
:root[data-theme="dark"] .surface {                        /* 暗色顶光减弱到 8% */
  box-shadow: var(--shadow-2),
    inset 0 1px 0 rgb(255 255 255 / .08),
    inset 0 0 0 1px color-mix(in oklab, var(--accent) 16%, transparent);
}

/* 顶栏半透 + 4px 模糊，让色斑从导航后穿过去，而不是到边上就断 */
.topbar {
  background: color-mix(in oklab, var(--surface-1) 88%, transparent);
  backdrop-filter: blur(4px) saturate(1.04);
}
/* 设置页没有外层卡片，给整列一块 82% 的半透板 */
.settings {
  padding: var(--s-6);
  border-radius: var(--r-lg);
  background: color-mix(in oklab, var(--surface-1) 82%, transparent);
  box-shadow: var(--shadow-2),
    inset 0 1px 0 rgb(255 255 255 / .55),
    inset 0 0 0 1px color-mix(in oklab, var(--accent) 10%, transparent);
}
/* 验收：面板上正文与 fg-muted 对比均 ≥ 4.5:1；backdrop-filter 半径 ≤ 4px */
```

**5 · 文本可读性：首屏铺一块"雾中空地"**

```css
.view-head { position: relative; isolation: isolate; }
.view-head::before {
  content: ""; position: absolute;
  inset: calc(var(--s-6) * -1) calc(var(--s-7) * -0.5);
  z-index: -1; border-radius: var(--r-lg);
  background: radial-gradient(72% 120% at 28% 50%, var(--text-scrim), transparent 74%);
  filter: blur(40px);
}
/* 浅色 --text-scrim = surface-1 72%；暗色 = bg 82%。
   两个方向都让文字背后的实际颜色向"纯底色"靠，而不改变色相。 */
```

**6 · 慢漂移：四层各自周期，位移 ≤ 6%**

```css
@keyframes aurora-far {
  0%   { transform: rotate(-6deg)   translate3d(0, 0, 0)          scale(1.02); }
  25%  { transform: rotate(-4.5deg) translate3d(2.2%, -1.6%, 0)   scale(1.07); }
  50%  { transform: rotate(-7deg)   translate3d(-1.2%, 2.4%, 0)   scale(1.00); }
  75%  { transform: rotate(-5deg)   translate3d(1.4%, 1.1%, 0)    scale(1.05); }
  100% { transform: rotate(-6deg)   translate3d(0, 0, 0)          scale(1.02); }
}
@keyframes aurora-mid {
  0%   { transform: rotate(9deg)  translate3d(0, 0, 0)       scale(1.04); }
  33%  { transform: rotate(7deg)  translate3d(-3.2%, 2%, 0)  scale(.99); }
  66%  { transform: rotate(11deg) translate3d(2.6%, -2.8%, 0) scale(1.08); }
  100% { transform: rotate(9deg)  translate3d(0, 0, 0)        scale(1.04); }
}
@keyframes aurora-near {
  0%   { transform: rotate(-12deg) translate3d(0, 0, 0)        scale(1); }
  40%  { transform: rotate(-9deg)  translate3d(2.4%, 3.4%, 0)  scale(1.10); }
  70%  { transform: rotate(-14deg) translate3d(-2.2%, -2%, 0)  scale(.96); }
  100% { transform: rotate(-12deg) translate3d(0, 0, 0)        scale(1); }
}
@keyframes aurora-glow {
  0%   { transform: rotate(5deg)   translate3d(0, 0, 0)        scale(1); }
  30%  { transform: rotate(3.5deg) translate3d(-2.8%, 2.2%, 0) scale(1.06); }
  65%  { transform: rotate(6.5deg) translate3d(3.2%, -1.8%, 0) scale(.98); }
  100% { transform: rotate(5deg)   translate3d(0, 0, 0)        scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  :root[data-style="gradient-aurora"]::before,
  :root[data-style="gradient-aurora"] body::before,
  :root[data-style="gradient-aurora"] .app::before,
  :root[data-style="gradient-aurora"] body::after {
    animation: none; will-change: auto;
  }
}
/* 静态 transform 必须与各 keyframes 的 0% 完全一致（rotate + scale），
   否则动画启停、以及 reduced-motion 切换时会跳一下。 */
```

**7 · 按钮：在光上仍然要有实体边界**

```css
.btn { border: none; border-radius: var(--r-full); background: var(--surface-2); color: var(--fg); }
.btn[data-variant="primary"] {
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: var(--on-accent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / .22),
    0 4px 16px -4px color-mix(in oklab, var(--accent) 45%, transparent),
    0 10px 28px -12px color-mix(in oklab, var(--aurora-cyan) 34%, transparent);
}
/* 验收：on-accent/accent ≥ 4.5:1（浅 5.23 · 暗 9.15），外发光借用色斑的青 */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 暖色斑（黄 / 橙 / 粉红）与冷色斑同时出现 | 冷 + 暖的弥散光会读成"营销模板的彩虹"；本卡的气质感来自单一冷调内的色相跨度 |
| 只有 2–3 团等大、等距的色斑 | 会立刻读成"三个大圆"或"三个圆点"，从光退化为贴纸；必须是 10+ 团、尺寸差 2 倍以上、长宽比各异 |
| 色斑边缘可见（透明色标 < 56%） | 一旦看见圆边，色斑就从"光"退化为"贴纸"，且圆边会和卡片的圆角形成第二个形状系统 |
| 在色斑上直接放正文，不加托底 | 色斑是渐变的，文字对比度随滚动位置变化，无法保证任何位置都 ≥ 4.5:1 |
| 每团色斑单独写一个 alpha | 最亮的一团会跳出雾层，读成一盏灯，整页又退回"几个圆"；应该用层的 `opacity` 表达深度 |
| 色斑动画周期 < 20s | 会被人眼察觉为"背景在动"，持续争夺注意力；同时每帧全屏重绘，耗电明显 |
| 同时使用大色斑 + 毛玻璃 + 噪点纹理 | 三者都在争夺"材质"语义；并存时页面读成"做了很多效果"，而不是"有光的空间" |
| 纯黑 / 纯白表面卡 | 实色卡会切断色斑，让渐变只在边角露出，风格失效；必须用 82–88% 的半透明表面 |
| 让色斑成为唯一的视觉信息 | 色斑不携带任何语义；所有关键信息仍要靠排版与对比表达，色斑只是氛围 |

## 验收：怎么判断这个风格做对了

- [ ] 背景是 13 团（≥ 10 团）径向色斑，分 4 层，失焦半径 4 种（150 / 68 / 44 / 110px），透明色标 ≥ 56%
- [ ] 色斑尺寸与长宽比互不相同，缩小到缩略图也读不出"三个等大的圆"
- [ ] 所有色斑的色相落在 205–330，没有暖色斑；浅色 L 0.85–0.895 / 暗色 0.48–0.60
- [ ] `body` 背景是 `transparent`，底色画在 `html` 上（否则只剩最远的一层可见）
- [ ] 前景表面是 82–88% 不透明度的 `--surface-1/2/3`，边界靠内高光而不是描边
- [ ] 面板上 `backdrop-filter` 半径 ≤ 4px（本卡不是毛玻璃风格）
- [ ] 四层各自动画，周期 43–61s，位移幅度 ≤ 6%，`prefers-reduced-motion` 下 `animation: none` 且 `will-change: auto`
- [ ] 静态 `transform` 与 keyframes 0% 一致，启停无跳变
- [ ] 在色斑最亮处与最暗处分别采样正文对比度，两处均 ≥ 4.5:1（浅色 14.4–14.8 / 暗色 15.6–16.6）
- [ ] 暗色使用 `mix-blend-mode: screen` 并单独抬高各层 opacity，没有直接复用浅色的 opacity
- [ ] 页面滚动时背景不随之滚动（`position: fixed`），避免产生"贴图在滑动"的感觉
- [ ] 关闭动画后截图，页面仍成立（说明氛围不依赖运动）
- [ ] 标题 computed `font-family` 首项是衬线族（Palatino / Iowan Old Style / Georgia），正文仍是无衬线
- [ ] `--lh-body` = 1.75，标题字距 `-0.01em`，eyebrow `+0.14em`

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 用一张导出的渐变 PNG 当背景 | 位图色带在 8bit 下会出现明显的 banding；本风格必须用 CSS 渐变（或加极轻的噪点）平滑色阶 |
| 把色斑做成 `linear-gradient` | 线性渐变的过渡是方向性的，会读成"渐变按钮放大"，不是"空中漫射的光" |
| 用 `inset: -16%` 放大固定伪元素 | 百分比位移一起被放大，色斑中心会被推出视口，最后只剩四角偏暗的暗角，看起来像脏而不是光 |
| 浅色模式用 `screen` 叠加 | 白底上 screen 直接洗成纯白，所有色斑消失；`screen` 只属于暗色 |
| 暗色用浅色色斑 + 低 opacity | 深底上低 opacity 的浅色只会变成灰雾，且没有"光源在深处"的感觉；暗色必须换一组暗而饱和的值 |
| 只做暗色 | 浅色模式是"白天看云"而不是"夜里的灯"；两套都需要，且色斑色相必须一致 |
| 色斑 + 玻璃卡片 | 两者都在表达"背后有东西"，叠在一起时用户分不清哪个是景深哪个是材质；玻璃卡请走 `glassmorphism` |
| 用弥散光做后台的数据页 | **不适合**：色斑的明度变化会让表格的斑马纹与选中高亮都失效，行对齐的错觉直接导致误读 |
| 背景跟着滚动一起动（`background-attachment: scroll`） | 大色斑随内容移动会持续穿过文字，滚动时对比度每秒都在变 |
