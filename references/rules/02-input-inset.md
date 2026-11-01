# 输入框咬合 · R4 全文

> 什么时候读这份：写任何 `input` / `textarea` / `select` / 可编辑表格单元格；`audit.mjs` 报"缺 inset 内环"；某个风格（粗野主义、像素）需要替代方案。

R4 的一句话版在 [`00-non-negotiable.md`](00-non-negotiable.md) §3.4。本文给完整参数、状态、原理与替代方案。

---

## 1. 为什么输入框需要"咬合"

输入框与按钮的区别不是形状，是**方向**。

| 控件 | 视觉方向 | 用户读到的意思 |
|---|---|---|
| 按钮 | 凸起（外投影 + 亮边） | "按我" |
| 输入框 | 凹陷（内投影 + 暗环） | "把东西放进来" |

用一条浅灰细线画个矩形，也能让人知道"这是输入框"，但那是**靠常识认出来的**，不是靠视觉说的。R4 要的是后者：控件在几何上真的比页面低一层。

**人眼判断"凹陷"靠两件事：**

1. **上沿有阴影、下沿没阴影**——光从上方来，凹陷的顶部被遮挡
2. **边缘有一圈更深或更亮的过渡**——材质有厚度

两个都做到，才叫咬合。只做其一，就是"一个带边框的方块"。

---

## 2. 三件套

| 层 | 作用 | 方向 | 视觉贡献 |
|---|---|---|---|
| **外投影** | 让控件与页面分离 | 向外、向下 | "这块是从页面切出来的" |
| **inset 内环** | 咬合线，表示材质厚度 | 1px，四边等宽 | "边缘是硬的、有厚度的" |
| **内投影** | 上沿吃光 | 内部、向下 | "光从上打进来，上沿被压暗" |

三层必须在**同一条 `box-shadow`** 里，顺序为：外投影 → 内投影 → 内环。顺序错了（内环在最前）会被后画的层盖掉。

```css
.field {
  background: var(--surface-sunken);
  border: 1px solid transparent;
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .18),      /* ① 外投影：嵌入页面 */
    inset 0 1px 2px rgb(0 0 0 / .10),     /* ② 内投影：上沿吃光 */
    inset 0 0 0 1px var(--line-inset);    /* ③ 内环：咬合线 */
}
```

`border: 1px solid transparent` 不是装饰——它占住 1px，让 `box-sizing: border-box` 下的内外尺寸一致，也保证 `forced-colors` 模式下有可见边界。**不要删。**

---

## 3. 浅色参数

| 项 | 值 | 说明 |
|---|---|---|
| 底色 | `--surface-sunken` = `oklch(0.968 0.002 85)` / `#F5F4F3` | 比 `--bg` 深半格，与 `--surface-1` 几乎同亮但低一档 |
| 外投影 | `0 1px 2px -1px rgb(0 0 0 / .18)` | 偏移 1px、模糊 2px、负扩展 -1px，贴地 |
| 内投影 | `inset 0 1px 2px rgb(0 0 0 / .10)` | 只在上沿，向下 1px |
| 内环 | `inset 0 0 0 1px color-mix(in oklab, var(--fg) 8%, transparent)` | 比底色深一点，不是白 |
| 圆角 | `--r-sm`（默认 6px） | 与按钮同半径，不同方向 |

**负扩展 `-1px` 是关键。** 去掉它，投影会在控件四周留一圈光晕，控件看起来是"浮着的";加上它，投影被收进控件轮廓内，读作"嵌入"。

`--surface-sunken` 实测对 `--bg` 的对比度只有 **1.05:1**。它贡献的是"材质不同"，不是"边界"。看到这个数字不要慌，边界由另外两层负责（见 §8）。

---

## 4. 暗色参数

| 项 | 浅色 | 暗色 |
|---|---|---|
| 外投影 | `0 1px 2px -1px rgb(0 0 0 / .18)` | `0 2px 6px -2px rgb(0 0 0 / .45)` |
| 内环 | `fg 8%` | `white 6%` |
| 内投影 | `inset 0 1px 2px rgb(0 0 0 / .10)` | 同值（贡献很小，可见性主要由内环承担） |
| 底色 | `--surface-sunken` 浅 | `oklch(0.205 0.002 85)` 附近，比 `--bg` 亮一格 |

```css
:root[data-theme="dark"] .field {
  background: var(--surface-sunken);
  box-shadow:
    0 2px 6px -2px rgb(0 0 0 / .45),
    inset 0 1px 2px rgb(0 0 0 / .10),
    inset 0 0 0 1px rgb(255 255 255 / .06);
}
```

