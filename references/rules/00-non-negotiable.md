# R1–R9 非协商项全文

> 什么时候读这份：`check-tokens.mjs` / `audit.mjs` 报错要查原文；写 `contract.md` 第 8 段；用户要求覆盖某条规则、需要知道要登记什么；注入块里的一行字被质疑"凭什么"。

本文是规则的**唯一全文**。`SKILL.md` §3 是压缩版，`contract.md` 第 8 段是"本项目取值"，两者都以本文为准；本文的数值以 `SKILL-DESIGN.md` §6 为准。

规则不是教条。它们是可以被推翻的默认值——但推翻必须留痕，见文末「override」。

---

## 1. 规则分级

| 级别 | 含义 | 用户能否覆盖 | 覆盖要做什么 | 参与闸门 |
|---|---|---|---|---|
| **MUST** | 默认必须满足，违反即 `status: fail` | 能 | 在 `decisions.json.overrides[]` 登记九字段，且该 override 的 `verification` 必须在 G4 被满足 | 是 |
| **SHOULD** | 推荐满足，偏离要说明 | 能 | 在 `alignment-report.md` 记录原因，不必进 `overrides` | 偏离需在报告登记 |
| **ADVISORY** | 提示性建议 | 能 | 什么都不用做 | 否 |

三条口径：

1. **"宪法"不等于不可覆盖。** 用户说"这个项目就要纯黑"，不是拒绝执行的理由——执行、并登记 override。
2. **未登记的覆盖等于违规。** 区别不在"改没改"，在"有没有留痕"。L1 把未登记的覆盖报成 `✗`。
3. **override 不能直接产生"通过"。** 登记了也要在 G4 满足 `verification`，否则一样不通过。

**优先级链**（冲突时从上往下）：

```
用户显式要求 > MUST 规则 > 导演层方向 > SHOULD 规则 > 检测器默认规则 > 模型默认
```

---

## 2. 总表

| # | 规则 | 级别 | 主落点 token | 深度规格 |
|---|---|---|---|---|
| R1 | 视觉对齐 | MUST（构图）/ SHOULD（光学） | `--s-1…--s-8`、`--line-hair`、`--label-gap`、`--icon-shift` | 本文 §3.1 |
| R2 | 微对比色阶 | MUST | `--bg`、`--surface-1/2/3`、`--line-*` | [`01-color-scale.md`](01-color-scale.md) |
| R3 | 禁用纯黑 | MUST | `--fg`、`--bg`、`--line-*` | [`01-color-scale.md`](01-color-scale.md) |
| R4 | 输入框咬合 | MUST | `--surface-sunken`、`--line-inset`、`--accent` | [`02-input-inset.md`](02-input-inset.md) |
| R5 | 暗色字重降一档 | MUST | `--fw-body/strong/display`、`weightLadder` | [`03-dark-mode.md`](03-dark-mode.md) |
| R6 | AI 界面三条 | MUST | `--icon-shift`、`--dur-*`、`--ease-out` | [`04-ai-ui.md`](04-ai-ui.md) |
| R7 | 计时器等宽 | MUST（有 `tnum`）/ SHOULD（要换字族） | `--font-mono` | 本文 §3.7 |
| R8 | 设置页 | MUST | `--row-h`、`--s-6`(40)/`--s-7`(48)、`--line-hair` | [`05-settings-surface.md`](05-settings-surface.md) |
| R9 | 表单页 | MUST | `--s-5`(24)、`--label-gap`、`--fs-sm` | [`06-form-layout.md`](06-form-layout.md) |

**网格口径**（R1 的前提，全文共用）：8pt 基线，允许它的 4px 半格（`--s-1: 4px` 就是这个半格）。也就是说结构值必须是 **4 的倍数**，主阶梯用 8 的倍数。13 / 15 / 22 / 30 这类值不是"差一点"，是**没有 token**。

---

## 3. 逐条全文

每个小节统一五段：规格 / 反例 / 落点 / 例外 / 验收。验收里的规则 id 就是脚本输出的 id。

### 3.1 · R1 视觉对齐

