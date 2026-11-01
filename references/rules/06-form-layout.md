# 表单页 · R9 全文

> 什么时候读这份：做登录 / 注册 / 资料编辑 / 提交类页面；`audit.mjs` 报输入区宽度或字段间距；错误态出现时页面跳动。

R9 的一句话版在 [`00-non-negotiable.md`](00-non-negotiable.md) §3.9。

---

## 1. 布局基线

```
┌────────────────────────────────────────────────────┐
│  新建项目                                           │ ← 页面标题
│  填写基本信息，稍后可以修改                          │ ← 页面说明（次要色）
│                                                    │
│  项目名称 ·                                         │ ← 标签在上
│  ┌──────────────────────────────────────────────┐  │
│  │                                                │  │ ← 输入区全宽
│  └──────────────────────────────────────────────┘  │
│  用于在列表中识别，最多 60 字                        │ ← 帮助文本 12–13px
│                                                    │
│                          ↕ 24px（字段→字段）        │
│                                                    │
│  项目描述                                           │
│  ┌──────────────────────────────────────────────┐  │
│  │                                                │  │ ← textarea 同样全宽
│  └──────────────────────────────────────────────┘  │
│  0 / 500                                           │
│                                              ↕ 24px │
│  可见范围                                           │
│  ┌──────────────────────────────────────────────┐  │
│  │ 仅团队成员                             ▾     │  │ ← select 同样全宽
│  └──────────────────────────────────────────────┘  │
│                                                    │
│                          ↕ 32px（字段组→按钮）      │
│                                     [ 取消 ] [ 保存 ] │ ← 桌面右对齐
└────────────────────────────────────────────────────┘
```

| 规则 | 规格 |
|---|---|
| **纵向结构** | 名称在上，输入区在下 |
| **宽度** | 输入区**全宽**，不顺排、不并排 |
| **标签→输入** | 6–8px（光学值，`--label-gap`） |
| **字段→字段** | **24px**（`--s-5`） |
| **帮助文本** | 输入下方 12–13px，次要色 |
| **错误态** | 错误文本**替换**帮助文本，不叠加，预留同高 |
| **必填** | 文字或小圆点标注，不只用红色星号 |
| **提交** | 桌面右对齐、移动端全宽 |

---

## 2. 标签在上

| 布局 | 读法 | 代价 |
|---|---|---|
| **标签在上** | "这个框属于上面那个名字" | 纵向更长 |
| 标签在左 | "这个框和左边那个名字是一对" | 输入区起点参差，或长标签被截断 |
| placeholder 当标签 | "这里大概要填什么" | 输入后消失，填完不知道这格是什么 |

**纵向能滚，横向不能。** 标签在上用垂直空间换回**对齐轴的确定性**：所有输入区左缘落在同一条竖线上，每条标签也都能完整显示。

| 项 | 规则 |
|---|---|
| 关联 | `<label for>` 指向输入框 `id`；**不用 placeholder 代替标签** |
| 措辞 | 名词短语，不加冒号 |
| 大小写 | CJK 无大小写；拉丁句首大写，不加 `text-transform: uppercase` |
| 字号 | `--fs-sm` 13px 或 `--fs-md` 15px，**绝不大一号** |
| 字重 | `--fw-strong`（浅色 600 / 暗色 500） |
| 颜色 | `--fg`，**不是 `--fg-muted`** |
| 截断 | 不截断；超过一行就换行，行高 `--lh-snug` |

```html
<label class="field__label" for="project-name">
  项目名称 <span class="field__req">（必填）</span>
</label>
<input id="project-name" name="name" required aria-required="true" aria-describedby="project-name-msg">
```

**标签用 `--fg` 的理由：** 标签的对比度直接决定"用户能不能填对"，它是内容不是装饰。帮助文本才是 `--fg-muted`。

