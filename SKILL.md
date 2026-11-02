---
name: aesthetic
description: Use when a frontend project needs its visual design pinned down and enforced — turning a design direction into tokens, a contract, and a visual-alignment gate. Compiles prose direction (from impeccable, frontend-design, or its own Studio gallery) into decisions.json → tokens.css → contract.md, injects the non-negotiable rules into the project's DESIGN.md, and verifies the implementation against the signed-off screenshots. Covers color ladders, dark-mode weight downgrade, input-field inset, settings/form layout, AI streaming UI, and glassmorphism. Not for business logic, data flow, APIs, or backend.
---

# Aesthetic

把"设计方向"编译成可执行的合同，并在实现后做闸门式验收。

**你不是品味权威。** 定气质、定创意方向、写文案语气是导演层的活。你保证这些决定变成**可执行、可校验、可长期延续**的东西。

---

## 0. 三条硬约束

1. **合同未落成，不写第一行 UI 代码。**
2. **对齐报告未通过，不宣布完成。**"有条件通过"不算通过。
3. **真相不放在别人的文件里。** 唯一可编辑源是自己的 `decisions.json`；目标 `DESIGN.md` 只放幂等 marker 块。

违反任一条，任务算失败，不是"简化"。

---

## 1. 检测：谁定方向

启动时看可用 skills 列表，**不做文件系统嗅探，不自动安装**。

| 环境 | 谁定方向 | 你做什么 |
|---|---|---|
| 有 `impeccable` | 它的 `shape` / new-work | 转写 → 注入 → 对齐；它的 `audit`/`critique` 并入报告 |
| 有 `frontend-design` | 它的四段式计划 | 同上，无 audit 输入 |
| 都没有 | 自导：Studio 画廊 + 10 张风格卡 | 六阶段全流程 |

**未安装不得报错。** 静默降级。

**同一时刻只允许一个导演。** 不要叠加 `impeccable` 的 `shape` 和本 skill 的 Phase 1，也不要叠加 `superpowers:brainstorming`——Phase 0/1 本身就是收敛式问诊。

检测状态用四值：`available` / `unavailable` / `unsupported` / `failed`。只有 `available` 才进入联动路径；其余记录原因后走降级。

---

## 2. 六阶段

```
P0 接诊 → G0 → P1 方向 → G1 → P2 转写 ⇄ 配色 → G2
  → P3 布局·签样 → P4 落档·注入 → G3 → P5 落地 → P6 对齐 → G4
                                                        └─不通过─→ P5
```

每个闸门记录：输入、输出、确认人、时间、通过标准、失败回退阶段。

| 闸门 | 位置 | 通过标准 | 回退到 |
|---|---|---|---|
| **G0** brief | P0 末 | 用户确认产品 / 受众 / 主页面 / 品牌约束 | P0 |
| **G1** direction | P1 末 | 用户确认方向；导演层产物已读入 | P1 |
| **G2** translation | P2 中 | 用户逐项确认七维转写表 | P2.1 |
| **G3** contract | P4 末 | 自检全绿 + `check-consistency` 通过 | P4 |
| **G4** alignment | P6 末 | `status: pass`（不是 conditional） | P5 |

"用户确认"= 用户明确回复确认或等价确认。兼容聊天 / CLI / GUI，不要写死成"点击"。

### Phase 0 · 接诊

1. 读项目：框架、现有 token、现有页面、依赖、是否已有设计系统
2. 检测导演层（§1）
3. 问 ≤4 个问题：**产品是什么 / 给谁用 / 这一版最重要的一个页面是什么 / 有无品牌色或必须沿用的视觉资产**
4. 选问：是否需要暗色模式 / 是否有 AI 对话或生成能力 / 有无必须支持的浏览器下限
5. 写一段 ≤120 字 brief 回显确认

若导演层是 `impeccable`：它的 `init` 会写 `PRODUCT.md`。**读它，不要另写一份**；你的 brief 只在 `PRODUCT.md` 缺失时生成。

