# 示例 · 极简 / Operate

一个完整的走通样例：从 `decisions.json` 到 `DESIGN.md` 注入块的全部产物。

用来做什么：

- **看格式**：交付物长什么样，比读模板快
- **当测试夹具**：`node scripts/check-consistency.mjs --project <这个目录的上级>` 应该通过
- **当起点**：复制 `decisions.json` 改值，重跑 `build.mjs` + `inject.mjs`

## 这个例子的设定

| 项 | 值 | 说明 |
|---|---|---|
| 导演层 | `impeccable` | 方向来自它的 `shape`，模式 Operate |
| 风格 | `minimalism` | 自导画廊的首选 |
| 主题 | 浅 + 深 | 完整双主题 |
| 字体 | Inter Variable | 可变字体，字重可任意取 |

方向原话（假想）：

> 工业感、图纸感，像瑞士铁路时刻表那样克制。不要糖水渐变，不要大字报。

## 转写结果

| 维度 | 取值 | 依据 |
|---|---|---|
| 中性色温度 | H 250, C 0.003 | 「像瑞士铁路时刻表」 |
| 彩度上限 | 0.09 | 「不要糖水感」 |
| 圆角 | 0 / 2 / 4 / 999 | 「工业感」 |
| 边框 | 1px / fg 8% | 「像图纸」 |
| 阴影 | 仅浮层 | `null`（规则默认） |
| 字重 | 400 / 500 / 600 | 「不要大字报」 |
| 动效 | 100–140ms ease-out | `null`（规则默认） |

注意**阴影**和**动效**两维写的是 `null`——方向里没有说，所以取规则默认。这本身是信息：日后改方向时，这两维不会被推翻。

## 文件

| 文件 | 说明 |
|---|---|
| `decisions.json` | **唯一可编辑源**。要改，改这个 |
| `tokens.css` | 派生。可以直接 `@import` |
| `tokens.json` | 派生。给 lint / CI 用 |
| `contract.md` | 派生。给实现者和 agent 读 |
| `DESIGN.md` | 注入块示例。真实项目里这个文件属于导演层，只写块 |

## 复现

```bash
cp -r assets/examples/minimal-operate /tmp/demo/design/aesthetic
node scripts/build.mjs  --project /tmp/demo     # 重新生成 tokens + contract
node scripts/inject.mjs --project /tmp/demo     # 写 DESIGN.md 的 marker 块
node scripts/check-consistency.mjs --project /tmp/demo
node scripts/check-tokens.mjs      --project /tmp/demo
```

全部应返回 0。

## 刻意留下的东西

- `--surface-sunken` 只用于输入框凹陷底，不参与表面阶梯（所以它的 ΔL 是 `—`）
- 暗色主题的 ΔL 比浅色大（0.022 / 0.024 / 0.026 对 0.010 / 0.015 / 0.017）——暗底上同样的 L 差感知更强
- `--fg` 用 `#1A1A19` 而不是纯黑，`oklch` 值是实测的 `0.2174 0.0019 106.6`，不是手写近似
