# tests

```
node tests/run.mjs        # 单元 + 集成 + 生成链 + lint + guard 复算（56 项）
node tests/css-check.mjs  # 12 个风格变体的结构检查
node tests/baseline.mjs   # 基线录制与比对（19 项）
```

零依赖，无框架。全部退出码：`0` 通过 · `1` 有失败 · `3` 输入非法（`baseline.mjs` 另有 `2` = 环境问题 / 拒绝覆盖）。

## run.mjs 覆盖什么

| 组 | 内容 |
|---|---|
| 颜色数学 | OKLCH 往返、ΔL 绝对值、对比度、色域映射、`surfaceLadder` 的 step 夹取 |
| Schema | 合法数据通过、缺字段被拒、ΔL 越界被拒、override 十字段（含 `guard`） |
| 哈希 | 键序无关、值变则变、稳定性 |
| marker | 新建 / 追加 / 替换 / unchanged / 只有 begin / end 在前 / 三次幂等 |
| 生成链 | build → inject → consistency 全绿；产物零残留占位符；改决策后报漂移；注入块被抹后可恢复 |
| lint | 裸色值、纯黑、阴影里的 alpha 黑豁免、translation 为空、ΔL 越界、暗色未降字重、按钮文字对比度、小字被降档 |
| override | `guard` 四种断言（token / contrast / deltaL / surface）逐条复算；`OV1`–`OV4`；reason 套话黑名单按整句匹配，不误杀「无过渡边缘」 |
| 构建 | 小字字重跨主题恒定、body 字重暗色低于浅色 |
| 路径安全 | `--design-file` 指向项目外被拒 |

## baseline.mjs 覆盖什么

| 组 | 内容 |
|---|---|
| 录制 | 首次 `--record`、重复录制需 `--force`、`--check` 时无基线退出 2 |
| hard 项 | 删链接 / 删带 name 的字段 → 退出 1；多文件丢同一个值可一条豁免覆盖 |
| soft 项 | 删 heading、字数骤减超 40% → 只 warn，退出 0 |
| 豁免 | 行注释 / 块注释都生效；理由不足 12 字无效；同项重复豁免提示 |
| 扫描 | 跳过 `node_modules` 与 `design/aesthetic`；JSX 属性里的箭头函数不截断后续属性 |

## css-check.mjs 覆盖什么

每个变体文件：

- 括号 / 字符串 / 注释平衡
- 作用域必须是 `:root[data-style="<文件名>"]`，不能是裸 `:root`
- 必须有 `[data-theme="dark"]` 块（R5 要生效）；索引里标 `"theme": "dark-only"` 的变体例外
- token 名在共享语义集合内（局部变量按前缀白名单）
- 非 token 行不出现色字面量
- `bento` 之外不允许改写 `display: grid/flex`

两份 `style-index.json` 必须与磁盘一致，且 variant id 互相匹配。

## 真实浏览器上的验收

单元测试不验证渲染。完整验收要跑：

```bash
node scripts/studio.mjs --project <dir> --port 4318 &
node scripts/audit.mjs --project <dir> \
  --url "http://127.0.0.1:4318/studio/fixture/index.html#/settings" \
  --view desktop --theme dark
```

浏览器不可用时 `audit` 退出码 2 并输出 `manual-required`——**这是设计，不是失败**。
当前基线：12 个变体 × 4 个路由 = 48 次审计，全部 0 error 0 warning。
