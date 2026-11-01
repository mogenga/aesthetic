<!-- aesthetic:begin v2 — 由 aesthetic 生成，勿手改；重跑只覆盖此块 -->
<!-- sourceHash: sha256:f9e40363655ff3b29194d9966c809868e3f888db14a609b038b8dce5298c6209 · generatorVersion: aesthetic-v2 -->
## 非协商项（本项目取值）

> 完整合同：`design/aesthetic/contract.md` · 令牌：`design/aesthetic/tokens.css`

**设置页**：名称在左、控件在右，一行一项；无外层卡片，页面即背景；组标题 + 组间 44px / 组内 0；行间仅 1px 细线；行高 54px；危险操作单独成组置于最后。

**表单**：标签在上、输入区在下、输入区全宽；标签→输入 8px，字段→字段 24px；错误文本替换帮助文本并预留同高。

**AI 界面**：流式文字逐字 30ms 错峰、高斯模糊→瞬间对焦；正文行内图标 `vertical-align: -0.125em`；思考框用 `0fr → 1fr` 网格撑开。

**暗色模式**：全站文字字重降一档（body 350 / strong 500 / display 600），正文不低于 300，小于 16px 不低于 400。

**色彩**：表面层级 ΔL ∈ [0.010, 0.030]；禁止场景不用纯黑，正文用 `#1A1A19`。

**输入框**：不用亮线，外投影 + inset 内环咬合。

**计时器**：`font-variant-numeric: tabular-nums`（无 `tnum` 时改用等宽字族）。

**视觉对齐**：结构值对齐 8pt 网格；光学值走独立 token；实现须与签样逐项对齐。

---
<!-- aesthetic:end -->
