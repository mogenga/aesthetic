# 像素风

> 8px 网格、硬边、无抗锯齿——界面像一块被放大到 400% 的 16 色显示器。

## 元信息

| 项 | 值 |
|---|---|
| id | `pixel` |
| 变体 | `pixel` |
| 一句话 | 一切尺寸是 8 的倍数，一切边缘是硬边，色彩收敛到一组有限调色板 |
| 最适合 | 游戏、创作者工具的品牌页、活动页与展示型组件、面向年轻用户的趣味产品 |
| 不适合 | **正文阅读**（字形不抗锯齿，长文本疲劳度高）；**数据密集场景**（一屏放不下同样多的行）；表单密集页也容易读成玩具 |
| 主要代价 | 可访问性成本高：像素字体在小字号下可读性差，且必须为它配一个"正常字族"做正文回退 |

## 签名特征（3–5 条，缺一不可）

1. **8px 基线，双倍缩放**：所有尺寸（间距、图标、边框、行高）都是 8 的倍数；1x 下看起来过大是正确的，像素风是"放大后"的美学。
2. **无圆角、无抗锯齿**：用 2px 或 4px 的阶梯式"假圆角"（`clip-path` 阶跃）而不是 `border-radius`。
3. **有限调色板**：一屏最多 8 个色，其中 3 个是明度阶梯。色相数量 ≤ 4。
4. **像素字体只用于标题、数字与短标签**；正文必须回退到可读的比例字族，否则不满足阅读门槛。
5. **所有硬边"对齐到像素网格"**：`box-shadow` 偏移、边框宽度、图标位置必须落在偶数像素，否则在 1x 屏上出现半像素模糊。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 95 / C 0.030（暖米黄，取自早期掌机的底色；浅色下 C 偏高，读的是"屏幕发黄"而不是"纸张"） |
| 彩度上限 | C ≤ 0.180；彩色 3 个（主 + 辅 + 状态），其余全部进米/墨两族 |
| 圆角 | `--r-sm` 0 · `--r-md` 0 · `--r-lg` 0 · `--r-full` 0（假圆角用 `clip-path`，不走 token） |
| 边框 | 2px solid `--fg`（1x）或 4px（2x 缩放模式）；不用 1px |
| 阴影 | `--shadow-1` 4px 4px 0 · `--shadow-2` 8px 8px 0 · `--shadow-3` 浮层用 0 8px 0 + 1px 描边 |
| 字重 | 浅色 400 / 700 / 700 · 暗色 400 / 700 / 700（像素字体通常只有单字重，700 是渲染近似） |
| 动效 | 60–90ms `steps(1)`；只允许"帧切换"式变化，不做插值 |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#EEE8D2` · `oklch(0.930 0.030 95)` | `#0E0E18` · `oklch(0.170 0.020 280)` |
| surface-1 | `#E8E2CC` · `oklch(0.912 0.030 95)` | `#13141E` · `oklch(0.194 0.020 280)` |
| surface-2 | `#E1DCC6` · `oklch(0.892 0.030 95)` | `#181923` · `oklch(0.218 0.020 280)` |
| surface-3 | `#DAD4BF` · `oklch(0.870 0.030 95)` | `#1E1F29` · `oklch(0.243 0.020 280)` |
| fg | `#14151F` · `oklch(0.200 0.020 280)` | `#F0EBDC` · `oklch(0.940 0.020 90)` |
| fg-muted | `#464759` · `oklch(0.405 0.030 280)` | `#A39E91` · `oklch(0.700 0.020 90)` |
| accent | `#B72D29` · `oklch(0.515 0.175 27)` | `#EBC34D` · `oklch(0.830 0.140 90)` |
| line-1 | `#14151F` · `oklch(0.200 0.020 280)` | `#F0EBDC` · `oklch(0.940 0.020 90)` |

- 表面 ΔL（浅）：bg→s1 **0.018** · s1→s2 **0.020** · s2→s3 **0.022**；（暗）0.024 / 0.024 / 0.025
- 对比度（浅）：`fg/bg` 14.8:1 · `fg-muted/bg` 7.4:1 · `accent/bg` 5.0:1
- 对比度（暗）：`fg/bg` 16.1:1 · `fg-muted/bg` 7.2:1 · `accent/bg` 11.3:1

