# 对齐报告 · {{PROJECT}} · {{DATE}}

<!-- alignment-report
status: {{pass|conditional|fail}}
gate: G4
checkedAt: {{ISO}}
project: {{PROJECT}}
viewports: [1440, 834, 390]
themes: [light, dark]
toolVersions: { build: aesthetic-v2, shoot: "{{V}}", audit: "{{V}}", cdp: "{{V}}", impeccable: "{{V|-}}" }
motionPrefs: [default, reduce]
unresolvedCount: {{N}}
overrides: {{N}}
selfReview: { philosophy: {{1-5}}, hierarchy: {{1-5}}, execution: {{1-5}}, specificity: {{1-5}}, restraint: {{1-5}}, variety: {{1-5}}, weakest: "{{轴}}", note: "{{为了提升最弱轴改了什么，≥20 字}}" }
-->

> **状态说明**：只有 `status: pass` 才算完成。`conditional` 是待处理候选，必须修回 Phase 5 重跑；不得以此宣布交付。

---

## 结论

{{通过：所有 MUST 检查通过；已登记 override 均满足其验证条件。}}
{{有条件通过：N 项偏差待处理，不构成完成状态。}}
{{不通过：N 项 MUST 未满足。}}

| 档 | 结果 | 阻断项 |
|---|---|---|
| L1 token 审计 | {{✓ / ✗}} | {{—}} |
| L2 几何审计 | {{✓ / ✗}} | {{—}} |
| L3 知觉复核 | {{✓ / ✗}} | {{—}} |
| 导演层输入 | {{并入 / 未启用}} | {{—}} |

---

## 发射前自评

出报告之前先给自己的方案打分，用来发现「检查全绿但东西不行」的情况。分数与机读块 `selfReview` 一致。

| 轴 | 分数（1–5） | 依据 |
|---|---|---|
| Philosophy | {{N}} | {{方案背后有一个能说清的立场吗？一句话写出这个立场，并说明它排除了什么}} |
| Hierarchy | {{N}} | {{一屏里最该被看见的东西是不是最显眼的？指出它是什么、靠什么手段胜出}} |
| Execution | {{N}} | {{对齐、间距、状态、可读性是否到位？列出已验证的项与仍存在的粗糙处}} |
| Specificity | {{N}} | {{把方案放到同类的另一个产品上是否还成立？成立 = 低分；写出这个方案绑定了哪些业务事实}} |
| Restraint | {{N}} | {{有没有该删没删的装饰？列出删掉的或坚持保留的，并说明保留理由}} |
| Variety | {{N}} | {{结构是否只用了最顺手的那一种？说明本方案与默认版式的差别}} |

**判定规则**（四条都执行）：

1. **任一项 < 3 必须先改再出报告**，不能「记下来待办」。回到 Phase 5 修完重跑对应闸门。
2. **全给 5 分要说明「砍了什么才换来的」**——没有取舍的满分不可信。
3. `weakest` 必须与最低分轴一致；`note` 写「为了提升最弱轴改了什么」，**≥20 字**。
4. **不许为了填字段编一个弱点。** 六项都 ≥4 时，`weakest` 指向最低的那项，如实写它为什么只是「够用」。

**六个轴的含义**：

- **Philosophy**：方案背后有没有一个能说清的立场
- **Hierarchy**：一屏里最该被看见的东西是不是最显眼
- **Execution**：细节是否到位（对齐、间距、状态、可读性）
- **Specificity**：放到同类的另一个产品上还成立吗（成立 = 低分）
- **Restraint**：有没有该删没删的装饰
- **Variety**：结构是否只用了最顺手的那一种

---

## L1 · token 审计

`node scripts/check-tokens.mjs --project <dir>`

```
{{粘贴实际输出}}
```

| 检查 | 结果 | 说明 |
|---|---|---|
| 色值全部来自 token | {{✓}} | {{62/62}} |
| 表面层级 ΔL ∈ [0.010, 0.030] | {{✓}} | {{0.010 / 0.015 / 0.017}} |
| 禁止场景无纯黑 | {{✓}} | {{阴影中的带 alpha 黑已登记}} |
| 暗色字重已降档 | {{✓}} | {{body 350 / strong 500 / display 600}} |
| 对比度（正文 / 大字 / 非文本 / 焦点） | {{✓}} | {{14.2 / 7.1 / 4.3 / 3.6}} |
| `translation` 非空 | {{✓}} | {{七维齐全}} |

---

## L2 · 几何审计

`node scripts/audit.mjs --project <dir> --url <url> --view all --theme all`

```
{{粘贴实际输出}}
```