**为什么内环在暗色下反号。** R4 的语义是"边缘比底色更深 = 凹陷"。暗底上不存在"更深"——降到 0 是纯黑，而纯黑已经在 R3 被禁；实际可用的下探空间只有 L 0.18 → 0.10 左右，ΔL 0.08 在暗色下几乎看不出来。所以改用**微亮的 1px 边**表示"这是一个有倒角的开口"，方向语义不变：亮边贴着暗面 = 凹陷边缘反光。

**暗色外投影从 1px/2px 放大到 2px/6px 且 alpha 从 .18 提到 .45**，原因同样是暗底吃掉阴影。浅色的 .18 在暗色下完全不可见。

**不要把暗色内环加到 20% 以上。** white 20% 已经到 `#484746`，控件边缘会变成一圈明显的亮框，那是发光的描边，不是凹陷。

---

## 5. 内环必须"变深"，不能是高光

这是 R4 里最常被做反的一条。

| 做法 | 视觉结果 | 用户读到 |
|---|---|---|
| `inset 0 1px 0 white` 顶部高光 | 上沿亮、下沿暗 | **凸起**的按钮 |
| `inset 0 0 0 1px fg 8%` 四边暗线 | 一圈略深的收边 | **凹陷**的容器 |

```
凸起：   ▁▁▁▁▁▁▁       顶部一道白边，光落在上沿
        │      │
        ▔▔▔▔▔▔▔       底部一道暗边，影子在下方

凹陷：   ▔▔▔▔▔▔▔       顶部一道暗边，光被挡住
        │      │
        ▁▁▁▁▁▁▁       底部一道亮边
```

**高光 + 暗线成对出现**是"厚度"的做法（玻璃拟态也用这个），但输入框不需要厚度，它需要**凹进去**。只用一个四边等宽的暗环，就已经足够表达"这块区域被压进页面"。

反过来，**纯白高光在浅色下根本看不见**——`white 22%` 叠在 `#F5F4F3` 上几乎是同色。这就是为什么很多"内阴影"实现看起来完全没有效果：它们抄了按钮的公式。

**唯一的例外是暗色**，见 §4：那里用 white 6%，因为"更深"不可用。注意 6% 与 22% 不是一回事——前者是发丝级的边缘，后者是会发光的。

---

## 6. 状态

| 状态 | 底色 | 外投影 | 内投影 | 内环 | 额外 |
|---|---|---|---|---|---|
| 默认 | `--surface-sunken` | `0 1px 2px -1px / .18` | `inset 0 1px 2px / .10` | `--line-inset` | — |
| hover | 同默认 | 同默认 | 同默认 | `fg 14%` | 只加深内环，不动位置 |
| focus-visible | 同默认 | 同默认 | 同默认 | `--accent` | 外环 `0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent)` |
| filled（有值） | 同默认 | 同默认 | 同默认 | `--line-inset` | 无变化，靠文字表达 |
| disabled | `color-mix(in oklab, var(--surface-sunken) 60%, transparent)` | 无 | 无 | `fg 6%` | 文字 40% 不透明；`cursor: not-allowed` |
| error | 同默认 | 同默认 | 同默认 | `--danger` | 错误文本见 [`06-form-layout.md`](06-form-layout.md) |
| readonly | `--surface-1` | 无 | 无 | `--line-1` | 去掉凹陷语义，换成"平铺" |

### 6.1 focus 态

```css
.field:focus-visible {
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .18),
    inset 0 1px 2px rgb(0 0 0 / .10),
    inset 0 0 0 1px var(--accent),
    0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent);
}
```

四层，前三层与默认**完全一致**，只把内环换色并追加外环。

| 要点 | 为什么 |
|---|---|
| 用 `:focus-visible` 不用 `:focus` | 鼠标点击不该出现环；键盘必须出现 |
| 内环换成 `--accent` | 3px 外环是"指示"，内环是"控件本身处于焦点"，两者一起才是完整的焦点态 |
| 外环 3px / 22% | 22% 的环实测对比度约 1.33:1，**它不是用来满足 3:1 的**——3:1 由内环的 `--accent` 提供（`--accent` 对 `--surface-sunken` 实测 4.41:1） |
| 不改 `transform` / `outline-offset` | 环是 `box-shadow` 第 4 层，不占布局，不推动相邻元素 |
| `forced-colors` 下 | `box-shadow` 会失效，必须额外给 `outline: 2px solid CanvasText` |

