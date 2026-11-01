# AI 界面三条 · R6 全文

> 什么时候读这份：项目有对话 / 生成 / 流式输出、行内图标混排、可折叠的"思考过程"区块；`audit.mjs` 报流式或图标问题。

R6 的一句话版在 [`00-non-negotiable.md`](00-non-negotiable.md) §3.6。三条都是**可验收的具体实现决定**：做过之后明显更好，不做就一眼是玩具。

| 子条 | 决定 | 反例 |
|---|---|---|
| R6.1 | 流式文字用**模糊对焦**逐字入场 | 逐字蹦出、整段一次性出现 |
| R6.2 | 行内图标下移 **`-0.125em`** | 图标坐在基线上，比文字高 |
| R6.3 | 思考框用 **`0fr → 1fr`** 网格撑开 | `height` 动画、JS 量高 |

---

## 1. R6.1 · 流式文字

### 1.1 关键帧与参数

```css
@keyframes glyph-focus {
  from { filter: blur(6px); opacity: .35; transform: translateY(2px); }
  to   { filter: blur(0);   opacity: 1;   transform: translateY(0); }
}
.glyph {
  display: inline-block;
  animation: glyph-focus 200ms cubic-bezier(.2,.7,.2,1) both;
  animation-delay: calc(var(--i) * 30ms);
  will-change: filter, opacity, transform;
}
```

| 参数 | 值 | 调错的后果 |
|---|---|---|
| `blur` / `opacity` / `translateY` 起点 | 6px / .35 / 2px | 3px 读不出对焦感；0 变成纯淡入；8px 变成弹跳 |
| 时长 / 缓动 | 200ms / `cubic-bezier(.2,.7,.2,1)` | 400ms 拖尾，120ms 看不见；`linear` 显得机械 |
| 错峰 | 30ms | 60ms 像打字机；10ms 糊成一团 |
| `both` | 必须 | 缺了会在 delay 期间先以终态渲染，闪一下再变糊 |

**`animation-fill-mode: both` 不能省。** 没有它，带 `animation-delay` 的字在延迟期以"无动画"状态渲染（完全清晰），30ms 后才突然变糊再对焦——比不做还难看。单字 200ms、错峰 30ms，同屏最多约 7 个字在动（200 / 30 ≈ 6.7）；这部分重叠是有意的，压到 15ms 会让 13 个字一起动，整段始终半糊。`--i` 是**相对当前批次的序号**，不是全文序号。

### 1.2 性能约束

| 约束 | 规则 | 为什么 |
|---|---|---|
| **只 append** | 只向尾部追加新 `<span>`；已完成的字**合并为纯文本节点** | 重排已渲染文本会触发整段 layout |
| **只给最新 30 字挂动画** | 超出的旧 span 移除 class、清 `will-change`、合并 | 每个 `filter` 元素是一个合成层，累积吃满 GPU |
| **>40 字/秒批量入场** | 按 2–3 字一组，共用同一个 `--i` | 错峰间隔小于帧间隔，视觉变成噪点 |
| **不滚动到中间** | `overflow-anchor: none`，仅在用户贴底时自动滚 | 自动滚动打断用户回看 |
| **不用 `setInterval`** | 用 `requestAnimationFrame` 批量 flush | 定时器回调与绘制打架 |

```js
const MAX_LIVE = 30;                    // 同屏最多挂动画的字数
const BATCH_RATE = 40;                  // 字/秒，超过则批量入场

function flush(buffer) {
  const chars = [...buffer];
  const groups = chars.length > BATCH_RATE / 30 ? chunk(chars, 2) : chars;
  groups.forEach((text, i) => live.append(makeGlyph(text, i)));
  trimAndMerge(MAX_LIVE);               // 只 append，不回头改已渲染的节点
}

function makeGlyph(text, i) {
  const span = document.createElement('span');
  span.className = 'glyph';
  span.style.setProperty('--i', i);
  span.textContent = text;
  return span;
}

function trimAndMerge(max) {
  const spans = live.querySelectorAll('.glyph');
  const n = spans.length - max;
  if (n <= 0) return;
  let text = '';
  for (let i = 0; i < n; i++) {
    spans[i].classList.remove('glyph'); // class 与 will-change 一并清掉
    text += spans[i].textContent;
    spans[i].remove();
  }
  live.insertBefore(document.createTextNode(text), live.firstChild);
}
```

