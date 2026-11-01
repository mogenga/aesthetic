# 渐变 · 弥散光

> 大块柔光色斑在页面上缓慢游动，内容浮在光之上而不是贴在纸之上。

## 元信息

| 项 | 值 |
|---|---|
| id | `gradient-aurora` |
| 变体 | `gradient-aurora` |
| 一句话 | 用两三团失焦的巨大色斑铺出氛围底，前景只保留一种冷白表面，让内容成为光里的实体 |
| 最适合 | 品牌首页、AI 产品与生成类工具、发布页、需要在 3 秒内建立"贵"的印象的落地页 |
| 不适合 | 长文档、数据密集后台、需要长时间阅读的界面；色斑会持续争夺注意力并干扰表格对齐 |
| 主要代价 | 背景抢戏：色斑的动态范围一大，文字就得靠实色卡托住；而实色卡一多，弥散光就只剩边角 |

## 签名特征（3–5 条，缺一不可）

1. **背景由 2–3 个径向渐变色斑构成**，色斑半径 ≥ 60vmax，边缘必须完全失焦（无可见圆边）。
2. **色斑之间用 `screen` / `plus-lighter` 叠加**，产生"光相加"的过渡，而不是交叠出脏色。
3. **前景表面是半透明白**（`color-mix` 后再叠背景），让色斑透上来一点点——完全不透就失去风格，太透就丢对比度。
4. **色相只走冷调**：紫 → 靛 → 青，跨度 ≥ 90° 且不跨过黄与红；暖色斑会让整页读成"营销模板"。
5. **动画极慢且不可察觉**：色斑位移周期 ≥ 40s，位移幅度 ≤ 8%；不做脉冲、不做闪烁。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 300 / C 0.012（浅紫中性；比纯灰更有"光感"，但 C 不能更高否则表面发脏） |
| 彩度上限 | C ≤ 0.170；色斑本身 C 可以到 0.17，但表面与文字一律 ≤ 0.03 |
| 圆角 | `--r-sm` 10 · `--r-md` 16 · `--r-lg` 24 · `--r-full` 999（大圆角配合大色斑，形状语言统一为"软"） |
| 边框 | 1px · `--line-1`，常替换为 `white 12%` 的内高光（表面不透明，靠内光表达边界）；输入框内环 `--line-inset` |
| 阴影 | `--shadow-1` 0 1px 2px -1px / .06 · `--shadow-2` 0 8px 24px -12px / .16 · `--shadow-3` 0 24px 64px -24px / .28 |
| 字重 | 浅色 400 / 500 / 600 · 暗色 350 / 450 / 550；display 建议 600，不做 800 |
| 动效 | 240–360ms `cubic-bezier(.2,.7,.2,1)`；背景动画 ≥ 40s 线性循环，reduced-motion 下完全静止 |

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

**色斑的三色（局部变量，不进 token 表）**：

| 名称 | 浅色 | 暗色 | 位置 |
|---|---|---|---|
| `--aurora-1` | `oklch(0.86 0.10 300)` | `oklch(0.55 0.19 300)` | 左上，半径 80vmax |
| `--aurora-2` | `oklch(0.90 0.08 240)` | `oklch(0.50 0.17 255)` | 右下，半径 70vmax |
| `--aurora-3` | `oklch(0.92 0.06 330)` | `oklch(0.58 0.16 330)` | 中下，半径 60vmax |

浅色下色斑要**亮而淡**（L 0.86–0.92），暗色下要**暗而饱和**（L 0.50–0.58）。直接把浅色色斑放到暗色背景上会变成三块发光的脏斑。

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

  --aurora-1: oklch(0.86 0.10 300);
  --aurora-2: oklch(0.90 0.08 240);
  --aurora-3: oklch(0.92 0.06 330);

  --r-sm: 10px; --r-md: 16px; --r-lg: 24px; --r-full: 999px;

  --shadow-1: 0 1px 2px -1px rgb(30 20 60 / .06);
  --shadow-2: 0 8px 24px -12px rgb(30 20 60 / .16);
  --shadow-3: 0 24px 64px -24px rgb(30 20 60 / .28);

  --fw-body: 400; --fw-strong: 500; --fw-display: 600;
  --dur-fast: 160ms; --dur-base: 280ms; --dur-slow: 360ms;
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
  --aurora-1: oklch(0.55 0.19 300);
  --aurora-2: oklch(0.50 0.17 255);
  --aurora-3: oklch(0.58 0.16 330);
  --fw-body: 350; --fw-strong: 450; --fw-display: 550;
}
/* 验收：暗色色斑 L 在 0.48–0.60，浅色在 0.84–0.94；两组色相完全一致 */
```

**2 · 色斑底：三个径向渐变 + 一次 `plus-lighter`**

```css
.aurora-bg {
  position: fixed; inset: 0; z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(80vmax 80vmax at 12% 8%,  var(--aurora-1) 0%, transparent 62%),
    radial-gradient(70vmax 70vmax at 88% 72%, var(--aurora-2) 0%, transparent 60%),
    radial-gradient(60vmax 60vmax at 50% 105%, var(--aurora-3) 0%, transparent 58%),
    var(--bg);
  background-blend-mode: plus-lighter;
}
/* 验收：色斑边缘无可见圆边（透明色标 ≥ 58%）；背景层不拦截任何指针事件 */
```

**3 · 前景：半透明白，让光透上来一点**

```css
.panel {
  background: color-mix(in oklab, var(--surface-1) 82%, transparent);
  border: 1px solid color-mix(in oklab, white 45%, transparent);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-2);
  backdrop-filter: blur(2px);      /* 只糊一点，足够压住色斑细节 */
}
/* 验收：面板上正文对比 ≥ 4.5:1；backdrop-filter 半径 ≤ 4px（本卡不是毛玻璃风格） */
```

**4 · 文本可读性：色斑只在"没有字"的地方可见**

```css
.hero { position: relative; }
.hero::before {
  content: ""; position: absolute; inset: -20% -10%;
  background: radial-gradient(60% 60% at 50% 40%,
    color-mix(in oklab, var(--surface-1) 92%, transparent) 0%,
    transparent 100%);
  z-index: -1;
}
/* 验收：正文最暗像素与其背后实际颜色的对比 ≥ 4.5:1（含色斑透过处） */
```

**5 · 缓慢移动：40s 以上，位移 ≤ 8%**

```css
@keyframes aurora-drift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  50%  { transform: translate3d(2%, -3%, 0) scale(1.06); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
}
.aurora-bg { animation: aurora-drift 52s linear infinite; will-change: transform; }

