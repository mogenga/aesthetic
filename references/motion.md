# 动效语汇

> 用于 Phase 4 定合同第 7 段。

---

## 一个原则

**动效回答"发生了什么"，不回答"这里好看"。**

用户做了一个动作（打开、提交、切换、失败），动效告诉他结果。没有动作触发、也不传递信息的动画，就是噪音。

---

## 时长

| 距离 / 面积 | 时长 | 例子 |
|---|---|---|
| 微反馈（颜色、透明度） | 80–120ms | 按钮 hover、开关切换 |
| 小元素（图标、徽章） | 120–180ms | 复制成功、状态点变色 |
| 中元素（卡片、面板） | 180–260ms | 下拉展开、toast 入场 |
| 大元素（模态、页面转场） | 240–360ms | 弹窗、抽屉 |
| 超过全屏 | 不做动画 | 页面导航直接换，或用系统转场 |

**上限 400ms。** 超过这个数，高频交互会让人觉得卡。所谓"高级感"来自短而准，不是长而缓。

---

## 缓动

```css
--ease-out:    cubic-bezier(.2, .7, .2, 1);     /* 入场，默认用这个 */
--ease-in:     cubic-bezier(.4, 0, 1, 1);       /* 退场 */
--ease-inout:  cubic-bezier(.4, 0, .2, 1);      /* 位置移动、尺寸变化 */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1); /* 有弹性，慎用 */
```

| 场景 | 用哪个 | 为什么 |
|---|---|---|
| 元素出现 | `ease-out` | 快速到位，收尾减速 |
| 元素消失 | `ease-in` | 开始慢，加速离开，不拖泥带水 |
| 位置/尺寸变化 | `ease-inout` | 两头都平滑 |
| 开关、勾选 | `ease-spring` | 弹性传达"咔哒"的手感 |

**不要用 `linear`** 做任何 UI 动画，除了进度条和循环动画。

---

## 什么该动，什么不该动

| 该动 | 为什么 |
|---|---|
| 状态变化（hover / focus / active / disabled） | 告诉用户"这个能点""正在提交" |
| 层级变化（浮层出现 / 消失） | 告诉用户"这是临时盖在上面的" |
| 位置变化（列表重排） | 让用户跟得上元素去了哪 |
| 内容增长（流式、展开） | 让用户知道还在加载 |
| 操作结果（成功 / 失败） | 确认动作生效 |

| 不该动 | 为什么 |
|---|---|
| 页面加载时的整页入场动画 | 每次进页面都要等，纯延迟 |
| 滚动到某个位置就淡入 | 用户控制滚动，不要再夺走控制权 |
| hover 时的位移或缩放（> 1.02） | 鼠标划过一排卡片会晃 |
| 自动播放的装饰动画 | 抢注意力，且耗电 |
| 每个列表项依次入场（stagger） | 超过 5 项就变成等待 |

---

## 只动这两个属性最安全

```css
/* 合成层友好：不改布局、不触发重绘 */
transform: translate / scale / rotate
opacity
```

`width` / `height` / `top` / `left` / `margin` 会触发布局，长列表里必卡。

**例外**：`grid-template-rows: 0fr → 1fr` 虽然算尺寸变化，但它是思考框展开的唯一正确做法——因为它能处理内容高度未知的情况，而 `height` 动画必须提前量高。

---

## 三组必备动效

### 1. 浮层

```css
@keyframes pop-in {
  from { opacity: 0; transform: translateY(-4px) scale(.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
.popover {
  animation: pop-in 200ms var(--ease-out) both;
  transform-origin: top center;  /* 从触发它的按钮那侧展开 */
}
```

`transform-origin` 必须指向触发源。从中心展开的下拉框看起来像"凭空出现"。

### 2. 状态切换

```css
.btn {
  transition:
    background-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}
```

只过渡视觉属性，不过渡 `transform`——按钮按下时的位移应该是瞬时的（或用 60ms）。

### 3. 流式文字

见 `references/rules/04-ai-ui.md`。关键点：30ms 错峰、高斯模糊 → 对焦、只给最新 30 字挂动画。

---

## 减弱动效

`prefers-reduced-motion: reduce` 下**必须**：

| 动效 | 处理 |
|---|---|
| 位移 / 缩放 / 旋转 | 全部去掉 |
| 模糊 / 滤镜动画 | 去掉 |
| 透明度淡入 | 保留（这是内容出现，不是装饰） |
| 颜色过渡 | 保留（120ms 内，不引起不适） |
| 流式文字 | 只留透明度瞬变 |
| 视差 / 自动播放 | 完全禁用 |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .glyph { animation: glyph-fade 120ms both !important; }
}
```

这不是"锦上添花"——前庭功能障碍的人会因位移动画眩晕。

---

## 编排

一次只让一个东西动。同时动三样 = 没有重点。

**好的编排**：点击"发送" → 按钮进入 loading（立即）→ 消息气泡出现（120ms 后）→ 文字开始流式（200ms 后）。三件事有先后，读起来是一条因果链。

**坏的编排**：点击"发送" → 按钮缩放 + 气泡弹入 + 页面背景微动 + 顶部进度条滑过，全部同时。用户不知道看哪。

---

## 性能红线

| 项 | 阈值 |
|---|---|
| 单次动画属性数 | ≤ 2 |
| 同时动画的元素数 | ≤ 1（列表项分批除外） |
| 流式消息的挂动画字符数 | ≤ 30 |
| 动画元素的 `will-change` | 动画结束后必须移除 |
| 连续动画总时长 | ≤ 400ms |

```js
// 动画结束后一定要移除 will-change，否则会一直占着一个合成层
el.addEventListener('animationend', () => {
  el.style.willChange = 'auto';
}, { once: true });
```

---

## 反模式

| 反模式 | 为什么错 |
|---|---|
| 给每个卡片加 hover 上浮 | 一排卡片划过像在呼吸，很吵 |
| 用 `transition: all` | 会连带过渡意料之外的属性（包括布局属性） |
| 动画时长随距离线性增长 | 800px 的移动用 600ms，用户已经点别处了 |
| 弹窗用 500ms 缓入 | 高频操作每次多等半秒 |
| 流式文字逐字 `setInterval` + 滚动 | 持续回流，长回答必掉帧 |
| 忽略 `prefers-reduced-motion` | 无障碍硬伤，也是验收项 |
