# recipes

组件 CSS 片段库。

**这个目录是只读模板。** 真正产出落在**目标项目**的 `assets/recipes/`（Studio 组件实验室的 `[ 写入 recipe ]` 按钮写那里），不写这里。

## 为什么分开

- `SKILL_ROOT/assets/recipes/` — 随 skill 分发，是所有项目共享的起点
- `PROJECT_ROOT/assets/recipes/` — 项目自己的积累

混在一起的话，升级 skill 会覆盖掉用户积累的片段。

## 当前状态

**空。** 按 v2.1 的决定（`SKILL-DESIGN.md` §11.3 Q5），不预置组件片段——组件形态高度依赖具体项目的 token，预置的片段多半要改。

## 什么时候往这里加

当同一个片段在**三个以上不同项目**里被证明可复用时，再把它提升到这里。提升时：

1. 片段里不能有硬编码颜色/间距——全部走 `var(--…)`
2. 顶部加注释说明：适用风格、依赖哪些 token、有没有已知退化
3. 补一条验收：在 fixture 上渲染一次，截图对照

## 片段格式

```css
/* === recipe: segmented-control ===
 * 适用：minimalism / material / dark-tech
 * 依赖：--surface-1 --surface-2 --fg --fg-muted --r-full --dur-fast --ease-out
 * 退化：无
 */
.segmented { … }
```

## 实验室产物示例路径

```
<project>/assets/recipes/segmented-control.css
<project>/assets/recipes/stat-tile.css
```