| | |
|---|---|
| **规格** | 双读，两条都做。(a) **构图**：结构尺寸对齐 8pt 基线网格；文本块对齐**内容轴**而不是盒子轴；图标与文本做**光学**对齐而不是数学居中。(b) **实现**：实现结果与签样截图逐项对齐。 |
| **反例** | `margin: 13px` 凑视觉（且没登记为光学值）；图标用 `align-items: center` 之后比文字高 1px，还觉得"居中了"；卡片用 `padding: 15px` 让它"看起来跟旁边的对齐"。 |
| **落点** | 结构值 `--s-1` 4 / `--s-2` 8 / `--s-3` 12 / `--s-4` 16 / `--s-5` 24 / `--s-6` 32 / `--s-7` 48 / `--s-8` 64；光学值 `--line-hair` 1px、`--label-gap` 6–8px、`--icon-shift` `-0.125em`、组标题 `--fs-sm` 13–14px |
| **例外** | 光学细则本身是 SHOULD：允许偏离网格，但必须**走独立 token**或在合同登记。不走 token 的光学值一律按违规处理。 |
| **验收** | `audit.mjs`（L2）只对结构值做网格校验，对光学值只校验"是否引用了 token"；L3 对照 `shots/approved-*.png` 逐项记录偏差。 |

**结构值 vs 光学值是两类东西，不要混着争。**

| 类别 | 例子 | 必须落 8pt？ | 必须走 token？ |
|---|---|---|---|
| 结构值 | 栅格间距、容器宽、行高、组件高、组间留白 | 是 | 是（`--s-*`） |
| 光学值 | 1px 细线、标签→输入 6–8px、`-0.125em` 图标偏移、13–14px 组标题 | 否 | 是（独立 token） |

### 3.2 · R2 微对比色阶

| | |
|---|---|
| **规格** | 相邻表面层级的 **`ΔL = \|L₁ − L₂\|`**（OKLCH **L 通道绝对差值**）必须落在 `[0.010, 0.030]`。同一色阶内**色相漂移 ≤ 2°**，**彩度保持一致**。描边色不参与层级，单独一条 `--line-*` 阶梯。 |
| **反例** | 把 ΔL 当成"相对百分比"算；用 0.008 让卡片"几乎看不见"；用 0.045 做出卡片叠卡片；表面 ΔL 达标就认为可读性也达标（这是两个独立检查）。 |
| **落点** | `--bg`、`--surface-1/2/3`、`--line-1`、`--line-inset` |
| **例外** | 无。暗色阶梯**独立计算**，同样要落进 `[0.010, 0.030]`。 |
| **验收** | `check-tokens.mjs` 规则 `R2`：对 `surfaceLadder.step[]` 逐项判界，再从实际 token 的 L 值重算一遍；Studio 配色面板显示每一级的 ΔL。 |

**这是全文最容易写错的一条。** 数字抄错会导致整条规则失效：

```
正确  ΔL = |L₁ − L₂| ∈ [0.010, 0.030]      L 是 OKLCH 的 L 通道，取值范围 0–1
错误  ΔL = |L₁ − L₂| / L₁ ∈ 1%–3%          这是相对百分比，不是本规则
错误  "相对亮度差 1%–3%"                    不是 WCAG 相对亮度
```

`check-tokens.mjs` 的判定边界带 `1e-9` 容差，0.010 与 0.030 本身**合法**。详见 [`01-color-scale.md`](01-color-scale.md)。

### 3.3 · R3 禁用纯黑

| | |
|---|---|
| **规格** | 正文用 `#1A1A19`，实测 **`oklch(0.2174 0.0019 106.6)`**（暖调深灰）。**不透明**的 `#000` / `rgb(0 0 0)` / `oklch(0 0 0)` 不得用于**文字、背景、边框、图标填充**四个场景。 |
| **反例** | `color: #000`；`background: rgb(0 0 0)`；用 `oklch(0 0 0)` 当不透明遮罩底；在 token 表里把 `--fg` 写成 `#181818`（不是纯黑，但也不是登记过的值，属于 `T2` 裸值）。 |
| **落点** | `--fg`（正文）、`--bg`（页面底）、`--line-*`、图标填充 |
| **例外** | **带 alpha 的黑是允许的**：阴影、玻璃边缘暗线、叠加遮罩里的 `rgb(0 0 0 / .18)` 是透明度混合工具，不是"纯黑色块"。另外允许：打印样式、风格卡明确声明的硬描边（新粗野主义 / 像素风）——后者必须登记 override。 |
| **验收** | `check-tokens.mjs` 规则 `R3` 按**使用场景**（行内是否出现 `shadow` / `inset` / `color-mix` / `rgba()` / `transparent`）判定，不按字面扫 `000`；L1 人工复核豁免清单。 |

**写 `#1A1A19` 的 oklch 时用四位小数，不要手写近似值。**

```css
--fg: oklch(0.2174 0.0019 106.6);  /* #1A1A19 */
/* 写成 0.217 0.002 104 会让 hex/oklch 对照失败，check-consistency 会漂 */
```

### 3.4 · R4 输入框咬合

