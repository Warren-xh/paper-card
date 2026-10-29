// Interface language. Chinese is the source language of the page code; when
// English is chosen, interface text is swapped as it appears on screen.
// What people write (notes, code, Markdown) is never translated.

export const LANGS = { zh: "中文", en: "English" };
const KEY = "pc-lang";

export function getLang() {
  try { return localStorage.getItem(KEY) === "en" ? "en" : "zh"; } catch { return "zh"; }
}
export function setLang(lang) {
  try { localStorage.setItem(KEY, lang === "en" ? "en" : "zh"); } catch {}
}

/* ---------- exact strings ---------- */
const EXACT = {
  // shell
  "文献卡片": "Paper Cards", "实操记录": "Practice Log", "思维导图": "Mind Maps",
  "论文阅读卡片：读一篇，记一张；回头看，一眼想起。": "Paper cards: read one, write one; look back and remember at a glance.",
  "跳到正文": "Skip to content", "切换模式": "Switch mode", "文献": "Papers", "实操": "Practice", "导图": "Maps",
  "主导航": "Main navigation", "回顾": "Review", "设置": "Settings", "切换明暗主题": "Toggle light/dark theme",
  "切换语言": "Switch language",
  "正在打开卡片…": "Opening cards…", "读一篇，记一张；回头看，一眼想起。": "Read one, write one; look back and remember at a glance.",
  // common
  "确定": "OK", "取消": "Cancel", "已复制。": "Copied.", "读取文件失败。": "Could not read the file.",
  "粗体": "bold", "斜体": "italic", "今天": "today", "明天": "tomorrow",
  "已解锁": "Unlocked", "登录编辑": "Sign in", "点击锁定（退出编辑）": "Click to lock (stop editing)", "输入密码后可以编辑": "Enter your password to edit",
  "授权已失效，请重新输入密码。": "Your sign-in has expired. Please enter your password again.",
  "还没有设置密码": "No password set yet", "第一次使用需要先完成一次设置：连接 GitHub 并设定你的密码。": "Before the first use, connect GitHub and choose a password once.",
  "去设置": "Set up", "输入密码": "Enter password", "解锁后就可以写卡片和修改网站。": "Once unlocked you can write cards and change the site.",
  "密码": "Password", "在这台设备上记住我 30 天": "Remember me on this device for 30 days", "解锁": "Unlock", "正在解锁…": "Unlocking…",
  "已解锁，可以编辑了。": "Unlocked. You can edit now.", "页面打不开": "This page can't be opened", "回到全部导图": "Back to all maps", "回到首页": "Back to home",
  "锁定编辑？": "Lock editing?", "锁定后需要重新输入密码才能编辑。": "You will need your password again to edit.", "锁定": "Lock", "已锁定。": "Locked.",
  "闲置太久，已自动锁定。": "Locked after being idle for a while.",
  // home
  "先想，再看答案 →": "Recall first, then check →",
  "今天没有要回顾的卡片。卡片标成「读完」后，第二天开始提醒回顾。": "Nothing to review today. Cards marked “Finished” come up for review from the next day.",
  "写下第一张卡片吧：读之前想清楚为什么读，边读边打标记，读完合上论文再写。": "Write your first card: know why you read, mark as you go, then close the paper and write.",
  "张卡片": "cards", "篇本月": "this month", "次回顾": "reviews", "条待解决": "unresolved", "篇在读": "reading", "篇读完": "finished",
  "周日": "Sun", "周一": "Mon", "周二": "Tue", "周三": "Wed", "周四": "Thu", "周五": "Fri", "周六": "Sat", "时间点": "Time",
  "写一张新卡片": "New card", "全部卡片": "All cards", "搜索卡片": "Search cards", "搜索标题、作者、一句话、笔记…": "Search titles, authors, one-liners, notes…",
  "按状态筛选": "Filter by status", "全部状态": "All statuses", "在读": "Reading", "读完": "Finished", "有待解决的": "With open questions",
  "按项目筛选": "Filter by project", "全部项目": "All projects",
  "还没有卡片。点上面的「写一张新卡片」开始。": "No cards yet. Click “New card” above to start.",
  "没有找到匹配的卡片。换个关键词，或清除筛选。": "No matching cards. Try another keyword or clear the filters.",
  "该回顾": "Due", "附有论文 PDF": "Paper PDF attached", "还没写一句话": "No one-liner yet", "未写标题": "Untitled", "（未写标题）": "(untitled)",
  // card page
  "揭晓": "Reveal", "数据集": "Datasets", "对比对象": "Baselines", "关键数字": "Key numbers", "被这些卡片关联：": "Linked from these cards:",
  "一句话": "One-liner", "阅读标记": "Reading marks", "已初步解决": "Resolved in the first pass", "初步解决": "First-pass answers", "还没解决": "Not solved yet",
  "下载论文 PDF": "Download paper PDF", "在新标签页打开": "Open in a new tab", "为什么读：": "Why read: ", "回顾记录": "Review history",
  "今天该回顾了。": "Due for review today.", "还没回顾过。": "Not reviewed yet.", "找不到这张卡片": "Card not found",
  "它可能刚发布、网站还没更新，或者已经删除了。": "It may have just been published (the site has not updated yet), or it was deleted.",
  "← 全部卡片": "← All cards", "回忆模式": "Recall mode", "退出回忆模式": "Exit recall mode", "全部揭晓": "Reveal all", "复制 Markdown": "Copy Markdown", "编辑": "Edit",
  "先别看：试着自己说出每一栏，再点「揭晓」对照。": "Don't peek: say each part yourself first, then click “Reveal” to compare.",
  "自由笔记": "Free notes", "痛点": "Problem", "核心想法": "Key idea", "怎么证明的": "Evidence", "疑问 / 局限": "Doubts / limits",
  "和我有什么关系": "Why it matters to me", "关联": "Links", "相关实操记录": "Related practice logs",
  // review
  "今天的回顾做完了": "Today's review is done", "今天没有要回顾的卡片": "Nothing to review today",
  "卡片标成「读完」后，第二天开始提醒回顾；之后想得起来，间隔就会越来越长（1 → 7 → 30 → 90 → 180 天）。": "Cards marked “Finished” come up for review from the next day; each time you remember, the gap grows (1 → 7 → 30 → 90 → 180 days).",
  "回到卡片": "Back to cards", "正在取出下一张…": "Loading the next card…", "打开卡片": "Open card",
  "用一句话说出它": "In one sentence, say", "用什么方法": "what method it uses", "解决了什么问题": "what problem it solves", "结果如何": "how well it worked",
  "我想起来的": "What I remembered", "先自己写下想起来的（只是帮你想，不会保存）": "Write down what you remember first (just to help you think; not saved)",
  "揭晓答案": "Show the answer", "想得怎么样？": "How well did you remember?", "忘了": "Forgot", "有点模糊": "Fuzzy", "想起来了": "Remembered",
  // editor
  "正在打开编辑器…": "Opening the editor…", "它可能刚发布、网站还没更新。稍等一分钟再试。": "It may have just been published and the site has not updated yet. Try again in a minute.",
  "加粗（⌘/Ctrl + B）": "Bold (⌘/Ctrl + B)", "加粗": "Bold", "斜体（⌘/Ctrl + I）": "Italic (⌘/Ctrl + I)", "插入图片": "Insert image",
  "← 返回": "← Back", "预览": "Preview", "已恢复这台设备上还没发布的草稿。": "Restored an unpublished draft from this device.", "放弃草稿": "Discard draft",
  "你可以先写，发布时再输入密码。草稿会自动保存在这台设备上。": "You can write now and enter your password when publishing. Drafts are saved on this device automatically.",
  "论文标题": "Paper title", "作者": "Authors", "作者姓名": "Author names", "年份": "Year", "发表年份": "Year published",
  "会议 / 期刊": "Venue", "会议或期刊名称": "Conference or journal", "链接": "Link", "网址、DOI 或 arXiv 编号": "URL, DOI or arXiv ID",
  "标签": "Tags", "用逗号分开": "Separate with commas", "项目": "Project", "可以留空": "Optional", "阅读日期": "Date read", "状态": "Status",
  "论文 PDF": "Paper PDF",
  "PDF 会存到 GitHub 仓库的 papers/ 文件夹，之后在卡片页可以下载。仓库是公开的，知道链接的人都能下载，付费期刊的论文请留意版权。最大 50 MB。": "The PDF is stored in the papers/ folder of your GitHub repository and can be downloaded from the card page. The repository is public, so anyone with the link can download it — mind the copyright of paywalled papers. Max 50 MB.",
  "读之前": "Before reading", "为什么读这篇、想从里面得到什么？（一行）": "Why read this, and what do you want from it? (one line)", "为什么读这篇，想从中得到什么": "Why you read it and what you want from it",
  "边读边记": "While reading",
  "只打标记，不写长句。选一个符号，写几个字，回车就记下一条。页码从 1 开始，翻页时点 ＋（也可以直接改数字，或清空不填）。觉得这一条还没解决，就勾上「待解决」，它会出现在下面的「初步解决」里。": "Just mark, no long sentences. Pick a symbol, type a few words, press Enter. Page numbers start at 1; press ＋ when you turn the page (or type a number, or leave it empty). If something is still unclear, tick “Open” and it will show up under “First-pass answers” below.",
  "标记类型": "Mark type", "上一页": "Previous page", "页": "p.", "页码": "Page", "下一页": "Next page", "写几个字，回车记下": "A few words, then Enter", "标记内容": "Mark text", "记下": "Add",
  "没看懂": "Unclear", "关键结论": "Key point", "可以借鉴": "Reusable", "有问题": "Questionable", "普通笔记": "Note", "待解决": "Open",
  "初步解决问题": "First-pass answers",
  "「边读边记」里勾了「待解决」的标记列在这里。读完第一遍后给它们写答案；没弄懂的留空，之后可以「带入」到 ⑤。": "Marks ticked “Open” while reading are listed here. After the first read, write their answers; leave unclear ones empty and bring them into ⑤ later.",
  "其他初步弄懂的": "Other things figured out", "其他读完第一遍弄懂的地方": "Anything else you figured out after the first read",
  "读完 · 合上论文再写": "After reading · close the paper and write", "写的时候不看原文，写不出来的那栏就是没懂的地方。": "Don't look at the paper while writing — any part you can't fill is a part you haven't understood.",
  "最重要的一栏。点下面的句式，直接打字填空，按 Tab 跳到下一个空。": "The most important part. Click the pattern below, type into the blanks, and press Tab to jump to the next blank.",
  "用【什么方法】解决了【什么问题】，结果【比谁好多少】": "Used [what method] to solve [what problem], result: [better than whom, by how much]",
  "用一句话概括这篇论文": "Sum up the paper in one sentence", "它要解决什么问题？之前的方法差在哪？": "What problem does it solve? Where did earlier methods fall short?",
  "它的关键一招是什么？能画出来就画一张图。": "What is its key trick? Draw it if you can.", "用什么数据、和谁比、关键数字是多少。": "Which data, compared with what, and the key numbers.",
  "哪里没看懂、哪里站不住、哪些情况它不适用。": "What is unclear, what doesn't hold up, where it doesn't apply.", "带入阅读时的 ? 和 ×（已解决的不带）": "Bring in ? and × marks (resolved ones skipped)",
  "我能借鉴什么？对我的研究有什么用？": "What can I reuse? How does it help my research?", "带入 ★": "Bring in ★ marks",
  "搜索并选中相关的已有卡片，再写一句它们的区别。关联只记下对方的编号，不会多出卡片；两张卡片上都会显示。": "Search and pick related cards, then say how they differ. A link only stores the other card's ID — no new card is created — and shows on both cards.",
  "输入标题、作者或关键词找卡片…": "Find cards by title, author or keyword…", "搜索要关联的卡片": "Search cards to link", "还没有其他卡片可以关联。": "No other cards to link yet.",
  "这些卡片已经关联了这张，会自动显示在两边，不用再选：": "These cards already link to this one and show on both sides automatically: ",
  "这篇和关联论文的区别": "How this paper differs from the linked ones",
  "任何想记的：公式、推导、代码、截图。支持 Markdown，公式用 $…$。": "Anything else: formulas, derivations, code, screenshots. Markdown supported; formulas with $…$.",
  "草稿已恢复": "Draft restored", "草稿自动保存在这台设备": "Drafts are saved on this device", "删除": "Delete", "发布": "Publish",
  "待解决：勾上后出现在「初步解决」里": "Open: ticked marks appear under “First-pass answers”", "这个问题的答案，没弄懂就留空": "The answer; leave empty if still unclear",
  "答案": "Answer", "还没有勾「待解决」的标记。": "No marks ticked “Open” yet.",
  "没有新的 ? 或 × 标记可以带入。": "No new ? or × marks to bring in.", "没有新的 ★ 标记可以带入。": "No new ★ marks to bring in.",
  "取消关联": "Unlink", "最近的卡片：": "Recent cards:", "没有找到匹配的卡片。": "No matching cards.",
  "换一个": "Replace", "移除": "Remove", "上传 PDF": "Upload PDF", "已移除。发布后仓库里的 PDF 也会删掉。": "Removed. The PDF in the repository is deleted when you publish.",
  "请选择 PDF 文件。": "Please choose a PDF file.", "PDF 已上传到仓库。记得点「发布」保存卡片。": "PDF uploaded to the repository. Remember to click “Publish” to save the card.",
  "图片已插入，发布时一起上传。": "Image inserted; it will be uploaded when you publish.", "正在保存草稿…": "Saving draft…", "草稿已保存在这台设备": "Draft saved on this device",
  "这台设备无法保存草稿（存储已满或被禁用）": "This device can't save drafts (storage full or disabled)", "放弃草稿？": "Discard the draft?",
  "这台设备上还没发布的修改会被删除。": "Unpublished changes on this device will be deleted.", "先写上论文标题再发布。": "Add the paper title before publishing.",
  "正在发布…": "Publishing…", "已发布。网站大约 1 分钟后对所有人更新。": "Published. The site updates for everyone in about a minute.",
  "删除这张卡片？": "Delete this card?", "删除后网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。": "It will no longer show on the site. You can still recover it from the GitHub history.",
  "已删除。": "Deleted.", "请选择图片文件。": "Please choose an image file.", "图片太大了（超过 25 MB）。": "The image is too large (over 25 MB).", "无法读取这张图片。": "Could not read this image.",
  // settings & setup
  "还没有设置密码，网站暂时不能编辑。": "No password yet, so the site can't be edited.", "开始设置": "Start setup", "网站标题": "Site title", "一句话介绍": "Tagline",
  "保存设置": "Save settings", "保存后会发布到网站。": "Saving publishes to the site.", "密码与授权": "Password & access", "未知": "unknown",
  "修改密码 / 更换令牌": "Change password / replace token", "在这台设备上锁定": "Lock on this device", "备份": "Backup",
  "下载全部论文卡片（Markdown）": "Download all paper cards (Markdown)", "下载全部实操记录（Markdown）": "Download all practice logs (Markdown)", "下载全部（JSON）": "Download everything (JSON)",
  "设置已保存。网站大约 1 分钟后更新。": "Settings saved. The site updates in about a minute.", "正在整理全部卡片…": "Collecting all cards…",
  "先输入现在的密码。令牌过期时，在这里粘贴新令牌。": "Enter your current password first. When the token expires, paste a new one here.",
  "现在的密码": "Current password", "新密码（不改就留空）": "New password (leave empty to keep)", "新令牌（不换就留空）": "New token (leave empty to keep)", "保存": "Save",
  "现在的密码不对。": "The current password is wrong.", "令牌应该以 github_pat_ 开头，请检查是否复制完整。": "The token should start with github_pat_. Please check it was copied completely.",
  "已保存。其他设备下次用新密码解锁。": "Saved. Other devices unlock with the new password next time.",
  "第一次设置": "First-time setup", "这个网站已经设置过密码了。重新设置会让旧密码失效。": "This site already has a password. Setting it up again replaces the old one.",
  "返回设置": "Back to settings", "只需要做一次。完成后，在任何设备上输入密码就能写卡片。": "You only do this once. Afterwards, enter your password on any device to write.",
  "在 GitHub 生成一个令牌": "Create a token on GitHub", "打开 GitHub 令牌页面": "Open the GitHub token page", "粘贴令牌，设一个密码": "Paste the token and choose a password",
  "令牌会用你的密码加密后保存，网站和仓库里都不会出现原文。": "The token is encrypted with your password before it is saved; it never appears in plain text on the site or in the repository.",
  "GitHub 令牌": "GitHub token", "设一个密码": "Choose a password", "至少 8 位，字母加数字": "At least 8 characters, letters and numbers", "再输一次": "Repeat it",
  "完成设置": "Finish setup", "这样安全吗？": "Is this safe?",
  "令牌只授权这一个仓库，只能改这个卡片网站，碰不到你的其他仓库和账号。加密后的令牌保存在公开仓库里，所以密码别太简单，也别和其他账号共用。万一密码泄露，到 GitHub 删除令牌，再回这里重新设置即可；卡片的每次修改都能从 GitHub 历史里恢复。": "The token only covers this one repository, so it can change this site and nothing else in your account. The encrypted token lives in a public repository, so use a strong password you don't use anywhere else. If the password leaks, delete the token on GitHub and set up again here; every change can be restored from the GitHub history.",
  "两次输入的密码不一样。": "The two passwords don't match.", "正在检查令牌…": "Checking the token…", "正在加密保存…": "Encrypting and saving…",
  "设置完成，现在可以写卡片了。": "Setup done. You can write cards now.", "语言": "Language", "界面语言": "Interface language",
  "只翻译界面，你写的内容不会被翻译。": "Only the interface is translated; what you write stays as it is.",
  // GitHub and password errors
  "GitHub 令牌已失效或被撤销，请到设置页更换令牌。": "The GitHub token has expired or was revoked. Replace it in Settings.",
  "GitHub 拒绝了请求：请确认令牌对这个仓库有 Contents 读写权限，或稍后再试。": "GitHub refused the request: make sure the token has Contents read & write access to this repository, or try again later.",
  "找不到仓库或文件，请确认令牌授权了这个仓库。": "Repository or file not found. Make sure the token covers this repository.",
  "仓库暂时冲突，请重试。": "The repository is busy. Please try again.", "GitHub 没有接受这次保存。": "GitHub did not accept this save.",
  "连接 GitHub 超时，草稿仍保存在本机。": "Connecting to GitHub timed out. Your draft is still saved on this device.",
  "无法连接 GitHub，草稿仍保存在本机。": "Can't reach GitHub. Your draft is still saved on this device.", "这个令牌没有写入权限。": "This token has no write access.",
  "保存失败，请重试。": "Saving failed. Please try again.", "密码至少需要 8 位。": "The password needs at least 8 characters.", "密码太长了。": "The password is too long.",
  "不要只用数字，加几个字母吧。": "Don't use only digits; add some letters.", "密码里重复的字符太多了。": "Too many repeated characters in the password.",
  "这个密码太常见了，换一个吧。": "This password is too common; pick another.", "令牌格式不对：请使用 github_pat_ 开头的细粒度令牌。": "Wrong token format: use a fine-grained token starting with github_pat_.",
  "授权文件已损坏，请到设置页重新配置。": "The access file is damaged. Set it up again in Settings.", "密码不正确。": "Wrong password.",
  "卡片格式不正确。": "The card's format is invalid.", "卡片编号不正确。": "The card's ID is invalid.", "未知的回顾结果。": "Unknown review result.",
  // practice logs
  "暂时读不到这个文件。刚上传的文件要等网站更新（约 1 分钟）。": "Can't read this file yet. Newly uploaded files appear once the site updates (about a minute).",
  "动手做过的记下来，踩过的坑下次不再踩。": "Write down what you built, so you never fall into the same hole twice.",
  "写代码、跑实验、做练习时，开一条记录随手记。": "When coding, running experiments or practising, start a log and jot things down.",
  "第一次用：点「新建一条记录」，开始时写目标，过程中随手记，做完写结论。": "First time? Click “New log”: write a goal at the start, jot as you go, write a conclusion at the end.",
  "新建一条记录": "New log", "条记录": "logs", "条进行中": "in progress", "条本月": "this month", "小时": "hours", "全部实操记录": "All practice logs",
  "搜索记录": "Search logs", "搜索标题、结论、命令、报错…": "Search titles, conclusions, commands, errors…", "进行中": "In progress", "完成": "Done",
  "还没有记录。": "No logs yet.", "没有找到匹配的记录。换个关键词，或清除筛选。": "No matching logs. Try another keyword or clear the filters.", "未写日期": "No date",
  "已解决": "Solved", "结论": "Conclusion", "过程": "Process", "问题与解决": "Problems & fixes", "关键代码 / 命令": "Key code / commands", "结果": "Results",
  "下次要做": "Next steps", "相关论文": "Related papers", "笔记": "Notes", "代码文件": "Code files", "在 GitHub 上查看": "View on GitHub", "查看": "View",
  "下载": "Download", "收起": "Hide", "正在读取…": "Loading…", "代码链接": "Code link", "目标：": "Goal: ", "正在打开记录…": "Opening the log…",
  "找不到这条记录": "Log not found", "它可能刚保存、网站还没更新，或者已经删除了。": "It may have just been saved (the site has not updated yet), or it was deleted.",
  "回到实操记录": "Back to practice logs", "← 全部记录": "← All logs", "它可能刚保存、网站还没更新。稍等一分钟再试。": "It may have just been saved and the site has not updated yet. Try again in a minute.",
  "已恢复这台设备上还没保存的草稿。": "Restored an unsaved draft from this device.", "你可以先写，保存时再输入密码。草稿会自动保存在这台设备上。": "You can write now and enter your password when saving. Drafts are saved on this device automatically.",
  "标题": "Title", "这次做了什么": "What you worked on", "日期": "Date", "用时（小时）": "Time spent (hours)", "环境 / 工具": "Environment / tools",
  "语言、框架、硬件等": "Language, framework, hardware…", "仓库、提交或笔记本的网址": "URL of a repo, commit or notebook", "上传文件": "Upload files", "上传文件夹": "Upload folder",
  "文件马上存进 GitHub 仓库的 code/ 文件夹，之后在记录页可以查看和下载；同名文件再传会覆盖。仓库是公开的，会自动跳过 .env、密钥文件、node_modules、.git 等。单个文件最大 25 MB，一次最多 200 个文件、共 100 MB。": "Files go straight into the code/ folder of your GitHub repository and can be viewed and downloaded from the log page; uploading the same name again replaces the file. The repository is public, so .env files, keys, node_modules, .git and similar are skipped automatically. Max 25 MB per file, 200 files and 100 MB per upload.",
  "开始前": "Before you start", "目标（一行）": "Goal (one line)", "这次想做成什么、验证什么": "What you want to build or verify", "过程中": "While working",
  "随手记，每条自动记下时间。选一个符号，写几个字，回车记下一条。卡住的问题勾上「待解决」，做完后在下面写怎么解决的。": "Jot as you go; each entry gets the time. Pick a symbol, type a few words, press Enter. Tick “Open” for problems you're stuck on and write the fix below when done.",
  "记录类型": "Entry type", "过程记录": "Process entry", "做完后": "When done", "一句话：做成了什么、学到了什么。": "One sentence: what got done and what you learned.",
  "一句话总结这次的结果": "Sum up the result in one sentence", "勾了「待解决」的记录列在这里，写下怎么解决的；没解决就留空。": "Entries ticked “Open” are listed here — write how you fixed them; leave empty if not fixed.",
  "其他遇到的问题和解决办法": "Other problems and how you fixed them", "值得留下的代码或命令，直接粘贴即可。": "Code or commands worth keeping — just paste them.", "代码或命令": "Code or commands",
  "指标、输出、截图": "Metrics, output, screenshots", "接下来要做或要改的": "What to do or change next", "这次实践对应的论文卡片，两边都会显示。": "Paper cards this practice relates to; shown on both sides.",
  "输入论文标题或关键词…": "Paper title or keyword…", "搜索论文卡片": "Search paper cards", "还没有论文卡片。": "No paper cards yet.",
  "任何想记的，支持 Markdown、公式 $…$ 和图片。": "Anything else; Markdown, formulas ($…$) and images supported.", "时间": "Time", "记录内容": "Entry text",
  "待解决：勾上后出现在「问题与解决」里": "Open: ticked entries appear under “Problems & fixes”", "怎么解决的，没解决就留空": "How you fixed it; leave empty if not fixed",
  "解决办法": "Fix", "还没有勾「待解决」的记录。": "No entries ticked “Open” yet.", "图片已插入，保存时一起上传。": "Image inserted; it will be uploaded when you save.",
  "这台设备上还没保存的修改会被删除。": "Unsaved changes on this device will be deleted.", "先写上标题再保存。": "Add a title before saving.", "正在保存…": "Saving…",
  "已保存。网站大约 1 分钟后对所有人更新。": "Saved. The site updates for everyone in about a minute.", "删除这条记录？": "Delete this log?",
  "操作": "Action", "报错": "Error", "成功": "Success", "疑问": "Question", "依赖或缓存": "dependencies or cache", "系统文件": "system file", "可能含密钥": "may contain secrets",
  "记录格式不正确。": "The log's format is invalid.", "记录编号不正确。": "The log's ID is invalid.",
  // mind maps
  "把读过的论文、做过的实操串成一张图。": "Connect the papers you read and the things you built into one picture.",
  "新建一张导图，从中心主题开始加分支；分支可以是文字，也可以是论文卡片或实操记录。": "Create a map and grow branches from the central topic; a branch can be text, a paper card or a practice log.",
  "新建导图": "New map", "全部导图": "All maps", "未命名导图": "Untitled map", "导图的名字也是中心主题，之后可以改。": "The map's name is also its central topic; you can change it later.",
  "名字": "Name", "导图的主题": "Topic of the map", "创建": "Create", "正在打开导图…": "Opening the map…", "找不到这张导图": "Map not found", "← 全部导图": "← All maps",
  "模式": "Mode", "浏览": "Browse", "撤销（⌘/Ctrl + Z）": "Undo (⌘/Ctrl + Z)", "撤销": "Undo", "重做（⌘/Ctrl + Shift + Z）": "Redo (⌘/Ctrl + Shift + Z)", "重做": "Redo",
  "复制大纲": "Copy outline", "删除导图": "Delete map", "已恢复这台设备上还没保存的修改。": "Restored unsaved changes from this device.", "放弃修改": "Discard changes",
  "导图画布": "Map canvas", "缩小": "Zoom out", "放大": "Zoom in", "适应": "Fit", "全部展开": "Expand all", "只看主干": "Main branches only", "文字": "Text", "论文": "Paper",
  "拖动空白处移动画布，滚轮或双指缩放；点论文、实操分支可以打开。": "Drag empty space to move, scroll or pinch to zoom; click a paper or practice branch to open it.",
  "点分支选中；Tab 加子分支，Enter 加同级，Delete 删除；把分支拖到另一个分支上可以移动。": "Click a branch to select it; Tab adds a child, Enter a sibling, Delete removes; drag a branch onto another to move it.",
  "中心主题": "Central topic", "（空）": "(empty)", "有备注": "Has a note", "展开": "Expand", "折叠": "Collapse", "当前分支": "Selected branch", "分支的文字": "Branch text",
  "（已删除）": "(deleted)", "打开": "Open", "改成文字": "Make it text", "颜色": "Colour", "备注（浏览时悬停可见）": "Note (shown on hover when browsing)",
  "＋ 子分支": "＋ Child", "＋ 同级": "＋ Sibling", "上移": "Move up", "下移": "Move down", "分支类型": "Branch type", "输入文字，回车添加": "Type text, press Enter to add",
  "只显示读完的论文": "Only finished papers", "只显示完成的记录": "Only completed logs", "搜索论文标题、作者…": "Search paper titles, authors…", "搜索记录标题…": "Search log titles…",
  "Tab 子分支 · Enter 同级 · Delete 删除 · ⌘Z 撤销 · 把分支拖到另一个分支上可以移动": "Tab child · Enter sibling · Delete remove · ⌘Z undo · drag a branch onto another to move it",
  "已在图中": "Already on the map", "删除这个分支？": "Delete this branch?", "放弃修改？": "Discard the changes?", "丢掉这张导图？": "Throw this map away?",
  "它还没保存过，丢掉后就没有了。": "It was never saved; once thrown away it is gone.", "丢掉": "Throw away", "删除这张导图？": "Delete this map?",
  "删除后网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。导图里关联的论文和实操记录不受影响。": "It will no longer show on the site and can be recovered from the GitHub history. Linked papers and logs are not affected.",
  "自动": "Auto", "蓝": "Blue", "绿": "Green", "橙": "Orange", "红": "Red", "紫": "Purple", "青": "Teal", "灰": "Grey",
  "导图格式不正确。": "The map's format is invalid.", "导图编号不正确。": "The map's ID is invalid.", "找不到要添加到的分支。": "The branch to add to was not found.",
  "版本": "Version", "源代码与部署说明": "Source code & setup guide", "已删除": "deleted",
  // v4.0: sorting, map search, courses
  "排序": "Sort", "阅读日期：新→旧": "Date read: newest first", "阅读日期：旧→新": "Date read: oldest first", "最近修改": "Recently edited",
  "标题 A→Z": "Title A→Z", "发表年份：新→旧": "Year: newest first", "待解决最多": "Most open questions", "下次回顾最近": "Next review soonest",
  "日期：新→旧": "Date: newest first", "日期：旧→新": "Date: oldest first", "用时最长": "Most time spent", "分支最多": "Most branches",
  "最近学习": "Recently studied", "进度：高→低": "Progress: most first", "进度：低→高": "Progress: least first",
  "搜索导图": "Search maps", "搜索导图名字和分支…": "Search map names and branches…", "没有找到匹配的导图。": "No matching maps.",
  "在图中查找…": "Find in map…", "在图中查找": "Find in map", "没有找到": "Not found",
  "课程笔记": "Course Notes", "课程": "Course", "回到全部课程": "Back to all courses", "下载全部课程笔记（Markdown）": "Download all course notes (Markdown)",
  "找不到这一课": "Lesson not found", "找不到这门课程": "Course not found",
  "看课时随手记，看完一课写一句话。": "Jot notes while watching; sum up each lesson in one sentence.",
  "边看边记时间点，回看时一眼找到。": "Note the video time as you go, so you can find things again at a glance.",
  "添加一门课程，列出课时，看每一课时边看边记。": "Add a course, list its lessons, and take notes while you watch each one.",
  "添加课程": "Add course", "门课程": "courses", "门在学": "learning", "门学完": "finished", "课看完": "lessons watched", "全部课程": "All courses",
  "搜索课程": "Search courses", "搜索课程、课时、笔记…": "Search courses, lessons, notes…", "在学": "Learning", "学完": "Finished", "暂停": "Paused",
  "还没有课程。": "No courses yet.", "没有找到匹配的课程。换个关键词，或清除筛选。": "No matching courses. Try another keyword or clear the filters.",
  "未命名课程": "Untitled course", "还没有课时": "No lessons yet", "正在打开课程…": "Opening the course…", "课程链接": "Course link",
  "← 全部课程": "← All courses", "编辑课程": "Edit course", "为什么学：": "Why: ", "下一课": "Next lesson", "课时": "Lessons", "＋ 新的一课": "＋ New lesson",
  "标成没看完": "Mark as not watched", "标成看完了": "Mark as watched", "记笔记": "Take notes",
  "还没有课时。点「编辑课程」一次加好全部课时，或点「＋ 新的一课」。": "No lessons yet. Click “Edit course” to add them all at once, or “＋ New lesson”.",
  "学完总结": "Course takeaways", "正在打开…": "Opening…", "看完了": "Watched", "没看完": "Not watched", "视频链接": "Video link",
  "这一课讲了什么": "What this lesson covered", "边看边记": "While watching", "问题与解答": "Questions & answers", "这一课还没有笔记。": "No notes for this lesson yet.",
  "翻页": "Pages", "上一课": "Previous lesson", "课程名称": "Course name", "讲师 / 平台": "Teacher / platform", "讲师、学校或平台": "Teacher, school or platform",
  "课程主页或播放列表的网址": "URL of the course page or playlist", "开始日期": "Start date", "为什么学": "Why take it", "学这门课想得到什么": "What you want from this course",
  "每一课一行。笔记在课程页点每一课的「记笔记」里写。": "One lesson per row. Notes go under each lesson's “Take notes” on the course page.",
  "批量添加（每行一课）": "Add several (one lesson per line)", "每行写一课的标题": "One lesson title per line", "添加这些课时": "Add these lessons",
  "整门课学完后，写下最重要的收获。": "When you finish the course, write down what mattered most.", "这门课最重要的收获": "The most important takeaways",
  "删除课程": "Delete course", "这一课的标题": "Lesson title", "课时标题": "Lesson title", "删除这一课": "Delete this lesson", "删除这一课？": "Delete this lesson?",
  "这一课已经有笔记，保存后会一起删除。": "This lesson has notes; they will be deleted when you save.", "先写上课程名称再保存。": "Add a course name before saving.",
  "删除这门课程？": "Delete this course?",
  "这一课已经有笔记或资料，保存后会一起删除。": "This lesson has notes or materials; they will be deleted when you save.",
  "插入图片（也可以直接 Ctrl+V 粘贴截图）": "Insert image (or paste a screenshot with Ctrl+V)", "可以直接 Ctrl+V 粘贴截图": "Paste screenshots with Ctrl+V",
  "课件与资料": "Slides & materials", "上传文件": "Upload files", "边看边记（可选）": "Notes while watching (optional)", "有笔记": "Has notes",
  "这一课的笔记": "Notes for this lesson", "这一课还没有笔记和资料。": "This lesson has no notes or materials yet.", "开始记笔记": "Start taking notes",
  "点任意一课进去看笔记和资料；点左边的圆圈标成看完了。": "Open any lesson to see its notes and materials; click the circle on the left to mark it watched.",
  "还没有课时。点「＋ 新的一课」开始记第 1 课；也可以在「编辑课程」里一次列出全部课时的标题。": "No lessons yet. Click “＋ New lesson” to start lesson 1, or list all lesson titles at once under “Edit course”.",
  "这里只列每一课的标题，比如「Agent 概览」。笔记、截图和课件保存后在课程页点进每一课里写和上传。": "Only list each lesson's title here, e.g. “Agent overview”. After saving, open each lesson on the course page to write notes and upload screenshots and slides.",
  "这一课的要点、公式、推导、代码都写在这里。支持 Markdown，公式用 $…$。截图可以直接 Ctrl+V 粘贴，或点「插入图片」。": "Key points, formulas, derivations and code for this lesson. Markdown works; write formulas as $…$. Paste screenshots with Ctrl+V, or click “Insert image”.",
  "课件 PDF、PPT、讲义、图片、代码等。选好后马上存进 GitHub 仓库的 materials/ 文件夹，在这一课的页面可以打开和下载；也可以把文件直接拖到这里。同名文件再传会覆盖。仓库是公开的，别传私密文件。单个文件最大 25 MB。": "Slide PDFs, PPTs, handouts, images, code and more. Files are stored right away in the materials/ folder of your GitHub repository and can be opened and downloaded from the lesson page; you can also drag files here. Uploading a file with the same name replaces it. The repository is public, so don't upload private files. Up to 25 MB per file.",
  "课程和所有课时笔记都会删除，网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。": "The course and all its lesson notes will be deleted and no longer show on the site. You can still recover them from the GitHub history.",
  "这一课视频的网址": "URL of this lesson's video", "学习日期": "Date studied", "进度": "Progress",
  "写下视频时间（分:秒），选一个符号，写几个字，回车记下一条。时间会保留，接着改就行。没听懂的勾上「待解决」，看完后在下面写答案。": "Enter the video time (m:ss), pick a symbol, type a few words and press Enter. The time stays, so just change it as you go. Tick “Open” for anything unclear and answer it below after watching.",
  "分:秒": "m:ss", "视频时间": "Video time", "看完后": "After watching", "一句话说出这一课的核心。": "Say the core of this lesson in one sentence.",
  "一句话总结这一课": "Sum up this lesson in one sentence", "勾了「待解决」的标记列在这里，写下答案；没弄懂的留空。": "Marks ticked “Open” are listed here — write the answers; leave unclear ones empty.",
  "公式、推导、代码、截图都可以，支持 Markdown，公式用 $…$。": "Formulas, derivations, code, screenshots — Markdown supported; formulas with $…$.",
  "待解决：勾上后出现在「问题与解答」里": "Open: ticked marks appear under “Questions & answers”", "答案，没弄懂就留空": "The answer; leave empty if still unclear",
  "没听懂": "Unclear", "重点": "Key point", "可以用": "Useful", "只显示学完的课程": "Only finished courses", "搜索课程名称…": "Search course names…",
  "课程格式不正确。": "The course's format is invalid.", "课程编号不正确。": "The course's ID is invalid.",
  "、": ", ", "。": ".", "：": ": ",
  "打开下面的链接，名称和权限已经填好。在「Repository access」里选": "Open the link below; the name and permissions are filled in. Under “Repository access” choose",
  "，再选": ", then pick", "；确认「Permissions」里": "; make sure under “Permissions”", "是": "is",
  "，然后点页面底部的「Generate token」，复制生成的令牌。": ", then click “Generate token” at the bottom and copy the token.",
  "做了什么、看到什么，回车记下；命令可用 `反引号` 包住": "What you did or saw, then Enter; wrap commands in `backticks`",
  "只用于文献卡片网站发布，只授权": "Only for publishing the Paper Cards site; only covers",
  // v4.2: overview, search, viewer, video
  "这是你今天的学习桌面。": "Here is your study desk for today.",
  "从下面任意一个开始：读一篇论文、记一次实操、跟一门课，或者画一张导图。": "Start with any of these: read a paper, log some practice, follow a course or draw a mind map.",
  "搜索论文、实操、课程、课时、导图…": "Search papers, logs, courses, lessons, maps…", "搜索全部内容": "Search everything",
  "搜索（Ctrl+K）": "Search (Ctrl+K)", "学习日历": "Study calendar", "正在统计…": "Counting…", "快速开始": "Quick start",
  "写论文卡片": "Write a paper card", "记一次实操": "Log some practice", "最近更新": "Recently updated",
  "还没有内容。写下第一条之后会出现在这里。": "Nothing yet. Your first entry will show up here.",
  "近半年每天的学习记录": "Study activity per day over the last six months",
  "天连续学习": "day streak", "按每天在网站上保存的次数": "Saves made on the site each day", "按卡片、记录和课时的日期": "By the dates of cards, logs and lessons",
  "少": "Less", "多": "More", "先回想，再看答案": "Recall first, then check", "开始 →": "Start →", "今天没有要回顾的": "Nothing to review today",
  "卡片标成「读完」后会提醒回顾": "Cards marked “Finished” come up for review", "上课 →": "Watch →", "实操进行中": "Practice in progress",
  "接着做 →": "Continue →", "读 →": "Read →", "在读": "Reading", "快速操作": "Quick actions", "选择": "Select", "关闭": "Close",
  "总览": "Overview", "新建一条实操记录": "New practice log", "开始回顾": "Start reviewing",
  "刚刚": "just now", "昨天": "yesterday", "在新标签页打开原图": "Open the original in a new tab", "原图": "Original",
  "上一张": "Previous", "下一张": "Next", "回到顶部": "Back to top", "收起预览": "Hide preview", "PDF 预览": "PDF preview",
  "视频": "Video", "在 B 站打开": "Open on Bilibili", "在 YouTube 打开": "Open on YouTube", "在页面里播放": "Play here",
  "点「边看边记」里的时间，视频会跳到那一刻。": "Click a time under “Notes while watching” to jump the video there.",
  "把读过的论文、做过的实操、学过的课程串成一张图。": "Tie the papers you read, the practice you did and the courses you took into one map.",
  "暂时统计不了。": "Can't count right now.", "夜深了": "It's late", "早上好": "Good morning", "中午好": "Good afternoon", "下午好": "Good afternoon", "晚上好": "Good evening",
  // v4.3: term library, one notes box per lesson
  "术语": "Term", "词库": "Terms", "标为术语": "Mark as a term", "标为术语：先选中文字，再点这里，可以写中英文和解释并收进词库": "Mark as a term: select the words, click here, then add Chinese, English and an explanation for the term library",
  "已保存到词库。": "Saved to the term library.", "已记下。登录后再保存一次，词条就会存进词库。": "Noted. Sign in and save once more to store it in the term library.",
  "编辑术语": "Edit term", "标注术语": "Mark a term", "词库里已经有这个词，修改会更新词库。": "This term is already in the library; your changes update it.",
  "写下中英文和解释，保存后会收进词库；笔记里这个词会显示成术语，指上去就能看到解释。": "Add the Chinese and English names and an explanation. It goes into the term library, and the word in your notes shows its explanation when you point at it.",
  "在词库里用的名字": "Name in the term library", "中文": "Chinese", "中文名": "Chinese name", "解释": "Explanation",
  "它是什么、怎么用；支持 Markdown 和公式 $…$": "What it is and how it is used; Markdown and formulas ($…$) work",
  "标注并保存": "Mark and save", "先写上术语。": "Write the term first.", "术语里不能有换行或方括号。": "A term can't contain line breaks or square brackets.",
  "先选中要标注的词。": "Select the words to mark first.", "还没有写解释。": "No explanation yet.", "在词库中查看 →": "Open in the term library →",
  "词库里还没有这个词。": "This term is not in the library yet.", "加入词库 →": "Add to the library →", "名称 A→Z": "Name A→Z", "最近添加": "Recently added", "出现最多": "Most mentioned",
  "笔记里标注的专业词汇：中英对照，附上解释。": "Technical terms marked in your notes, in Chinese and English, with explanations.",
  "在任何笔记框里选中一个词，点「术语」就能标注并收进这里。": "Select a word in any notes box and click “Term” to mark it and collect it here.",
  "还没有术语。在笔记里选中一个词点「术语」，或者点右边直接添加。": "No terms yet. Select a word in your notes and click “Term”, or add one here.",
  "添加术语": "Add term", "个术语": "terms", "个本月新增": "added this month", "个有英文": "with English", "保存到词库": "Save to the library",
  "搜索术语": "Search terms", "搜索术语、中文、英文、解释…": "Search terms, Chinese, English, explanations…", "还没有术语。": "No terms yet.",
  "没有找到匹配的术语。": "No matching terms.", "笔记里还没出现": "Not in your notes yet", "删除这个术语？": "Delete this term?",
  "词库里的解释会删除；笔记里标注的词还在，只是不再有解释。需要时可以从 GitHub 的历史记录里找回。": "Its explanation leaves the library; the marked words stay in your notes without one. You can recover it from the GitHub history.",
  "已记下。登录后再保存一次就会删除。": "Noted. Sign in and save once more to delete it.", "回到词库": "Back to the term library", "下载词库（Markdown）": "Download the term library (Markdown)", "已解决": "Solved",
  "原来的「边看边记」已经合并到笔记的最后，保存后生效。": "Your earlier time marks have been moved to the end of the notes; save to keep them there.",
  "边看边写，所有内容都在这一个框里。点「⏱ 时间点」记下视频时间，课时页上点它视频就跳过去；没听懂的点「☐ 待解决」，弄懂后在课时页勾上，或改成 [x] 并在后面写答案。支持 Markdown、公式 $…$，截图可以 Ctrl+V 粘贴，选中文字点「术语」可以加入词库。": "Write everything for the lesson in this one box. “⏱ Time” records a video time that jumps the video when clicked on the lesson page; “☐ Open” adds a question — tick it on the lesson page once solved, or change it to [x] and add the answer. Markdown, formulas ($…$), pasted screenshots (Ctrl+V) all work; select words and click “Term” to add them to the term library.",
  "在光标处插入时间点": "Insert a time point at the cursor", "⏱ 时间点": "⏱ Time", "插入一条待解决的问题": "Add an open question", "☐ 待解决": "☐ Open",
  "先在左边写上视频时间，比如 12:05。": "Enter the video time on the left first, e.g. 12:05.", "点笔记里的时间，视频会跳到那一刻。": "Click a time in the notes to jump the video there.",
  "已标成解决。": "Marked as solved.", "已标成待解决。": "Marked as open.", "这一课的笔记": "Notes for this lesson",
  // v4.4: paper auto-fill, GitHub changes, mind-map outline, unmarked terms, reading settings
  "DOI、arXiv 编号或网址": "DOI, arXiv number or web address", "自动填写": "Auto-fill", "正在查…": "Looking up…",
  "填了 DOI 或 arXiv 编号：自动填写标题、作者、年份、会议；只写了标题：按标题查找论文": "With a DOI or arXiv number: fills in title, authors, year and venue. With only a title: searches papers by title.",
  "覆盖已经写的内容？": "Replace what you wrote?", "覆盖": "Replace", "查到的和已经写的一样。": "What was found matches what you wrote.",
  "选一篇论文": "Pick a paper", "先在「链接」里填 DOI 或 arXiv 编号，或者写好标题，再点「自动填写」。": "Enter a DOI or arXiv number under “Link”, or write the title, then click “Auto-fill”.",
  "连不上论文数据库，请稍后再试。": "Can't reach the paper databases. Please try again later.",
  "认不出这个编号：请填 DOI（如 10.1038/nature14539）或 arXiv 编号（如 2508.10016）。": "Not a recognised number: enter a DOI (e.g. 10.1038/nature14539) or an arXiv number (e.g. 2508.10016).",
  "这些词在词库里，但这条笔记里还没标注。勾上的会在第一次出现的地方标成术语。": "These words are in the term library but not marked in this note yet. Ticked ones are marked where they first appear.",
  "标注选中的": "Mark selected",
  "跟随系统": "System", "浅色": "Light", "护眼": "Sepia", "深色": "Dark", "系统字体": "System font", "霞鹜文楷": "LXGW WenKai", "思源宋体": "Noto Serif", "思源黑体": "Noto Sans",
  "小": "S", "标准": "Normal", "大": "L", "特大": "XL", "窄": "Narrow", "宽": "Wide", "宽松": "Loose",
  "主题": "Theme", "字体": "Font", "字号": "Text size", "行宽": "Page width", "行距": "Line spacing",
  "阅读时自动标出词库里的术语": "Mark library terms while reading", "阅读设置": "Reading settings", "更多设置": "More settings",
  "阅读设置：主题、字体、字号、行宽": "Reading settings: theme, font, text size, page width", "主题 · 字体 · 字号": "Theme · font · size", "阅读与外观": "Reading & appearance",
  "只保存在这台设备上。电脑上也可以点顶栏的「Aa」随时调整。": "Kept on this device only. On a computer you can also use “Aa” in the top bar.",
  "代码改动": "Code changes", "提交": "Commit", "对比": "Compare", "仓库": "Repository", "已合并": "Merged", "未合并": "Open", "已关闭": "Closed",
  "新增": "Added", "改名": "Renamed", "修改": "Modified", "去 GitHub 看完整改动": "see the full change on GitHub", "去 GitHub 看": "see it on GitHub",
  "二进制文件或改动太大，": "Binary file or too large a change; ", "在 GitHub 上打开": "Open on GitHub", "GitHub 提交": "GitHub commits",
  "提交、PR、对比或仓库的网址": "Address of a commit, PR, comparison or repository", "选择提交": "Pick commits", "也关联整个仓库": "Also link the whole repository",
  "记录页会显示每次提交改了哪些文件、改了哪几行。贴仓库地址可以从最近的提交里挑。公开仓库直接可用。": "The log page shows which files and lines each commit changed. Paste a repository address to pick from its recent commits. Public repositories work right away.",
  "认不出这个地址：请贴 GitHub 上提交、PR、对比或仓库的网址。": "Not a recognised address: paste a GitHub commit, PR, comparison or repository address.",
  "无法连接 GitHub。": "Can't reach GitHub.", "找不到：仓库可能是私有的，或者地址写错了。": "Not found: the repository may be private, or the address is wrong.",
  "GitHub 暂时不让读取（每小时的次数用完了），稍后再试。": "GitHub isn't allowing more reads right now (hourly limit reached). Try again later.",
  "大纲": "Outline", "分支": "Branch", "写点什么": "Write something",
  "Enter 新的一行，Tab 缩进一级，Shift+Tab 提出一级，↑↓ 换行，Alt+↑↓ 调整顺序，空行按 Backspace 删除。粘贴多行文字（可以带缩进或 - 列表）会自动变成分支。": "Enter adds a line, Tab indents, Shift+Tab outdents, ↑↓ move between lines, Alt+↑↓ reorder, Backspace on an empty line deletes it. Pasting several lines (indented or as a - list) turns them into branches.",
};

