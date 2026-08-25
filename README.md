# Project Archive Wiki

Project Archive 的非官方静态资料站，集中展示公告、学生图鉴、战斗资料与宣传片。

网站使用单个 `index.html` 实现，不需要构建工具或额外依赖，可以直接本地打开，也可以部署到任意静态网站服务。

## 功能

- 37 名学生资料与 111 条技能记录
- 12 个学院与战斗定位筛选
- 角色名、学院、武器、站位及战斗定位搜索
- 学生详情弹窗与对应 Kivo Wiki 图鉴入口
- 带独立地址的公告详情，例如 `#announcement/izuna-update`
- 中文、English、日本語即时切换
- 可记忆的日间与夜间模式
- 四支 Project Archive 宣传片站内切换播放
- 响应式桌面与移动端布局
- 键盘操作、焦点管理及“减少动态效果”支持

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
├── assets/
│   └── students/       # 37 张本地学生图像
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
- `characterNames`：角色名称与特殊形态译名
- `announcements`：公告标题、摘要与完整正文
- `trailers`：YouTube 影片 ID、链接与多语言标题
- `characters`：学生数值、技能、备注、图片路径及 Kivo 图鉴 ID
- `verifiedStudentFacts`：按 Kivo 图鉴复核的学院、初始星级、战斗定位、站位、武器与攻防类型

语言和主题偏好保存在浏览器本地存储中，键名分别为 `pa-language` 与 `pa-theme`。

## 素材来源与声明

- 学生图像资料整理自 [基沃托斯古书馆（Kivo Wiki）](https://kivo.wiki/)
- 游戏图像及相关素材版权归其原权利方所有
- 本项目为同人资料整理与界面展示项目，与游戏官方及 Kivo Wiki 无隶属关系

如需公开部署或再分发，请先确认相关素材的使用条件。
