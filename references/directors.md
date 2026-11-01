# 导演层接入

> 用于 Phase 0 检测、Phase 1 交接、Phase 6 合并。

---

## 三种导演

| id | 来源 | 强项 | 交付物 |
|---|---|---|---|
| `impeccable` | `pbakaus/impeccable` | 24 个 steering 命令、62 条确定性规则、四种 surface 模式、`audit`/`critique` 分级 | `PRODUCT.md`、`DESIGN.md`、`.impeccable/design.json` |
| `frontend-design` | 本机 skill | 反模板清单、色/字/布局/原则四段式 | 一次设计计划（文字） |
| `self` | 本 skill 的 Studio | 10 张逻辑卡 + 3 个玻璃变体 | 卡 id + variant id |

**同一时刻只允许一个导演。** 叠加会得到两套互相打架的方向。

---

## 检测

只看**可用 skills 列表**，不做文件系统嗅探，**不自动安装、不联网下载**。

```
可用的 skills 里有没有 impeccable？
  ├─ 有 → director = impeccable
  └─ 无 → 有没有 frontend-design？
        ├─ 有 → director = frontend-design
        └─ 无 → director = self
```

### 四值状态

| 状态 | 含义 | 后续 |
|---|---|---|
| `available` | 能加载且版本兼容 | 进入对应联动路径 |
| `unavailable` | 没装 | 走降级梯 |
| `unsupported` | 装了但版本/能力不满足 | 记录原因，走降级梯 |
| `failed` | 能加载但调用报错 | 记录错误，走降级梯；**不重试超过一次** |

只有 `available` 才算数。`failed` 不要静默吞掉——写进 `alignment-report.md` 的 `toolVersions` 旁边。

### 适配协议

```ts
interface DirectorAdapter {
  id: 'impeccable' | 'frontend-design' | 'self'
  version: string
  status: 'available' | 'unavailable' | 'unsupported' | 'failed'
  capabilities: Array<'shape' | 'audit' | 'critique' | 'design-md' | 'product-md'>
  directionInput: string      // 它期望的方向描述格式
  auditOutput?: string        // 规则 id → P0..P3 的映射约定
  timeoutMs: number           // 默认 120_000
  errorCode?: string
}
```

---

## 交接话术

检测到导演层时，**不要静默接管**。用一句话说明分工：

### 有 `impeccable`

> 我检测到 `impeccable`。**方向由它定**（气质、风格、文案语气），我负责把它编译成 token 与可验收的合同，并在实现后做对齐。
> 先跑它的 `shape`（或 new-work），把结论给我，我转写成七维表给你确认。

### 有 `frontend-design`

> 我检测到 `frontend-design`。请它先给出"色 / 字 / 布局 / 原则"四段式计划，我把它转写成可校验的 token 与合同。
> 它的反模板清单我会用来筛掉候选方向里的默认套路。

### 都没有

> 没有检测到导演层。我用自己的 Studio 画廊：从 10 张风格卡里挑 3 个最匹配的并排渲染给你选，或者你直接描述想要的风格。

---

## 读它的产物

### `impeccable`

| 文件 | 怎么用 | 不要做什么 |
|---|---|---|
| `PRODUCT.md` | 当 brief 的输入。**已有就不再写一份** | 不要覆盖或重写 |
| `DESIGN.md` | 读色板、字体、原则，作为转写 2.x 的输入 | 不要整篇改写；只在末尾注入 marker 块 |
| `.impeccable/design.json` | 读它的设计决策 | **不要写它**（与我们的 `decisions.json` 同名不同义） |
| `.impeccable/config.json` | 读 `buildPath` 等配置 | 不改 |

### `frontend-design`

它是纯文字的，没有落盘产物。把它的四段式计划原文保留在 `decisions.json` 的 `direction.raw` 里，供日后审计。

---

## 冲突处理

### 优先级

```
用户显式要求 > MUST 规则 > 导演层方向 > SHOULD 规则 > 检测器默认规则 > 模型默认
```

### 三类冲突

**① 导演层给了色板，但没给层级阶梯**

→ 以它的色板为**输入端**，用 R2 生成阶梯。写进 `contract.md` 第 9 段标"aesthetic 补足"。

```js
// 它的 bg = oklch(0.985 0.002 85)
// 用 surfaceLadder() 按 ΔL ∈ [0.010, 0.030] 生成 surface-1..3
```

**② 导演层给了圆角，与方向冲突**

→ 先问用户。用户说"按导演层"就改，说"按方向"就保留并登记。

```json
{
  "rule": "R1",
  "scope": "radius.lg",
  "requestedValue": 12,
  "effectiveValue": 4,
  "reason": "方向说工业感，导演层默认 12px 与方向冲突，用户选择按方向",
  "approvedBy": "user",
  "createdAt": "2026-11-01T10:00:00Z",
  "expiresAt": null,
  "verification": "contract §9 已注明刻意偏离"
}
```

**③ 它的 lint 规则咬到我们的合法决策**

→ 不静默。用它的机制压制 + 登记 override（详见 `injection.md`）。

---

## Phase 6 的结果合并

若 `impeccable` 可用：

```bash
# 它的两个命令
/impeccable audit <target>
/impeccable critique <target>
```

合并规则：

| 它的输出 | 并入 | 是否改判 |
|---|---|---|
| **P0** | L2 与 L3 之间 | **一律升级为"不通过"** |
| P1 | 同上 | 记为偏差 |
| P2 / P3 | 同上 | 只记录，不改判 |
| `critique` 打分 | L3 辅助材料 | **不进入结论**——主观分不能当闸门 |

去重：按规则 id 匹配。同一条规则两边都报时，保留 `aesthetic` 的原文（因为它带本项目具体参数）。

写入报告：

```
## 导演层输入
tool: impeccable v4.8.0
audit: 3 findings (P0:0 P1:1 P2:2) → 已并入 L2
critique: 8.2/10 → 仅作 L3 参考
dedup: 2 条与 L1 重合，保留 aesthetic 原文
```

---

## 降级路径必须都能跑通

在批次 5 的验收里，三条路径各跑一遍完整流程：

| 路径 | 需要验证 |
|---|---|
| 有 `impeccable` | 能读 `PRODUCT.md` / `DESIGN.md`；它的 `document` 重跑后注入块被抹、`inject.mjs` 能恢复 |
| 有 `frontend-design` | 能拿到四段式计划并转写；无 audit 输入时报告里那一节标"未启用" |
| 都没有 | Studio 画廊能出 3 个候选、能选、能落盘 |

**任何一条跑不通，说明你把导演层当成了必须依赖**，这是 SKILL.md §7 里列出的失败模式之一。