**6–8px 是光学值，不在 4px 网格上。** 标签的 `line-height` 已经带来视觉留白，再加 8px 盒间距后视觉间隙约 12–14px，是"贴在一起但能分开"的最佳区间。取值 8px 时用 `--label-gap: 8px`；标签 `line-height` 较大时用 6px，但也要建独立 token——`margin-bottom: 6px` 直接写死就是 `audit.mjs` 的违规项。

---

## 3. 输入区全宽

```css
.form { max-width: 640px; }
.field__control { width: 100%; box-sizing: border-box; }
```

`input`、`textarea`、`select`、日期选择器、文件上传区、自定义 combobox **全部全宽**。

| 并排的代价 | 说明 |
|---|---|
| 视线折返 | 眼睛走"Z 字"而不是一条竖线往下 |
| 宽度凭运气 | 长内容那格不够用，短内容那格浪费 |
| 移动端必然塌 | 390px 宽时两列各 170px，几乎无法输入 |
| 错误态错位 | 左栏出错时右栏没动，两栏高度不一致 |

**唯一例外是语义成对且都很短的字段**（省 / 市、起止日期），且移动端仍应塌成上下排列。即便并排，**24px 间距在两个方向都要成立**（`gap` 同时管横纵）。

```css
.field-row { display: grid; grid-template-columns: 1fr; gap: var(--s-5); }
@media (min-width: 640px) { .field-row--paired { grid-template-columns: 1fr 1fr; } }
```

---

## 4. 字段间距 24px

```css
.form__fields { display: grid; gap: var(--s-5); }   /* 24 */
```

**24px 是"字段与字段"之间的距离，不是"标签顶到下一个标签顶"。**

```
标签 A
输入 A
帮助 A          ← 这三行是一个"字段"
──── 24px ────
标签 B
```

| 间距 | 落在 | 说明 |
|---|---|---|
| 24px | 字段 ↔ 字段 | `--s-5`，**规定值** |
| 32px | 最后一组字段 ↔ 提交按钮 | `--s-6`，大一档，标示"输入结束" |
| 16px | 页面标题 ↔ 第一组字段 | `--s-4` |

间距加在**字段边界之间**，用 `gap` 直接得到；不要给每个 `.field` 写 `margin-bottom`——后者会在最后一个字段后也留 24px，与提交区间距叠加。**24px 比常见的 16px 和 20px 大是有意的**：表单失败率与字段间距强相关，挨太近时用户会把上一格的帮助文本读成下一格的说明。

---

## 5. 帮助文本与错误文本

### 5.1 替换关系与等高预留

```
正常态：  输入框
          帮助文本（12–13px，--fg-muted）

错误态：  输入框（内环 --danger）
          错误文本（12–13px，--danger）      ← 替换，不是追加
```

| 做法 | 结果 | 判定 |
|---|---|---|
| 错误文本追加在帮助文本下方 | 字段变高 20px，后续全部下跳 | ✗ |
| 替换但不预留高度 | 无帮助文本时字段矮一截，出现错误时跳 | ✗ |
| **预留同高，替换内容** | 高度恒定 | ✓ |

```css
.field__msg {
  min-height: 20px;              /* 13px × 1.35 ≈ 17.6 → 取 20 */
  margin: var(--s-1) 0 0;        /* 4 */
  font-size: var(--fs-sm);       /* 13 */
  line-height: var(--lh-snug);
  color: var(--fg-muted);
}
.field__msg[data-state="error"] { color: var(--danger); }
```

帮助态与错误态用同一个 `min-height`，切换时不产生任何高度变化；字段本来没有帮助文本时也要保留这个空槽位，否则出现错误时整页会跳。

**多行错误文本怎么办：** 错误文案必须保持**一行**。做不到就把 `min-height` 提到两行的量（约 38px），所有字段统一按两行预留——不能"这个字段一行、那个字段两行"。

### 5.2 语义关联

```html
<input id="email" name="email" type="email" aria-describedby="email-msg" aria-invalid="true">
<p class="field__msg" id="email-msg" data-state="error" role="alert">邮箱格式不正确</p>
```