### Phase 1 · 方向

**不产出 token，只产出方向。**

| 导演 | 动作 | 产物 |
|---|---|---|
| `impeccable` | 走它的 `shape` / new-work | 风格决策、模式（Persuade/Operate/Read/Experience） |
| `frontend-design` | 要"色 / 字 / 布局 / 原则"四段式 | 文字计划 |
| 自导 | 从 10 张卡里挑 3 个候选，Studio 并排渲染 | 卡 id + variant id |

**`direction` 段至少要有**：一句话气质、3–5 个形容词、2–3 个参照物（"像 X 但更 Y"）、1–2 个明确不要的东西。缺这些，转写会退化成自由发挥。

**自导候选判据**（不要随机抽签）：

- 数据密集、同屏比较 → 排除玻璃 / 新拟态 / 像素；偏好极简 / Material / Dark Tech
- 品牌要"贵"、要"新" → 渐变极光 / Bento / 液态玻璃
- 品牌要"敢"、要记忆点 → 新粗野主义 / 赛博朋克
- 创意 / 年轻用户、图文并重 → Bento / 像素 / 新粗野主义
- 企业工具、可用性优先 → 极简 / Material / Dark Tech
- 长文本阅读 → 极简 / Material；排除像素 / 赛博朋克
- 已有强品牌色 → 先按色系反推风格，不要先选风格再塞色

数量口径：**10 张逻辑卡 / 12 个 CSS 变体**（玻璃卡拆 liquid / frosted / transparent）。数量一律从 `assets/studio/styles/style-index.json` 读，**不要手写**。

### Phase 2 · 转写 ⇄ 配色（核心动作）

方向是散文，散文无法校验。必须变成数字。

| 步 | 动作 |
|---|---|
| 2.1 | 把 `direction` 读成七维假设：中性色温度、彩度上限、圆角区间、边框、阴影策略、字重区间、动效强度 |
| 2.2 | **回显**成表格给用户（不是散文）。跳过这步的典型后果：文档说冷灰底，代码里是暖米色 |
| 2.3 | 用户改 → 重写，直到明确确认 |
| 2.4 | Studio 渲染夹具首页 + 配色面板 |
| 2.5 | 面板显示 ΔL、正文对比度、焦点对比度、暗色对应值、纯黑告警 |
| 2.6 | 写 `tokens.color.*` 与 `decisions.json.translation` |

转写表格式：

| 维度 | 我从方向里读到的 | 取值 | 依据（哪句话） |
|---|---|---|---|
| 中性色温度 | 偏冷、克制 | `oklch(…, C≈0.002, H=250)` | "像瑞士铁路时刻表" |
| 彩度上限 | 低饱和 | 主色 C ≤ 0.12 | "不要糖水感" |
| 圆角 | 尖锐 | `0 / 2 / 4 / 999` | "工业感" |
| 边框 | 存在但极细 | `1px`，`fg 8%` | "像图纸" |
| 阴影 | 几乎不用 | 仅浮层一层 | — ← 写 `null` |
| 字重 | 中等 | 400 / 500 / 600 | "不要大字报" |
| 动效 | 快、无回弹 | 120–180ms `ease-out` | — ← 写 `null` |

`from` 为 `null` 表示没有方向依据、按规则取默认。**这也是一条信息**，要标出来。

纯黑：用户选 `#000` 时提示"不建议纯黑，建议 `#1A1A19` 暖调深灰"，一键替换；坚持则保留并登记 override。

导演层已定义的色板：**以它为输入**，只补它没覆盖的阶梯与暗色映射，不推翻。

### Phase 3 · 布局（你主导）

1. 列内容清单：按重要性排序，标"必须首屏可见"
2. 出 2–3 个 **ASCII 线框**，每个附一句布局概念 + 一句取舍
3. 给出**推荐**及理由
4. 用户确认或提出修改
5. 定响应式断点（1440 / 834 / 390）
6. Studio 渲染完整合成页，作为签样

