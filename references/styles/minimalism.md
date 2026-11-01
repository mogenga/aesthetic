# 极简主义

> 用留白和字级建立秩序，装饰只出现在它必须出现的地方——通常一处也不出现。

## 元信息

| 项 | 值 |
|---|---|
| id | `minimalism` |
| 变体 | `minimalism` |
| 一句话 | 靠间距、字级和一条极细的分隔线构成全部结构，彩色只用在一个地方 |
| 最适合 | 长文本阅读、企业工具、文档站、需要"安静"的品牌页 |
| 不适合 | 需要即时情绪冲击的活动页、儿童向产品；图文并重的编辑排版（会显得素） |
| 主要代价 | 极易做成"没有性格的默认 admin"；靠的是比例，比例错一点就全盘垮 |

## 签名特征（3–5 条，缺一不可）

1. **层次只来自三个变量**：间距、字号、字重。任何一处分隔都先试留白，留白不够才用 1px 线。
2. **全站只有一个强调色**，且只用在链接、焦点环、选中态；彩色面积占比 < 5%。
3. **表面之间几乎没有边界**：不使用卡片边框，靠 `--surface-*` 的 ΔL（0.010–0.017）区分层级。
4. **字距是负的，字重不是重的**。display 用 `-0.02em` 收紧，正文 400 不动；不用 700 以上的标题。
5. **动效只做透明度和颜色**，没有位移，没有缩放。超过 200ms 的过渡在这个风格里等于噪音。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 85 / C 0.002（微暖中性，不是纯灰——纯灰会掉进默认模板） |
| 彩度上限 | C ≤ 0.090；彩色出现 1 处 |
| 圆角 | `--r-sm` 2 · `--r-md` 4 · `--r-lg` 6 · `--r-full` 999（数字与全圆，别出现中间值的"软"圆角） |
| 边框 | 1px · `--line-1`；只用于分隔线与输入框，不用于卡片 |
| 阴影 | `--shadow-1` none · `--shadow-2` 0 1px 2px -1px / .06 · `--shadow-3` 仅浮层，见下 |
| 字重 | 浅色 400 / 500 / 600 · 暗色 350 / 450 / 550（阶梯 300–700） |
| 动效 | 100–160ms `ease-out`，只动 `opacity` / `background-color` / `border-color` |

`--shadow-3` 必须存在，即使前两档是 `none`：

```css
--shadow-3: 0 8px 24px -8px rgb(0 0 0 / .14), 0 24px 64px -24px rgb(0 0 0 / .16);
```

理由：下拉、弹窗、toast 没有投影时，用户无法判断它浮在页面之上。"不用阴影"指的是**不做装饰性投影**，不是取消层叠语义。

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#FBFAF9` · `oklch(0.985 0.002 85)` | `#121111` · `oklch(0.180 0.002 85)` |
| surface-1 | `#F7F7F5` · `oklch(0.975 0.002 85)` | `#171615` · `oklch(0.202 0.002 85)` |
| surface-2 | `#F2F2F0` · `oklch(0.960 0.002 85)` | `#1C1C1B` · `oklch(0.226 0.002 85)` |
| surface-3 | `#EDECEB` · `oklch(0.943 0.002 85)` | `#222221` · `oklch(0.252 0.002 85)` |
| fg | `#1A1A19` · `oklch(0.2174 0.0019 106.6)` | `#ECEBEA` · `oklch(0.940 0.002 85)` |
| fg-muted | `#6A6966` · `oklch(0.520 0.004 85)` | `#A6A4A2` · `oklch(0.720 0.004 85)` |
| accent | `#3C6797` · `oklch(0.505 0.090 252)` | `#7EAFE5` · `oklch(0.740 0.095 252)` |
| line-1 | `#DFDEDC` · `oklch(0.900 0.003 85)` | `#2E2E2C` · `oklch(0.300 0.003 85)` |

- 表面 ΔL（浅）：bg→s1 **0.010** · s1→s2 **0.015** · s2→s3 **0.017**；（暗）0.022 / 0.024 / 0.026
- 对比度（浅）：`fg/bg` 16.7:1 · `fg-muted/bg` 5.3:1 · `accent/bg` 5.6:1
- 对比度（暗）：`fg/bg` 15.8:1 · `fg-muted/bg` 7.6:1 · `accent/bg` 8.2:1

暗色不是反转：`fg` 从 `L 0.217` 抬到 `0.940`，但 `fg-muted` 只到 `0.720`（比正文低 0.22 的 L，保持层级），强调色同时提高明度以免在深底上发闷。表面阶梯在暗色下**扩大**到 0.022–0.026，因为低 L 区间里同样的绝对差在视觉上更弱。

## 标志性 CSS

**1 · Token 覆盖（浅 + 暗）**

```css
:root[data-style="minimalism"] {
  --bg: oklch(0.985 0.002 85);        /* #FBFAF9 */
  --surface-1: oklch(0.975 0.002 85); /* #F7F7F5 */
  --surface-2: oklch(0.960 0.002 85); /* #F2F2F0 */
  --surface-3: oklch(0.943 0.002 85); /* #EDECEB */
  --fg: oklch(0.2174 0.0019 106.6);   /* #1A1A19 */
  --fg-muted: oklch(0.520 0.004 85);  /* #6A6966 */
  --accent: oklch(0.505 0.090 252);   /* #3C6797 */
  --line-1: oklch(0.900 0.003 85);    /* #DFDEDC */
  --line-inset: color-mix(in oklab, var(--fg) 8%, transparent);

  --r-sm: 2px; --r-md: 4px; --r-lg: 6px; --r-full: 999px;

  --shadow-1: none;
  --shadow-2: 0 1px 2px -1px rgb(0 0 0 / .06);
  --shadow-3: 0 8px 24px -8px rgb(0 0 0 / .14),
              0 24px 64px -24px rgb(0 0 0 / .16);

  --fw-body: 400; --fw-strong: 500; --fw-display: 600;
  --dur-fast: 100ms; --dur-base: 140ms; --dur-slow: 160ms;
}
:root[data-style="minimalism"][data-theme="dark"] {
  --bg: oklch(0.180 0.002 85);
  --surface-1: oklch(0.202 0.002 85);
  --surface-2: oklch(0.226 0.002 85);
  --surface-3: oklch(0.252 0.002 85);
  --fg: oklch(0.940 0.002 85);
  --fg-muted: oklch(0.720 0.004 85);
  --accent: oklch(0.740 0.095 252);
  --line-1: oklch(0.300 0.003 85);
  --fw-body: 350; --fw-strong: 450; --fw-display: 550;
}
/* 验收：四个表面的 L 差值必须落在 0.010–0.030，且 H 全部为 85 */
```

