# 版本记录 / Changelog

每个版本的完整网站压缩包在 [Releases](https://github.com/Warren-xh/paper-card/releases) 和 [`backup/`](backup/) 里。
Release packages of every version are on [Releases](https://github.com/Warren-xh/paper-card/releases) and in [`backup/`](backup/).

## v4.3 — 2026-10-28

- 新的**词库**（顶栏「词库」）：在任何笔记框里选中一个词，点加粗、斜体旁边的「**术语**」，写下中文、英文和解释，就会收进词库；笔记里这个词带虚线下划线，指上去或点一下就弹出中英文和解释。词库页可以搜索、排序、编辑、删除，并列出每个术语出现在哪些论文、实操、课时里；全站搜索也能搜到术语。
  New **term library** (**Terms** in the top bar): select a word in any notes box and click **Term** next to bold and italic, add the Chinese and English names and an explanation, and it goes into the library. The word in your notes gets a dotted underline and shows its card when you point at or tap it. The library page searches, sorts, edits and deletes terms and lists where each one appears; Ctrl+K search finds terms too.
- 课程的每一课只有**一个笔记框**：「⏱ 时间点」插入视频时间，「☐ 待解决」插入问题；课时页上点时间视频就跳过去，问题可以直接勾选成已解决。原来单独的「边看边记」在打开编辑时自动合并进笔记，内容不会丢。
  Each lesson now has **one notes box**: **⏱ Time** inserts a video time and **☐ Open** a question; on the lesson page, times jump the video and questions can be ticked off. Earlier separate time marks are merged into the notes when you open the editor, so nothing is lost.
- 去掉所有输入框的字数上限，标题、标记、笔记想写多长都可以。
  No more length limits on any text box.

## v4.2 — 2026-10-28

- 新的「今天」总览页（顶栏 🏠，也是网站名的链接）：今天该回顾的卡片、继续上哪一课、进行中的实操、各模块待解决的问题；近半年的**学习日历**（按每天在网站上保存的次数）和连续学习天数；快速开始和最近更新。
  New **Today** overview (🏠 in the top bar, also the site name): cards to review, the lesson to continue, practice in progress and open questions everywhere; a six-month **study calendar** of daily saves with your streak; quick starts and recent changes.
- **全站搜索**：Ctrl+K / ⌘K 或顶栏放大镜，一个框搜论文、实操、课程、每一课的笔记和导图，键盘就能选、能打开；也能直接跳到常用操作。
  **Search everything** with Ctrl+K / ⌘K or the magnifier: papers, logs, courses, every lesson's notes and mind maps in one box, fully keyboard-driven, plus quick actions.
- 课时的视频链接是 B 站或 YouTube 时，课时页可以**在页面里播放**，点标记的时间就**跳到那一刻**。
  Lessons with a Bilibili or YouTube link **play in the page**; clicking a mark's time **jumps the video there**.
- 论文 PDF 和课程资料 PDF 可以**在页面里预览**；点任何图片**放大查看**，← → 切换。
  **Preview PDFs** (papers and course materials) in the page; click any image to **view it large**, ← → to move between images.
- 界面重新设计：每个模块有自己的颜色和图标，首页改成带图标的标题和数字卡片，卡片、按钮、列表更柔和，页面切换有过渡；代码块自动上色；编辑时 Ctrl+S 保存；长页面有「回到顶部」。
  Redesigned look: each module has its own colour and icon, module homes get an icon header and number tiles, softer cards, buttons and lists, gentle page transitions; coloured code blocks; Ctrl+S saves while editing; a back-to-top button on long pages.

## v4.1 — 2026-10-27

- 课程里每一课都能上传**课件与资料**（PDF、PPT、讲义、图片等，也可以直接拖进来），存在仓库的 `materials/` 文件夹；课时页上可以打开、下载，图片显示成缩略图。删除课时或课程时一起删除。
  Each lesson of a course can hold **slides & materials** (PDFs, PPTs, handouts, images; drag and drop works), stored in `materials/`; open or download them on the lesson page, with images as thumbnails. They are deleted with their lesson or course.
- 课时页和编辑页改成「笔记 → 课件与资料 → 边看边记 → 看完后」；课程页的课时显示「第 N 课」，并标出有笔记、几个资料。
  Lesson pages now go notes → materials → notes while watching → wrap-up; the course page labels lessons “Lesson N” and shows which have notes and materials.
- 所有模块的笔记框都有「插入图片」按钮，并且可以直接 **Ctrl+V 粘贴截图**或拖入图片；一行的标记、过程记录、答案里也能粘贴。课程的学完总结也能插图。
  Every notes box in every module has **Insert image**, and you can **paste screenshots with Ctrl+V** or drag images in, including one-line marks, log entries and answers. Course takeaways can hold images too.
- 修复：刚保存的图片在网站更新前也能马上显示；本地预览服务器在 Windows 上读不到刚提交的文件。
  Fixed: images saved in this session show right away before the site rebuilds; the local preview server on Windows could not serve files committed in mock mode.

## v4.0 — 2026-10-27

- 新增课程笔记（顶栏「课程」）：课程含多节课，每课边看边记带视频时间点的标记、待解决与答案、一句话和笔记；进度条、快速标记看完、继续下一课、学完总结。
  Course notes (**Courses** in the top bar): lessons with time-stamped marks, open questions and answers, a one-liner and notes; progress bar, quick “watched” toggle, continue to the next lesson, course takeaways.
- 所有模块的列表都能搜索和排序；导图里可以「在图中查找」，导图分支可以是课程。
  Search and sort on every list; **Find in map** inside a mind map; courses can be map branches.
- 阅读标记、过程记录、答案等一行输入框改为自动换行、自动变高，长文字不再被挡住。
  One-line boxes (reading marks, log entries, answers) now wrap and grow, so long text stays visible.
- 手机上顶栏的「设置」和登录按钮改为图标，四个模式也能放在一行。
  On phones, Settings and the sign-in button become icons so all four modes fit on one line.

## v3.1 — 2026-10-22

- 界面可切换英文（默认中文）：顶栏「EN / 中」或「设置 → 界面语言」；只翻译界面，不翻译你写的内容。
  English interface (Chinese stays the default): **EN / 中** in the top bar or **Settings → Interface language**; only the interface is translated, never your own writing.
- 设置页显示版本号和项目链接。
  Settings shows the version and a link to the project.
- 中英文 README，写明完整部署步骤；发布包放到 Releases，提供固定下载链接。
  Chinese and English READMEs with full deployment steps; release packages on Releases with a stable download link.
- 网站代码以 MIT 许可证发布（版权人 Warren-xh），个人内容不在许可范围内。
  The website code is released under the MIT License (copyright Warren-xh); personal content is not covered.

## v3.0 — 2026-10-22

- 新增思维导图：分支可以是文字、论文卡片或实操记录；浏览模式（拖动、缩放、折叠、点击跳转）和编辑模式（面板、拖动移动、撤销、快捷键）。
  Mind maps: branches can be text, paper cards or practice logs; browse mode (pan, zoom, fold, click to open) and edit mode (panel, drag to move, undo, shortcuts).

## v2.0 — 2026-10-22

- 新增实操记录：过程随手记（自动带时间）、待解决、问题与解决、关键代码、关联论文卡片。
  Practice logs: timestamped entries, open problems and fixes, key code, links to paper cards.
- 实操记录可上传代码文件或整个文件夹，网页上查看和下载。
  Upload code files or whole folders to a log; view and download them on the page.

## v1.0 — 2026-10-21

- 论文卡片：四个阶段（读之前 / 边读边记 / 初步解决 / 合上论文再写）、回忆模式、间隔回顾、论文 PDF 上传下载。
  Paper cards: four stages (before / while reading / first-pass answers / after reading), recall mode, spaced review, paper PDF upload and download.
- 密码加密的 GitHub 令牌、每次保存一次提交、草稿自动保存、导出、明暗主题。
  Password-encrypted GitHub token, one commit per save, automatic drafts, export, light and dark themes.