| 属性 | 要求 |
|---|---|
| `aria-describedby` | 指向 `.field__msg` 的 `id`，正常态与错误态**都指向同一个** |
| `aria-invalid` | 错误时 `"true"`，否则移除或 `"false"` |
| `role="alert"` | **只在错误态加**；帮助文本不要加 |
| 焦点 | 提交校验失败时，焦点移到**第一个**出错字段 |

**不要用 `aria-errormessage`。** 支持度不稳定；`aria-describedby` + `role="alert"` 在所有目标浏览器上可靠。

---

## 6. 必填标注

```css
.field__req {
  color: var(--fg-muted);        /* 不是 --danger */
  font-weight: var(--fw-body);   /* 不比标签粗 */
  font-size: var(--fs-xs);       /* 12 */
}
```

| 方案 | 色盲可辨 | 屏幕阅读器可读 | 评价 |
|---|---|---|---|
| 红色 `*`（无文字） | ✗ | ✗ | ✗ |
| 中性色 `*` + 顶部说明"带 * 的为必填" | ✓ | ✗ | ⚠ 需 `aria-required` 补齐 |
| **`（必填）` 文字** | ✓ | ✓ | ✓ 最稳 |

**反向策略：字段大多必填时只标"（选填）"**，可显著降低视觉噪音：必填 > 70% 时只标选填，否则标必填并在表单顶部统一说明。两种策略**不能混用**——同一页面既标必填又标选填，用户会以为漏标的是第三种状态。`required` 与 `aria-required` 两个都加：前者触发原生校验（可在 `<form>` 上加 `novalidate` 接管），后者保证屏幕阅读器读得出。

---

## 7. 提交按钮

| 断点 | 对齐 | 宽度 |
|---|---|---|
| 桌面（≥ 768） | **右对齐** | 自适应内容，最小 88px |
| 移动（< 768） | 全宽 | 100% |
| 主次同排 | 次在左、主在右（次按钮低一档） | 等高 |

```css
.form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-3);               /* 12 */
  margin-top: var(--s-6);        /* 32：字段组→按钮 */
  padding-top: var(--s-5);       /* 24 */
}
.form__actions .btn { min-width: 88px; }

@media (max-width: 767px) {
  .form__actions { flex-direction: column-reverse; gap: var(--s-2); }
  .form__actions .btn { width: 100%; }
}
```

`column-reverse` 让主按钮（DOM 里靠后）在移动端出现在**上方**——拇指更容易够到，也是 iOS / Material 的惯例。左对齐会与输入区左缘混成一条线，被读成"又一个输入项"；右对齐 + 32px 上间距才是明确的操作区。

---

## 8. 完整可复制 CSS