| | |
|---|---|
| **规格** | 三件套：**外投影**（嵌入页面）+ **inset 内环**（咬合线）+ **内投影**（上沿吃光）。内环的颜色是"**变深**"，不是白色高光。 |
| **反例** | 用一条突兀的亮色 `border: 1px solid #ddd` 当边界；内环用 `inset 0 1px 0 white` 做出"浮起"；只加外投影不加内环，暗色下控件完全贴平。 |
| **落点** | `--surface-sunken`（底）、`--line-inset`（内环，浅色 = fg 8%）、`--accent`（focus 内环） |
| **例外** | 新粗野主义 / 像素风：改用硬边框 + 偏移硬阴影达到同等"嵌入"语义，见 [`02-input-inset.md`](02-input-inset.md)。 |
| **验收** | `audit.mjs` 读 `getComputedStyle(el).boxShadow`，必须同时包含一条非 inset 投影与一条 `inset 0 0 0 1px` 内环。 |

```css
.field {
  background: var(--surface-sunken);
  border: 1px solid transparent;
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .18),      /* 外投影：嵌入页面 */
    inset 0 1px 2px rgb(0 0 0 / .10),     /* 内投影：上沿吃光 */
    inset 0 0 0 1px var(--line-inset);    /* 内环：咬合线 */
}
/* 暗色：外投影 0 2px 6px -2px / .45；内环改 white 6% */
```

### 3.5 · R5 暗色字重降一档

| | |
|---|---|
| **规格** | 切暗色时，**大字号（≥ 16px）的 body / strong / display 三档各降一格**。可变字体减 50–100（或 `font-variation-settings: "wght" 原值−75`）；静态字体换到下一档更轻的**可用**字重。**小于 16px 的文字不降档**，保持浅色档字重。**只作用于文字**，图标 / 分割线 / 边框不降。 |
| **反例** | 全站 `font-weight: 300`；把小字也降（13px 的 400 → 350 只是变糊，没有变细）；把图标、边框一起降；静态字体没查 `weightLadder.available` 就写 350；降完不重测对比度。 |
| **落点** | `--fw-body` / `--fw-strong` / `--fw-display`；`--fw-small`（跨主题恒定）；`weightLadder.available`；`tokens.json` 的 `actualWeight` |
| **例外** | 无。字体没有目标字重时走**映射**，不走豁免。 |
| **验收** | `check-tokens.mjs` 规则 `R5`：启用暗色就必须有 `weights.dark`；三项都必须**低于** `weights.light`；`body ≥ 300`；`--fw-small` 必须存在且等于浅色值；不在 `available` 内则告警（要求补 `actualWeight`）。 |

**为什么小字不降**：halation（暗底字看起来更粗）的补偿量随笔画绝对宽度增长。15px 的 400 降到 350，笔画只从 2px 变到 1.75px——视觉上读不出"细了一档"，只是从清楚变成发虚。**小字降档没有收益，只有代价。**

**护栏**（三条都不能省）：

| 护栏 | 阈值 | 为什么 |
|---|---|---|
| 正文下限 | ≥ 300 | 低于 300 的大字正文在暗底上糊成一团 |
| 小字恒定 | < 16px 时使用 `--fw-small`，**暗色下与浅色同值** | 小字降档只变糊不变细；这条同时覆盖"≥ 400"的老护栏 |
| 对比度复测 | 降档后仍须 ≥ 4.5:1 | 不达标就**回退一档**，不是调背景 |

**分界线按字号算，不按语义角色**：`--fs-xs`(12) / `--fs-sm`(13) / `--fs-md`(15) 都是小字，用 `--fw-small`；`--fs-lg`(18) 及以上才参与降档。一个 15px 正文的项目，暗色下正文确实不降——这是正确行为，不是遗漏。

### 3.6 · R6 AI 界面三条

| | |
|---|---|
| **规格** | ① **流式文字**：每个字出现时高斯模糊 → 瞬间对焦，相邻字错开 **30ms**；② **行内图标**：`vertical-align: -0.125em`；③ **思考框**：`grid-template-rows: 0fr → 1fr` 撑开。 |
| **反例** | ① 用 `setInterval` 逐字追加并滚动（持续回流，长回答掉帧）；② 图标 `vertical-align: middle` 之后在 CJK 行里飘高；③ 用 `height` 动画展开思考框（内容还在流式增长，中途失准）。 |
| **落点** | `--icon-shift`、`--dur-base` 200ms、`--ease-out`、`--ease-inout` |
| **例外** | `prefers-reduced-motion: reduce` 时取消 blur 与位移，**只保留透明度**。这是唯一允许的降级，不是例外。 |
| **验收** | L3 人眼看节奏；`audit.mjs` 检查行内图标的 computed `vertical-align` 为 `-0.125em`、思考框展开后 `grid-template-rows` 为 `1fr`。 |

