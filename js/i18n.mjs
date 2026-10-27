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
  "张卡片": "cards", "篇本月": "this month", "次回顾": "reviews", "条待解决": "unresolved", "篇在读": "reading",
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
