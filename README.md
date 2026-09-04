# Project Archive Wiki

Project Archive 的非官方静态资料站，集中展示公告、学生图鉴、战斗资料与宣传片。

网站由 `index.html` 与独立的 `styles.css` 主题覆盖层组成，不需要构建工具，可以直接本地打开，也可以部署到任意静态网站服务。Blueaka 字体在线加载，无法联网时会自动回退到 Noto Sans / 系统字体。

## 功能

- 37 名学生资料与 111 条技能记录；技能、角色说明与使用备注支持 CN / EN / JP
- 12 个学院与战斗定位筛选
- 角色名、学院、武器、站位及战斗定位搜索
- 学生详情弹窗与对应 Kivo Wiki 图鉴入口
- 带独立地址的公告详情，例如 `#announcement/izuna-update`
- 中文、English、日本語即时切换
- 可记忆的日间与夜间模式
- 四支 Project Archive 宣传片站内切换播放
- 响应式桌面与移动端布局
- 键盘操作、焦点管理及“减少动态效果”支持

## 更新记录

版本标题、日期和顺序以 [GitHub Activity](https://github.com/pan0001/paweb/activity) 与仓库提交历史为准，最新开发版本记录在顶部。

### 0.03.1 beta · 2026-09-04

- 修复切换 English / 日本語 后角色说明与 Usage Notes 仍显示中文的问题
- 为 37 条角色说明和 111 条使用备注补齐 English 与日本語文本，并支持弹窗内即时切换

### [0.03 beta](https://github.com/pan0001/paweb/commit/6cf39790fec3b26a4cc7eb608691a2368f48026f) · 2026-08-27

- 接入 Blueaka / Blueaka Bold 字体与本地 BA、Kivo UI 装饰素材
- 为 37 名学生的 111 条技能补齐 English 与日本語名称和说明，并修复冷却文本残留中文的问题
- 使用项目作者提供的 Project Archive Wiki Logo 与礼服日奈 Banner，适配日间、夜间和移动端布局
- 补充 UI 素材来源说明，并保留先前横幅作为备用素材

### [0.02.2 beta](https://github.com/pan0001/paweb/commit/85c4392973d6b3cdfe70f586f48829780b033754) · 2026-08-26

- 新增独立 `styles.css` 主题覆盖层
- 完成学院、攻防类型和站位的语义配色
- 升级学生卡片、详情档案、暗色主题及移动端布局

### [0.02.1 beta](https://github.com/pan0001/paweb/commit/8c697c69adef5dd9f27e5341c5d4564201ecb8fe) · 2026-08-26

- 按 Kivo Wiki 逐人复核学院、星级、战斗定位、站位、武器和攻防类型
- 将“职业”统一调整为“战斗定位”，并补充专属武器与站位字段
- 修正学生名称和筛选可搜索字段

### [0.02 beta](https://github.com/pan0001/paweb/commit/887167be1bb858b48f61f21772e742bc5285070d) · 2026-08-26

- 完成公告详情、CN / EN / JP 切换、日夜主题和四支宣传片播放
- 加入组合筛选、语言与主题偏好保存、响应式布局及无障碍交互
- 建立完整 README，补充运行、维护和素材声明

### [0.01 Bata](https://github.com/pan0001/paweb/commit/d528f30a71cb576d83b767fd467d10189007136c) · 2026-08-26

- 建立可直接打开的静态 `index.html`
- 加入 37 名学生、111 条技能及本地学生图片
- 完成首屏、公告、学生卡片、详情弹窗和基础筛选结构

### [Initial commit](https://github.com/pan0001/paweb/commit/4996ada86d8523a095e29634c245a7c8018e0edb) · 2026-08-26

- 初始化仓库与 README

## 本地运行

最简单的方法是直接打开 `index.html`。

由于部分浏览器会限制 `file://` 页面内的 YouTube 播放器，推荐通过本地 HTTP 服务预览。例如已安装 Python 时：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

如果播放器仍受地区、年龄或浏览器策略限制，可以使用页面中的“在 YouTube 观看”按钮。

## 目录结构

```text
paweb/
├── index.html          # 页面、样式、资料数据与交互逻辑
├── styles.css          # Project Archive 学生档案主题与语义配色
├── i18n/
│   ├── characters.en.js # 角色说明与使用备注的 English 文本
│   ├── characters.jp.js # 角色说明与使用备注的日本語文本
│   ├── skills.en.js    # 111 条技能的 English 文本
│   └── skills.jp.js    # 111 条技能的日本語文本
├── assets/
│   ├── students/       # 37 张本地学生图像
│   └── ui/             # BA 官网与 Kivo 的本地 UI 装饰素材
└── README.md
```

## 宣传片

- [PA IZUNA HIKARI](https://www.youtube.com/watch?v=FekdUUn3cIo)
- [BA fan game "Project Archive" update video](https://www.youtube.com/watch?v=6J3IQ5VhRVQ)
- [Project Archive Nagusa Update!](https://www.youtube.com/watch?v=YamYqKh7jLI)
- [Project Archive: Tachibana Nozomi](https://www.youtube.com/watch?v=oZ2mTczpaZY)

影片来自 YouTube 频道 [in_uni](https://www.youtube.com/@IN_UNI)。

## 内容维护

主要内容都位于 `index.html` 底部的 JavaScript 数据区：

- `translations`：CN / EN / JP 界面文案
- `localizedValues`：学院、战斗定位、武器及战斗类型译名
- `i18n/characters.en.js`、`i18n/characters.jp.js`：按学生 ID 维护的角色说明与使用备注
- `i18n/skills.en.js`、`i18n/skills.jp.js`：按“学生 ID:技能序号”维护的技能名称与说明
- `characterNames`：角色名称与特殊形态译名
- `announcements`：公告标题、摘要与完整正文
- `trailers`：YouTube 影片 ID、链接与多语言标题
- `characters`：学生数值、技能、备注、图片路径及 Kivo 图鉴 ID
- `verifiedStudentFacts`：按 Kivo 图鉴复核的学院、初始星级、战斗定位、站位、武器与攻防类型

视觉覆盖规则位于 `styles.css`，包括 Blueaka 字体、BA 风 UI 图片、学院主题色、攻击/防御语义色、学生卡片、详情档案布局、暗色主题和移动端覆盖。

语言和主题偏好保存在浏览器本地存储中，键名分别为 `pa-language` 与 `pa-theme`。

## 素材来源与声明

- 学生图像资料整理自 [基沃托斯古书馆（Kivo Wiki）](https://kivo.wiki/)
- Blueaka 字体通过 Kivo Wiki 的字体服务加载；UI 装饰图来自 [Kivo Wiki](https://kivo.wiki/) 与 [Blue Archive 日服官网](https://bluearchive.jp/)
- 当前 Project Archive Logo 与礼服日奈 Banner 由项目作者提供，并保存为本地素材
- OpenAI 内置图像生成工具创作的礼服日奈横幅保留为备用同人视觉素材
- 游戏图像及相关素材版权归其原权利方所有
- 本项目为同人资料整理与界面展示项目，与游戏官方及 Kivo Wiki 无隶属关系

如需公开部署或再分发，请先确认相关素材的使用条件。
