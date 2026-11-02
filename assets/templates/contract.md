# {{PROJECT}} · 设计合同

<!-- contract-meta
schemaVersion: 1
sourceFile: design/aesthetic/decisions.json
sourceHash: sha256:{{HASH}}
generatedAt: {{ISO}}
generatorVersion: aesthetic-v2
-->

> 状态：{{STATUS}}
> 签样：`shots/approved-*.png`
> 本文件由 `decisions.json` 派生。**改决策去改 `decisions.json`，不要手改本文件。**

---

## 1. 概览

<!-- BLOCK:overview -->

---

## 2. 转写表

<!-- BLOCK:translation -->

---

## 3. 色彩

### 3.1 令牌表

<!-- BLOCK:color-table -->

### 3.2 对比度矩阵

<!-- BLOCK:contrast -->

### 3.3 色域处理

<!-- BLOCK:gamut -->

### 3.4 override 登记

<!-- BLOCK:overrides -->

---

## 4. 字体

<!-- BLOCK:type -->

### 4.1 字号阶梯

| 字号 | 值 | 行高 | 用途 |
|---|---|---|---|
| `--fs-xs` | 12px | 1.5 | 组标题、帮助文本 |
| `--fs-sm` | 13px | 1.55 | 次要正文 |
| `--fs-md` | 15px | 1.65 | 正文 |
| `--fs-lg` | 18px | 1.45 | 小标题 |
| `--fs-xl` | 24px | 1.3 | 段落标题 |
| `--fs-2xl` | 32px | 1.2 | 页面标题 |
| `--fs-3xl` | 44px | 1.15 | 首屏标题 |

### 4.2 CJK 与行长

- 最大行长 **< 80 字符**；中文正文约 30–40 字/行
- CJK 回退字族必须在 `--font-body` 里显式声明，不要依赖系统默认
- 中英混排时空格由排版规则处理，不手动插入

---

## 5. 空间与栅格

### 5.1 间距（8pt 结构值）

`--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64

### 5.2 光学值（允许偏离网格，必须走 token）

| Token | 值 | 用在哪 |
|---|---|---|
| `--line-hair` | 1px | 分组细线 |
| `--label-gap` | 8px | 表单标签→输入 |
| `--icon-shift` | -0.125em | 行内图标基线修正 |
| `--focus-ring` | 3px | 焦点外环 |

### 5.3 圆角

<!-- BLOCK:radius -->

### 5.4 断点与容器

| 断点 | 宽度 | 栅格 | 内容最大宽 | 对齐轴 |
|---|---|---|---|---|
| 桌面 | ≥ 1200 | 12 列 / 24px 沟 | 1120px | 左对齐 |
| 平板 | 768–1199 | 8 列 / 20px 沟 | 100% | 左对齐 |
| 手机 | < 768 | 4 列 / 16px 沟 | 100% | 左对齐 |

---

## 6. 组件规格

### 6.1 尺寸与状态

| 组件 | 尺寸 | 内距 | 默认 | hover | focus | active | disabled | loading |
|---|---|---|---|---|---|---|---|---|
| 按钮 / md | h 36 | 0 14 | 底 accent | 提亮 6% | 外环 3px / 22% | 压暗 4% | 40% 不透明 | 图标位换 16px 环 |
| 按钮 / sm | h 30 | 0 10 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 |
| 输入框 | h 36 | 0 12 | inset 内环 | — | accent 内环 + 3px 外环 | — | 40% 不透明 | — |
| 开关 | 36×20 | — | 关：surface-3 | — | 3px 外环 | — | 40% 不透明 | — |
| 标签 | h 22 | 0 8 | surface-2 | 提亮 4% | 3px 外环 | — | 40% 不透明 | — |
| 徽章 | h 20 | 0 6 | surface-2 | — | — | — | — | — |

### 6.2 输入框咬合参数（R4）

```css
/* 浅色 */
.field {
  background: var(--surface-sunken);
  border: 1px solid transparent;
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .18),      /* 外投影：嵌入页面 */
    inset 0 1px 2px rgb(0 0 0 / .10),     /* 内投影：上沿吃光 */
    inset 0 0 0 1px var(--line-inset);    /* 内环：咬合线 */
}
/* 暗色 */
[data-theme="dark"] .field {
  box-shadow:
    0 2px 6px -2px rgb(0 0 0 / .45),
    inset 0 0 0 1px rgb(255 255 255 / .06);
}
```

内环必须是**比底色深**的线，不是高光。亮边 = 控件浮起；暗边 = 控件凹进。要"咬合"，就必须是后者。

---

## 7. 动效

| 场景 | 时长 | 缓动 | 属性 | 减弱动效时 |
|---|---|---|---|---|
| 状态切换 | 120ms | `--ease-out` | opacity / background | 保留 |
| 浮层出现 | 200ms | `--ease-out` | transform + opacity | 仅 opacity |
| 思考框展开 | 280ms | `--ease-out` | `grid-template-rows` | 即时 |
| 流式文字 | 200ms / 每字 | `cubic-bezier(.2,.7,.2,1)` | filter / opacity / transform | 仅 opacity |

`--dur-fast` 120ms · `--dur-base` 200ms · `--dur-slow` 320ms
`--ease-out` `cubic-bezier(.2,.7,.2,1)` · `--ease-inout` `cubic-bezier(.4,0,.2,1)`

**AI 流式关键帧**

```css
@keyframes glyph-focus {
  from { filter: blur(6px); opacity: .35; transform: translateY(2px); }
  to   { filter: blur(0);   opacity: 1;   transform: translateY(0); }
}
.glyph {
  display: inline-block;
  animation: glyph-focus 200ms var(--ease-out) both;
  animation-delay: calc(var(--i) * 30ms);
}
```

---

## 8. 非协商项取值

<!-- BLOCK:non-negotiable -->

---

## 9. 与导演层的一致性

<!-- BLOCK:consistency -->

---

## 10. 验收清单

每条都必须是可观测事实，不是主观判断。

- [ ] 代码里没有 token 表之外的颜色 / 字号 / 圆角 / 阴影
- [ ] 表面层级实际 ΔL 全部落在 `[0.010, 0.030]`
- [ ] 文字、次要文字、焦点指示、非文本控件均通过 WCAG 2.2 AA
- [ ] 禁止场景没有不透明纯黑；阴影里的带 alpha 黑已登记
- [ ] 暗色模式下 **≥16px** 的 body / strong / display 各降一档，且 body 不低于 300
- [ ] 暗色模式下 **<16px** 的文字使用 `--fw-small` / `--fw-small-strong`，字重与浅色完全一致
- [ ] 所有输入框有外投影 + inset 内环；focus 态内环变 accent
- [ ] 设置页：左名右控件、无外层卡片、组间留白、删除独立成组
- [ ] 表单页：标签在上、输入全宽、错误文本替换帮助文本
- [ ] AI 流式：30ms 错峰模糊对焦，`prefers-reduced-motion` 下降级
- [ ] 行内图标 `vertical-align: -0.125em`
- [ ] 思考框用 `0fr → 1fr` 撑开，不是 height 动画
- [ ] 计时器 `font-variant-numeric: tabular-nums` 生效
- [ ] 结构值对齐 8pt 网格；光学值走 token
- [ ] 1440 / 834 / 390 × 浅 / 深 × 键盘 × 200% 缩放均通过
- [ ] 焦点可见、状态不只靠颜色、触控目标 ≥ 44×44
