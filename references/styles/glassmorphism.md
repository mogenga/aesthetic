# 玻璃拟态

> 界面浮在一层薄玻璃上：背后的东西还在，但被折射、被糊掉，或只是被染了一层色。

## 元信息

| 项 | 值 |
|---|---|
| id | `glassmorphism` |
| 变体 | `glass-liquid` / `glass-frosted` / `glass-transparent`（三个独立 CSS 变体） |
| 一句话 | 用一层半透明表面把背景"隔开但不遮住"，细节交给三种不同的光学处理 |
| 最适合 | 悬浮控制条、导航条、播放器、卡片层叠的品牌页、有受控背景资产的落地页 |
| 不适合 | 数据密集后台、长文本阅读、任何背景内容不可控的页面（用户上传、无限列表、实时视频） |
| 主要代价 | 实现成本与对比度风险双高：每个玻璃元素都是独立渲染面，对比度取决于它背后恰好是什么 |

**先分清三支**。判定法：遮住页面背景，只留一个纯色块放在玻璃后面。三者技术栈、浏览器支持、性能、失败模式完全不同，不能共用一份参数。

| 观察 | 结论 | 变体 id |
|---|---|---|
| 背景**变形**了（直线被掰弯） | 液态玻璃 | `glass-liquid` |
| 背景**糊了**（轮廓消失但颜色还在） | 毛玻璃 | `glass-frosted` |
| 背景**只是被染了一层色** | 透明玻璃 | `glass-transparent` |

## 签名特征（3–5 条，缺一不可）

1. **表面是页面基色的半透明版**（由 `--surface-*` 派生），不是纯白半透明；纯白在暗色下会发灰。
2. **边缘靠两条 inset 阴影伪造厚度**：上亮下暗，比单条 border 可信。
3. **玻璃只出现在小型高价值表面**：导航条、浮条、播放器、单张卡；不用在大面板与列表项上。
4. **背后必须有"值得看"的内容**：玻璃的全部意义是透出背景，放在纯色页上等于一块灰。
5. **正文不进玻璃**，或最多 6 行且加内层遮罩渐变；超过就换实色面板。

## Token 骨架（三支共用）

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 265–270 / C 0.014–0.025（冷紫灰；玻璃需要一点冷调才不像雾） |
| 彩度上限 | C ≤ 0.145；彩色只在强调色与背景资产里 |
| 圆角 | `--r-sm` 10 · `--r-md` 16 · `--r-lg` 26 · `--r-full` 999（小圆角会在倒角处露出折射断裂） |
| 边框 | 1px，`white 16–26%` 的亮边（不是 `--line-1`） |
| 阴影 | `--shadow-1` 贴地 · `--shadow-2` 玻璃本体的抬升 · `--shadow-3` 只给浮在玻璃之上的弹层；三条 inset 边缘光另算，暗色整套重算 |
| 字重 | 浅色 400 / 500 / 600 · 暗色 350 / 450 / 550 |
| 动效 | 120–200ms `ease-out`；动透明度与 8px 位移，**不对 `backdrop-filter` 做过渡** |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#EFF4FD` · `oklch(0.965 0.014 265)` | `#0B0F1A` · `oklch(0.170 0.025 270)` |
| surface-1 | `#E9EEF8` · `oklch(0.948 0.014 265)` | `#101420` · `oklch(0.195 0.025 270)` |
| surface-2 | `#E3E7F1` · `oklch(0.928 0.014 265)` | `#161A26` · `oklch(0.220 0.025 270)` |
| surface-3 | `#DBE0E9` · `oklch(0.905 0.014 265)` | `#1C202D` · `oklch(0.246 0.025 270)` |
| fg | `#181D27` · `oklch(0.230 0.020 265)` | `#E8EBF2` · `oklch(0.940 0.010 270)` |
| fg-muted | `#515762` · `oklch(0.455 0.020 265)` | `#A7ABB5` · `oklch(0.740 0.015 270)` |
| accent | `#5762C0` · `oklch(0.535 0.145 275)` | `#ADB3FD` · `oklch(0.790 0.105 280)` |
| line-1 | `#D7DEEC` · `oklch(0.900 0.020 265)` | `#333845` · `oklch(0.340 0.025 270)` |

- 表面 ΔL（浅）：bg→s1 **0.017** · s1→s2 **0.020** · s2→s3 **0.023**；（暗）0.025 / 0.025 / 0.026
- 对比度（浅，实底）：`fg/bg` 15.3:1 · `fg-muted/bg` 6.6:1 · `accent/bg` 4.8:1
- 对比度（暗，实底）：`fg/bg` 16.1:1 · `fg-muted/bg` 8.3:1 · `accent/bg` 10.0:1

