# 新拟态

> 控件不是画在表面上的，而是从同一块材料里被"挤"出来或"按"下去——全靠一对明暗阴影。

## 元信息

| 项 | 值 |
|---|---|
| id | `neumorphism` |
| 变体 | `neumorphism` |
| 一句话 | 整页是同一块软材料，浮起与凹陷只由左上高光 + 右下暗影的方向差表达 |
| 最适合 | 大控件的单页工具、播放器与控制面板、硬件产品页、创意展示组件 |
| 不适合 | 数据密集后台、长文本阅读、需要多个并行操作的界面；表单密集页也会失去可辨识的控件边界 |
| 主要代价 | 对比度天然不足，控件边界只能靠阴影暗示；必须把控件做大、把文字加深才站得住 |

## 签名特征（3–5 条，缺一不可）

1. **底色即材料色**：`--bg` 与 `--surface-1` 的 L 差不超过 0.012，整页看起来是同一个平面。
2. **成对阴影**：每个凸起元素带 `-Npx -Npx 2Npx 亮` + `Npx Npx 2Npx 暗`；凹陷元素把两者对调并加 `inset`。
3. **圆角与投影半径成正比**：投影模糊半径 ≈ 圆角 × 1.6；圆角小的元素用硬边阴影会立刻穿帮。
4. **可点区域必须 ≥ 44×44 且投影跨度 ≥ 8px**。小控件在这个风格里读不出来——这是硬限制不是建议。
5. **状态只改投影方向与深度**，不改颜色。按下 = 从凸起变凹陷，选中 = 凹陷加深 + 内环。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 250 / C 0.004（冷灰；材料感偏"塑料 / 硅胶"，暖灰会读成纸板） |
| 彩度上限 | C ≤ 0.095；彩色只用于状态（成功/警告/危险），不做装饰 |
| 圆角 | `--r-sm` 10 · `--r-md` 14 · `--r-lg` 22 · `--r-full` 999（比多数风格大 1.5–2 倍，阴影要靠圆角才"软"） |
| 边框 | 0。唯一例外：`forced-colors` 与焦点态必须有 1px 实边，否则用户完全看不见控件 |
| 阴影 | 双色成对投影，见下方 CSS；`--shadow-1..3` 全被"成对"语义占用 |
| 字重 | 浅色 500 / 600 / 700 · 暗色 450 / 550 / 650（材料底比纯白暗，字要更重才压得住） |
| 动效 | 140–200ms `ease-out`；只允许 `box-shadow` 与 `background-color`，位移最多 1px |

## 典型配色

| 角色 | 浅色 | 暗色 |
|---|---|---|
| bg | `#E9EBEE` · `oklch(0.940 0.004 250)` | `#27292C` · `oklch(0.280 0.006 250)` |
| surface-1 | `#E6E8EA` · `oklch(0.930 0.004 250)` | `#292C2E` · `oklch(0.290 0.006 250)` |
| surface-2 | `#E3E5E7` · `oklch(0.920 0.004 250)` | `#2C2E31` · `oklch(0.300 0.006 250)` |
| surface-3 | `#DFE1E4` · `oklch(0.910 0.004 250)` | `#2E3133` · `oklch(0.310 0.006 250)` |
| fg | `#34383D` · `oklch(0.340 0.010 250)` | `#E6E8EA` · `oklch(0.930 0.004 250)` |
| fg-muted | `#4E5255` · `oklch(0.435 0.008 250)` | `#AEB1B5` · `oklch(0.760 0.006 250)` |
| accent | `#1C6E72` · `oklch(0.492 0.075 200)` | `#64CACF` · `oklch(0.780 0.095 200)` |
| line-1 | `#D5D7D9` · `oklch(0.878 0.004 250)` | `#37393C` · `oklch(0.345 0.006 250)` |

- 表面 ΔL（浅）：bg→s1 **0.010** · s1→s2 **0.010** · s2→s3 **0.010**；（暗）0.010 / 0.010 / 0.010
- 对比度（浅）：`fg/bg` 9.9:1 · `fg-muted/bg` 6.7:1 · `accent/bg` 5.0:1
- 对比度（暗）：`fg/bg` 11.9:1 · `fg-muted/bg` 6.8:1 · `accent/bg` 7.6:1

**浅色取暗向而不是亮向**：底 `L 0.94`、`fg L 0.34`，而不是白底浅灰字。这是这个风格唯一能同时保住"软"和"可读"的组合——白底会让成对阴影中的高光完全不可见。

`--fg-muted` 的对比度是 6.7:1 而不是常见的 5:1，因为材料底本身吸光，次要文字再淡就会糊进阴影里。

### 状态色

