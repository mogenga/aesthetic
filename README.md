# Aesthetic

> 把设计方向编译成 token 与可执行合同的 Claude Code skill。

`aesthetic` 是一个**编译型 + 治理型** skill：接收导演层（`impeccable` / `frontend-design` / 自带 Studio 画廊）给出的设计方向，转写成数字化 token 与非协商项合同，注入项目设计文档，并在实现后做 L1/L2/L3 三档视觉对齐验收。

它不定义品味，只保证品味决定**可执行、可校验、可长期延续**。

| 层 | 职责 | 产出 |
|---|---|---|
| 导演层 | 气质、风格、文案语气、创意方向 | 方向、散文、草图 |
| 编译层 | 散文 → token 表 → 合同 | `contract.md`、`tokens.css`、`tokens.json` |
| 验收层 | L1 token / L2 几何 / L3 知觉 | `alignment-report.md` |

## 核心约束

- 合同未落成，不写第一行 UI 代码
- 对齐报告未通过，不宣布完成
- 真相永远不放在别人的文件里（`design/aesthetic/` 是唯一事实来源，目标 `DESIGN.md` 只放幂等注入块）

## 文档

- [`SKILL-DESIGN.md`](SKILL-DESIGN.md) — 完整设计文档（v2.0）：定位与边界、六个核心决策、六阶段工作流、Studio 工作台、R1–R9 非协商项、交付物规格、实施计划

## 状态

设计阶段（v2.0 已拍板，实现批次规划见 SKILL-DESIGN.md §10）。