**玻璃上的对比度要另算**：上表是实底值。玻璃必须在其**实际渲染像素**上重测——把背后内容换到最亮与最暗两帧各测一次，三支共通，不因变体豁免。**暗色参数整套重算**（不是把浅色压暗）：底色 62% → 42%、上高光 22% → 16%、下暗线 8% → 24%、外投影加重一档、模糊 24px → 20px。

**三支共用基座**（三个变体文件都带这一段；差异只写在 `--glass-*` 与 `--shadow-*`）：

```css
:root[data-style^="glass-"] {
  --bg: oklch(0.965 0.014 265);        --surface-1: oklch(0.948 0.014 265);
  --surface-2: oklch(0.928 0.014 265); --surface-3: oklch(0.905 0.014 265);
  --fg: oklch(0.230 0.020 265);        --fg-muted: oklch(0.455 0.020 265);
  --accent: oklch(0.535 0.145 275);    --line-1: oklch(0.900 0.020 265);
  --line-inset: color-mix(in oklab, var(--fg) 8%, transparent);
  --r-sm: 10px; --r-md: 16px; --r-lg: 26px; --r-full: 999px;
  --fw-body: 400; --fw-strong: 500; --fw-display: 600;
  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms; --ease-out: cubic-bezier(.2,.7,.2,1);
}
/* 验收：三支 --r-* / --fw-* / --dur-* 完全一致，只有 --glass-* 与 --shadow-* 不同 */
```

### 状态色（三支共用）

| 角色 | 浅色 | 暗色 | 说明 |
|---|---|---|---|
| danger | `#AB3C44` · `oklch(0.516 0.145 20)` | `#FF9A9A` · `oklch(0.790 0.122 20)` | 与基座 accent 同明度带（0.516 / 0.790） |
| danger-hover | `oklch(0.474 0.150 20)` | `oklch(0.840 0.112 20)` | |
| on-danger | `#FCFCFC` · `oklch(0.990 0 0)` | `oklch(0.170 0.020 20)` | |
| success | `#00703E` · `oklch(0.478 0.118 155)` | `#62D691` · `oklch(0.790 0.145 155)` | |
| warning | `#895600` · `oklch(0.498 0.108 70)` | `#F5A843` · `oklch(0.790 0.145 70)` | |

状态色与冷紫灰基座共用一套，三支完全一致（与基座一样，差异只允许出现在 `--glass-*` / `--shadow-*`）。因为玻璃本身是半透明面，状态色不透明度有硬下限：**危险按钮的 `color-mix` 不得低于 88%**，低于 85% 时 `--on-danger` 对实际渲染像素只有 4.36:1。

## 变体 A · 液态玻璃 `glass-liquid`

**原理**：把元素当作一块有倒角的厚玻璃。对元素尺寸与圆角计算圆角矩形 SDF → 由梯度得到边缘法线 → 生成位移场贴图（R 通道 = x 偏移，G 通道 = y 偏移，128 = 不动）→ 交给 SVG 滤镜 → `backdrop-filter: url(#filter)` 实时折射背后内容。**用 `assets/vendor/hyalite.js`（MIT，单文件，`Hyalite.watch()`），不要自己从物理公式推。**

### 技术事实（改实现前重读）

| # | 事实 | 后果 |
|---|---|---|
| 1 | `backdrop-filter: url(#svg)` **只有 Chromium 真渲染**。Safari 接受属性但丢弃 SVG（WebKit bug 245510）；Firefox 不实现（bug 1787623），自 106 起只是不过滤而非消失 | 非 Chromium 必须走降级链 |
| 2 | `CSS.supports('backdrop-filter','url(#x)')` 在**三大引擎都返回 true** | 不能做特性检测；必须引擎嗅探 + 手工开关 `force(true/false)` |
| 3 | Chromium 置换采样是**最近邻**（Skia bug 40045448） | 大位移出阶梯；靠窄倒角 + 叠模糊 + 两趟位移拆分，**调参解决不了** |
| 4 | 装滤镜的 `<svg>` **不能用 `display:none`**，Blink 会忽略 | 用 `position:fixed; width:0; height:0` |
| 5 | 每个 `backdrop-filter` 元素都是**独立 render surface** | 只用于小型高价值表面 |

另两条前提：位移图常为 `data:` URL，严格 CSP 需放行 `img-src data:`；尺寸变化会触发重建（hyalite 限流 90ms），形状变形（药丸→卡片）应在动画结束后再 attach。

### 技术方案

