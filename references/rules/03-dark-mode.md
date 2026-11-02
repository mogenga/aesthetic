# 暗色模式字重降档 · R5 全文

> 什么时候读这份：项目启用暗色主题、选字体时、`check-tokens.mjs` 报 `R5`、`weightLadder` 里没有目标字重、页面在中日韩文环境下字重看起来不一致。

R5 的一句话版在 [`00-non-negotiable.md`](00-non-negotiable.md) §3.5。

---

## 1. 为什么暗色要降档

浅色主题是"深字压浅底"，暗色主题是"浅字浮暗底"。同一款字体、同一个字重，在暗底上会**看起来更粗**，原因有两个：

| 机制 | 表现 |
|---|---|
| **光晕（halation）** | 亮笔画向四周的暗区溢出，边缘模糊变宽，主观上增加笔画厚度 |
| **抗锯齿的 gamma 差** | 亮底暗字的抗锯齿把边缘压向背景；暗底亮字则把边缘提向文字，视觉膨胀 |

后果不是"稍微粗一点"，是**整体发闷**：字重全部往上浮一档，层级被压平，正文显得笨重，而且高饱和强调色在粗字旁边被压得没有存在感。

所以不是"暗色下要用细字"这种审美偏好，是**补偿渲染差异**。降一档之后，暗色下的主观字重回到与浅色相同的水平。

---

## 2. 三档降一档

项目只定义三个字重角色，不做逐字号映射（决策 E）：

| 角色 | 用于 | 浅色参考 | 暗色参考 | 降幅 |
|---|---|---|---|---|
| `--fw-body` | 正文、次要文本、标签、帮助文本 | 400 | 350 | −50 |
| `--fw-strong` | 强调、字段名、按钮文字、组标题 | 600 | 500 | −100 |
| `--fw-display` | 页面标题、首屏大标题、数字大屏 | 700 | 600 | −100 |

```css
:root {
  --fw-body: 400;
  --fw-strong: 600;
  --fw-display: 700;
}

:root[data-theme="dark"] {
  --fw-body: 350;      /* 浅色 400 */
  --fw-strong: 500;    /* 浅色 600 */
  --fw-display: 600;   /* 浅色 700 */
}
```

**为什么 body 只降 50 而 strong / display 降 100：** 正文是连续阅读，降太多会让笔画在 15px 上断裂；strong 与 display 是短文本且原本更粗，降 100 才产生可感知的补偿。这是**回到等主观字重**的经验值，不是"每档都降 100"的机械规则。

**只作用于文字。** 图标、分割线、边框、`stroke` 一律不降——它们没有光晕问题，降了只会变淡到看不见。

```css
/* ✗ 错：把图标也一起降 */
:root[data-theme="dark"] svg.icon { font-weight: 350; stroke-width: 1.2; }

/* ✓ 对：图标保持原值，靠颜色适配 */
:root[data-theme="dark"] svg.icon { color: var(--fg-muted); }
```

---

## 3. 一档的定义

"降一档"是**阶梯上往下一格**，不是"减 100"，也不是"除以 1.15"。

```
weightLadder.available = [300, 400, 500, 600, 700]
浅色 body 400  →  下一格 300        （静态字体，降 100）
浅色 body 400  →  350               （可变字体，降 50，350 是连续轴上的点）
```

```json
"weightLadder": {
  "family": "Inter",
  "variable": true,
  "available": [300, 400, 500, 600, 700]
}
```

| 字段 | 含义 | 谁用 |
|---|---|---|
| `family` | 字体族名 | 报告、合同第 4 段 |
| `variable` | 是否可变字体 | 决定用连续轴还是离散档位 |
| `available` | **实际能渲染的字重** | 映射依据；`check-tokens` 用它判"是否在阶梯内" |

**`available` 是"渲染得出区别"的字重，不是厂商宣称支持的列表。** Noto Sans SC 宣称 100–900，但项目只加载了 400/700 两个 `@font-face` 时，`available` 只能是 `[400, 700]`——其他值会走**合成加粗**，那正是我们要避免的。

---

## 4. 可变字体 vs 静态字体

### 4.1 可变字体

```css
/* 方式 A：font-weight 连续值（优先） */
:root[data-theme="dark"] { --fw-body: 350; --fw-strong: 500; --fw-display: 600; }

/* 方式 B：显式写轴（需要同时调 wght + opsz + GRAD 时才用） */
:root[data-theme="dark"] .prose {
  font-variation-settings: "wght" 350, "opsz" 16;
}
```

| 项 | 规则 |
|---|---|
| 降幅 | 50–100（body 取 55–65，strong/display 取 75–100） |
| `available` | 真可变字体整个区间都可渲染，但仍要列出**实际用到的锚点**，供报告对照 |
| `opsz` 联动 | 有大字号光学轴时，暗色下 `opsz` 不变；它和字重是两件事 |