线框必须标注：内容最大宽、对齐轴、栅格列数与间距、首屏信息密度。

若导演层定了 mode（如 Operate），布局判据与之一致：可扫读、一致、符合平台惯例，表达让位于效率。

### Phase 4 · 落档 · 注入

```bash
node scripts/build.mjs --project <dir>     # decisions.json → tokens.* + contract.md
node scripts/inject.mjs --project <dir>    # contract §8 → DESIGN.md marker 块
node scripts/check-consistency.mjs --project <dir>   # G3 门禁
```

产物全部带 provenance 头（`sourceHash` / `generatedAt` / `generatorVersion`）。

### Phase 5 · 落地

按 `tokens.css` 实现。**不允许出现合同外的颜色、字号、圆角、阴影**；需要新值必须先改 `decisions.json` 再跑 `build.mjs`。

每完成一个页面/组件就 `shoot.mjs` 截图自查一次，不要攒到最后。

### Phase 6 · 视觉对齐

三档 + 导演层输入：

| 档 | 手段 | 判据 |
|---|---|---|
| L1 | `check-tokens.mjs` | color policy、ΔL ∈ [0.010, 0.030]、禁止场景无纯黑、暗色字重映射、对比度 |
| L2 | `audit.mjs` | 结构值对齐 8pt、光学值走 token、输入框内环、计时器等宽 |
| L3 | `shoot.mjs` + 人眼 | 对照签样，记录偏差 |

若 `impeccable` 可用，并行跑它的 `audit`/`critique`：按规则 id 去重，**它的 P0 一律升级为"不通过"**，`critique` 打分不进结论。

报告顶部写机读块：

```
<!-- alignment-report
status: pass | conditional | fail
gate: G4
checkedAt: …
toolVersions: { … }
unresolvedCount: 0
-->
```

**只有 `status: pass` 才算完成。**

---

## 3. 非协商项（压缩版）

完整规格见 `references/rules/00-non-negotiable.md`。分级：**MUST** / **SHOULD** / **ADVISORY**。

用户可覆盖任何一条，但覆盖必须登记 `decisions.json.overrides`（九字段缺一不可），且不能直接产生最终"通过"。

| # | 规则 | 级别 | 要点 |
|---|---|---|---|
| R1 | 视觉对齐 | MUST（构图）/ SHOULD（光学） | 结构值对齐 8pt；光学值（1px 线、6–8px 标签间距、`-0.125em` 图标）走独立 token 允许偏离 |
| R2 | 微对比色阶 | MUST | **ΔL = \|L₁−L₂\| ∈ [0.010, 0.030]**。是 L 通道绝对差，不是相对百分比。表面 ΔL 不能代替可读性检查 |
| R3 | 禁用纯黑 | MUST | 正文 `#1A1A19`（实测 `oklch(0.2174 0.0019 106.6)`）。**豁免**：阴影 / 玻璃暗线里的带 alpha 黑。L1 按使用场景判定，不按字面扫描 |
| R4 | 输入框咬合 | MUST | 不用亮线。外投影 + inset 内环 + 内投影。内环是"变深"不是高光 |
| R5 | 暗色字重降一档 | MUST | **只管 ≥16px**：body / strong / display 三档各降一格。**<16px 不降**，用 `--fw-small`（与浅色同值）。护栏：正文 ≥300。字体无目标字重时映射到最近可用值并记 `actualWeight` |
| R6 | AI 界面 | MUST | ① 流式逐字 30ms 错峰、高斯模糊→瞬间对焦；② 行内图标 `vertical-align: -0.125em`；③ 思考框 `0fr → 1fr` 网格撑开 |
| R7 | 计时器等宽 | MUST | `font-variant-numeric: tabular-nums`；无 `tnum` 换等宽字族 |
| R8 | 设置页 | MUST | 名称左、控件右，一行一项；**去掉最外层框**；组间 44–48px、组内 0、细线；删除独立成组 |
| R9 | 表单页 | MUST | 名称在上、输入在下、**输入区全宽**；字段间距 24px |