```css
:root[data-style="glass-liquid"] {
  --glass-bg: color-mix(in oklab, var(--surface-1) 58%, transparent);
  --glass-edge: color-mix(in oklab, white 26%, transparent);
  --glass-edge-dark: color-mix(in oklab, black 10%, transparent);
  --shadow-2: 0 8px 32px -8px rgb(20 25 60 / .22);
  --shadow-3: 0 24px 64px -24px rgb(20 25 60 / .32);  /* 弹层；不叠 backdrop-filter */
  /* 其余 token 与上方共用表一致 */
}
.glass--liquid {
  position: relative; background: var(--glass-bg);
  border: 1px solid var(--glass-edge);
  backdrop-filter: url(#liquid-glass-filter) blur(1px);
  -webkit-backdrop-filter: blur(20px) saturate(180%);  /* 非 Chromium 兜底 */
  box-shadow: inset 0 1px 0 var(--glass-edge), inset 0 -1px 0 var(--glass-edge-dark), var(--shadow-2);
}
@supports not (backdrop-filter: blur(1px)) { .glass--liquid { background: var(--surface-1); backdrop-filter: none; } }
```

```html
<svg aria-hidden="true" style="position:fixed;width:0;height:0;overflow:hidden">
  <filter id="liquid-glass-filter" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage href="data:image/png;base64,…" result="map" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

```js
const isChromium = /Chrome|Edg|OPR/.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
Hyalite.watch({ force: isChromium === false });   // CSS.supports 在这里一定返回 true，别用它
// 验收：Safari / Firefox 人工确认玻璃是"糊的"而不是"变形的"
```

**降级链与性能**：`液态（Chromium）→ 毛玻璃（其他引擎）→ 半透明实色（不支持 backdrop-filter）`，三级参数都要进合同，不能只写一级。一页液态表面 ≤ 2；重建随元素数线性增长，流式内容在重建期掉帧；位移场"折叠"（slope > 1）是液态感来源，但折叠区拉伸无上限，靠窄倒角 + 模糊 + 色散盖住；元素大于 320×200 不用液态。

## 变体 B · 毛玻璃 `glass-frosted`

**几乎所有"玻璃感"产品真正用的就是这一支。**

```css
:root[data-style="glass-frosted"] {
  --glass-bg: color-mix(in oklab, var(--surface-1) 62%, transparent);
  --glass-edge: color-mix(in oklab, white 22%, transparent);
  --glass-edge-dark: color-mix(in oklab, black 8%, transparent);
  --glass-blur: 24px;
  --shadow-2: 0 8px 32px -8px rgb(20 25 60 / .28);
}
:root[data-style="glass-frosted"][data-theme="dark"] {
  --glass-bg: color-mix(in oklab, var(--surface-1) 42%, transparent);
  --glass-edge: color-mix(in oklab, white 16%, transparent);
  --glass-edge-dark: color-mix(in oklab, black 24%, transparent);
  --glass-blur: 20px;
  --shadow-2: 0 12px 40px -12px rgb(0 0 0 / .55);
  --fw-body: 350; --fw-strong: 450; --fw-display: 550;
}
.glass--frosted {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid var(--glass-edge);
  border-radius: var(--r-lg);
  box-shadow: inset 0 1px 0 var(--glass-edge),
              inset 0 -1px 0 var(--glass-edge-dark), var(--shadow-2);
}
/* 放正文时必须加内层遮罩（顶部 0 → 底部 12% 底色），否则滚动内容经过时对比度崩 */
.glass--frosted .glass__content::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(to bottom, transparent 0%,
    color-mix(in oklab, var(--surface-1) 12%, transparent) 100%);
}
/* 验收：底色由 --surface-1 派生而非纯白；暗色 42% / 20px 与浅色不同；任一滚动帧正文对比 ≥ 4.5:1 */
```

降级链：支持 `backdrop-filter` → 毛玻璃；不支持 → `--surface-1` 88% 半透明 + 两条 inset；`prefers-reduced-transparency: reduce` → 实色 + 1px `--line-1`。

## 变体 C · 透明玻璃 `glass-transparent`

不模糊，只染色。常用于悬浮在图片上的极简控制条。

```css
:root[data-style="glass-transparent"] {
  --glass-bg: color-mix(in oklab, var(--surface-1) 10%, transparent);
  --glass-edge: color-mix(in oklab, white 18%, transparent);
  --shadow-2: 0 4px 24px -6px rgb(20 25 60 / .20);
  --shadow-3: 0 20px 56px -20px rgb(20 25 60 / .30);
}
.glass--transparent {
  background: var(--glass-bg);
  border: 1px solid var(--glass-edge);
  border-radius: var(--r-full);
  box-shadow: var(--shadow-2);
  /* 注意：没有 backdrop-filter */
}
/* 兜底压暗层：删掉它对比度就掉到阈值以下 —— 说明它不是装饰 */
.glass--transparent::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background: linear-gradient(to bottom, color-mix(in oklab, var(--bg) 22%, transparent),
    color-mix(in oklab, var(--bg) 8%, transparent));
}
/* 验收：computed backdrop-filter 为 none；关闭压暗层后对比度跌破阈值 */
```

**强制要求：受控背景资产。** 背后内容不可控 → 对比度不可控。必须满足：① 背景是固定插画 / 渐变网格 / 暗色照片 / 纯色 + 噪点之一，不得放在用户图片、实时视频、无限列表之上；② 资产登记进 `contract.md` 第 3 段并随交付物版本管理；③ 玻璃文字与资产**最亮、最暗两处**的对比都 ≥ 4.5:1。降级：`prefers-contrast: more` 时底色提到 40%、边框提到 `fg 30%`；资产加载失败退到 `--surface-1` 实色。

## 标志性 CSS（三支共用）

```css
/* 厚度：两条 inset 伪造玻璃断面（单条 border 无法产生厚度感）；验收看两条 y 方向相反 */
.glass { border: 1px solid var(--glass-edge); border-radius: var(--r-lg);
  box-shadow: inset 0 1px 0 var(--glass-edge),
              inset 0 -1px 0 var(--glass-edge-dark), var(--shadow-2); }