**优先用 `font-weight`。** `font-variation-settings` 不做继承叠加，父元素的轴会被子元素整条覆盖，调试成本高。

### 4.2 静态字体

静态字体只有离散档位，映射必须**向下**取。

```
规则：actualWeight = max(v ∈ available | v < lightWeight)
      若集合为空 → 阶梯不足，必须回 Phase 2 调整
```

| 浅色 | 目标 | available | actualWeight | 说明 |
|---|---|---|---|---|
| 400 | 350 | `[300,400,500,600,700]` | **300** | 向下取最近可用值 |
| 400 | 350 | `[400,500,600,700]` | **无可用** | 阶梯不足，见 §4.3 |
| 600 | 500 | `[400,500,600,700]` | 500 | 正好命中 |
| 700 | 600 | `[400,600,700]` | 600 | 正好命中 |

**绝对不要向上取。** 350 向上取到 400 等于"没降"，`check-tokens` 会报 `R5`（`weights.dark.body` 未低于 `weights.light.body`），而且视觉上确实没有补偿。宁可降到 300 并接受"比理论值轻一点"，也不要降成一个等值。

### 4.3 阶梯不足怎么办

浅色 body 已经是 400、字体又只有 `[400, 500, 600, 700]` 时，暗色无路可降。三个选项，按优先级：

| 方案 | 做法 | 代价 |
|---|---|---|
| 1. 换字体 | 换成有 300 或可变轴的字族 | 重新签样；字体加载体积变化 |
| 2. 抬浅色基准 | 浅色 body 改 500，暗色落 400 | 浅色下正文变重，需要重看签样 |
| 3. 扩字重集 | 补一个 300 的 `@font-face` | 多一份字体文件（拉丁字体约 20–40 KB / 字重） |

**不能选的是"登记 override 跳过 R5"。** 那是把渲染差异留给用户看。override 是给"用户就是要更粗"的场景用的，不是给"字体不够用"用的。

### 4.4 记录 `actualWeight`

映射过的值必须写进 `tokens.json`，让 L1 和下一个会话知道"代码里的 350 实际渲染成 300"：

```json
"weights": {
  "light": { "body": 400, "strong": 600, "display": 700 },
  "dark":  { "body": 350, "strong": 500, "display": 600 }
},
"weightResolution": {
  "dark.body":    { "requested": 350, "actualWeight": 300, "mapped": true },
  "dark.strong":  { "requested": 500, "actualWeight": 500, "mapped": false },
  "dark.display": { "requested": 600, "actualWeight": 600, "mapped": false }
}
```

`contract.md` 第 4 段同时写人读版：

```markdown
**字重阶梯**：`300 / 400 / 500 / 600 / 700`（来自 `weightLadder.available`）
**映射记录**：暗色 body 350 → 300（字体无 350；已记 actualWeight）
```

**`requested` 与实际渲染值分离是有意的。** 只写 350 会让审计以为渲染出的是 350；只写 300 会丢掉设计意图。

---

## 5. 护栏

三条，缺一条就会翻车。

| 护栏 | 阈值 | 检查对象 | 违反后果 |
|---|---|---|---|
| **正文下限** | `--fw-body` ≥ 300 | 暗色 body | 低于 300 的正文在暗底上笔画像灰雾 |
| **小字恒定** | `< 16px` 用 `--fw-small` / `--fw-small-strong`，**暗色与浅色完全同值** | 所有 `< 16px` 的文本节点 | 小字一旦跟着降，就从"清楚"变成"发虚"，没有任何视觉收益 |
| **对比度复测** | 降档后仍 ≥ 4.5:1 | 每个前景/背景组合 | 不达标回退一档，**不是调深背景** |

### 5.1 小字根本不降档

**规则：R5 的"降一档"只作用于大字号（≥ 16px）。小于 16px 的文字在暗色下保持浅色档的字重，一个字重都不减。**

理由不是"小字需要护栏"，而是**小字降档本身没有收益**：halation 让暗底文字看起来更粗，这个效应随笔画绝对宽度增长——15px 的 400 降到 350，笔画从 2px 变成 1.75px，视觉上并没有"变细一档"，只是变糊了。

所以小字用独立 token，跨主题恒定：

```css
:root {
  --fw-body: 400; --fw-strong: 600; --fw-display: 700;
  --fw-small: 400;          /* 小字常规 */
  --fw-small-strong: 600;   /* 小字加粗 */
}
:root[data-theme="dark"] {
  --fw-body: 350; --fw-strong: 500; --fw-display: 600;
  --fw-small: 400;          /* 与浅色同值，不降 */
  --fw-small-strong: 600;   /* 同上 */
}

/* 所有 < 16px 的文字必须显式绑定这两个之一 */
.text-sm, .help, .label, .btn--sm, .eyebrow { font-weight: var(--fw-small); }
.card__title, .settings-row__name             { font-weight: var(--fw-small-strong); }
```