```css
@keyframes glyph-focus {
  from { filter: blur(6px); opacity: .35; transform: translateY(2px); }
  to   { filter: blur(0);   opacity: 1;   transform: translateY(0); }
}
.glyph {
  display: inline-block;
  animation: glyph-focus 200ms cubic-bezier(.2,.7,.2,1) both;
  animation-delay: calc(var(--i) * 30ms);
}
```

```css
.think { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s var(--ease-out); }
.think[data-open="true"] { grid-template-rows: 1fr; }
.think > .think__body { overflow: hidden; }
```

实现约束（性能与无障碍）见 [`04-ai-ui.md`](04-ai-ui.md)：只 append、只给最新 30 字挂动画、>40 字/秒时 2–3 字一组、动画层 `aria-hidden` + 隐藏 `aria-live="polite"` 每 200–300ms 更新。

### 3.7 · R7 计时器等宽

| | |
|---|---|
| **规格** | `font-variant-numeric: tabular-nums slashed-zero` + `font-feature-settings: "tnum" 1, "zero" 1` + `letter-spacing: .01em`。字体**没有 `tnum`** 时，数字单独用一个等宽字族，字号与字重对齐正文。容器 `min-width: Nch` 预留宽度。 |
| **反例** | 比例数字跳秒时整行左右抖；换成 `monospace` 但字号没对齐，数字比正文大一号；给秒的跳动加 `translateY` 动画，视线被拉走。 |
| **落点** | `--font-mono`（回退字族）、组件级 `.timer` 规则 |
| **例外** | 需要换字族时级别降为 **SHOULD**：可以换，但要在报告登记，并保证字重与正文同步降档（R5 同样作用于等宽字）。 |
| **验收** | `audit.mjs` 读 computed `font-variant-numeric` 含 `tabular-nums`，或确认回退字族生效；截图连拍两帧，数字区域无水平位移。 |

**秒级跳动只做透明度微变，不做位移动画。**

### 3.8 · R8 设置页

| | |
|---|---|
| **规格** | 名称在左、控件在右、**一行一项**；**去掉最外层框**（页面即背景）；每组有标题（13–14px，次要色），组间 40–48px，组内 0，行间只留 1px 细线；行高 52–56px、上下 padding 12–14px；标签与控件间距 ≥24px、标签最多两行；删除操作独立成组置于最后；控件右缘对齐到内容轴右缘。 |
| **反例** | 整页套一张大卡片再加一层阴影（"设置页看起来像仪表盘"）；每行一个 `gap: 12px` 的列表（组内留白不是 0）；控件各自宽度，右缘参差；把"删除账号"放在"通知"下面当邻居。 |
| **落点** | `--row-h` 52、`--s-6` 40 / `--s-7` 48、`--s-5` 24、`--s-3` 12、`--line-hair`、`--fs-sm` |
| **例外** | 无。密集设置页允许组间取 40 而不是 48，但**不允许**超出 40–48 区间。 |
| **验收** | `audit.mjs`：页面级容器无 `box-shadow` 与可见 `border`；相邻行只隔 1px；同组控件右缘 `getBoundingClientRect().right` 一致；组间垂直距离落在 40–48。 |

### 3.9 · R9 表单页

| | |
|---|---|
| **规格** | 标签在上、输入区在下；输入区**全宽**（不顺排、不并排）；标签→输入 6–8px；字段→字段 **24px**；帮助文本输入下方 12–13px 次要色；错误文本**替换**帮助文本、预留同高；必填用文字或小圆点，不只用红色星号；提交按钮桌面右对齐、移动端全宽。 |
| **反例** | `姓名 [input]   电话 [input]` 并排两列；标签与输入同一行；错误文本出现时整页往下跳 20px；必填只靠一个红 `*`；提交按钮左对齐粘在最后一个字段下面。 |
| **落点** | `--s-5` 24（字段间距）、`--label-gap` 8、`--fs-sm` 13、`--danger` |
| **例外** | 无。 |
| **验收** | `audit.mjs`：输入区宽度 = 内容轴宽；字段间垂直距离 24；帮助态与错误态切换时后续元素 `offsetTop` 不变；`<input>` 上有 `aria-required` 或 `required`。 |

---

## 4. override

**override = 对某条规则的显式豁免，登记才成立。**

### 4.1 九字段

