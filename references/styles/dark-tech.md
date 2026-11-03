# 黑色科技极简

> 近黑底、1px 极细线、一个青绿高光点——像一台没有多余按钮的仪器面板。
> **这个风格没有浅色版本。选它即锁定深色。**

## 元信息

| 项 | 值 |
|---|---|
| id | `dark-tech` |
| 变体 | `dark-tech` |
| 主题 | 仅暗色（`dark-only`）：CSS 只有一套 token，不带 `[data-theme]` 限定 |
| 一句话 | 把界面压到近黑，用发丝线划分区域，所有彩色收束成一个高光点 |
| 最适合 | 企业工具、监控与运维台、AI 产品、需要长时间注视的专业界面 |
| 不适合 | 儿童向产品、需要情绪温度的品牌页；也**不适合**在强光环境下使用的移动端（近黑底反光严重） |
| 主要代价 | 暗色下字重与光晕极难控制：同一字重在不同 L 的底上粗细感知差一档，光晕还会吃掉细线 |

## 签名特征（3–5 条，缺一不可）

1. **近黑而非纯黑**：`--bg` L 在 0.16–0.19，带极低彩度的蓝（H 260）。纯黑会让蓝色高光在 OLED 上出现拖影。
2. **所有分隔都是 1px 发丝线**，颜色是 `--line-1`（与 bg 的 L 差 0.13–0.15），没有卡片边框、没有色块分区。
3. **一个高光色**：青绿 `H 170–180`，只出现在"当前活动/实时数据"的位置；其余全部无彩。
4. **层级靠 L 而不是靠阴影**：四个表面各差 0.022–0.026，阴影只用于浮层，且极淡。
5. **等宽数字与高度紧凑的排布**：表格行高 40px 起，数据区必须 `tabular-nums`，任何数字跳动都是严重缺陷。

## Token 骨架

| 维度 | 取值 |
|---|---|
| 中性色温度 | H 260 / C 0.004（冷蓝灰近黑；C 再高会变成"蓝黑"而丢掉"仪器"感） |
| 彩度上限 | C ≤ 0.125；彩色只在高光点邻域出现 |
| 圆角 | `--r-sm` 4 · `--r-md` 6 · `--r-lg` 10 · `--r-full` 999（克制但不为零，零圆角会读成终端而非仪器） |
| 边框 | 1px · `--line-1`；所有容器与分区线同一宽度，不因重要程度变粗；输入框内环 `--line-inset` |
| 阴影 | `--shadow-1` 无 · `--shadow-2` 0 1px 3px -1px / .5 · `--shadow-3` 0 12px 40px -12px / .75 |
| 字重 | 400 / 500 / 550（起始值就比常规低半档，因为暗底字看重；只有这一套） |
| 字族 | 正文 `"DIN Next LT Pro", Bahnschrift, "Segoe UI Variable Text", "Segoe UI", "PingFang SC"`（仪器面板的窄无衬线）；数字/时间戳走 `--font-mono` |
| 类型比例 | `11 / 12 / 14 / 16 / 20 / 26 / 34`；`--lh-tight` 1.1 · `--lh-snug` 1.28 · `--lh-body` 1.55（只比基线大半档，靠对齐建立秩序）；标签大写 + `0.1em`，等宽 |
| 排版骨架 | 紧凑控制台：`--rail-w` 216 / 顶栏 48；统计卡 `1.6fr 1fr 1fr 1fr`，主分栏 2.2fr / 1fr，间距整体缩一档 |
| 动效 | 120–180ms `ease-out`；只允许颜色与透明度，数据刷新允许 200ms 的高光脉冲 |

## 典型配色

| 角色 | 暗色（唯一一套） |
|---|---|
| bg | `#0D0E10` · `oklch(0.165 0.004 260)` |
| surface-1 | `#121315` · `oklch(0.188 0.004 260)` |
| surface-2 | `#18191B` · `oklch(0.212 0.004 260)` |
| surface-3 | `#1E1F21` · `oklch(0.238 0.004 260)` |
| fg | `#E8E9EC` · `oklch(0.935 0.004 260)` |
| fg-muted | `#9B9FA3` · `oklch(0.700 0.008 260)` |
| accent | `#60DDB6` · `oklch(0.815 0.125 170)` |
| line-1 | `#2C2E31` · `oklch(0.300 0.006 260)` |

- 表面 ΔL：bg→s1 **0.023** · s1→s2 **0.024** · s2→s3 **0.026**
- 对比度：`fg/bg` 15.9:1 · `fg-muted/bg` 7.2:1 · `accent/bg` 11.4:1