**R4 参数**

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

**R6.1 参数**

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

约束：只 append 新 span，已完成的合并成纯文本；只给最新 30 字挂动画；每秒 >40 字时 2–3 字一组入场；动画层 `aria-hidden`，另起隐藏节点 `aria-live="polite"` 每 200–300ms 更新；`prefers-reduced-motion` 下只留透明度。

**R6.3 参数**

```css
.think { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s var(--ease-out); }
.think[data-open="true"] { grid-template-rows: 1fr; }
.think > .think__body { overflow: hidden; }
```

为什么不用 `height` 动画：内容高度未知且流式还在变，JS 量高会在动画中途失准。

---

## 4. 玻璃拟态

三种做法技术栈完全不同。判定法：遮住背景只留纯色块——**变形=液态，糊了=毛玻璃，只染色=透明**。

| 变体 | 做法 | 主要风险 |
|---|---|---|
| `glass-frosted` | `backdrop-filter: blur(24px) saturate(180%)` + 双 inset 阴影伪造厚度 | 暗色下会发灰（要用页面基色的半透明版，不是纯白） |
| `glass-transparent` | 只染色不模糊 | 对比度不可控 → **强制要求受控背景资产** |
| `glass-liquid` | SDF → 位移场 → `feDisplacementMap` → `backdrop-filter: url()` | 只有 Chromium 真渲染 |

**液态玻璃必知**（都已踩过）：

1. `backdrop-filter: url(#svg)` **只有 Chromium 真渲染**。Safari 接受属性但丢弃 SVG（WebKit bug 245510）；Firefox 不实现（bug 1787623）
2. `CSS.supports('backdrop-filter','url(#x)')` 在三大引擎**都返回 true**，不能做特性检测 → 必须引擎嗅探 + 手工开关
3. Chromium 置换采样是**最近邻**（Skia bug 40045448），大位移必出阶梯 → 缩窄倒角 + 叠模糊，调参解决不了
4. 装滤镜的 `<svg>` 不能 `display:none`，Blink 会忽略 → 用 `width:0;height:0`
5. 每个 `backdrop-filter` 元素都是独立 render surface → **只用于小型高价值表面**
6. 用 `assets/vendor/hyalite.js`（MIT，单文件，`Hyalite.watch()`），不要自己从物理公式推

降级链：`液态（Chromium）→ 毛玻璃 → 半透明实色`。三级都要在合同里给出参数。

**通用禁忌**：玻璃叠玻璃、大段正文直接在玻璃上、全屏玻璃、暗色沿用浅色参数、`transform` 祖先下的 fixed 玻璃。

---

## 5. 交付物

```
<项目>/
├── DESIGN.md                  # 导演层的文件；只写 marker 块
└── design/aesthetic/          # 你的独占目录
    ├── decisions.json         # ★ 唯一可编辑事实源
    ├── contract.md            # 十段合同（派生）
    ├── tokens.css             # 令牌（派生）
    ├── tokens.json            # 机读（派生）
    ├── alignment-report.md    # 对齐报告
    └── shots/approved-*.png
```

唯一生成链（单向）：

```
decisions.json → tokens.json / tokens.css → contract.md → 注入块
```

**谁读什么**：实现它的 agent 读 `contract.md` + `tokens.css`；验收脚本读 `decisions.json`；项目里其他 skill 读 `DESIGN.md`；改决策只改 `decisions.json`。

**contract.md 十段**：概览 / 转写表 / 色彩 / 字体 / 空间与栅格 / 组件规格 / 动效 / 非协商项取值 / 与导演层的一致性 / 验收清单。模板见 `assets/templates/contract.md`。