**暗色是"夜间掌机"而不是浅色反转**：暗色底走蓝紫（H 280）而不是暖米色压暗。两个模式的色相家族不同，这是这台"设备"的两种显示模式，不是同一个主题的亮暗。

**表面阶梯偏大（0.018–0.025）**：像素风的颜色是"色块"，色块之间需要更明显的分界才看得出是不同区域——因为它没有渐变、没有柔边、也没有阴影来辅助。

## 标志性 CSS

**1 · Token 覆盖**

```css
:root[data-style="pixel"] {
  --bg: oklch(0.930 0.030 95);
  --surface-1: oklch(0.912 0.030 95);
  --surface-2: oklch(0.892 0.030 95);
  --surface-3: oklch(0.870 0.030 95);
  --fg: oklch(0.200 0.020 280);
  --fg-muted: oklch(0.405 0.030 280);
  --accent: oklch(0.515 0.175 27);
  --line-1: oklch(0.200 0.020 280);

  --r-sm: 0px; --r-md: 0px; --r-lg: 0px; --r-full: 0px;

  --px: 2px;                              /* 局部变量：像素单位，1x=2px / 2x=4px */
  --shadow-1: 4px 4px 0 var(--fg);
  --shadow-2: 8px 8px 0 var(--fg);
  --shadow-3: 0 8px 0 color-mix(in oklab, var(--fg) 85%, transparent),
              0 0 0 1px var(--fg);

  --fw-body: 400; --fw-strong: 700; --fw-display: 700;
  --dur-fast: 60ms; --dur-base: 80ms; --dur-slow: 90ms;
  --ease-out: steps(1);
}
:root[data-style="pixel"][data-theme="dark"] {
  --bg: oklch(0.170 0.020 280);
  --surface-1: oklch(0.194 0.020 280);
  --surface-2: oklch(0.218 0.020 280);
  --surface-3: oklch(0.243 0.020 280);
  --fg: oklch(0.940 0.020 90);
  --fg-muted: oklch(0.700 0.020 90);
  --accent: oklch(0.830 0.140 90);
  --line-1: oklch(0.940 0.020 90);
  --fw-body: 400; --fw-strong: 700; --fw-display: 700;  /* 像素字体无中间字重 */
}
/* 验收：所有 border-radius 的 computed 值为 0px；--px 在两个主题下都是偶数 */
```

**2 · 假圆角：阶跃而不是圆弧**

```css
.px-card {
  border: var(--px) solid var(--fg);
  background: var(--surface-1);
  clip-path: polygon(
    0 4px, 2px 4px, 2px 2px, 4px 2px, 4px 0,
    calc(100% - 4px) 0, calc(100% - 4px) 2px, calc(100% - 2px) 2px,
    calc(100% - 2px) 4px, 100% 4px, 100% calc(100% - 4px),
    calc(100% - 2px) calc(100% - 4px), calc(100% - 2px) calc(100% - 2px),
    calc(100% - 4px) calc(100% - 2px), calc(100% - 4px) 100%,
    4px 100%, 4px calc(100% - 2px), 2px calc(100% - 2px),
    2px calc(100% - 4px), 0 calc(100% - 4px)
  );
}
/* 验收：放大到 400% 后角部是直角阶梯，没有平滑弧线 */
```

**3 · 字体：像素只做展示，正文必须可读**

```css
.display, h1, h2, h3, .btn, .label {
  font-family: "Press Start 2P", "Zpix", ui-monospace, monospace;
  letter-spacing: 0.02em;
  /* 像素字体在非整数倍字号下会重新采样，必须锁定到 8px 的倍数 */
  font-size: 16px; line-height: 24px;
}
.prose, .body, p, li, td {
  font-family: system-ui, "Noto Sans SC", sans-serif;  /* 正文回退到比例字 */
  font-size: var(--fs-md); line-height: var(--lh-body);
}
/* 验收：正文段落的 computed font-family 首项不是像素字体 */
```