**这套阶梯是「暗色的校正」而非「浅色的镜像」**：暗区的绝对 L 差在感知上更弱，显示器在低亮度下的 gamma 让 0.010–0.018 的差几乎不可见。没有一套浅色 token 可以对照，也不该有——浅底上的同一条规则会得到一张完全不同的卡。

**高光色唯一**：`--accent` 在整页只出现于三处——当前选中的导航项、实时数据点、焦点环。第四处开始，这个风格就退化成普通暗色主题。

### 状态色

| 角色 | 暗色（唯一一套） | 说明 |
|---|---|---|
| danger | `#E7B4AD` · `oklch(0.814 0.060 27)` | C ≤ 0.060，远低于 accent 的 0.125 |
| danger-hover | `oklch(0.860 0.054 27)` | |
| on-danger | `oklch(0.165 0.010 27)` | 亮 danger 底上压深色字 |
| success | `#9ECFB9` · `oklch(0.814 0.060 165)` | 青绿，与 accent 同色相 |
| warning | `#D9BD97` · `oklch(0.814 0.060 75)` | |

「其余全部无彩」意味着状态色必须低彩度：三个状态色统一 C 0.060（不到 accent 的一半），**颜色不是唯一通道**——`data-tone` 的文案与形状（点 / 标签 / 徽章）同时承担状态语义。危险按钮同理：本卡不允许实心饱和块（暗底上会产生同时对比），所以危险态 = danger 描边 + danger 文字，不加实心填充。

## 标志性 CSS

**1 · Token 覆盖：只有一个块，不跟 `[data-theme]` 变**

```css
/* 暗色专属：没有浅色块。选择这个变体即锁定深色。 */
:root[data-style="dark-tech"] {
  color-scheme: dark;                        /* 原生控件 / 滚动条同步 */
  --bg: oklch(0.165 0.004 260);
  --surface-1: oklch(0.188 0.004 260);
  --surface-2: oklch(0.212 0.004 260);
  --surface-3: oklch(0.238 0.004 260);
  --fg: oklch(0.935 0.004 260);
  --fg-muted: oklch(0.700 0.008 260);
  --accent: oklch(0.815 0.125 170);
  --line-1: oklch(0.300 0.006 260);

  --shadow-1: none;
  --shadow-2: 0 1px 3px -1px rgb(0 0 0 / .5);
  --shadow-3: 0 12px 40px -12px rgb(0 0 0 / .75);

  --fw-body: 400; --fw-strong: 500; --fw-display: 550;
  --dur-fast: 120ms; --dur-base: 160ms;
}
/* 验收：文件里不存在第二个 token 块；页面在任意 data-theme 下 --bg 都是 #0D0E10 */
```

**2 · 发丝线分区：不用卡片**

```css
.section { border-top: 1px solid var(--line-1); padding-block: var(--s-5); }
.section:first-of-type { border-top: 0; }
.grid > * + * { border-left: 1px solid var(--line-1); }
/* 验收：页面里不存在同时带 border 与 border-radius 的容器（浮层除外） */
```

**3 · 数据区：紧凑行高 + 等宽数字**

```css
.table { font-size: var(--fs-sm); }
.table th {
  height: 32px; font-size: var(--fs-xs); letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--fg-muted); font-weight: var(--fw-strong);
  border-bottom: 1px solid var(--line-1);
}
.table td { height: 40px; border-bottom: 1px solid var(--line-1); }
.table .num {
  font-variant-numeric: tabular-nums slashed-zero;
  text-align: end;
}
/* 验收：数值列在数字变化时列宽不跳（比较前后 getBoundingClientRect） */
```

**4 · 高光点：只有当前活动项才有**

```css
.nav-item[aria-current="page"] {
  color: var(--accent);
  box-shadow: inset 2px 0 0 var(--accent);   /* 左侧 2px 光条，不用背景色块 */
}
.live-dot {
  width: 6px; height: 6px; border-radius: var(--r-full);
  background: var(--accent);
  box-shadow: 0 0 6px color-mix(in oklab, var(--accent) 55%, transparent);
}
/* 验收：全页 accent 出现的元素数 ≤ 3 类 */
```

**5 · 浮层：唯一有阴影的地方**

```css
.popover, .menu {
  background: var(--surface-3);
  border: 1px solid var(--line-1);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);
}
/* 验收：普通卡片无阴影；仅浮层使用 --shadow-3 */
```