```css
@media (forced-colors: active) {
  .field:focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; }
}
```

**环的对比度不是装饰。** 如果 `--accent` 对输入框底的对比度低于 3:1，焦点态就不合格（`A11Y`）。在深底上这条最容易翻车：`--accent` 在暗色下要换成更亮的版本（如 `oklch(0.720 0.110 250)` / `#6DA9E7`，实测对暗底 7.61:1）。

### 6.2 error 态

错误色只换内环，**不改底色**。把整个输入框染成淡红是常见做法，但它同时降低了文字对比度，而且和"必填标注只靠红色"是同一类错误。

```css
.field[aria-invalid="true"] {
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .18),
    inset 0 1px 2px rgb(0 0 0 / .10),
    inset 0 0 0 1px var(--danger);
}
```

`--danger` 必须自己过 3:1（相对 `--surface-sunken`，实测 `oklch(0.640 0.190 30)` / `#E9523F` 为 3.33:1）。同时必须有文字错误信息与图标——**颜色永远不是唯一的状态信号**。

### 6.3 disabled 态

disabled 时**去掉全部三层**。凹陷语义表示"可以放东西进来"，禁用时这个语义不成立；保留凹陷会让人反复点击。

```css
.field:disabled {
  background: color-mix(in oklab, var(--surface-sunken) 60%, transparent);
  box-shadow: none;
  color: color-mix(in oklab, var(--fg) 40%, transparent);
  cursor: not-allowed;
}
```

禁用态不受 WCAG 1.4.3 约束，所以 40% 不透明的文字是允许的；但**不要**把禁用态做到几乎看不见——用户需要知道"这里有个字段，只是现在不能改"。

---

## 7. 替代方案：硬边框 + 偏移硬阴影

R4 明确允许：新粗野主义 / 像素风用硬边框时，用 `inset 0 0 0 2px var(--fg)` 加偏移硬阴影达到同等"嵌入"语义。

```css
/* 新粗野主义 */
:root[data-style="neo-brutalism"] .field {
  background: var(--bg);
  border: 2px solid var(--fg);
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--fg);
  transform: translate(-1px, -1px);
}
:root[data-style="neo-brutalism"] .field:focus-visible {
  box-shadow: 4px 4px 0 var(--accent);
  border-color: var(--accent);
}
:root[data-style="neo-brutalism"] .field:active {
  box-shadow: none;
  transform: translate(2px, 2px);
}
```

| 件 | 柔光版（R4 默认） | 硬边版 | 共同点 |
|---|---|---|---|
| 分离 | 外投影（模糊） | 偏移硬阴影 `4px 4px 0`（无模糊） | 控件与页面不是同一平面 |
| 边缘 | inset 内环 1px | 实心 `2px` 边框 | 边缘有明确的材质 |
| 方向 | 内投影压暗上沿 | `translate(-1px,-1px)` 把控件推向光源 | 都表达"这是个有形的块" |
| 按下 | 底色压暗 4% | `translate(2px,2px)` + 去掉阴影 | 物理式反馈 |

**硬边版为什么仍然算满足 R4：** R4 的要求是"不用突兀亮线，用几何手段把控件压进页面"。`4px 4px 0` 的硬阴影在左上留出亮区、右下留出暗区，与柔光版是同一套光照模型的极端化，不是"退回带边框的方块"。

**但必须登记。** 它偏离了默认参数，属于风格级偏离：

```json
{
  "rule": "R4",
  "scope": "neo-brutalism.field",
  "requestedValue": "2px solid fg + 4px 4px 0",
  "effectiveValue": "2px solid fg + 4px 4px 0",
  "reason": "新粗野主义签名元素：硬边与偏移硬阴影替代柔光三件套",
  "approvedBy": "user",
  "createdAt": "2026-11-01T10:00:00Z",
  "expiresAt": null,
  "verification": "风格卡 neo-brutalism.verify 第 2 条：每个可点元素都有清晰描边"
}
```

### 7.1 像素风

像素风用同一套硬边逻辑，但所有尺寸取 4px 的整数倍（也是 8pt 的一半格）：

```css
:root[data-style="pixel"] .field {
  background: var(--bg);
  border: 2px solid var(--fg);
  border-radius: 0;
  box-shadow:
    inset -2px -2px 0 color-mix(in oklab, var(--fg) 30%, transparent),
    inset 2px 2px 0 color-mix(in oklab, var(--bg) 60%, white);
  image-rendering: pixelated;
}
```

内亮外暗的"斜角"用两条 inset 硬阴影伪造，是像素 UI 的通用做法。同样要登记 override。

