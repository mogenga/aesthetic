# 注入：让规则活在别人的文件里而不被抹掉

> 用于 Phase 4，以及任何"我的规则怎么消失了"的排查。

---

## 问题

`aesthetic` 产出的 R1–R9 具体取值，必须让**任何**进入这个项目的 agent 看到。所有 agent 都会读项目根目录的 `DESIGN.md`。

但 `DESIGN.md` 可能属于 `impeccable`，它的 `/impeccable document` 命令会**整篇重生成**这个文件。我们写进去的段落会消失，而且不会有任何报错。

同时，反向也不行：如果我们把 `DESIGN.md` 当成自己的文件去维护，导演层的 `context` 命令读到过期的摘要，会产生更隐蔽的错乱。

---

## 解法：单向投影

```
decisions.json  ──►  contract.md  ──►  DESIGN.md 的 marker 块
   ★ 唯一可编辑源        规范化合同            幂等投影
```

- **真相**永远在 `design/aesthetic/` 里，别的 skill 不写它
- **投影**在 `DESIGN.md` 里，块外内容我们一个字节都不碰
- 投影被抹 → 不报警、不补救、下次重跑 `inject.mjs` 就回来

**为什么不双向同步**：双向要求我们能解析导演层的格式、并让它理解我们的格式。任一边升级都会漂移，维护成本是平方级。

---

## Marker 语法

```markdown
<!-- aesthetic:begin v2 — 由 aesthetic 生成，勿手改；重跑只覆盖此块 -->
<!-- sourceHash: sha256:abc123… · generatorVersion: aesthetic-v2 -->
## 非协商项（本项目取值）

> 完整合同：`design/aesthetic/contract.md` · 令牌：`design/aesthetic/tokens.css`

**设置页**：名称在左、控件在右，一行一项；……

**表单**：……

<!-- aesthetic:end -->
```

规则：

| 部分 | 约束 |
|---|---|
| 首行 | 必须以 `<!-- aesthetic:begin` 开头，`aesthetic:begin v2 … -->` 整行 |
| 末行 | 必须恰好是 `<!-- aesthetic:end -->` |
| 第二行 | `sourceHash` 元信息，供 `check-consistency` 判过期 |
| 内容 | **由 `contract.md` 第 8 段派生**，不手写 |
| 之间 | 不允许出现第二个 `aesthetic:begin` |

`inject.mjs` 用正则锚定，匹配的是**第一个 begin 与第一个 end**。嵌套或不配对一律按损坏处理。

---

## 六种写入情形

| # | 现状 | 动作 | 备份 | 提示 |
|---|---|---|---|---|
| 1 | `DESIGN.md` 不存在 | 新建，只含块 | — | `✓ 新建` |
| 2 | 有完整 marker 对，内容一致 | 不动 | — | `= 未变化` |
| 3 | 有完整 marker 对，内容不同 | 只替换块内 | `.bak` | `✓ 替换块内` |
| 4 | 有文件但无 marker | 追加到末尾，前加空行 | `.bak` | `✓ 追加到末尾` |
| 5 | 有 begin 无 end（或反之） | 按"无 marker"处理 → 追加 | `.bak` | `✓ 追加到末尾` |
| 6 | end 在 begin 之前 | 按"无 marker"处理 → 追加 | `.bak` | `✓ 追加到末尾` |

情形 4/5/6 的共同点是**永不覆盖全文**。最坏情况是文件里多一段重复内容，人工一眼可见、可以删掉；而覆盖全文的后果是不可逆的。

---

## 被导演层抹掉之后

这是**预期行为**，不是故障。

```
1. impeccable document  →  DESIGN.md 全量重生成，注入块消失
2. check-consistency   →  ✗ DESIGN.md 注入块 — 缺少 sourceHash
3. inject.mjs          →  ✓ 追加到末尾（情形 4）
4. check-consistency   →  ✓ 所有派生物一致
```

**不要**：
- 去改 `impeccable` 的输出格式
- 把块写进它的模板
- 在它重生成后手工粘贴（下次还会被抹）

**要**：把 `inject.mjs` 加入每次 `impeccable document` 之后的固定步骤。在 `SKILL.md` 的 Phase 4 里已经这样写了。

---

## 与其他 skill 的 lint 冲突

`impeccable` 有 62 条确定性规则，其中一些会咬到我们的合法决策：

| 我们的规则 | 可能触发它的 | 压制方式 |
|---|---|---|
| R3 允许粗野主义用纯黑描边 | `overused-black` 一类 | 块末尾加 `<!-- impeccable-disable <rule-id> -->` |
| R2 允许 ΔL 低至 0.010 | 低对比告警 | 同上，同时在报告里注明"表面层级，非文本对比度" |
| 风格卡指定非系统字体 | `overused-font` | `npx impeccable ignores add-value overused-font <Font> --reason "风格卡指定"` |

压制的**同时**必须写进 `decisions.json.overrides[]` 的 `verification` 字段，否则下次 audit 会重报，而你不知道为什么。

```json
{
  "rule": "R3",
  "scope": "neo-brutalism.border",
  "requestedValue": "#000",
  "effectiveValue": "#000",
  "reason": "风格卡声明纯黑描边是签名元素",
  "approvedBy": "user",
  "createdAt": "2026-11-01T10:00:00Z",
  "expiresAt": null,
  "verification": "impeccable-disable overused-black"
}
```

---

## 排查清单

规则"没生效"时按顺序查：

| 现象 | 查什么 | 命令 |
|---|---|---|
| `DESIGN.md` 里没有块 | 有没有跑过 inject | `node scripts/inject.mjs --project <dir> --check` |
| 块还在但内容旧 | 有没有重跑 build | `node scripts/check-consistency.mjs --project <dir>` |
| 块被抹了 | 导演层刚跑过 document | 重跑 inject |
| 块里有一条规则但实现没照做 | 不是注入问题，是落地问题 | 跑 `check-tokens.mjs` + `audit.mjs` |
| 块里出现的值和合同不符 | 有人手改了块 | 重跑 inject 覆盖；并检查是否有人改了 `contract.md` |
| 两个 agent 报不同的值 | `contract.md` 与 `tokens.css` 漂移 | `check-consistency` 会指出是哪个文件 |

---

## 直接调用

```bash
# 从 contract.md §8 派生并注入
node scripts/inject.mjs --project ./my-app

# 只检查，不写（退出码 1 = 需要刷新）
node scripts/inject.mjs --project ./my-app --check

# 看会写成什么样，不落盘
node scripts/inject.mjs --project ./my-app --dry-run

# 用自定义内容（通常是测试或特殊场景）
node scripts/inject.mjs --project ./my-app --content ./block.md

# 目标不是 DESIGN.md
node scripts/inject.mjs --project ./my-app --design-file ./docs/VISUAL.md
```

`--content` 会跳过 `contract.md` 派生，但仍然套用 marker 头和 `sourceHash`。正常流程不应该用它。