**2 · 用留白代替分隔线**

```css
.card + .card { border-top: 1px solid var(--line-1); }
.card { padding-block: var(--s-6); }        /* 32px，上下各一次 */
.card:first-child { padding-block-start: var(--s-5); }
.card:last-child { padding-block-end: var(--s-7); }  /* 48px 收尾，让列表下沿"呼吸" */
/* 验收：卡片之间没有 border-radius 生效，computed 值为 0 或继承容器 */
```

**3 · 字级优先于字重**

```css
.prose h1, .section-title {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-display);
  letter-spacing: -0.02em;
  line-height: var(--lh-tight);
}
.prose p { max-width: 68ch; line-height: var(--lh-body); }
.eyebrow {
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
/* 验收：页面里所有 font-weight 的上界等于 --fw-display，不存在 700+ */
```

**4 · 输入框：内环是变深，不是高光**

```css
.field {
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--r-md);
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .12),
    inset 0 1px 2px rgb(0 0 0 / .08),
    inset 0 0 0 1px var(--line-inset);
}
.field:focus-visible {
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .12),
    inset 0 1px 2px rgb(0 0 0 / .08),
    inset 0 0 0 1px var(--accent);
  outline: none;
}
/* 验收：focus 时外环 3px 由 --focus-ring 提供，内环颜色切换为 accent */
```

**5 · 唯一的强调色，且只在这里**

```css
a, .link { color: var(--accent); text-underline-offset: 0.18em; text-decoration-thickness: 1px; }
:where(button, a, input, select, textarea):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
::selection { background: color-mix(in oklab, var(--accent) 22%, transparent); }
/* 验收：全页 computed color 中出现的色相种类 ≤ 3（fg / fg-muted / accent） */
```

**6 · 动效只做"看得见的变化"**

```css
.btn, .link, .field {
  transition: background-color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .btn, .link, .field { transition-duration: 1ms; }
}
/* 验收：无 transform 过渡；reduced-motion 下动画时长 ≤ 1ms */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 卡片边框 + 卡片阴影同时存在 | 两者表达同一个"浮起"语义，重复之后页面变成一堆有框的盒子，留白被吃掉 |
| 两个以上强调色 | 极简的"少"是靠对比建立，第二个彩色会立刻把注意力从内容上抢走 |
| 纯白 `#FFF` 页面底 | 在 OLED 与高亮屏上过曝，且与 `#1A1A19` 的对比度 19:1 造成阅读疲劳；用 `L 0.98` 的微暖底 |
| 700 以上的标题字重 | 字号已经承担层级，再加重会让标题变成"大字报"，与"安静"的气质冲突 |
| 装饰性渐变、模糊背景 | 它们不携带信息，只会让表面 ΔL 失效，让层级判断从"看明度"退化为"猜" |
| 超过 200ms 的过渡 | 高频交互里会被感知为卡顿；极简的质感来自"短而准" |

## 验收：怎么判断这个风格做对了

- [ ] 页面里没有一处 `border-radius` 大于 `--r-lg`（6px），除了头像 / 徽章 / 开关等 `--r-full`
- [ ] 全页出现的色相种类 ≤ 3，且彩色只出现在链接、焦点环、选中态
- [ ] 四个表面连续采样，`ΔL` 三档全部落在 `[0.010, 0.030]`
- [ ] 卡片之间没有同时出现 border 与 box-shadow
- [ ] 正文行长 ≤ 68ch，行高 1.6–1.7
- [ ] 从页面里任取一个区块，去掉它的背景色后布局仍然可读（说明结构不是靠色块撑的）
- [ ] 下拉 / 弹窗 / toast 有明显的 `--shadow-3`，而普通卡片没有阴影
- [ ] `prefers-reduced-motion` 下所有过渡 ≤ 1ms，且没有布局跳动
- [ ] 暗色下 `--fw-body` = 350，且正文对比度仍 ≥ 4.5:1

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| "极简 = 全白 + 细灰字" | 细灰字在浅底上对比度不足 4.5:1，用户读不动；极简靠的是留白，不是低对比 |
| 所有元素统一 8px 圆角 | 四级圆角退化成一级，形状不再携带"按钮 / 卡片 / 弹窗"的信息，层级只能靠阴影补，又回到上一行的错误 |
| 把"不用阴影"做成"不用浮层语义" | 下拉与弹窗贴在同一平面上，用户会误以为它是页面内容，点击外部不消失的行为也无法预测 |
| 用超大留白掩盖内容组织不清 | 留白是呼吸，不是分组；分组仍要靠间距梯度（32 / 48 / 64），全用 96px 会让页面失去节奏 |
| 抄了配色没抄比例 | `#FBFAF9` + `#1A1A19` 谁都能填，但 68ch 行长、32px 段间距、-0.02em 字距才是这个风格的手感 |