**4 · 用 8 的倍数网格约束一切**

```css
:root[data-style="pixel"] { --grid: 8px; }
.px-stack > * + * { margin-top: calc(2 * var(--grid)); }   /* 16px */
.px-row { min-height: calc(6 * var(--grid)); }              /* 48px */
.icon-16 { width: 16px; height: 16px; image-rendering: pixelated; }
/* 验收：所有视觉尺寸可被 8 整除（光学值 1px 例外不适用本风格） */
```

**5 · 双倍缩放模式：整体乘 2，不做半像素**

```css
@media (min-width: 834px) {
  :root[data-style="pixel"] { --px: 4px; }
  .px-card { border-width: 4px; }
  .btn { min-height: 96px; padding-inline: 32px; }
}
/* 验收：834px 以上所有边界尺寸是 4 的倍数 */
```

**6 · 焦点与状态：颜色 + 形状双通道**

```css
:where(a, button, input, select, textarea):focus-visible {
  outline: 2px solid var(--fg);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--bg);      /* 双层环，内环填 bg 让外环"跳"出来 */
}
.btn[disabled] {
  background-image: repeating-linear-gradient(
    45deg, transparent 0 4px,
    color-mix(in oklab, var(--fg) 18%, transparent) 4px 8px
  );
}
/* 验收：禁用态不只是降透明度，有 45° 斜纹；焦点环在任意表面都能看见 */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 任何 `border-radius > 0` | 圆弧是抗锯齿的产物，一条弧就足以让整页读成"现代 UI 配了个像素字体" |
| 小于 16px 的像素字体正文 | 像素字体在 12px 下每笔画只剩 1px，中文尤其糊；正文必须换比例字族 |
| 渐变、软阴影、模糊 | 三种都是连续插值，与"有限色阶 + 硬边"的世界观冲突 |
| 半像素尺寸（如 1.5px、13px 行高） | 半像素在 1x 屏上被抗锯齿，硬边的观感直接消失 |
| 超过 8 个颜色 | 像素美学的记忆点来自**受限调色板**；颜色越多越像"低分辨率照片"而不是"像素画" |
| 全站使用像素字体 | 长文本阅读疲劳；像素字体只适合标题、按钮、标签、数字 |
| `image-rendering: auto` 的图标 | 缩放后被插值模糊，与硬边 UI 冲突 |

## 验收：怎么判断这个风格做对了

- [ ] 全页 `border-radius` 均为 0
- [ ] 所有结构尺寸可被 8 整除（除了 R1 定义的光学值与 1px 描边）
- [ ] 一屏出现的颜色 ≤ 8 个，色相数 ≤ 4
- [ ] 正文段落使用比例字族，字号 ≥ 15px，行高 ≥ 1.6
- [ ] 所有 `<img>` / 图标设了 `image-rendering: pixelated`（或本身是 1x 位图）
- [ ] 标题与按钮使用像素字体，且字号是 8 的倍数
- [ ] 放大到 400% 截图，所有硬边仍为直线、角部为阶梯
- [ ] 禁用态有斜纹或其它非颜色信号
- [ ] 暗色模式换了色相家族（蓝紫底），不是把米底直接压暗
- [ ] 动效用 `steps()` 而非插值缓动

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 把像素风当"复古主题"，只换字体 | 像素风是网格与硬边的系统工程；只换字体得到的是"清晰度很差的现代 UI" |
| 用像素字体渲染长文 | **明确不适合正文阅读**：像素字形的 x-height 与字距被字重锁死，长段落下行间节奏完全一致，眼睛没有可锚定的停顿 |
| 在数据表格里用像素风 | **明确不适合数据密集场景**：8px 网格意味着行高不能小于 32px，同屏行数比常规少 30–50%，且等宽像素数字在小字号下无法区分 6/8/0 |
| 用 CSS `box-shadow` 模拟多层描边 | 多层 offset 阴影会在像素网格外产生落点，放大后出现错位的"重影" |
| 全站 2x 缩放但不改布局 | 2x 之后所有组件尺寸翻倍，一屏只能放 1/4 内容；2x 必须配合布局重排，而不是单纯放大 |