**6 · 输入框：内环用亮边表达"嵌入"，不改变语义**

```css
.field {
  background: var(--surface-sunken);
  border: 1px solid var(--line-1);
  border-radius: var(--r-sm);
  box-shadow:
    var(--shadow-field-outer),
    inset 0 1px 2px rgb(0 0 0 / .30),
    inset 0 0 0 1px color-mix(in oklab, var(--fg) 6%, transparent);
}
.field:focus-visible {
  box-shadow:
    inset 0 0 0 1px var(--accent),
    0 0 0 3px color-mix(in oklab, var(--accent) 20%, transparent);
}
/* 验收：内环是 fg 6% 的亮线——暗底上"变深"不可见，嵌入必须靠微亮边 */
```

## 必须压制的东西

| 不要出现 | 原因 |
|---|---|
| 纯黑 `#000` 底 | OLED 上纯黑与近黑之间的过渡会出现拖影，且蓝色高光在纯黑上过饱和；L 0.16–0.19 已足够"黑" |
| 一套浅色 token 作为"浅色模式" | 本卡只有一种形态。翻出一套浅底会让发丝线、单点高光、低彩度状态色的全部校正失效——那是另一张卡 |
| 卡片 + 卡片阴影 + 卡片边框三件套 | 这个风格的层级靠 L 与发丝线；加阴影后每张卡片都"浮"起来，仪器感变成后台模板 |
| 两个以上高光色 | 高光点的语义是"这一处是实时的"；两个颜色后用户无法判断哪个是真高光 |
| 大面积饱和色块 | 暗底上饱和色块的边缘会产生同时对比（simultaneous contrast），让相邻的灰看起来带补色 |
| 正文使用 300 以下字重 | 暗底光晕已经让字变"胖"，但 300 以下在 1x 屏上笔画会断裂；护栏：正文 ≥ 400 |
| 粗于 1px 的分隔线 | 2px 线在近黑底上会读成"一个没有内容的条"，把视线从内容上拽走 |
| 满屏的辉光与渐变背景 | 与"仪器"气质相反；这个风格的背景必须是静的、无图案的 |

## 验收：怎么判断这个风格做对了

- [ ] `bg` 的 L 在 0.16–0.19，且不是 `#000`
- [ ] 变体 CSS 只有一个 token 块；把 `data-theme` 强制设成 `light`，`--bg` 仍是 `#0D0E10`
- [ ] 所有分隔线宽 1px，`--line-1` 与 bg 的 L 差 ≥ 0.13
- [ ] 四个表面 ΔL 全部 ≥ 0.022
- [ ] 全页 accent 只出现在 ≤ 3 类元素上
- [ ] 普通卡片没有 `box-shadow`；只有浮层用 `--shadow-3`
- [ ] 所有数字列 `font-variant-numeric` 含 `tabular-nums`，数值变化时无列宽跳动
- [ ] `--fw-body` = 400 且 ≥ 400
- [ ] 输入框内环是 `fg 6%` 一类亮线，而非暗色内投影
- [ ] 表格行高 ≥ 40px，表头 32px，两者不相等（区分表头与数据）
- [ ] 用 1x 屏截图放大到 200% 后，发丝线仍然连续，没有断成虚线
- [ ] 正文 computed `font-family` 首项是 DIN Next / Bahnschrift 一类窄无衬线
- [ ] `--lh-body` = 1.55，标签 uppercase + `0.1em`，统计卡第一张更宽

## 反模式

| 常见做错 | 为什么错 |
|---|---|
| 当"深色主题"用 | 这不是主题开关，是一套独立风格；把浅色设计反转后调暗，只会得到"暗的默认后台" |
| 给它补一套浅色"以保持完整" | "黑色科技极简"的签名就是黑底上的发丝线；浅色版只能得到一张普通灰白后台，名字与成品对不上 |
| 用大量青绿点缀却叫它"科技感" | 高光点的价值来自唯一性；点缀越多，唯一性越弱，最后只剩一个配色偏青的暗色主题 |
| 在暗色里用阴影表达层级 | 暗底上深色阴影的可见度极低，层级必须靠 L 差；用阴影只会得到"看不清的边界" |
| 把所有文字都调成 `fg` | 缺少 `fg-muted` 后，标签、单位、时间戳会和正文抢注意力，数据表无法扫读 |
| 面板内再嵌面板再嵌面板 | 三层 1px 线嵌套后，1px 线之间的间距小于 8px，视觉上合并成 2px 灰带，层级反转 |