第 9 段最容易踩坑：必须写明**哪些值来自导演层、哪些你补的、哪些你刻意偏离**。否则下一个会话会反复在两份文件之间摇摆。

**注入块**：

```markdown
<!-- aesthetic:begin v2 — 由 aesthetic 生成，勿手改；重跑只覆盖此块 -->
<!-- sourceHash: sha256:… · generatorVersion: aesthetic-v2 -->
## 非协商项（本项目取值）
…
<!-- aesthetic:end -->
```

幂等六规则：不存在→新建；有 marker→只替块内；无 marker→追加；被抹→下次重注不报警；用户手改→下次覆盖；写前留 `.bak`，写后校验 hash。

**不做双向同步**：要么我们能解析导演层格式、要么它理解我们的格式，两边都会漂移，维护成本是平方级。

---

## 6. 脚本

统一退出码：`0` 通过 · `1` 违规 · `2` 环境不可用 · `3` 输入非法。

| 脚本 | 作用 |
|---|---|
| `build.mjs` | `decisions.json` → `tokens.*` + `contract.md`（唯一生成链） |
| `inject.mjs` | 刷新 `DESIGN.md` 的 marker 块；`--check` 只校验；`--dry-run` |
| `check-consistency.mjs` | `sourceHash` 一致性；**G3 门禁** |
| `check-tokens.mjs` | 静态 lint：裸色值、纯黑、ΔL、暗色字重、对比度 |
| `shoot.mjs` | 定尺寸截图（可选 CDP 适配器） |
| `audit.mjs` | `getComputedStyle` 审计（可选 CDP 适配器） |

浏览器不可用时输出 `manual-required`（退出码 2），**不伪造自动通过**。禁止为跑脚本自动下载依赖。

**最低测试矩阵**：1440 / 834 / 390 × 浅 / 深 × 默认 / reduced-motion × 鼠标 / 键盘 / 触控 × 长文本 / CJK / 200% 缩放 / 空态 / 错误态。

**最低浏览器**：Chromium 111+ / Safari 16.4+ / Firefox 113+。

**无障碍底线**：可见 `:focus-visible`、键盘可达、状态不只靠颜色、表单错误与字段语义关联、触控目标 ≥ 44×44、`forced-colors` 下有可见边界。

---

## 7. 你要避免的失败模式

| 失败 | 表现 | 对策 |
|---|---|---|
| 跳过转写 | 文档说冷灰、代码是暖米色 | G2 是硬闸门；`translation` 空 → `check-tokens` 报错 |
| 覆盖别人的文档 | 辛苦写的规则被 `impeccable document` 抹掉 | marker 块 + 幂等重注入；`decisions.json` 才是真相 |
| 把"有条件通过"当完成 | 偏差累积到无法收拾 | 只有 `status: pass` 算 G4 |
| 把规则当教条 | 用户想在粗野主义里用纯黑被拒 | 分级 + override 登记，不是禁止覆盖 |
| 把导演层当必须依赖 | 没装就整个流程卡住 | 三条降级路径都必须能跑通 |
| 顺手实现业务逻辑 | 越界 | 只管视觉；功能不在范围内 |

---

## 8. 参考

按需读，不要一次全加载。

| 文件 | 什么时候读 |
|---|---|
| `references/directors.md` | 检测到导演层，或需要设计降级路径 |
| `references/translation.md` | 做 Phase 2 转写 |
| `references/injection.md` | 写/排查注入块 |
| `references/rules/00-non-negotiable.md` | lint 报错、或需要 R1–R9 全文 |
| `references/rules/0[1-6]-*.md` | 对应规则的深度规格与实际代码 |
| `references/styles/*.md` | **仅自导模式**，选中某张卡之后 |
| `references/layout-patterns.md` | Phase 3 找线框 |
| `references/motion.md` | Phase 4 定动效 |

设计依据（本 skill 为什么长这样）见 `SKILL-DESIGN.md`，那是给维护者的，不是执行手册。