### 7.2 什么时候不许替代

| 场景 | 为什么 |
|---|---|
| 表单是核心流程（注册、支付、设置） | 柔光三件套的"凹陷"语义更明确，错误率更低 |
| 内容密度高的后台 | 硬阴影在密集布局里会互相干扰 |
| 暗色为主的界面 | 硬阴影在暗底上退化成"多一条边"，不如柔光有效 |

**替代方案是风格的附属品，不是省事的捷径。** 如果只是因为写 `box-shadow` 三行太长而简化，那不是偏离，是没做。

---

## 8. 已知张力：内环不是 3:1 边界

必须说清楚，否则会被无障碍审查打成硬伤。

| 元素 | 实测对比度 | 能否当"识别控件的 3:1 边界" |
|---|---|---|
| `--surface-sunken` vs `--bg`（浅色） | 1.05:1 | ✗ |
| `--line-inset`（fg 8%）vs `--surface-sunken` | 1.17:1 | ✗ |
| 内环（white 6%）vs 暗底 | 1.18:1 | ✗ |
| `--accent` 内环 vs `--surface-sunken`（focus） | 4.41:1 | ✓ |

**内环是质感，不是边界。** WCAG 1.4.11 要求"识别控件所必需的视觉信息"达到 3:1——但控件并非只能靠边界识别：

| 情况 | 可接受的做法 |
|---|---|
| 有可见且对比度 ≥ 4.5:1 的 `<label>` | 标签承担识别职责，边界可低于 3:1 |
| 只有 placeholder、无可见标签 | **不允许**。placeholder 不是标签，且会在输入后消失 |
| 输入框是纯图标搜索框 | 必须另给 ≥ 3:1 的边界或图标 |

需要 3:1 边界时，用这两档（已实测）：

| 场景 | 值 | 对底色对比度 |
|---|---|---|
| 浅色 | `color-mix(in oklab, var(--fg) 50%, transparent)` → `#888786` | 3.26:1 |
| 暗色 | `color-mix(in oklab, var(--fg) 40%, transparent)` → `#767574`（fg 为暗色正文 `#ECEBEA`） | 3.82:1 |

代价：这条线明显更重，视觉上会接近"带框输入框"。**在无标签的场景里这个代价必须付。**

---

## 9. 反例

| 反例 | 为什么错 |
|---|---|
| `border: 1px solid #ddd` 当唯一视觉 | 突兀亮线；无凹陷语义；R4 明令禁止 |
| 只加外投影，不加内环 | 控件看起来"贴在页面上"而不是"切进去"；暗色下完全消失 |
| 内环用 `white 22%` | 凸起语义；浅色下不可见，暗色下变成发光描边 |
| 三件套写成三条独立 `border` / `outline` | `outline` 不跟随 `border-radius`（旧版），会露出方角 |
| 用 `height` 写死 36px 但 padding 用 14px | 内容一多就溢出；高度应由 `min-height` + padding 决定 |
| focus 时改 `border-color` 导致布局抖动 | 边框宽度变化会推挤；用 `box-shadow` 不占布局 |
| 暗色沿用浅色的 `.18` 外投影 | 完全不可见，控件和页面糊在一起 |
| 把 `border: transparent` 删掉 | `forced-colors` 下失去边界；尺寸计算也会变 |

---

## 10. 验收

`audit.mjs`（L2）对每个匹配 `input` / `textarea` / `select` / `[contenteditable]` 的元素读 `getComputedStyle`：

```
1. boxShadow 包含至少一条非 inset 投影        → 否则 ✗ "缺外投影"
2. boxShadow 包含 inset 0 0 0 1px（或 2px）    → 否则 ✗ "缺内环"
3. boxShadow 包含 inset 0 1px 2px              → 缺则 ⚠ "缺内投影"
4. :focus-visible 态的内环颜色 = --accent      → 否则 ✗
5. :focus-visible 态存在外环且宽度 ≥ 3px        → 否则 ⚠
6. borderStyle = solid 且宽度 ≥ 1px            → 否则 ⚠ "forced-colors 风险"
```

人工复核（L3）：

- [ ] 缩放到 200%，三层是否仍然分得清
- [ ] 浅色 / 暗色切换时，控件是否都读作"凹陷"
- [ ] 键盘 Tab 到输入框，焦点是否一眼可见
- [ ] 截图对照签样，边界是否与按钮明显区分

```bash
node scripts/check-tokens.mjs --project <dir>   # 色值是否来自 token
```