**两档，不是一档。** 小字里也有常规与加粗之分；如果只给 `--fw-small` 一个值，所有加粗小标题都会被压成 400，层级消失。所以 `--fw-small-strong` 是必需的，不是可选优化。

**边界怎么划**：按 `font-size` 判断，不是按语义角色。`--fs-xs`(12) / `--fs-sm`(13) / `--fs-md`(15) 三档都属于"小字"；`--fs-lg`(18) 及以上才参与降档。

**必须显式绑定，不能靠继承。** `body { font-weight: var(--fw-body) }` 会把 350 传下去；每个用到 `--fs-xs/sm/md` 的规则都要写 `font-weight: var(--fw-small 或 --fw-small-strong)`。`check-tokens.mjs` 守的是数据层（暗色 `weights.dark.small` 必须等于浅色值），元素层由 `audit.mjs` L2 抽样验证。

**不要写成 `font-weight: max(var(--fw-body), 400)`。** 它有名字、可审计；`max()` 在 `getComputedStyle` 里只是算好一个数，看不出意图。

### 5.2 对比度复测到底测什么

对比度比值是颜色的函数，**不随字重改变**。"降档后重测"实际是两件事：

| 侧 | 测什么 | 不达标怎么办 |
|---|---|---|
| 颜色侧 | `--fg` / `--bg` 是否仍 ≥ 4.5:1 | 说明降档前就擦线；回退一档并查色板 |
| 笔画侧 | 薄笔画在 100% 与 200% 缩放下是否仍清楚（截图对照） | 回退一档；或把该处字号抬 1 级 |

笔画侧必须用截图判断。`--fg-muted` 在暗色 `--surface-3` 上实测 6.41:1，数值绰绰有余，但 12px / 300 的笔画在 1x 屏上依然会碎。

**回退一档 ≠ 调暗背景。** 改背景会连锁破坏 ΔL 阶梯与全部对比度组合。

### 5.3 `--fs-md` 是分界线，不是"正文"

`--fs-md` 取 15px 时，它**低于 16px 分界**，因此按 §5.1 属于"小字"，暗色不降档。这不是漏洞，是定义：

| 正文字号 | 归类 | 暗色处理 |
|---|---|---|
| 12 / 13 / 15px | 小字 | `--fw-small`，与浅色同值，**不降** |
| 18px 及以上 | 大字号 | `--fw-body` 降一档 |

所以一个 15px 正文的项目，暗色下 `body` 确实**不变**——只有标题（`--fs-lg` 以上）降档。这看起来和"全站降一档"的直觉相反，但符合 R5 的真实目的：**halation 的视觉补偿只对大字有意义**。

想验证效果对不对，看的是"暗色下整页读起来会不会太闷"，不是"字重数字有没有变小"。如果 15px 在暗色下确实发闷，处理方式是**抬字号到 18px**或**换更细的字体家族**，不是硬降字重。

### 5.4 检查项

`check-tokens.mjs` 验两件事：

1. 暗色块存在 `--fw-small`，且**等于浅色块的值**（不降）
2. 暗色 `--fw-body/strong/display` 均严格小于浅色对应值

`audit.mjs` 验一件：暗色下 `< 16px` 的元素 `font-weight` 等于 `--fw-small` 的值（抽样最近 200 个文本节点）。这条抓的是"忘了绑定"——继承 `--fw-body` 的小字会被报出来。

---

## 6. CJK 字体的回退与字宽

中文项目里这条比字重本身更容易出问题。

### 6.1 混合字族的字重断层

典型栈：

```css
--font-sans: "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
```

| 脚本 | 命中字体 | 暗色 body 350 | 实际渲染 |
|---|---|---|---|
| Latin | Inter Variable | 可渲染 350 | 350 |
| 中文 | Noto Sans SC（只加载了 400/500/700） | 无 350 | **400** |
| 中文（Windows 无 Noto） | Microsoft YaHei（仅 400/700） | 无 350 | **400** |

结果：一行里中英文粗细不同，中文明显更重，混排标题上非常刺眼。对策按优先级：

1. **让 CJK 字体也有目标字重。** Noto Sans SC 可变版本支持 100–900，加载它就能和 Inter 同步降档。
2. **把 CJK 字重单独 token 化**，只在 `:lang(zh)` 作用域内生效。

   ```css
   :root[data-theme="dark"] {
     --fw-body: 350;
     --fw-body-cjk: 400;   /* CJK 无 350，也不映射到 300（300 的 CJK 更糊） */
   }
   .prose:lang(zh) { font-weight: var(--fw-body-cjk); }
   ```

3. **接受断层但把它做成设计决定**，且必须写进合同第 9 段。