@media (prefers-reduced-motion: reduce) {
  .aurora-bg { animation: none; will-change: auto; }
}
/* 验收：周期 ≥ 40s；reduced-motion 下完全静止且不留 will-change */
```

**6 · 按钮：在光上仍然要有实体边界**

```css
.btn--primary {
  background: var(--accent);
  color: var(--bg);
  border-radius: var(--r-full);
  box-shadow: var(--shadow-2);
}
.btn--ghost {
  background: color-mix(in oklab, var(--surface-1) 70%, transparent);
  color: var(--fg);
  border: 1px solid color-mix(in oklab, var(--fg) 14%, transparent);
}
/* 验收：两类按钮在半透明面板上都有可见边界，且前景对比 ≥ 4.5:1 */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 暖色斑（黄 / 橙 / 粉红）与冷色斑同时出现 | 冷 + 暖的弥散光会读成"营销模板的彩虹"；本卡的气质感来自单一冷调内的色相跨度 |
| 色斑边缘可见（stop < 50%） | 一旦看见圆边，色斑就从"光"退化为"贴纸"，且圆边会和卡片的圆角形成第二个形状系统 |
| 在色斑上直接放正文，不加托底 | 色斑是渐变的，文字对比度随滚动位置变化，无法保证任何位置都 ≥ 4.5:1 |
| 色斑动画周期 < 20s | 会被人眼察觉为"背景在动"，持续争夺注意力；同时每帧全屏重绘，耗电明显 |
| 同时使用大色斑 + 毛玻璃 + 噪点纹理 | 三者都在争夺"材质"语义；并存时页面读成"做了很多效果"，而不是"有光的空间" |
| 纯黑 / 纯白表面卡 | 实色卡会切断色斑，让渐变只在边角露出，风格失效；必须用 82% 左右的半透明表面 |
| 让色斑成为唯一的视觉信息 | 色斑不携带任何语义；所有关键信息仍要靠排版与对比表达，色斑只是氛围 |

## 验收：怎么判断这个风格做对了

- [ ] 背景恰好 3 个径向色斑（或 2），半径 ≥ 60vmax，透明色标 ≥ 58%
- [ ] 所有色斑的色相落在 240–335，没有暖色斑
- [ ] 前景表面是 78–88% 不透明度的 `--surface-1/2/3`，不是纯色
- [ ] 面板上 `backdrop-filter` 半径 ≤ 4px（本卡不是毛玻璃风格）
- [ ] 背景动画周期 ≥ 40s，位移幅度 ≤ 8%，`prefers-reduced-motion` 下静止
- [ ] 在色斑最亮处与最暗处分别采样正文对比度，两处均 ≥ 4.5:1
- [ ] 暗色色斑 L 在 0.48–0.60，未直接复用浅色值
- [ ] 页面滚动时背景不随之滚动（`position: fixed`），避免产生"贴图在滑动"的感觉
- [ ] 关闭动画后截图，页面仍成立（说明氛围不依赖运动）

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 用一张导出的渐变 PNG 当背景 | 位图色带在 8bit 下会出现明显的 banding；本风格必须用 CSS 渐变（或加极轻的噪点）平滑色阶 |
| 把色斑做成 `linear-gradient` | 线性渐变的过渡是方向性的，会读成"渐变按钮放大"，不是"空中漫射的光" |
| 只做暗色 | 浅色模式是"白天看云"而不是"夜里的灯"；两套都需要，且色斑色相必须一致 |
| 色斑 + 玻璃卡片 | 两者都在表达"背后有东西"，叠在一起时用户分不清哪个是景深哪个是材质；玻璃卡请走 `glassmorphism` |
| 用弥散光做后台的数据页 | **不适合**：色斑的明度变化会让表格的斑马纹与选中高亮都失效，行对齐的错觉直接导致误读 |
| 背景跟着滚动一起动（`background-attachment: scroll`） | 大色斑随内容移动会持续穿过文字，滚动时对比度每秒都在变 |