```css
/* ---------- 容器 ---------- */
.form { max-width: 640px; margin-inline: auto; padding-block: var(--s-7); }
.form__title {
  font-size: var(--fs-2xl); font-weight: var(--fw-display);
  line-height: var(--lh-tight); margin: 0 0 var(--s-2);
}
.form__desc {
  font-size: var(--fs-md); color: var(--fg-muted);
  line-height: var(--lh-body); margin: 0 0 var(--s-4);
}
.form__fields { display: grid; gap: var(--s-5); }   /* 24 */

/* ---------- 字段 ---------- */
.field { display: flex; flex-direction: column; min-width: 0; }
.field__label {
  display: block;
  font-size: var(--fs-sm);        /* 13 */
  font-weight: var(--fw-strong);
  line-height: var(--lh-snug);
  color: var(--fg);
  margin-bottom: var(--label-gap); /* 8：光学值 */
}
.field__req { font-size: var(--fs-xs); font-weight: var(--fw-body); color: var(--fg-muted); }

/* ---------- 控件：全宽 ---------- */
.field__control { width: 100%; box-sizing: border-box; }
textarea.field__control { min-height: 96px; resize: vertical; line-height: var(--lh-body); }

/* ---------- 帮助 / 错误：同一个槽位 ---------- */
.field__msg {
  min-height: 20px;               /* 13 × 1.35 ≈ 17.6 → 20 */
  margin: var(--s-1) 0 0;
  font-size: var(--fs-sm); line-height: var(--lh-snug);
  color: var(--fg-muted);
}
.field__msg[data-state="error"] { color: var(--danger); }

/* ---------- 错误态内环（R4） ---------- */
.field__control[aria-invalid="true"] {
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .18),
    inset 0 1px 2px rgb(0 0 0 / .10),
    inset 0 0 0 1px var(--danger);
}

/* ---------- 成对字段（例外） ---------- */
.field-row { display: grid; grid-template-columns: 1fr; gap: var(--s-5); }
@media (min-width: 640px) { .field-row--paired { grid-template-columns: 1fr 1fr; } }

/* ---------- 操作区 ---------- */
.form__actions {
  display: flex; justify-content: flex-end; align-items: center;
  gap: var(--s-3); margin-top: var(--s-6); padding-top: var(--s-5);
}
.form__actions .btn { min-width: 88px; }
@media (max-width: 767px) {
  .form__actions { flex-direction: column-reverse; gap: var(--s-2); }
  .form__actions .btn { width: 100%; min-height: 48px; }
}
@media (pointer: coarse) {
  .form__actions .btn, .field__control { min-height: 44px; }
}
```

依赖的 token 由 `build.mjs` 写入 `tokens.css`（`--s-*`、`--fs-*`、`--lh-*`、`--label-gap`），页面里不要重复定义。

---

## 9. 反例

| 反例 | 为什么错 |
|---|---|
| `姓名 [____]  电话 [____]` 两列 | 视线折返；移动端塌；错误态高度错位 |
| placeholder 当标签 | 输入后消失；placeholder 默认对比度不达 4.5:1 |
| 标签在左、宽度固定 120px | 长标签截断；短标签后留空；浪费横向空间 |
| 字段间距 16px | 上一格的帮助文本被读成下一格的说明 |
| 错误文本追加不替换，或 `position: absolute` 浮起 | 字段变高、后续下移；多字段同时出错时互相遮挡 |
| 必填只用红色 `*` | 色盲不可辨；屏幕阅读器无信息 |
| 校验失败后滚回顶部 | 用户不知道哪一栏错了；应聚焦第一个错误字段 |
| 提交按钮左对齐贴着最后一个字段 | 被读成又一个输入项 |
| 移动端按钮保持右对齐小尺寸 | 拇指够不到 |
| 输入框 `width: 320px` 写死；帮助文本 11px | 容器变窄时溢出；低于可读阈值，且 11 不在字号阶梯上 |

---

## 10. 验收

`audit.mjs`（L2）：

```
1. 每个 .field__control 的 offsetWidth === 父 .field 的 clientWidth（±1px）
2. .form__fields 的 row-gap = 24
3. .field__label 的 marginBottom = 8px（或走 token 的 6px）
4. .field__msg 的 minHeight = 20px；切换 hint/error 时 offsetHeight 不变
5. .form__actions 在 ≥768 视口 justify-content = flex-end
6. 每个 input 的 aria-describedby 指向已存在的 id
7. aria-invalid="true" 的控件有可见的 danger 内环
8. 必填字段标注包含文字、或页面有统一说明，且 input 带 aria-required
```

人工复核（L3）：

- [ ] 提交全空表单，页面**不跳动**，焦点落在第一个错误字段
- [ ] 逐个修正错误，帮助文本恢复时页面仍不跳动
- [ ] 390px 宽下所有输入区占满内容轴，按钮全宽
- [ ] 200% 缩放下标签不截断、输入区不溢出
- [ ] 键盘 Tab 顺序与视觉顺序一致
- [ ] 屏幕阅读器读出"项目名称，必填，编辑框，用于在列表中识别……"

```bash
node scripts/check-tokens.mjs --project <dir>   # 颜色 / 对比度
```