**CJK 映射方向与拉丁相反：向下取会更糟。** 拉丁 350 → 300 只是略细；CJK 300 的横画在 15px 下会断成虚线。CJK 没有 350 时**向上取到 400 并登记**，不机械执行 §4.2 的向下规则。

### 6.2 字宽变化

降档会改变字形宽度，中文尤其明显：

| 影响 | 表现 | 对策 |
|---|---|---|
| 行数变化 | 一段文字在浅色 4 行、暗色 5 行 | 签样时**两种主题都截**；不要只对浅色 |
| 表头换行 | 4 个字勉强一行，降档后放不下 | 表头 `white-space: nowrap` 或列宽按最宽主题留 |
| 按钮宽度 | 中文字按钮在暗色下变窄 | 按钮用 `min-width` 定宽，不依赖文字自然宽 |
| 断行位置 | CJK 可在任意字间断 | `line-break: strict` + `text-wrap: pretty` |

```css
.btn { min-width: 88px; }                 /* 不靠文字撑宽 */
.th  { white-space: nowrap; }
.prose { text-wrap: pretty; line-break: strict; }
```

**暗色切换不应引起布局位移。** 切主题时页面跳一下不是"正常现象"，是字宽没约束。

### 6.3 合成控制与字体加载

```css
:root {
  font-synthesis: none;            /* 找不到目标字重时不伪造 */
}
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2-variations");
  font-weight: 100 900;            /* 必须与真实文件一致 */
  font-display: swap;
}
```

`font-synthesis: none` 让浏览器找不到目标字重时回退到最近的实存字重——这正是 `weightLadder.available` 描述的事实；开着合成会让 350 变成一个不可控的假字重。

**只加载了 400 却声明 `font-weight: 400 700`，会让浏览器在 500–700 之间做合成。** 关键字体另用 `<link rel="preload" as="font" type="font/woff2" crossorigin>` 提前拉取。

---

## 7. 反例

| 反例 | 为什么错 |
|---|---|
| 暗色全站 `font-weight: 300` | 一刀切，标题失去层级；正文笔画出灰雾 |
| 只降 body，不降 strong / display | 正文变细但标题还粗，层级差被拉大而不是压缩 |
| 静态字体 350 → 向上映射到 400 | 未降档，`check-tokens` 报 `R5`；视觉上没有补偿 |
| 降档同时把图标 `stroke-width` 调细 | 图标没有光晕问题，只会变淡 |
| 降档后不重测，以为比值不会变 | 比值确实不变，但笔画会碎；护栏就是防这个 |
| CJK 沿用拉丁的向下取整 | 中文 300 在 15px 下断笔 |
| `@font-face` 声明 `100 900` 但只加载 400 | 中间字重全是合成，跨浏览器不一致 |
| 切主题引起整页重排 | 字宽未约束；暗色不应改变布局 |
| 用 `-webkit-font-smoothing: antialiased` 当补偿手段 | 它只改变抗锯齿策略，不改变字重；在非 WebKit 上无效 |

---

## 8. 验收

`check-tokens.mjs`（L1）的 R5 判定，逐条对应：

| 检查 | 条件 | 输出 |
|---|---|---|
| 启用了暗色就必须有 `weights.dark` | `data.color.dark` 存在时 | `✗` "没有 weights.dark" |
| 三档齐全且是数字 | `body` / `strong` / `display` | `✗` |
| 暗色 body ≥ 300 | — | `✗` "低于护栏 300" |
| `--fw-small` 在暗色块里存在且**等于浅色值** | `Math.max(400, weights.light.body)` | `✗` "小字被降档了" |
| 值在 `weightLadder.available` 内 | 仅静态字重 | `⚠` 要求补 `actualWeight` |
| `weightLadder.available` 非空 | — | `✗` |

`audit.mjs`（L2）在浏览器里读计算值，补上 L1 看不到的部分：

```
1. 字号 < 16px 的文本节点 computed font-weight 等于 --fw-small（不是 --fw-body）
   —— 抓「忘了绑定」，继承下来的小字会被报
2. 字号 ≥ 16px 的文本节点 computed font-weight 等于对应 token 的暗色值
3. 图标 / SVG 的 font-weight / stroke-width 与浅色一致
4. 切换 data-theme 前后，主要容器的 offsetHeight 变化为 0
```

人工复核（L3）：

- [ ] 浅色与暗色各截一张同页面图，并排看**标题**粗细是否"感觉一样"
- [ ] 13px 帮助文本在暗色下与浅色粗细一致（本来就不该变）
- [ ] 中文与英文混排的一行里，两者粗细是否协调
- [ ] 200% 缩放下，最细的正文笔画仍连续
- [ ] 切主题时页面不跳

```bash
node scripts/check-tokens.mjs --project <dir>    # R5
```