**合并必须是纯文本节点，不是另一个 `span`。** `span` 在 DOM 树上更整齐，但每个节点仍参与样式计算；纯文本节点是零成本的。

### 1.3 无障碍

动画层与可读层**必须分开**。

```html
<div class="stream" aria-hidden="true">
  <span class="glyph" style="--i:0">你</span><span class="glyph" style="--i:1">好</span>
</div>
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">你好</div>
```

```css
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; border: 0;
}
```

| 规则 | 值 | 理由 |
|---|---|---|
| 动画层 `aria-hidden="true"` | — | 逐字 span 会让屏幕阅读器反复朗读碎片 |
| `aria-live="polite"` | 不是 `assertive` | 不打断用户当前操作 |
| 更新节流 | **200–300ms** | 每来一个字就更新会淹没朗读队列 |
| `aria-atomic="true"` | — | 每次都读整段，否则只读增量、上下文断裂 |
| 完成时立即更新一次 | — | 保证最终文本完整 |

不要在动画层上加 `aria-live`：一个 `aria-hidden` + 一个 `aria-live` 两个节点同步，是唯一可靠的做法。

### 1.4 reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  .glyph { animation: glyph-fade 120ms linear both; animation-delay: 0s; }
  @keyframes glyph-fade { from { opacity: .35 } to { opacity: 1 } }
}
```

**只留透明度。** `blur` 与 `translate` 都必须去掉——前者对前庭敏感人群是视觉噪声，后者是运动。更保守的做法是错峰归零，整段一起淡入。

### 1.5 CJK 标点与换行

| 情况 | 处理 | 理由 |
|---|---|---|
| 换行符 `\n` | **不生成 span** | 空 span 会占一个错峰位，出现 30ms 停顿 |
| 空格 | 生成 span，容器 `white-space: pre-wrap` | 连续空格会被 HTML 折叠 |
| CJK 标点（，。、；：！？） | **允许悬挂**，不参与错峰 | 标点单独对焦会让字"跳" |
| 开引号 / 左括号 | 与前一个字同组 | 避免行首出现孤立动画 |
| 拉丁单词 | 按**字**切，不按词切 | 按词切会让长单词一次出现，节奏断裂 |
| emoji / 组合字符 | 用 `Intl.Segmenter` 按**字素簇**切 | `split('')` 会拆出半个 emoji |

```js
const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
const glyphs = [...seg.segment(text)].map((s) => s.segment);
```

`Intl.Segmenter` 在最低浏览器矩阵（Chromium 111 / Safari 16.4 / Firefox 113）里全部可用。容器三行：

```css
.stream {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  hanging-punctuation: allow-end;   /* 仅 Safari 生效，其他引擎是无害的空操作 */
}
```

---

## 2. R6.2 · 行内图标下移 1/8 字高

```css
.prose .ico-inline {
  display: inline-block;
  width: 1em; height: 1em;
  vertical-align: -0.125em;   /* 1/8 em */
  flex: none;
}
```

`-0.125em` = 当前 `font-size` 的 −1/8：15px 字号下移 1.875px，32px 字号下移 4px。**它随字号自动缩放**，这是用 `em` 而不是 `px` 的全部理由。

### 2.1 为什么是 `-0.125em`

图标的默认基线是它自己的底边。文字基线上，`x-height` 的中心在基线上方约 `0.25em`；一个 `1em` 见方的图标，中线在基线上方 `0.5em`。

```
         ┌──────┐  ← 图标顶，高 1em
    ─────┤  ●   │  ← 图标中心，基线以上 0.5em
   基线  └──────┘  ← 图标底，坐在基线上
         xxxxxxx    ← 文字 x-height 区，中心在基线上约 0.25em
