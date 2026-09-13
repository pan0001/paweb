# Common / Combat 图集引用

作者在 2026-09-08 提供这两张游戏 UI 图集，未附带原始精灵描述文件或提取版本。两张 PNG 在项目中保持字节一致，版权归原权利方；本目录不是官方发布包。

- `Common.png`：2048 × 2048；导航、档案、箭头、搜索与纸面纹理。
- `Common-prologue.png`：作者于 2026-09-13 提供的 `Common_7231006368839740661.png`，2048 × 2048，来自其 `BlueArchive_UI/Images/01_通用界面与控件/综合图集/prologdepengroup-assets-_mx-uis-atlas-_mxprolog_e65fce81` 导出目录；按原字节复制，SHA-256 为 `dd54e69c3765d1d1a99a3e9fb8ce7314fb846016ec9b665fefd44ae8c11f3e85`。仅引用金色星星矩形 `(1535,312,70,66)`，不替换其他两张图集，不包含相邻蓝色星星或武器标志。
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

2026-09-13：`styles/rarity.css` 通过 `--ref-rarity-star` 在完整资料、基础字段、选人信息栏和学生卡片显示原图金星。未获得星位仅以 CSS 灰度／透明度弱化，不修改 PNG；高对比模式显示原星字符。星级数量与 CN／EN／JP 无障碍标签继续来自学生数据。

2026-09-08：修正补充月亮图标的画布偏移，改用居中的 32 × 32 viewBox；原始 Common／Combat 图集不变。日月图标可通过 `scripts/check-control-alignment.cjs` 检查可见像素边界，按钮的实际布局仍需浏览器复核。