| 角色 | 浅色 | 暗色 | 说明 |
|---|---|---|---|
| danger | `#8F4A43` · `oklch(0.492 0.095 27)` | `#EEA097` · `oklch(0.780 0.095 27)` | 本卡唯一有彩的东西，给到 C 上限 0.095 |
| danger-hover | `oklch(0.450 0.100 27)` | `oklch(0.830 0.085 27)` | |
| on-danger | `#FCFCFC` · `oklch(0.990 0 0)` | `oklch(0.280 0.010 27)` | |
| success | `#2D693D` · `oklch(0.468 0.095 150)` | `#8BC997` · `oklch(0.780 0.095 150)` | |
| warning | `#805415` · `oklch(0.484 0.095 70)` | `#DFAD73` · `oklch(0.780 0.095 70)` | |

「彩色只用于状态」在这里的反向约束是：状态色**必须**有彩，否则它和材料灰分不开。明度与 accent 同带（浅 0.47–0.49 / 暗 0.78），按钮仍用凸起/凹陷而非换色来区分状态。

## 标志性 CSS

**1 · Token 覆盖（含成对阴影的三档语义）**

```css
:root[data-style="neumorphism"] {
  --bg: oklch(0.940 0.004 250);
  --surface-1: oklch(0.930 0.004 250);
  --surface-2: oklch(0.920 0.004 250);
  --surface-3: oklch(0.910 0.004 250);
  --fg: oklch(0.340 0.010 250);
  --fg-muted: oklch(0.435 0.008 250);
  --accent: oklch(0.492 0.075 200);
  --line-1: oklch(0.878 0.004 250);

  /* 成对阴影的两个色端：亮端从 bg 提亮 0.05 L，暗端压暗 0.06 L */
  --neu-light: oklch(0.990 0.004 250);
  --neu-dark:  oklch(0.880 0.006 250);

  --r-sm: 10px; --r-md: 14px; --r-lg: 22px; --r-full: 999px;

  /* 1 = 贴地凸起 · 2 = 抬升 · 3 = 浮层（浮层不再用成对阴影） */
  --shadow-1: -4px -4px 8px var(--neu-light), 4px 4px 8px var(--neu-dark);
  --shadow-2: -6px -6px 14px var(--neu-light), 6px 6px 14px var(--neu-dark);
  --shadow-3: 0 12px 32px -12px rgb(0 0 0 / .22);
  /* 注：凹陷 = --shadow-1 的方向反转（暗在左上、亮在右下 + inset），不用 token 表达，
     因为它在语义上是"状态"而不是"层级"，由 .neu-sunken 规则直接给出 */

  --fw-body: 500; --fw-strong: 600; --fw-display: 700;
  --dur-fast: 140ms; --dur-base: 170ms; --dur-slow: 200ms;
}
:root[data-style="neumorphism"][data-theme="dark"] {
  --bg: oklch(0.280 0.006 250);
  --surface-1: oklch(0.290 0.006 250);
  --surface-2: oklch(0.300 0.006 250);
  --surface-3: oklch(0.310 0.006 250);
  --fg: oklch(0.930 0.004 250);
  --fg-muted: oklch(0.760 0.006 250);
  --accent: oklch(0.780 0.095 200);
  --line-1: oklch(0.345 0.006 250);
  --neu-light: oklch(0.330 0.008 250);
  --neu-dark:  oklch(0.220 0.008 250);
  --fw-body: 450; --fw-strong: 550; --fw-display: 650;
}
/* 验收：暗色下阴影两端与 bg 的 L 差各为 +0.05 / -0.06，不能直接复用浅色值 */
```

**2 · 凸起：控件从材料里长出来**

```css
.neu-raised {
  background: var(--bg);
  border: 0;
  border-radius: var(--r-md);
  box-shadow: var(--shadow-1);
  min-height: 44px;                /* 硬限制：小于 44px 阴影读不出来 */
  min-width: 44px;
}
/* 验收：所有可点元素的 offsetWidth / offsetHeight 均 ≥ 44 */
```

**3 · 凹陷：按下与输入框用同一套语义**

```css
.neu-sunken,
.field {
  background: var(--bg);
  border: 0;
  border-radius: var(--r-md);
  box-shadow:
    inset 4px 4px 8px var(--neu-dark),
    inset -4px -4px 8px var(--neu-light);
}
.btn:active { box-shadow:
    inset 3px 3px 6px var(--neu-dark),
    inset -3px -3px 6px var(--neu-light); }
/* 验收：输入框在空态与 focus 态都没有外侧亮线（无 border） */
```

**4 · 让 R4 的"咬合"以等价方案成立**

新拟态的双阴影会把普通内环吞掉，因此内环要更深、外投影要更薄，两者都保留——`audit.mjs` 要求"一条非 inset 投影 + 一条 `inset 0 0 0 1px` 内环"，缺一条就报违规：

