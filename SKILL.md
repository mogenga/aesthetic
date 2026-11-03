---
name: aesthetic
description: Use when a frontend project needs its visual design pinned down and enforced — turning a design direction into tokens, a contract, and a visual-alignment gate. Compiles prose direction (from impeccable, frontend-design, or its own Studio gallery) into decisions.json → tokens.css → contract.md, injects the non-negotiable rules into the project's DESIGN.md, and verifies the implementation against the signed-off screenshots. Covers color ladders, dark-mode weight downgrade, input-field inset, settings/form layout, AI streaming UI, and glassmorphism. Not for business logic, data flow, APIs, or backend.
---

# Aesthetic

把"设计方向"编译成可执行的合同，并在实现后做闸门式验收。

**你不是品味权威。** 定气质、定创意方向、写文案语气是导演层的活。你保证这些决定变成**可执行、可校验、可长期延续**的东西。

---

## 0. 四条硬约束

1. **先问要不要起工作台；起了就给出完整 URL 并等用户确认真的打开，再问别的。** 用户不接受或打不开就走纯 CLI 形态；不得默认启动服务，不得在用户拒绝后偷偷启动，也不得把 URL 只写进日志或文件。见 §2。
2. **合同未落成，不写第一行 UI 代码。**
3. **对齐报告未通过，不宣布完成。**"有条件通过"不算通过。
4. **真相不放在别人的文件里。** 唯一可编辑源是自己的 `decisions.json`；目标 `DESIGN.md` 只放幂等 marker 块。

违反任一条，任务算失败，不是"简化"。

### 对用户说话

**内部术语不得直接抛给用户。** 第一次出现要换白话或当场解释，对照表见 `references/phrasing.md`。

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

## 2. 第零步：问用户要不要启动工作台

**在 Phase 0 的任何提问之前，先问这一个问题。** 它决定后面整条流程用哪种形态跑。

> 我这边有两种工作方式：
> **① 本地工作台**（推荐）—— 起一个本地 web 服务，浏览器里并排看候选风格、实时调色、看按钮和输入框这些组件换上真实颜色后的样子。
> **② 只在对话里做** —— 不启动任何服务，我用表格和文字和你确认每个决定。
>
> 要起工作台吗？

按回答分叉：

| 回答 | 后续 |
|---|---|
| **接受** | 按下面的三段式交接工作台。Phase 1–3 在浏览器里完成，CLI 只负责复述结论与闸门确认 |
| **不接受** | 不起服务。Phase 1–3 全部改成文字形态（见下表），脚本仍然照常跑（`build` / `inject` / `check-*` 不需要浏览器） |

**接受的交接分三段，缺一段都不算交付工作台**：

| 段 | 时机 | 必须做什么 |
|---|---|---|
| **① 启动前** | 跑 `node scripts/studio.mjs --project <dir> --open` 之前 | 告诉用户要占用的端口：默认 **4318**，被占用会自动 +1，**以脚本实际打印的端口为准**，不要承诺"就是 4318" |
| **② 启动后** | 脚本打印 `Studio <url>` 之后 | 在对话里直接给出**完整可点击 URL**（带一次性 token 那条，形如 `http://127.0.0.1:4318/studio/ui/index.html?t=…`）。禁止只说"已启动"；禁止把 URL 只写进日志 / 文件 / 脚本输出，让用户自己去找 |
| **③ 闸门** | 用户回话之前 | 等用户明确回复「打开了」/「看到了」或等价确认，**才进 Phase 0**。用户说打不开、或一直没回应 → 改用下面的对话形态，并明确告知"网页这边没打开，我们改在对话里继续" |

**不接受时的 CLI 等价物**：

| 阶段 | 工作台形态 | CLI 等价形态 |
|---|---|---|
| P1 选风格 | 画廊里并排看候选，可放大整页、可加载全部 12 个变体 | 给 3 个候选，每个用文字描述签名特征 + 代价，用户选编号 |
| P2 调色 | 拖滑块实时看 | 给出颜色表（每个颜色的色值、用途、明暗层次、与正文的对比度），用户说改哪个 |
| P2 转写 | 面板里编辑七维表 | 直接给出七个数值的表格（每项注明从哪句话推出来的），用户逐条回复确认或修改 |
| P3 布局 | 渲染合成页签样 | ASCII 线框（见 `references/layout-patterns.md`） |
| P6 签样 | 截图对照 | 若浏览器可用仍跑 `shoot.mjs`；不可用则标 `manual-required`，由用户人工比 |