```

```css
/* 出现动效：动透明度，不动滤镜 —— 对 backdrop-filter 做 transition 每帧重算模糊，必然掉帧 */
@keyframes glass-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.glass--enter { animation: glass-in 200ms var(--ease-out) both; }
```

```css
/* 焦点环必须在玻璃上可见；可点目标 ≥ 44px */
.glass :where(a, button, input):focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--bg) 65%, transparent);
}
.glass .icon-btn { min-width: 44px; min-height: 44px; }
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 玻璃叠玻璃 | 两层折射 / 模糊相乘，视觉上变成一团糊，render surface 数量翻倍 |
| 大段正文直接放在玻璃上 | 滚动时背景变化，对比度不可预测；上限 6 行，超过改实色 |
| 全屏玻璃 | 渲染成本高、低端掉帧；整页失去"什么浮在上面"的层级信息 |
| 暗色沿用浅色玻璃参数 | 会发灰：边缘过亮、底色过实、阴影过淡；必须整套重算 |
| 在 `transform` 祖先下用 fixed 玻璃 | 定位与滤镜区域错乱，玻璃随祖先被裁剪 |
| 用 `CSS.supports` 检测 SVG 滤镜 | 三大引擎都返回 true，等于没有检测 |
| 液态玻璃用于大面板或列表项 | 每个 `backdrop-filter` 元素是独立 render surface；面积一大就掉帧 |
| 透明玻璃用在不可控背景上 | 对比度不可控、无法采样验收 |
| 表单控件做成玻璃 | 玻璃底色随背后浮动，聚焦时控件会"跳"；表单一律走实色 + R4 三件套（内环 `--line-inset`） |

## 验收：怎么判断这个风格做对了

- [ ] 变体判定正确：遮住背景只留纯色块，变形 / 糊了 / 清楚三选一
- [ ] 非 Chromium 下 `glass-liquid` 实际落到毛玻璃（Safari / Firefox 各人工看一次，不能只看 `CSS.supports`）
- [ ] 滤镜 `<svg>` 用 `width:0;height:0` 隐藏，页面搜不到对它生效的 `display:none`
- [ ] 一页 `backdrop-filter` 元素 ≤ 3（液态 ≤ 2）；玻璃上正文 ≤ 6 行；最亮 / 最暗两帧下正文对比均 ≥ 4.5:1、焦点环均 ≥ 3:1
- [ ] 暗色玻璃不透明度、边缘光、外投影与浅色不同（42% / 16% / 24% 一组）
- [ ] `transition-property` 不含 `backdrop-filter`；`prefers-reduced-transparency: reduce` 下有实色回退
- [ ] `glass-transparent` 有登记在案的受控背景资产与压暗层；关掉所有玻璃后页面仍能读

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 以为"玻璃 = 白 + 模糊 + 描边"，三支共用一份 CSS | 三支失败模式不同：液态怕阶梯与引擎缺失，毛玻璃怕暗色发灰，透明怕背景不可控；共用参数只能在三支上各做到 60% |
| 用白色半透明代替页面基色的半透明 | 暗色下会发灰发脏；`--glass-bg` 必须由 `--surface-*` 派生 |
| 把 `backdrop-filter` 放在列表项上 | 列表可滚动 → N 个独立 render surface → 滚动时持续重绘，性能断崖 |
| 只做降级链的第一级 | 非 Chromium 看到"没有折射的玻璃"会当成 bug；三级参数都要进合同 |
| 玻璃上放正文又滚动 | 对比度随滚动位置变化，一次性采样无法保证 |
| 用液态玻璃做整页背景 | 形态是"一块玻璃"不是"一层空气"；面积放大后最近邻采样的阶梯在 1x 屏可见 |
| 手工推导位移场去"优化"现成实现 | 编码方式（128 = 不动）、双通道抗阶梯、sRGB 插值任一处错都产生不可调试的伪影；用 `hyalite.js` |