```

相差 0.25em → 图标偏高；下移差值的**一半**（0.125em）→ 图标中心落到 0.375em，与文字重心重合。`1em` 图标与典型字体 `x-height ≈ 0.5em` 之间的半个差值就是 `0.125em`，它是 **CJK / Latin 混排的标准光学修正量**，也是 R1 定义的光学值，必须走 `--icon-shift` token。

| `vertical-align` | 效果 | 何时用 |
|---|---|---|
| `baseline`（默认） | 图标坐基线，偏高 | 几乎从不对 |
| `middle` | 对齐"基线 + x-height/2"，**仍偏高约 0.125em** | 不推荐 |
| **`-0.125em`** | 精确光学居中 | **正文行内图标的标准答案** |
| `-0.15em` ~ `-0.2em` | 更低 | 图标下方视觉重量较强时 |

**`middle` 不是"居中"。** 它对齐的是"基线 + x-height/2"，而那个"一半"按字体 x-height 算，与图标几何中心并不一致——这就是它仍然偏高的原因。

### 2.2 CJK / Latin 混排

| 文字 | 典型 x-height | 视觉重心相对基线 | 行内图标 |
|---|---|---|---|
| Latin（Inter / Helvetica） | 0.52–0.54em | 0.26em | `1em` / `-0.125em` |
| CJK 汉字 | 0.86–0.88em（满格） | 0.43em | `1.05em` / `-0.18em` |
| 数字 | 0.70–0.72em | 0.35em | 同 Latin |

同一行里中英文都出现时，图标只能对齐其中一个：**图标紧邻哪种文字就对齐哪种**；默认对齐 Latin（`-0.125em` 就是按 Latin 推的），纯中文段落里图标略大、下移更多。大标题行内降到 `0.9em`（比例不变）——32px 正文配 32px 图标太重。

```css
/* 纯中文正文行内 */
.prose:lang(zh) .ico-inline { width: 1.05em; height: 1.05em; vertical-align: -0.18em; }
/* 中英混排：保持 -0.125em，不跟中文 */
.prose.mixed .ico-inline { vertical-align: -0.125em; }
```

### 2.3 与 `align-items: center` 的区别

`vertical-align` 只对内联格式化上下文生效。flex 容器里图标走 `align-items`，那是**盒子**居中，而按钮里的图标盒就是 `1em` 见方，几何居中在该场景下正确。R6.2 说的是**正文行内**混排，flex 内不要机械复制 `-0.125em`；只有截图确实显示偏移时，才给 flex 内的图标补 `transform: translateY(.5px)`。

```css
.prose .ico-inline { vertical-align: -0.125em; }                 /* 正文行内 */
.btn { display: inline-flex; align-items: center; gap: .5em; }   /* flex 内无需下移 */
```

---

## 3. R6.3 · 思考框用网格撑开

```css
.think {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows .28s var(--ease-out);
}
.think[data-open="true"] { grid-template-rows: 1fr; }
.think > .think__body { overflow: hidden; }
```

| 行 | 作用 | 删掉会怎样 |
|---|---|---|
| `grid-template-rows: 0fr` | 内容区高度归零 | 内容始终全高 |
| `overflow: hidden` 在**直接子元素**上 | 内容被裁掉，`fr` 才能把行高压到 0 | 内容溢出，框体已"打开" |
| `transition` 在 `grid-template-rows` 上 | 让 `fr` 值可插值 | 瞬间跳变 |

### 3.1 为什么不用 `height` 动画

| 障碍 | 说明 |
|---|---|
| 内容高度未知 | 思考过程是流式追加的，展开时还在变长 |
| `height: auto` 不可插值 | CSS 过渡不支持到 `auto`，必须知道两端具体值 |
| JS 量高会失准 | `scrollHeight` 在动画开始那一刻取，之后内容变高，底部被截 |
| 中途变高要重算 | 需 `ResizeObserver`，每次变化打断并重启过渡，产生卡顿 |

`0fr → 1fr` 把"高度是多少"交给浏览器：`0fr` 时 track 高度为 0，`1fr` 时为内容所需高度，过渡在两者之间插值。**内容在动画中途变高，目标值下一帧自动更新，动画依然正确**——这是它唯一胜过一切的属性。

时长 **280ms**（`--dur-slow` 320ms 太长，`--dur-base` 200ms 对大面积展开太快），缓动 `cubic-bezier(.2,.7,.2,1)`，只动高度。280ms 是**时长**不是结构尺寸，不受 R1 网格约束。**不要加 `opacity` 过渡**——展开过程中内容透明度在变，用户会以为"还在加载"。

### 3.2 降级链

| 浏览器能力 | 方案 |
|---|---|
| 支持 `fr` 过渡 | 本文主方案（基线矩阵全部支持，**不需要特性检测**） |
| 不支持 `fr` 过渡 | `interpolate-size: allow-keywords` + `height: auto` |
| 都不支持 | 即时展开，功能可用，只是没有动画 |

```css
@supports not (grid-template-rows: 0fr) {
  .think { display: block; height: 0; overflow: hidden; }
  .think[data-open="true"] { height: auto; }
}
@supports (interpolate-size: allow-keywords) {
  .think {
    display: block; height: 0; overflow: hidden;
    interpolate-size: allow-keywords;
    transition: height .28s var(--ease-out);
  }
  .think[data-open="true"] { height: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .think { transition: none; }        /* 即时展开 */
}
```

降低动效时**不要改成"淡入"**——高度变化是布局变化，用户预期内容移动；"布局跳了但内容淡入"会更难理解。

### 3.3 无障碍

```html
<section class="think" data-open="false">
  <button class="think__toggle" aria-expanded="false" aria-controls="t1">思考过程</button>
  <div class="think__body" id="t1"><p>……</p></div>
</section>
```

| 项 | 要求 |
|---|---|
| `aria-expanded` | 随状态切换 `"true"` / `"false"` |
| `aria-controls` | 指向内容区 `id` |
| 内容区 | **不加 `hidden`**；用 `visibility` 控制无障碍树 |
| 触发器 | 必须是 `<button>`（自带 Enter / Space） |

```css
.think__body { overflow: hidden; visibility: hidden; transition: visibility 0s .28s; }
.think[data-open="true"] .think__body { visibility: visible; transition: visibility 0s; }
```

`visibility` 从无障碍树移除内容，同时不打断高度动画（它不参与布局）。

---

## 4. 三条的组合场景

真实气泡里三条同时出现：header 的行内图标（R6.2）→ 思考框（R6.3）→ 流式正文（R6.1）+隐藏的 `aria-live` 节点。

| 冲突点 | 处理 |
|---|---|
| 思考框里也有流式文字 | 同样走 R6.1，但**错峰减半**（15ms），次要内容放慢会让人一直等 |
| 行内图标出现在流式文本里 | 图标**不参与错峰**，直接渲染 |
| 流式增长时用户展开思考框 | 两者互不干扰（transform + filter vs grid 行高） |
| 思考框内流式文字何时开始 | **展开动画结束后**再开始，否则 `fr` 目标高度每帧在变 |

---

## 5. 反例

| 反例 | 为什么错 |
|---|---|
| 逐字 `setInterval` 追加 + `scrollIntoView` | 持续回流；长回答掉帧；滚动打断用户 |
| 给每个字永久保留 `.glyph` | 上千个合成层，移动端内存爆 |
| 动画层直接挂 `aria-live`，或每来一字就更新 | 朗读队列堆积，用户听到几秒前的内容 |
| 用 `split('')` 切字 | 拆坏 emoji 与组合字符 |
| 图标用 `vertical-align: middle` 或固定 `px` | 仍然偏高；字号一变就错位 |
| 思考框用 `max-height: 0 → 1000px` | 内容少时一顿一顿，内容多时被截断 |
| 思考框用 JS 量 `scrollHeight`，或加 `opacity` 淡入 | 动画中途内容变高就失准；内容看起来像还在加载 |
| reduced-motion 下只把时长改短 | 前庭敏感用户仍看到运动；必须去掉 blur 与位移 |

---

## 6. 验收

`audit.mjs`（L2）：

```
R6.1  .stream .glyph 的 animationName = glyph-focus；相邻 animation-delay 差 30ms
      DOM 中 .glyph 数量 ≤ 30；.stream 带 aria-hidden="true"
      存在兄弟节点 [aria-live="polite"]
R6.2  行内图标 computed verticalAlign = -0.125em（或 -0.18em 的中文变体）
R6.3  .think 收起时 gridTemplateRows = "0px"，展开后 > 0
      .think__body 带 overflow: hidden
      展开后 getBoundingClientRect().height = 内容自然高度
```

人工复核（L3，截图或录屏）：

- [ ] 流式节奏：录 3 秒，肉眼判断"像对焦"而不是"像打字机"
- [ ] 长回答（>500 字）播放到末尾不掉帧
- [ ] 行内图标在 100% / 200% 缩放下都不飘
- [ ] 流式增长中展开思考框，动画仍平滑
- [ ] 系统开启"减弱动态效果"后三条都退化到可接受状态
- [ ] 屏幕阅读器只听到整段文字，不是逐字

```bash
node scripts/check-tokens.mjs --project <dir>   # icon-shift / dur / ease 是否走 token
```