**两种形态的产物完全一致**：都是 `decisions.json` → `tokens.*` → `contract.md` → 注入块。形态不影响交付物，只影响交互方式。

**不要做的事**：

- 不要默认启动服务。用户没同意就用 CLI。
- 不要在用户拒绝后偷偷在后台起服务。
- 不要在用户接受后还继续用 CLI 问 P1/P2 的问题——那是两遍。
- 不要只说"已启动"或把 URL 塞进日志 / 文件就算交接完成——用户手上没有可点的链接。
- 不要在用户确认打开之前开问 Phase 0——那等于用户选了工作台却得到 CLI。

---

## 3. 六阶段

```
P0 接诊 → G0 → P1 方向 → G1 → P2 转写 ⇄ 配色 → G2
  → P3 布局·签样 → P4 落档·注入 → G3 → P5 落地 → P6 对齐 → G4
                                                        └─不通过─→ P5
```

每个闸门记录：输入、输出、确认人、时间、通过标准、失败回退阶段。

| 闸门 | 位置 | 通过标准 | 回退到 |
|---|---|---|---|
| **G0** brief | P0 末 | 用户确认这个系统主要管什么 / 给谁用 / 品牌约束，以及 **agent 提案后用户拍板**先做哪个页面 | P0 |
| **G1** direction | P1 末 | 用户确认方向；导演层产物已读入 | P1 |
| **G2** translation | P2 中 | 用户逐项确认风格数值表（七项，每项注明出自哪句话） | P2.1 |
| **G3** contract | P4 末 | 自检全绿 + `check-consistency` 通过 | P4 |
| **G4** alignment | P6 末 | `status: pass`（不是 conditional） | P5 |

"用户确认"= 用户明确回复确认或等价确认。兼容聊天 / CLI / GUI，不要写死成"点击"。

---

### Phase 0 · 接诊

1. 读项目：框架、现有 token、现有页面、依赖、是否已有设计系统
2. 检测导演层（§1）
3. **必问第一项：这个系统主要管什么东西**（文章 / 订单 / 用户 / 设备 / 工单…）。**说不清管什么，主页面只能靠猜或靠 agent 拍选项，两种都会跑偏**——前者选出模板页，后者选出 agent 自己编的页
4. **主页面：agent 提候选、用户拍板**（不是提问，不占问题预算）
   - 先按这个系统主要管什么列 2–3 个候选页面，每个附一句"它承载什么、为什么可能是主场"
   - 给出**推荐及理由**，依据：哪个页面用的人最多 / 哪个页面暴露的设计决策最多 / 哪个页面能验证最多规则
   - 用户确认或改选
   - **不要用预设选项让用户三选一**——那等于把设计决策外包，用户会选到 agent 编出来的页面
5. 其余必问：给谁用 / 有无品牌色或必须沿用的视觉资产
6. 选问（至多 1 个，其余留到 Phase 2/3 相关时再问）：是否需要暗色模式 / 是否有 AI 对话或生成能力 / 有无必须支持的浏览器下限
7. 写一段 ≤120 字的需求小结（brief）回显给用户确认

**问题预算 ≤4**：系统管什么、给谁用、品牌/视觉资产占 3 个；主页面是提案不占预算；剩 1 个给选问。超出预算的问题一律合并或移出。

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

| 七个方面 | 我从你的描述里读到的 | 取什么值 | 这条是从你哪句话推出来的 |
|---|---|---|---|
| 中性色温度 | 偏冷、克制 | `oklch(…, C≈0.002, H=250)` | "像瑞士铁路时刻表" |
| 彩度上限 | 低饱和 | 主色 C ≤ 0.12 | "不要糖水感" |
| 圆角 | 尖锐 | `0 / 2 / 4 / 999` | "工业感" |
| 边框 | 存在但极细 | `1px`，`fg 8%` | "像图纸" |
| 阴影 | 几乎不用 | 仅浮层一层 | — ← 写 `null` |
| 字重 | 中等 | 400 / 500 / 600 | "不要大字报" |
| 动效 | 快、无回弹 | 120–180ms `ease-out` | — ← 写 `null` |

`from` 为 `null` 表示没有方向依据、按规则取默认。**这也是一条信息**，要标出来。

纯黑：用户选 `#000` 时说"纯黑在屏幕上会显得生硬，建议换成 `#1A1A19` 这种略带暖调的深灰"，一键替换；坚持则保留并记为一次例外。

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

