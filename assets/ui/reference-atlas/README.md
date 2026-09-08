# Common / Combat 图集引用

作者在 2026-09-08 提供这两张游戏 UI 图集，未附带原始精灵描述文件或提取版本。两张 PNG 在项目中保持字节一致，版权归原权利方；本目录不是官方发布包。

- `Common.png`：2048 × 2048；导航、档案、箭头、搜索与纸面纹理。
- `frames.json` 的 `pin`：黄色圆形图钉，供记忆大厅相框使用；前后纸张复用纸面纹理，胶带用 CSS 绘制。原始图集不裁剪、不改写。
- `Combat.png`：2048 × 1024；战斗目标标记与重置圆环。
- `frames.json`：手动复核的原图像素矩形，原点为左上角。
- `control-*.svg`：本项目补充的网页动作图标，不冒充游戏原素材。
- `preview.html`：本地 HTTP 图集与补充图标检查页。

`styles/atlas-frames.css` 中的背景大小为 `sheetSize / frameSize × 100%`，背景位置为 `origin / (sheetSize − frameSize) × 100%`。原图没有被裁剪或修改；搜索控件用 CSS 多边形排除紧贴其左上角的相邻图形，重置圆环用圆形裁切排除边角。外侧点击区域保持矩形，不按透明像素缩小。

维护时同步修改矩形与样式，并运行：

```powershell
node scripts/check-atlas-ui.cjs
node scripts/check-preview.mjs
```

全站标签和状态保留为 HTML / JavaScript 文本。图集中的货币数、未读角标和关卡信息没有当作本站数据展示。

2026-09-08：修正补充月亮图标的画布偏移，改用居中的 32 × 32 viewBox；原始 Common／Combat 图集不变。日月图标可通过 `scripts/check-control-alignment.cjs` 检查可见像素边界，按钮的实际布局仍需浏览器复核。