```css
.field {
  background: var(--bg);
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .12),                                  /* 非 inset：嵌入页面 */
    inset 4px 4px 8px var(--neu-dark),
    inset -4px -4px 8px var(--neu-light),
    inset 0 0 0 1px color-mix(in oklab, var(--neu-dark) 55%, transparent);
}
.field:focus-visible {
  box-shadow:
    0 1px 2px -1px rgb(0 0 0 / .12),
    inset 4px 4px 8px var(--neu-dark),
    inset -4px -4px 8px var(--neu-light),
    inset 0 0 0 1px var(--accent),
    0 0 0 3px color-mix(in oklab, var(--accent) 40%, transparent);
}
/* 验收：R4 override 已登记，verification 指向本段"加深内环 + 保留非 inset 外影" */
```

**5 · 状态不只靠阴影（无障碍兜底）**

```css
.neu-raised[aria-pressed="true"] {
  box-shadow: inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light);
}
.neu-raised[data-state="on"] { position: relative; }
.neu-raised[data-state="on"]::after {
  content: ""; display: block; width: 6px; height: 6px;
  border-radius: var(--r-full); background: var(--accent);
  position: absolute; inset-block-end: 8px; inset-inline-end: 8px;
}
@media (forced-colors: active) {
  .neu-raised, .neu-sunken, .field { border: 1px solid ButtonBorder; box-shadow: none; }
}
/* 验收：强制色模式下所有控件有可见实边，阴影全部取消 */
```

**6 · 浮层必须脱离材料语言**

```css
.popover, .menu, .toast {
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);     /* 单一方向投影，不带高光 */
  background: var(--surface-3);
}
/* 验收：浮层上没有 -Npx 高光，避免"弹出一块凸起的橡胶" */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 小于 44×44 的可点控件 | 阴影跨度需要约 8px 才能在材料上读出来；36px 的按钮只剩下一圈模糊，用户分不清它是不是按钮 |
| 在白色 `#FFF` 底上做浅色新拟态 | 亮端高光与白底差值为 0，成对阴影退化成单侧暗影，看起来只是"糊了一层灰" |
| 彩色表面 + 成对阴影 | 彩色底上高光会读成"反光塑料"，材质语言崩坏；彩色只用于状态点与图标 |
| 正文放在成对阴影之上并跨过阴影区 | 阴影带内的底色在变，文字对比度随位置漂移，无法保证 4.5:1 |
| 三层以上嵌套的凹陷 | 每层凹陷都要 1px 暗边 + 双阴影，两层之后边缘糊成一团，深度信息完全丢失 |
| 用 `filter: drop-shadow` 代替 `box-shadow` | 它跟着 alpha 走，会在图标内部也投出阴影；且不能分别指定两端的颜色与偏移 |
| 阴影模糊半径小于圆角 | 硬边阴影 + 大圆角 = 塑料片上贴了个方框，材料感瞬间消失 |

## 验收：怎么判断这个风格做对了

- [ ] 所有可点元素 ≥ 44×44，且至少有一条边落在 44 的整数倍附近（不为凑尺寸而做 43px）
- [ ] 每个凸起元素都同时有左上亮、右下暗两条阴影，且两者偏移量绝对值相等
- [ ] 输入框与按钮按下态均为 `inset` 阴影，且两端颜色对调（亮在下、暗在上）
- [ ] 页面里不存在 `border` 可见的普通容器（除 `forced-colors` 兜底）
- [ ] 底与 surface-1 的 L 差 ≤ 0.012
- [ ] 任意文字与其背后实际像素的对比度 ≥ 4.5:1（含阴影区采样）
- [ ] 在 `forced-colors: active` 下每个控件都有实边，且仍能用 Tab 看出焦点
- [ ] 浮层（下拉、toast）不带高光侧，只保留单向投影
- [ ] 暗色下阴影两端重新取值，未复用浅色的 `--neu-light` / `--neu-dark`

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 把新拟态当"全局风格"用到后台 | 表格、密集列表、多列表单都需要清晰边界；没有边界时用户会把相邻单元格读成一个控件 |
| 用低对比来加强"柔和" | 柔和来自阴影方向的一致，不来自低对比；再降对比就掉出 AA |
| 每张卡片独立调阴影方向 | 光源必须唯一（左上），第二套方向会让相邻卡片看起来互相穿插 |
| 用渐变模拟"上亮下暗"代替双阴影 | 渐变不能穿出元素边界，材料感只存在于元素内部，凸起变成"有渐变的卡片" |
| 做了凹陷却忘了状态：hover 不变、focus 只变颜色 | 用户无法判断当前控件是否被激活；状态必须改阴影方向或深度 |
