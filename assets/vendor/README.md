# vendor

第三方资产。全部 vendored，**不通过包管理器安装**——skill 需要在任意用户项目里即插即用，不能要求 `npm i`。

| 文件 | 版本 | 许可 | 用途 |
|---|---|---|---|
| `hyalite.js` | 0.5.0 | MIT | 液态玻璃折射引擎 |
| `hyalite.LICENSE.txt` | — | MIT 全文 | 合规保留 |
| `hyalite.SBOM.json` | — | — | 可追溯：来源 / 版本 / 核验日期 |

## hyalite

**做了什么**：把元素当作一块有倒角的厚玻璃。按元素真实尺寸与圆角计算圆角矩形 SDF → 由梯度得到边缘法线 → 生成位移场贴图（R=x 偏移、G=y 偏移、B=边缘明暗）→ 喂给 SVG `feDisplacementMap` → 通过 `backdrop-filter: url(#…)` 实时折射背后内容。

**为什么用它而不是自己写**：从物理公式自己推的话，会踩到至少四个非显而易见的问题——

1. Chromium 的置换采样是最近邻（Skia bug 40045448），位移大时边缘出阶梯。hyalite 用两趟位移拆分 + 环形遮罩模糊消掉了它。
2. 元素尺寸变化时要重建位移图，且不能让滤镜在中途掉线（流式增长的聊天气泡会疯狂触发）。
3. 滤镜区域必须跟着元素走，否则元素变大后边缘会露出未过滤区域。
4. 位移场"折叠"（slope > 1）才是液态感的来源，但折叠区拉伸无上限，必须靠窄倒角 + 模糊 + 色散盖住。

hyalite 把这四条都处理了，且是单文件、无 WebGL、无构建。

**已知限制**（写进设计文档，不要当成 bug）：

- `backdrop-filter: url(#svg)` **只有 Chromium 真渲染**。Safari 接受属性但丢弃 SVG 部分（WebKit bug 245510）；Firefox 不实现（bug 1787623）。
- `CSS.supports('backdrop-filter','url(#x)')` 在三大引擎**都返回 true**，不能作为特性检测。hyalite 用引擎嗅探 + 手动开关 `Hyalite.force(true|false)`。
- 每个 `backdrop-filter` 元素都是独立 render surface。**只用于小型高价值表面**（导航条、浮动控制条、播放器），不要用于大面板或列表项。
- 装滤镜的 `<svg>` 不能用 `display:none`（Blink 会忽略），hyalite 用 0×0 盒。
- 位移图是 `data:` URL，严格 CSP 需要放行 `img-src data:`。

## 使用

```html
<script src="/vendor/hyalite.js"></script>
```

```css
.glass {
  backdrop-filter: var(--hyalite, blur(6px));
  -webkit-backdrop-filter: var(--hyalite, blur(6px));
  box-shadow: var(--hyalite-edge, none);
  background: rgba(0, 0, 0, .13);
  border-radius: 24px;
}
```

```js
Hyalite.watch(document.getElementById('app'), '.glass');   // 现在和以后的 .glass 都挂上
Hyalite.attach(card, { bevel: 24, thickness: 40 });        // 单个，带参数
```

降级链永远是三级：`液态（Chromium）→ 毛玻璃 → 半透明实色`。CSS 里的 `var(--hyalite, blur(6px))` 就是第二级兜底。

## 升级

1. 从上游仓库取新版本
2. 更新 `hyalite.js` 与 `hyalite.LICENSE.txt`
3. 更新 `hyalite.SBOM.json` 的 `version` / `bytes` / `verifiedAt`
4. 重跑批次 6 的玻璃验收（Chromium 看到折射、Safari/Firefox 落到毛玻璃、`force()` 开关可用）
