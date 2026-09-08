# UI 素材说明

本目录保存当前页面使用的 Logo、Banner、学院校徽，以及保留的 Blue Archive / Kivo Wiki UI 备用素材，避免在运行时热链图片。

同日后续增加 `styles/site-motion.css`：复用下述三角 SVG 做缓慢漂移、透明度变化和光感呼吸，未新增背景视频或生成图片。页脚可暂停背景并记住偏好，系统减少动态效果时保持静止；主页原画不参与这层动画。

2026-09-08 的非首页背景参考 [国服官网](https://bluearchive-cn.com/official) 的公开样式与实际背景资源：桌面共用的 [`home1.eced09f4.mp4`](https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/home1.eced09f4.mp4) 和移动端 [`bgM.a00ae174.png`](https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/bgM.a00ae174.png)。观察到的核心是近白底色与很淡的大小三角纹理。本站用原创静态 SVG 几何和 CSS 遮罩重新实现，未下载或热链这些官网背景，也未接入官网脚本；并非官方素材提取图。首页原画及 Common / Combat 控件不受此次背景调整影响。

2026-09-08 接入作者提供的 `Common.png`、`Combat.png` 图集，当前由 `styles/atlas-ui.css` 统一全站皮肤。原图完整保留；用 CSS 定位引用，不生成近似替代图，也不改变角色素材或游戏数据。图集的具体提取版本未提供，来源按“作者提供”记录。

2026-09-06 的全站重设计参考了 [《蔚蓝档案》国服官网](https://bluearchive-cn.com/official) 的白／蔚蓝／深灰配色、斜切构图、大号英文标题与黄色三角装饰。相关几何装饰由本项目 CSS 实现；没有将官网页面或其整套资源复制进项目。

| 本地文件 | 来源 | 页面用途 |
| --- | --- | --- |
| `archive-triangles.svg` | 本项目代码绘制的透明度遮罩，参考上述国服官网背景 | 公告、宣传片、学生区、关于区与放大舞台的低对比几何底纹；日夜颜色由 `styles/site-backgrounds.css` 提供 |
| `reference-atlas/Common.png`、`reference-atlas/Combat.png` | 作者于 2026-09-08 提供的游戏 UI 图集 | 当前箭头、搜索、导航档案／公告图标、纸面纹理和战斗／重置控件；坐标见 `reference-atlas/frames.json` |
| `reference-atlas/control-*.svg` | 本项目代码绘制，非官方图集提取素材 | 图集中未定位到的网页播放、暂停、全屏、主题、关闭等动作；与图集使用统一深蓝和圆润线条 |
| `generated-buttons/*.png` | 2026-09-08 按作者要求使用 OpenAI 内置图像生成；完整提示词见 `generated-buttons/prompts.json` | 保留的上一版备用按钮与底板，非官方原始 UI 资源；当前皮肤覆盖这些图片 |
| `project-archive-logo.png` | 项目作者提供的 `ProjectArchive-Wiki_symbolon.png` | 当前导航栏与页脚标志 |
| `hina-dress-home-banner.png` | 项目作者提供的 `CH0230_home_Idle_01_1.633399999999994.png` | 当前首屏礼服日奈横幅 |
| `academies/*.png` | Kivo 公开学院 API 提供的 `static.kivo.wiki` 图片，逐项来源见 `academies/sources.json` | 角色选择区上方 12 个学院与夏莱（全部学生）卡片标志，以及每名学生身后的所属学院徽记；原 PNG 不变，淡色与过场由 CSS / JavaScript 实现 |
| `ba-logo-mark.png` | `https://webusstatic.yo-star.com/bluearchive_jp_web/img/bluearhive.f833c198.png` | 保留的备用横幅标志 |
| `ba-screen-frame.png` | `https://webusstatic.yo-star.com/bluearchive_jp_web/img/bg_cover.9bd1cfea.png` | 保留的旧版页面／学生档案边框备用素材 |
| `kivo-panel-corner.webp` | `https://kivo.wiki/assets/options-DoCj5sFX.webp` | 保留的旧版首屏／档案面板三角纹理备用素材 |
| `hina-dress-banner.png` | OpenAI 内置图像生成（同人创作） | 保留的备用礼服日奈横幅 |
| `kivo-home-banner.webp` | `https://kivo.wiki/assets/home_button-BRCngEW_.webp` | 保留的备用首屏横幅 |

2026-09-07 新增的学院校徽通过 `scripts/sync-academy-logos.mjs` 下载，学院接口为 `https://api.kivo.wiki/api/v1/data/schools/{id}`。本地文件名保留接口中的学院 ID；页面不在线请求该接口。卡片的倾斜轮廓、非对称圆角、纸片叠层及黄色选中标记由 `styles/gallery.css` 实现，不属于下载的 UI 图片。

字体不复制到本目录。页面通过以下样式表按需加载 Blueaka 的 Unicode 分片：

- `https://font.kivo.wiki/Blueaka/Blueaka.css`
- `https://font.kivo.wiki/Blueaka_Bold/Blueaka_Bold.css`

字体服务不可用或离线时会回退到 Noto Sans / 系统字体，不影响本地图片与资料展示。全站样式位于 `styles.css`，学生／公告详情和语义标签样式位于 `styles/details.css`。

生成横幅未包含文字、官方标志或水印，仅用于非官方同人资料展示。角色及其他游戏相关素材版权归原权利方所有。