出报告前还有两步：

1. **先做六轴自评**（Philosophy / Hierarchy / Execution / Specificity / Restraint / Variety，各 1–5 分，依据见模板）。**任一项 < 3 回到 P5 修，不写进报告**——不能记成待办。全给 5 分要说明砍了什么，`weakest` 必须等于最低分轴。
2. **若 Phase 0 记录过基线**，跑 `node scripts/baseline.mjs --project <dir> --check`；**hard 项缺失 = 不通过**，不得用"和上一版差不多"替代。

报告顶部写机读块：

```
<!-- alignment-report
status: pass | conditional | fail
gate: G4
checkedAt: …
toolVersions: { … }
unresolvedCount: 0
selfReview: { philosophy: N, …, weakest: "<最低分轴>", note: "<≥20 字>" }
-->
```

**只有 `status: pass` 才算完成。**

---

## 4. 非协商项（压缩版）

完整规格见 `references/rules/00-non-negotiable.md`。分级：**MUST** / **SHOULD** / **ADVISORY** / **REFLEX**。

**REFLEX 不是错，是模型的默认手**——看起来合理，但通常没经过判断。不做要给理由，并在 `alignment-report.md` 的 Reflex 区登记，不走 overrides 九字段。

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

**REFLEX · 模型的默认手**（替用户决定 / 把发出当收到 / 不知道就编 / 专家控件前置 / 静默失败 / 只改一半链路 / 模板冒充设计 / 清单当结果 / 一次给太多）全文与留痕方式见 `references/reflex.md`。
命中时先分清这是判断还是惯性；决定不做，给理由并登记 `alignment-report.md` 的 Reflex 区。

**R4 参数**：三件套代码见 `references/rules/00-non-negotiable.md` §3.4（浅色外投影 .18 / 内投影 .10 / 内环 fg 8%；暗色外投影 .45、内环 white 6%）。

**R6.1 参数**：`glyph-focus` 关键帧与 `.glyph` 规则见 `references/rules/00-non-negotiable.md` §3.6。约束：只 append 新 span，已完成的合并成纯文本；只给最新 30 字挂动画；每秒 >40 字时 2–3 字一组入场；动画层 `aria-hidden`，另起隐藏节点 `aria-live="polite"` 每 200–300ms 更新；`prefers-reduced-motion` 下只留透明度。

**R6.3 参数**：思考框 `grid-template-rows: 0fr → 1fr` 撑开，不用 `height` 动画；完整代码与降级链见 `references/rules/04-ai-ui.md` §3。

---

## 5. 玻璃拟态

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

## 6. 交付物

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

## 7. 脚本

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

## 8. 你要避免的失败模式

| 失败 | 表现 | 对策 |
|---|---|---|
| 跳过转写 | 文档说冷灰、代码是暖米色 | G2 是硬闸门；`translation` 空 → `check-tokens` 报错 |
| 覆盖别人的文档 | 辛苦写的规则被 `impeccable document` 抹掉 | marker 块 + 幂等重注入；`decisions.json` 才是真相 |
| 把"有条件通过"当完成 | 偏差累积到无法收拾 | 只有 `status: pass` 算 G4 |
| 把规则当教条 | 用户想在粗野主义里用纯黑被拒 | 分级 + override 登记，不是禁止覆盖 |
| 把导演层当必须依赖 | 没装就整个流程卡住 | 三条降级路径都必须能跑通 |
| 顺手实现业务逻辑 | 越界 | 只管视觉；功能不在范围内 |

---

## 9. 参考

按需读，不要一次全加载。

| 文件 | 什么时候读 |
|---|---|
| `references/phrasing.md` | 任何要对用户开口的场合；术语换白话的对照表 |
| `references/directors.md` | 检测到导演层，或需要设计降级路径 |
| `references/translation.md` | 做 Phase 2 转写 |
| `references/injection.md` | 写/排查注入块 |
| `references/rules/00-non-negotiable.md` | lint 报错、或需要 R1–R9 全文 |
| `references/rules/0[1-6]-*.md` | 对应规则的深度规格与实际代码 |
| `references/styles/*.md` | **仅自导模式**，选中某张卡之后 |
| `references/layout-patterns.md` | Phase 3 找线框 |
| `references/motion.md` | Phase 4 定动效 |
| `references/reflex.md` | 每次准备"先这样做"之前；X1–X9 的判定与留痕方式 |

设计依据（本 skill 为什么长这样）在维护者本地，不随仓库分发。