| 规则 | 检查 | 结果 | 实测 |
|---|---|---|---|
| R1 | 结构值对齐 8pt | {{✓}} | {{40/40}} |
| R1 | 光学值走独立 token | {{✓}} | {{--line-hair 1px、--label-gap 8px}} |
| R2 | 表面 ΔL（计算值） | {{✓}} | {{0.010 / 0.015 / 0.017}} |
| R4 | 输入框外投影 + inset 内环 | {{✓}} | {{6/6 个输入框}} |
| R5 | 暗色字重降档生效 | {{✓}} | {{}} |
| R7 | 计时器 `tabular-nums` | {{✓}} | {{}} |
| R8 | 设置页左名右控件 / 行高 / 细线 | {{✓}} | {{12/12 行}} |
| R9 | 表单标签在上 / 输入全宽 | {{✓}} | {{6/6 字段}} |

**偏差明细**

| 规则 | 位置 | 期望 | 实测 | 处置 |
|---|---|---|---|---|
| {{R9}} | {{.field:nth-child(3)}} | {{24px}} | {{18px}} | {{已改为 24px}} |

---

## L3 · 知觉复核

`node scripts/shoot.mjs --project <dir> --url <url> --view all --theme all`

| 页面 | 签样 | 实现 | 差异 | 处置 |
|---|---|---|---|---|
| 首页 | `approved-home.png` | `aligned-home.png` | {{卡片阴影偏重}} | {{已调 --shadow-1}} |
| 设置 | `approved-settings.png` | `aligned-settings.png` | {{—}} | — |
| 表单 | `approved-form.png` | `aligned-form.png` | {{—}} | — |
| AI | `approved-ai.png` | `aligned-ai.png` | {{流式节奏偏慢}} | {{delay 30ms → 24ms}} |

**判断依据**：并排看时，差异属于"实现错"还是"签样本身该改"？

- 实现错 → 改代码
- 签样该改 → 回 Phase 3 重新签样，并在 `decisions.json.overrides` 登记，说明为什么偏离原签样

{{本次所有 L3 差异均属实现错。}}

---

## 导演层输入

{{若 impeccable 可用：}}

```bash
/impeccable audit <target>
/impeccable critique <target>
```

| 来源 | 结果 | 并入位置 | 是否改判 |
|---|---|---|---|
| `impeccable audit` | {{P0:0 P1:1 P2:2}} | L2 | P1 记为偏差；P0 会升级为不通过 |
| `impeccable critique` | {{8.2/10}} | L3 参考 | **不改判**（主观分不能当闸门） |

去重：{{2 条与 L1 重合，保留 aesthetic 原文}}。

{{若未启用：}}
`impeccable` 不可用（{{unavailable / unsupported / failed}}），本节未启用。降级路径按 `references/directors.md` 执行。

---

## Override 登记

{{若为空：}}

本次无 override。

{{若不为空：}}

| 规则 | 范围 | 请求值 | 生效值 | 原因 | 批准人 | 验证方式 | 到期 |
|---|---|---|---|---|---|---|---|
| R3 | neo-brutalism.border | `#000` | `#000` | 风格卡声明纯黑描边是签名元素 | user | `impeccable-disable overused-black` | 无 |

每条 override 都必须在 `decisions.json.overrides` 中存在且九个字段齐全，否则 L1 报"未登记覆盖"。

---

## Reflex 登记

只登记**决定不按默认手做**的条目（X1–X9 见 `references/reflex.md`）。走了默认手且理由清楚的，不写。

{{若为空：}}

本次无 Reflex 偏离。

{{若不为空：}}

| # | 默认手 | 决定 | 理由 | 依据 / 确认人 | 时间 |
|---|---|---|---|---|---|
| X1 | 替用户做决定 | 不做 | brief 明确「本期不做暗色」 | 用户原话「本期不做暗色」 | {{ISO}} |

---

## 覆盖矩阵

| 维度 | 已测 | 结果 |
|---|---|---|
| 视口 | 1440 / 834 / 390 | {{✓}} |
| 主题 | 浅色 / 暗色 | {{✓}} |
| 动效偏好 | 默认 / `prefers-reduced-motion` | {{✓}} |
| 交互 | 鼠标 / 键盘 / 触控 | {{✓}} |
| 内容压力 | 长文本 / CJK / 200% 缩放 / 空态 / 错误态 | {{✓}} |
| 浏览器 | {{Chromium 111+ / Safari 16.4+ / Firefox 113+}} | {{✓ 实测版本：…}} |

**无障碍底线**：{{可见 focus-visible / 键盘可达 / 状态不只靠颜色 / 表单错误语义关联 / 触控目标 ≥44×44 / forced-colors 可见边界}}。

---

## 未解决项

{{若 unresolvedCount 为 0：}}

无。

{{否则：}}

| # | 项 | 影响 | 下一步 |
|---|---|---|---|
| 1 | {{…}} | {{…}} | {{…}} |