| 字段 | 类型 | 约束 | 写什么 |
|---|---|---|---|
| `rule` | string | 必须匹配 `^(R[1-9]\|A11Y\|T2)$` | 被覆盖的规则 id；无障碍用 `A11Y`，裸色值用 `T2` |
| `scope` | string | 非空 | **必须包含被豁免的 token 名**，如 `neo-brutalism.border` 不会豁免 `--bg` |
| `requestedValue` | 任意 | — | 用户要的值，原样记录 |
| `effectiveValue` | 任意 | — | 最终写进 token 的值（通常与 `requestedValue` 相同） |
| `reason` | string | 非空 | 为什么覆盖。写"用户坚持"可以，写"设计需要"不行 |
| `approvedBy` | string | 非空 | `user` 或具体人名；agent 不能自批 |
| `createdAt` | string | `date-time` | ISO 8601，带时区 |
| `expiresAt` | string \| null | — | 永不过期写 `null`；临时豁免写日期 |
| `verification` | string | 非空 | **G4 怎么验证这条豁免是有意的**，如 `impeccable-disable overused-black` |

**缺任一项 = 未登记覆盖**：`check-tokens.mjs` 规则 `O1` 报错，G4 不通过。

### 4.2 登记流程

1. **在 P2.5 / P5 发现冲突时停下来**，不要先写代码再补登记。
2. **回显代价**："这条会让卡片层级在低质量屏上消失"——说清后果，再问要不要。
3. **用户明确同意**。没有明确同意 = 不走 override，走正常实现。
4. **写入 `decisions.json.overrides[]`**，九字段齐全；`scope` 里带 token 名。
5. **跑 `build.mjs`**，让 `contract.md` §3.4 与注入块同步；`contract.md` 里"刻意偏离"写进第 9 段。
6. **在 G4 满足 `verification`**：跑对应命令或截图，把结果贴进 `alignment-report.md`。

### 4.3 示例

```json
{
  "rule": "R3",
  "scope": "neo-brutalism.border",
  "requestedValue": "#000",
  "effectiveValue": "#000",
  "reason": "风格卡声明纯黑描边是签名元素，用户确认保留",
  "approvedBy": "user",
  "createdAt": "2026-11-01T10:00:00Z",
  "expiresAt": null,
  "verification": "impeccable-disable overused-black"
}
```

```bash
# 登记完必须重跑，让合同与注入块跟着变
node scripts/build.mjs --project <dir>
node scripts/check-tokens.mjs --project <dir>   # O1 应清零
```

### 4.4 常见写错

| 写法 | 为什么错 |
|---|---|
| 只写 `reason: "设计需要"` | 三个月后没人能判断这是决策还是偷懒 |
| `approvedBy: "aesthetic"` | agent 不能自批；只能是用户 |
| `scope: "全局"` | L1 按 `scope.includes(token 名)` 匹配豁免，`全局` 匹配不到任何 token |
| `verification: "以后再说"` | 无法执行 = 无法通过 G4 |
| 改了 token 但没写 `overrides` | 这不是覆盖，是漂移，`T2` 会报裸值 |
| 写了 override 却没跑 `build.mjs` | 合同与注入块仍是旧值，G3 `check-consistency` 失败 |

---

## 5. 验收速查

| 规则 | 规则 id | 在哪跑 | 判据一句话 |
|---|---|---|---|
| R1 | — | `audit.mjs` L2 | 结构值 4 的倍数；光学值引用了 token |
| R2 | `R2` | `check-tokens.mjs` L1 | `\|L₁−L₂\| ∈ [0.010, 0.030]`，逐级重算 |
| R3 | `R3` | `check-tokens.mjs` L1 | 文字/背景/边框/图标无不透明纯黑 |
| R4 | — | `audit.mjs` L2 | `box-shadow` 同时含外投影与 inset 内环 |
| R5 | `R5` | `check-tokens.mjs` L1 | 暗色三档都低于浅色，`body ≥ 300` |
| R6 | — | L3 + `audit.mjs` | 30ms 错峰；`-0.125em`；`0fr → 1fr` |
| R7 | — | `audit.mjs` L2 | `tabular-nums` 生效或无位移换行 |
| R8 | — | `audit.mjs` L2 | 无外层框、组间 40–48、控件右缘一致 |
| R9 | `A11Y`（必填语义）、`audit.mjs` | L1 + L2 | 输入全宽、字段间距 24、错误态不跳 |
| override | `O1` | `check-tokens.mjs` L1 | 九字段齐全 |

**只有 `alignment-report.md` 的机读块是 `status: pass` 时，以上才算通过。** 全绿但结论是 `conditional`，任务仍然没完成。
