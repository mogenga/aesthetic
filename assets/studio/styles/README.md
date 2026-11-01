# styles

12 个风格变体的 CSS。**渲染时唯一读的计数来源是 `style-index.json`。**

## 怎么加载

```html
<link rel="stylesheet" href="../fixture/tokens.css">
<link rel="stylesheet" href="../fixture/base.css">
<link rel="stylesheet" href="minimalism.css">   <!-- 默认基线 -->
```

```html
<html data-style="neo-brutalism" data-theme="dark">
```

切换变体 = 换 `<link>` 的 href + 改 `data-style`。**不需要重载 DOM**，因为变体只覆盖 token 与标志性规则，结构全在 `base.css`。

## 三段式

每个变体文件结构固定：

```css
/* 1. TOKEN OVERRIDE —— 只覆盖差异项 */
:root[data-style="xxx"] { --r-md: 0px; --shadow-1: 4px 4px 0 var(--fg); }
:root[data-style="xxx"][data-theme="dark"] { … }

/* 2. SIGNATURE —— 3–8 条让它一眼可辨的规则 */
:root[data-style="xxx"] .btn { … }

/* 3. CONSTRAINT —— 这个风格下必须压制的东西 */
:root[data-style="xxx"] .glass { backdrop-filter: none; }
```

三段缺一不可。少第一段 = 不成为变体；少第二段 = 认不出来；少第三段 = 和别的变体打架。

## 硬要求（`tests/css-check.mjs` 会查）

| 要求 | 理由 |
|---|---|
| 所有规则带 `:root[data-style="<文件名>"]` 作用域 | 否则污染其它变体 |
| 必须有 `[data-theme="dark"]` 块 | R5 暗色字重降档要生效 |
| 不得写裸 `:root {}` | 同上 |
| token 名必须在共享语义集合内 | 12 个变体共用一套契约 |
| 非 token 行不得出现色字面量 | 颜色只能从 token 来 |
| 与两份 `style-index.json` 一致 | 计数不能靠手写 |

例外：`bento.css` 允许改写 `display: grid` —— 网格重排**就是**它的签名，不是结构性布局。

## 10 卡 / 12 变体的换算

| 卡 | 变体 |
|---|---|
| minimalism · bento · neumorphism · neo-brutalism · cyberpunk · dark-tech · pixel · material · gradient-aurora | 各 1 个 |
| glassmorphism | `glass-liquid` / `glass-frosted` / `glass-transparent` 三个 |

玻璃卡不是「一种风格」，是三种**技术栈完全不同**的做法：折射 / 模糊 / 只染色。合并成一个文件无法维护。

## 玻璃三支的关键差异

| | 液态 | 毛玻璃 | 透明 |
|---|---|---|---|
| 技术 | `backdrop-filter: url(#svg)` + 位移场 | `backdrop-filter: blur()` | 只染色 + 亮边 |
| 引擎 | **仅 Chromium** | 全引擎 | 全引擎 |
| 降级 | 毛玻璃 → 实色 | 实色 | — |
| 成本 | 每元素独立 render surface | 中等 | 最低 |
| 适用 | 导航条、浮动控制条 | 卡片、面板 | 顶栏、悬浮控件 |
| 风险 | 只有 Chrome 看得到折射 | 暗色下会发灰 | 对比度不可控 |

液态玻璃用 `assets/vendor/hyalite.js`（MIT），不自己实现。详见 `assets/vendor/README.md`。

## 加一个新变体

1. 写 `<id>.css`，三段式，带暗色块
2. `references/styles/<id>.md` 写风格卡（八段）
3. 两份 `style-index.json` 各加一条
4. `node tests/css-check.mjs` 必须 0 error
5. 在 fixture 上过一遍八个检查区域

索引里的 `name` / `signature` / `anti` 字段是给 Studio 画廊用的，不是装饰——它们决定候选推荐时展示什么。