/* ---------- strings with numbers or names inside ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const date = (y, m, d) => `${MONTHS[+m - 1]} ${+d}, ${y}`;
const plural = (n, one, many) => `${n} ${+n === 1 ? one : many}`;
// [pattern, replacement(...captures)]. Captures arrive as written (they may be the
// user's own words); rules call T() on the parts that are interface text.
const T = (c) => (c && isCJK.test(c) ? tr(c) ?? c : c);
const TEMPLATES = [
  [/^(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日$/, (y, m, d) => date(y, m, d)],
  [/^(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日 阅读$/, (y, m, d) => "Read " + date(y, m, d)],
  [/^(\d{4}) 年 (\d{1,2}) 月$/, (y, m) => `${MONTHS[+m - 1]} ${y}`],
  [/^(\d{1,2}) 月$/, (m) => MONTHS[+m - 1]],
  [/^(\d+) 天后$/, (n) => `in ${n} days`],
  [/^今天有 (\d+) 张该回顾$/, (n) => `${plural(n, "card", "cards")} due today`],
  [/^篇读完 · (\d+) 篇在读$/, (n) => `finished · ${n} reading`],
  [/^今天没有要回顾的卡片。下一次：(.+)（(\d+) 张）$/, (d, n) => `Nothing to review today. Next: ${d} (${n})`],
  [/^还有 (\d+) 条待解决$/, (n) => `${n} still open`],
  [/^待解决 (\d+)$/, (n) => `Open ${n}`],
  [/^七栏写了 (\d+) 栏$/, (n) => `${n} of 7 parts written`],
  [/^卡片 (\d+)\/(\d+)，还差 (.+)$/, (a, b, rest) => `Card ${a}/${b}, missing ${rest}`],
  [/^卡片 (\d+)\/(\d+)，写完了$/, (a, b) => `Card ${a}/${b}, complete`],
  [/^项目：(.+)$/, (p) => `Project: ${p}`],
  [/^下次回顾：(.+)（(.+)）$/, (d, rel) => `Next review: ${T(d)} (${T(rel)})`],
  [/^回顾了 (\d+) 张：想起来 (\d+) 张，有点模糊 (\d+) 张，忘了 (\d+) 张。忘了的明天会再出现。$/, (n, g, f, x) => `Reviewed ${n}: remembered ${g}, fuzzy ${f}, forgot ${x}. Forgotten ones come back tomorrow.`],
  [/^下一次：(.+)，(\d+) 张。$/, (d, n) => `Next: ${T(d)}, ${plural(n, "card", "cards")}.`],
  [/^第 (\d+) \/ (\d+) 张$/, (a, b) => `Card ${a} of ${b}`],
  [/^(.+)再看$/, (d) => `see again ${T(d)}`],
  [/^(.+)（点一下换符号）$/, (l) => `${T(l)} (click to change)`],
  [/^还有 (\d+) 条待解决，已解决 (\d+) 条。$/, (a, b) => `${a} still open, ${b} solved.`],
  [/^(\d+) 条都初步解决了。$/, (n) => `All ${n} resolved in the first pass.`],
  [/^(\d+) 条都解决了。$/, (n) => `All ${n} solved.`],
  [/^已添加「(.*)」。$/, (t) => `Added “${t}”.`],
  [/^PDF 太大了（(.+)），最大 50 MB。$/, (s) => `The PDF is too large (${s}); the maximum is 50 MB.`],
  [/^正在上传 (.+)（(.+)）…$/, (n, s) => `Uploading ${n} (${s})…`],
  [/^正在上传 (\d+) 个文件（(.+)）…$/, (n, s) => `Uploading ${plural(n, "file", "files")} (${s})…`],
  [/^(上传失败|发布失败|保存失败|删除失败)：(.+)$/s, (what, msg) => `${{ 上传失败: "Upload failed", 发布失败: "Publishing failed", 保存失败: "Saving failed", 删除失败: "Deleting failed" }[what]}: ${T(msg)}`],
  [/^上次设置：(.+)。这台设备(已解锁|未解锁)。$/, (d, s) => `Last set up: ${d}. This device is ${s === "已解锁" ? "unlocked" : "locked"}.`],
  [/^读取 (.+) 失败（(\d+)）。$/, (p, c) => `Could not read ${p} (${c}).`],
  [/^GitHub 请求失败（(\d+)）。$/, (c) => `GitHub request failed (${c}).`],
  [/^还有 (\d+) 条待解决的问题。$/, (n) => `${n} open problems.`],
  [/^(\d+) 条 · (.+) 小时$/, (n, h) => `${plural(n, "log", "logs")} · ${h} h`],
  [/^(\d+) 条$/, (n) => plural(n, "log", "logs")],
  [/^(.+) 小时$/, (h) => `${h} h`],
  [/^✗ (\d+) 次报错$/, (n) => `✗ ${plural(n, "error", "errors")}`],
  [/^用时 (.+) 小时$/, (h) => `Took ${h} h`],
  [/^(\d+) 个 · (.+) ·$/, (n, s) => `${plural(n, "file", "files")} · ${s} ·`],
  [/^(\d+) 条过程记录$/, (n) => `${plural(n, "entry", "entries")}`],
  [/^(\d+) 条过程记录 · 待解决 (\d+)$/, (n, o) => `${plural(n, "entry", "entries")} · ${o} open`],
  [/^没有可上传的文件（跳过了 (\d+) 个：依赖、缓存、密钥或过大）。$/, (n) => `Nothing to upload (skipped ${n}: dependencies, caches, secrets or too large).`],
  [/^已上传 (\d+) 个文件(，跳过 (\d+) 个（依赖、缓存、密钥或过大）)?。记得点「保存」。$/, (n, _x, s) => `Uploaded ${plural(n, "file", "files")}${s ? `, skipped ${s} (dependencies, caches, secrets or too large)` : ""}. Remember to click “Save”.`],
  [/^…（文件太长，只显示前 300 KB，完整内容请下载）$/, () => "…(file too long; only the first 300 KB is shown — download it for the rest)"],
  [/^共 (\d+) 张导图。$/, (n) => `${plural(n, "map", "maps")}.`],
  [/^(\d+) 个分支(?: · 论文 (\d+))?(?: · 实操 (\d+))?(?: · 课程 (\d+))?$/, (n, c, l, k) => `${plural(n, "branch", "branches")}${c ? ` · ${c} papers` : ""}${l ? ` · ${l} logs` : ""}${k ? ` · ${k} courses` : ""}`],
  [/^(论文|实操|课程) · (.+)$/, (k, s) => `${{ 论文: "Paper", 实操: "Practice", 课程: "Course" }[k]} · ${T(s)}`],
  [/^给「(.*)」加分支$/, (t) => `Add a branch to “${t}”`],
  [/^原(卡片|记录|课程)已删除$/, (k) => `The ${{ 卡片: "card", 记录: "log", 课程: "course" }[k]} was deleted`],
  [/^没有符合条件的(论文|记录|课程)。(试试取消「只显示…」。)?$/, (k, hint) => `No matching ${{ 论文: "papers", 记录: "logs", 课程: "courses" }[k]}.${hint ? " Try unticking “Only …”." : ""}`],
  [/^还没有(论文卡片|实操记录)。$/, (k) => (k === "论文卡片" ? "No paper cards yet." : "No practice logs yet.")],
  [/^它下面还有 (\d+) 个分支，会一起删除。可以用「撤销」找回。$/, (n) => `It has ${plural(n, "branch", "branches")} under it, which will be deleted too. You can bring them back with “Undo”.`],
  [/^一张导图最多 (\d+) 个分支。$/, (n) => `A map can have at most ${n} branches.`],
  [/^所有卡片都保存在 GitHub 仓库$/, () => "Everything is stored in the GitHub repository"],
  [/^里，每次发布都有历史记录。也可以随时下载一份。$/, () => ", with a history of every change. You can also download a copy at any time."],
  [/^版本 (.+)$/, (v) => `Version ${v}`],
  [/^还有 (\d+) 个待解决的问题。$/, (n) => `${n} open questions.`],
  [/^已看 (\d+) \/ (\d+) 课(?: · 下一课：(.+))?$/, (a, b, next) => `Watched ${a} / ${b} lessons${next ? ` · next: ${next}` : ""}`],
  [/^继续：(.+)$/, (t) => `Continue: ${T(t)}`],
  [/^(\d{4}-\d{2}-\d{2}) 开始$/, (d) => `Started ${d}`],
  [/^第 (\d+) 课$/, (n) => `Lesson ${n}`],
  [/^(.+) · 第 (\d+) 课$/, (t, n) => `${t} · Lesson ${n}`],
  [/^(\d+) 个标记$/, (n) => plural(n, "mark", "marks")],
  [/^(\d+) 个标记 · 待解决 (\d+)$/, (n, o) => `${plural(n, "mark", "marks")} · ${o} open`],
  [/^(\d+) 课 · 已看 (\d+)$/, (n, d) => `${plural(n, "lesson", "lessons")} · ${d} watched`],
  [/^已添加 (\d+) 课。$/, (n) => `Added ${plural(n, "lesson", "lessons")}.`],
  [/^(\d+) 个$/, (n) => `${n} found`],
  [/^(\d+) 个资料$/, (n) => plural(n, "file", "files")],
  [/^(夜深了|早上好|中午好|下午好|晚上好)，(.+)$/, (g, name) => `${T(g)}, ${name}`],
  [/^(\d{1,2}) 月 (\d{1,2}) 日 (星期[日一二三四五六])$/, (m, d, w) => `${({ 星期日: "Sunday", 星期一: "Monday", 星期二: "Tuesday", 星期三: "Wednesday", 星期四: "Thursday", 星期五: "Friday", 星期六: "Saturday" })[w]}, ${MONTHS[+m - 1]} ${+d}`],
  [/^(\d{1,2}) 月 (\d{1,2}) 日：(\d+) (次保存|条记录)$/, (m, d, n, u) => `${MONTHS[+m - 1]} ${+d}: ${plural(n, u === "次保存" ? "save" : "entry", u === "次保存" ? "saves" : "entries")}`],
  [/^(\d{1,2}) 月 (\d{1,2}) 日：没有记录$/, (m, d) => `${MONTHS[+m - 1]} ${+d}: nothing`],
  [/^天 · 近 30 天$/, () => "days in the last 30"],
  [/^(次保存|条记录) · 近半年$/, (u) => (u === "次保存" ? "saves" : "entries") + " in six months"],
  [/^(\d+) 张卡片该回顾$/, (n) => `${plural(n, "card", "cards")} to review`],
  [/^下一次：(\d{1,2}) 月 (\d{1,2}) 日（(\d+) 张）$/, (m, d, n) => `Next: ${MONTHS[+m - 1]} ${+d} (${n})`],
  [/^(.+) · 已看 (\d+) \/ (\d+) 课$/, (t, a, b) => `${t} · watched ${a} / ${b}`],
  [/^实操进行中 · 待解决 (\d+)$/, (n) => `In progress · ${n} open`],
  [/^(\d+) 个待解决的问题$/, (n) => `${n} open ${+n === 1 ? "question" : "questions"}`],
  [/^(论文|实操|课程) (\d+)$/, (k, n) => `${{ 论文: "Papers", 实操: "Practice", 课程: "Courses" }[k]} ${n}`],
  [/^在读 · 还有 (\d+) 篇在读$/, (n) => `Reading · ${n} more in progress`],
  [/^(\d+) 张$/, (n) => plural(n, "card", "cards")],
  [/^(\d+) 门 · (\d+) 课看完$/, (n, d) => `${plural(n, "course", "courses")} · ${d} watched`],
  [/^(\d+) 分钟前$/, (n) => `${n} min ago`],
  [/^(\d+) 小时前$/, (n) => `${n} h ago`],
  [/^(\d+) 天前$/, (n) => `${plural(n, "day", "days")} ago`],
  [/^没有找到「(.*)」。换个关键词试试。$/, (q) => `Nothing found for “${q}”. Try another word.`],
  [/^从 (.+) 开始播放$/, (t) => `Play from ${t}`],
  [/^论文数据库暂时不可用（(\d+)）。$/, (n) => `The paper database is unavailable right now (${n}).`],
  [/^arXiv 上找不到 (.+)。$/, (id) => `arXiv has no paper ${id}.`],
  [/^找不到 DOI (.+)。$/, (id) => `No paper found for DOI ${id}.`],
  [/^查到的和这些栏里写的不一样：(.+)。点「覆盖」用查到的；点「取消」只填空着的栏。$/, (list) => `What was found differs from: ${list.split("、").map(T).join(", ")}. “Replace” uses what was found; “Cancel” only fills the empty fields.`],
  [/^已填好(.+)（来自 (.+)）。$/, (list, src) => `Filled in ${list.split("、").map(T).join(", ")} (from ${src}).`],
  [/^按标题「(.*)」找到下面这些，点一篇填进卡片。$/, (q) => `Found these for “${q}”. Click one to fill the card.`],
  [/^按标题「(.*)」没有找到。换个写法试试，或者直接在「链接」里填 DOI \/ arXiv 编号。$/, (q) => `Nothing found for “${q}”. Try other words, or enter a DOI / arXiv number under “Link”.`],
  [/^发现 (\d+) 个未标注的术语$/, (n) => `${plural(n, "unmarked term", "unmarked terms")} found`],
  [/^已标注 (\d+) 个术语。$/, (n) => `Marked ${plural(n, "term", "terms")}.`],
  [/^(\d+) 个 GitHub 链接$/, (n) => plural(n, "GitHub link", "GitHub links")],
  [/^(\d+) 个文件 ·$/, (n) => `${plural(n, "file", "files")} ·`],
  [/^后面还有 (\d+) 行，$/, (n) => `${plural(n, "more line", "more lines")}; `],
  [/^(.+) 最近的提交。勾上要关联的，也可以只关联整个仓库。$/, (r) => `Recent commits in ${r}. Tick the ones to link, or link just the repository.`],
  [/^(.+?) ?已直接关联整个仓库。$/, (msg) => `${T(msg)} Linked the whole repository instead.`],
  [/^已添加 (\d+) 个分支。$/, (n) => `Added ${plural(n, "branch", "branches")}.`],
  [/^有 (\d+) 个词条还只存在这台设备上。$/, (n) => `${plural(n, "term is", "terms are")} only on this device so far.`],
  [/^出现在 (\d+) 处$/, (n) => `Mentioned ${plural(n, "time", "times")}`],
  [/^(\d+) 个术语$/, (n) => plural(n, "term", "terms")],
  [/^(\d+) 个时间点$/, (n) => plural(n, "time point", "time points")],
  [/^(\d+) 个时间点 · 待解决 (\d+)$/, (n, o) => `${plural(n, "time point", "time points")} · ${o} open`],  [/^(\d+) 个 · (.+)$/, (n, s) => `${plural(n, "file", "files")} · ${s}`],
  [/^已插入 (\d+) 张图片，保存时一起上传。$/, (n) => `Inserted ${n} images; they are uploaded when you save.`],
  [/^没有可上传的文件（跳过了 (\d+) 个：可能含密钥或超过 25 MB）。$/, (n) => `Nothing to upload (skipped ${n}: may contain secrets or larger than 25 MB).`],
  [/^已上传 (\d+) 个文件(?:，跳过 (\d+) 个)?。记得点「保存」。$/, (n, s) => `Uploaded ${plural(n, "file", "files")}${s ? `, skipped ${s}` : ""}. Remember to click “Save”.`],
];

const isCJK = /[㐀-鿿＀-￯　-〿]/;

// Translates one piece of interface text, or returns null when it is unknown.
export function tr(text) {
  if (!text || !isCJK.test(text)) return null;
  if (Object.hasOwn(EXACT, text)) return EXACT[text];
  for (const [re, fn] of TEMPLATES) {
    const m = text.match(re);
    if (m) return fn(...m.slice(1));
  }
  return null;
}

/* ---------- live translation of the page ---------- */
// Containers whose text is the user's own writing.
const SKIP = ".md, pre, code, textarea, .file-pre, .katex, [data-no-tr]";
const ATTRS = ["placeholder", "title", "aria-label"];

function translateText(node) {
  // Some places need a shorter English word than the usual one (data-en="…").
  const own = node.parentElement?.dataset.en;
  if (own) { if (node.nodeValue !== own) node.nodeValue = own; return; }
  const raw = node.nodeValue;
  const core = raw.trim();
  if (!core || !isCJK.test(core) || node.parentElement?.closest(SKIP)) return;
  const out = tr(core);
  if (out != null && out !== core) node.nodeValue = raw.replace(core, out);
}

function translateElement(el) {
  if (el.closest?.(SKIP)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v && isCJK.test(v)) {
      const out = tr(v.trim());
      if (out != null) el.setAttribute(a, out);
    }
  }
}

function translateTree(root) {
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) translateText(n);
    else translateElement(n);
  }
}

// Starts translating the page (English only); returns a function that maps a single string.
export function startTranslation() {
  if (getLang() !== "en") return (s) => s;
  document.documentElement.lang = "en";
  translateTree(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") translateText(r.target);
      else if (r.type === "attributes") translateElement(r.target);
      else r.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return (s) => tr(s) ?? s;
}
