// Pages for practice logs (实操记录). Shared helpers come from app.mjs through `ctx`.
import * as L from "./lab.mjs";
import { kindIcon } from "./palette.mjs";
import * as M from "./model.mjs";

export function createLab(ctx) {
  const { state, $, $$, h, renderMarkdown, renderInline, toast, confirmDialog, copyText, typesetMath, store } = ctx;
  const main = $("#main");
  state.logs = L.emptyIndex();
  state.logCache = new Map();
  state.labFilter = { query: "", tag: "", project: "", status: "" };

  /* ---------- data ---------- */
  async function loadLogs() {
    state.logs = L.normalizeIndex(await ctx.readData(L.LOGS_INDEX_PATH).catch(() => null));
    // Logs this device just saved may not be on the static site yet.
    const recent = (store.get("pc-recent-logs") || []).filter((r) => Date.now() - r.at < 15 * 60 * 1000);
    for (const r of recent) {
      const known = state.logs.logs.find((x) => x.id === r.summary.id);
      state.logs.logs = state.logs.logs.filter((x) => x.id !== r.summary.id);
      if (!r.removed) state.logs.logs.push(known && (known.updatedAt || "") >= (r.summary.updatedAt || "") ? known : r.summary);
    }
    state.logs = L.normalizeIndex(state.logs);
    store.set("pc-recent-logs", recent);
  }

  function rememberRecent(summary, removed = false) {
    const recent = (store.get("pc-recent-logs") || []).filter((r) => r.summary.id !== summary.id);
    recent.push({ at: Date.now(), summary, removed });
    store.set("pc-recent-logs", recent);
  }

  async function getLog(id) {
    if (state.logCache.has(id)) return state.logCache.get(id);
    const raw = await ctx.readData(L.LOG_DIR + id + ".json");
    const log = raw ? L.normalizeLog(raw) : null;
    if (log) state.logCache.set(id, log);
    return log;
  }

  // One commit: the log, the logs index and any images.
  async function saveLog(log, message, extraFiles = []) {
    const now = new Date().toISOString();
    const saved = { ...log, updatedAt: now, createdAt: log.createdAt || now };
    await state.gh.commitLatest(async (head) => {
      const index = L.normalizeIndex(await state.gh.readJSON(L.LOGS_INDEX_PATH, head));
      return {
        message,
        files: [
          { path: L.LOG_DIR + log.id + ".json", text: JSON.stringify(saved, null, 2) + "\n" },
          { path: L.LOGS_INDEX_PATH, text: JSON.stringify(L.upsertIndex(index, saved, now), null, 1) + "\n" },
          ...extraFiles,
        ],
      };
    });
    state.logCache.set(saved.id, saved);
    state.logs = L.upsertIndex(state.logs, saved, now);
    rememberRecent(L.summarize(saved));
    return saved;
  }

  /* ---------- shared bits ---------- */
  const sym = (type) => `<span class="mark-sym s${L.STEPS.findIndex((x) => x.type === type)}" title="${L.stepLabel(type)}">${type}</span>`;
  const md = (images) => (text) => renderMarkdown(text, { shiftHeadings: 2, resolveImage: (src) => images?.[src] || "" });
  const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
  const paperOf = (id) => state.index.cards.find((x) => x.id === id);
  // Uploaded code files are served by the site at their repository path.
  const fileUrl = (path) => path.split("/").map(encodeURIComponent).join("/");
  const relOf = (path) => path.replace(/^code\/[^/]+\//, "");
  async function fileText(path) {
    const res = await fetch(fileUrl(path) + "?v=" + Date.now(), { cache: "no-store" }).catch(() => null);
    if (res?.ok) return res.text();
    // Just uploaded: the site has not rebuilt yet, but GitHub already has it.
    if (state.gh.unlocked) { const text = await state.gh.readText(path); if (text != null) return text; }
    throw new Error("暂时读不到这个文件。刚上传的文件要等网站更新（约 1 分钟）。");
  }

  // Pasted code without ``` fences still keeps its indentation.
  const codeMd = (text) => (/```/.test(text) ? text : "```\n" + text.replace(/\n+$/, "") + "\n```");

  /* ---------- home ---------- */
  async function home() {
    const logs = state.logs.logs;
    state.labFilter.sort ||= store.get("pc-sort-logs") || "date";
    const s = L.stats(logs);
    const f = state.labFilter;
    main.innerHTML = `
      <div class="sheet hero">
        <div class="hero-head"><span class="hero-icon">${kindIcon("log")}</span><div><h1 class="site-title">实操记录</h1>
        <p class="site-sub">动手做过的记下来，踩过的坑下次不再踩。</p></div></div>
        <div class="home-actions">
          <p class="due-none">${s.open ? `还有 ${s.open} 条待解决的问题。` : logs.length ? "写代码、跑实验、做练习时，开一条记录随手记。" : "第一次用：点「新建一条记录」，开始时写目标，过程中随手记，做完写结论。"}</p>
          <a class="btn primary" href="#/lab/new">新建一条记录</a></div>
        ${logs.length ? `<div class="stats">
          <span class="stat"><b>${s.total}</b>条记录</span>
          <span class="stat"><b>${s.doing}</b>条进行中</span>
          <span class="stat"><b>${s.thisMonth}</b>条本月</span>
          <span class="stat"><b>${s.hours}</b>小时</span>
          ${s.open ? `<span class="stat"><b>${s.open}</b>条待解决</span>` : ""}
        </div>` : ""}
      </div>
      <section aria-label="全部实操记录">
        <div class="filters">
          <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <span class="visually-hidden">搜索记录</span><input type="search" id="lq" placeholder="搜索标题、结论、命令、报错…" value="${h(f.query)}"></label>
          <label><span class="visually-hidden">按状态筛选</span><select class="inline" id="lstatus">
            ${[["", "全部状态"], ["doing", "进行中"], ["done", "完成"], ["open", "有待解决的"]].map(([v, t]) => `<option value="${v}"${f.status === v ? " selected" : ""}>${t}</option>`).join("")}
          </select></label>
          ${L.projectList(logs).length ? `<label><span class="visually-hidden">按项目筛选</span><select class="inline" id="lproj"><option value="">全部项目</option>${L.projectList(logs).map(([p, n]) => `<option value="${h(p)}"${f.project === p ? " selected" : ""}>${h(p)}（${n}）</option>`).join("")}</select></label>` : ""}
          ${ctx.sortSelect("lsort", L.LOG_SORTS, f.sort)}
        </div>
        <div class="chips" id="ltags"></div>
        <div class="log-list" id="llist"></div>
      </section>`;
    $("#lq").addEventListener("input", (e) => { f.query = e.target.value; renderList(); });
    $("#lstatus").addEventListener("change", (e) => { f.status = e.target.value; renderList(); });
    $("#lproj")?.addEventListener("change", (e) => { f.project = e.target.value; renderList(); });
    $("#lsort").addEventListener("change", (e) => { f.sort = e.target.value; store.set("pc-sort-logs", e.target.value); renderList(); });
    renderTags();
    renderList();
  }

  function renderTags() {
    const box = $("#ltags");
    box.innerHTML = L.tagCounts(state.logs.logs).slice(0, 24)
      .map(([t, n]) => `<button type="button" class="chip" aria-pressed="${state.labFilter.tag === t}" data-tag="${h(t)}">#${h(t)}<span class="n">${n}</span></button>`).join("");
    $$("[data-tag]", box).forEach((b) => (b.onclick = () => {
      state.labFilter.tag = state.labFilter.tag === b.dataset.tag ? "" : b.dataset.tag;
      renderTags();
      renderList();
    }));
  }

  function renderList() {
    const box = $("#llist");
    const all = state.logs.logs;
    const sort = state.labFilter.sort;
    const list = L.sortLogs(L.search(all, state.labFilter), sort);
    if (!all.length) return (box.innerHTML = `<p class="empty">还没有记录。</p>`);
    if (!list.length) return (box.innerHTML = `<p class="empty">没有找到匹配的记录。换个关键词，或清除筛选。</p>`);
    // Month headings only make sense when the list is in date order.
    if (sort !== "date" && sort !== "date-asc") return (box.innerHTML = list.map(rowHtml).join(""));
    const groups = new Map();
    for (const x of list) {
      const key = (x.date || "0000-00").slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    }
    box.innerHTML = [...groups].map(([month, items]) => {
      const [y, m] = month.split("-").map(Number);
      const hours = Math.round(items.reduce((t, x) => t + (x.hours || 0), 0) * 10) / 10;
      return `<div class="week-head"><h2>${y ? `${y} 年 ${m} 月` : "未写日期"}</h2><span class="muted">${items.length} 条${hours ? " · " + hours + " 小时" : ""}</span></div>` + items.map(rowHtml).join("");
    }).join("");
  }

  function rowHtml(x) {
    const d = x.date ? day(x.date) : null;
    const facts = [`<span class="status s-${x.status === "done" ? "done" : "reading"}">${L.STATUS_LABELS[x.status]}</span>`];
    if (x.project) facts.push(`<span>${h(x.project)}</span>`);
    if (x.hours) facts.push(`<span>${x.hours} 小时</span>`);
    if (x.errors) facts.push(`<span>✗ ${x.errors} 次报错</span>`);
    if (x.open) facts.push(`<span class="todo-tag">待解决 ${x.open}</span>`);
    if (x.tags.length) facts.push(`<span class="tags">${x.tags.map((t) => "#" + h(t)).join(" ")}</span>`);
    return `<a class="entry-row" href="#/lab/e/${h(x.id)}">
      <div class="d"><b>${d ? d.d : "–"}</b><small>${d ? d.m + " 月" : ""}</small></div>
      <div><h3>${x.title ? h(x.title) : '<span class="untitled">未写标题</span>'}</h3>
        ${x.conclusion ? `<p>${h(x.conclusion)}</p>` : ""}
        <div class="facts">${facts.join("")}</div></div>
    </a>`;
  }

  /* ---------- detail ---------- */
  function bodyHtml(l, images) {
    const m = md(images);
    const sec = (title, body) => (body ? `<section class="section"><h2>${title}</h2>${body}</section>` : "");
    const text = (v) => (v.trim() ? `<div class="md">${m(v)}</div>` : "");
    const steps = l.steps.length
      ? `<ol class="step-view">${l.steps.map((s) => `<li>${s.time ? `<span class="time">${h(s.time)}</span>` : `<span class="time"></span>`}${sym(s.type)}<span>${renderInline(s.text)}${s.solve ? (s.answer ? ` <span class="solved-tick" title="已解决">✓</span>` : ` <span class="todo-tag">待解决</span>`) : ""}</span></li>`).join("")}</ol>`
      : "";
    const flagged = l.steps.filter((s) => s.solve);
    const fixes = flagged.length || l.fixes.trim()
      ? (flagged.length ? `<ul class="solve-view">${flagged.map((s) => `<li><div class="q">${sym(s.type)}<span>${renderInline(s.text)}</span></div><div class="a">${s.answer ? renderInline(s.answer) : '<span class="muted">还没解决</span>'}</div></li>`).join("")}</ul>` : "") + text(l.fixes)
      : "";
    const papers = l.papers.map(paperOf).filter(Boolean);
    return (l.conclusion ? `<section class="one-line"><h2 class="sec-label">结论</h2><div class="sec-body"><p>${h(l.conclusion)}</p></div></section>` : "") +
      sec("过程", steps) +
      sec("问题与解决", fixes) +
      sec("关键代码 / 命令", l.code.trim() ? `<div class="md">${m(codeMd(l.code))}</div>` : "") +
      filesHtml(l) +
      sec("结果", text(l.results)) +
      sec("下次要做", text(l.next)) +
      sec("相关论文", papers.length ? `<ul class="link-list">${papers.map((p) => `<li><a href="#/c/${h(p.id)}">${h(p.title || p.id)}</a>${p.oneLine ? `<p>${h(p.oneLine)}</p>` : ""}</li>`).join("")}</ul>` : "") +
      sec("笔记", text(l.notes));
  }

  function filesHtml(l) {
    if (!l.files.length) return "";
    const branch = state.site.branch || "main";
    const total = l.files.reduce((t, f) => t + (f.size || 0), 0);
    return `<section class="section files-section"><div class="sec-head"><h2>代码文件</h2>
        <span class="muted small">${l.files.length} 个 · ${L.formatSize(total)} · <a href="https://github.com/${h(state.gh.repo)}/tree/${h(branch)}/code/${h(l.id)}" target="_blank" rel="noopener">在 GitHub 上查看</a></span></div>
      <ul class="file-view">${l.files.map((f, i) => `<li>
        <div class="file-row"><span class="fname" title="${h(f.path)}">${h(relOf(f.path))}</span><span class="muted small">${L.formatSize(f.size)}</span>
          ${L.isTextFile(f.path) ? `<button type="button" class="btn quiet small" data-view-file="${i}" aria-expanded="false">查看</button>` : ""}
          <a class="btn quiet small" href="${h(fileUrl(f.path))}" download="${h(f.path.split("/").pop())}">下载</a></div>
        <pre class="file-pre" hidden><code></code></pre></li>`).join("")}</ul></section>`;
  }

  // "查看" loads a text file on demand and shows it under its row.
  function bindFiles(root, l) {
    root.onclick = async (e) => {
      const btn = e.target.closest("[data-view-file]");
      if (!btn) return;
      const f = l.files[+btn.dataset.viewFile];
      const pre = btn.closest("li").querySelector(".file-pre");
      const open = pre.hidden;
      pre.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "收起" : "查看";
      if (!open || pre.dataset.loaded) return;
      const code = pre.querySelector("code");
      code.textContent = "正在读取…";
      try {
        let text = await fileText(f.path);
        if (/\.ipynb$/i.test(f.path)) { try { text = L.notebookText(text); } catch {} }
        code.textContent = text.length > 300000 ? text.slice(0, 300000) + "\n\n…（文件太长，只显示前 300 KB，完整内容请下载）" : text;
        const ext = (f.path.match(/\.(\w+)$/) || [])[1];
        if (ext) code.className = "lang-" + (ext === "ipynb" ? "python" : ext.toLowerCase());
        pre.dataset.loaded = "1";
        typesetMath(pre);
      } catch (error) {
        code.textContent = error.message;
      }
    };
  }

  function headHtml(l) {
    const meta = [`<span class="status s-${l.status === "done" ? "done" : "reading"}">${L.STATUS_LABELS[l.status]}</span>`];
    if (l.date) { const d = day(l.date); meta.push(`<span>${d.y} 年 ${d.m} 月 ${d.d} 日</span>`); }
    if (l.hours != null) meta.push(`<span>用时 ${l.hours} 小时</span>`);
    if (l.project) meta.push(`<span>项目：${h(l.project)}</span>`);
    if (l.tags.length) meta.push(`<span>${l.tags.map((t) => "#" + h(t)).join(" ")}</span>`);
    const cite = [l.env && h(l.env), l.link && `<a href="${h(M.paperHref(l.link))}" target="_blank" rel="noopener">代码链接</a>`].filter(Boolean).join(" · ");
    return `<div class="meta-line">${meta.join("")}</div>
      <h1 class="card-title">${l.title ? h(l.title) : '<span class="untitled">未写标题</span>'}</h1>
      ${cite ? `<p class="cite">${cite}</p>` : ""}
      ${l.goal ? `<p class="why"><b>目标：</b>${h(l.goal)}</p>` : ""}`;
  }

  async function view(id) {
    if (!M.validId(id)) return home();
    main.innerHTML = `<p class="loading">正在打开记录…</p>`;
    const l = await getLog(id);
    if (!l) {
      main.innerHTML = `<div class="sheet"><h1>找不到这条记录</h1><p>它可能刚保存、网站还没更新，或者已经删除了。</p><div class="btn-row"><a class="btn" href="#/lab">回到实操记录</a></div></div>`;
      return;
    }
    main.innerHTML = `
      <div class="toolbar">
        <a class="btn quiet" href="#/lab">← 全部记录</a>
        <div class="btn-row"><button class="btn quiet" id="copyLog">复制 Markdown</button><a class="btn" href="#/lab/edit/${h(id)}">编辑</a></div>
      </div>
      <article class="sheet log-page">${headHtml(l)}${bodyHtml(l)}</article>`;
    $("#copyLog").onclick = () => copyText(L.logToMarkdown(l, new Map(state.index.cards.map((x) => [x.id, x.title]))));
    bindFiles($(".log-page"), l);
    typesetMath(main);
  }

  // Shown on a paper card's page: practice logs that list it under 相关论文.
  function relatedHtml(cardId) {
    const logs = L.logsForPaper(state.logs.logs, cardId);
    if (!logs.length) return "";
    return `<section class="section"><h2>相关实操记录</h2><ul class="link-list">${logs
      .map((x) => `<li><a href="#/lab/e/${h(x.id)}">${h(x.title || x.id)}</a>${x.conclusion ? `<p>${h(x.conclusion)}</p>` : ""}</li>`).join("")}</ul></section>`;
  }

  /* ---------- editor ---------- */
  async function edit(id) {
    const isNew = !id;
    if (!isNew && !M.validId(id)) return home();
    main.innerHTML = `<p class="loading">正在打开编辑器…</p>`;
    const existing = isNew ? null : await getLog(id).catch(() => null);
    if (!isNew && !existing) {
      main.innerHTML = `<div class="sheet"><h1>找不到这条记录</h1><p>它可能刚保存、网站还没更新。稍等一分钟再试。</p><div class="btn-row"><a class="btn" href="#/lab">回到实操记录</a></div></div>`;
      return;
    }
    const draftKey = "pc-logdraft-" + (id || "new");
    const draft = store.get(draftKey);
    let log = null;
    let images = {};
    let restored = false;
    // A new log that already has uploaded code keeps the id its files were stored under.
    let pendingId = "";
    if (draft && (!existing || (draft.savedAt || "") > (existing.updatedAt || ""))) {
      try {
        log = L.normalizeLog({ ...draft.log, id: id || "00000000-new-0000" });
        images = draft.images || {};
        pendingId = isNew && M.validId(draft.pendingId) ? draft.pendingId : "";
        restored = true;
      } catch { log = null; }
    }
    if (!log) log = existing ? structuredClone(existing) : L.newLog(M.todayISO());
    const projects = L.projectList(state.logs.logs).map(([p]) => p);
    const allTags = L.tagCounts(state.logs.logs).map(([t]) => t);
    const tools = ctx.mdTools;

    main.innerHTML = `
      <div class="toolbar">
        <a class="btn quiet" href="${existing ? "#/lab/e/" + h(id) : "#/lab"}">← 返回</a>
        <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="edit">编辑</button><button role="tab" aria-selected="false" data-tab="preview">预览</button></div>
      </div>
      ${restored ? `<div class="banner warn"><span>已恢复这台设备上还没保存的草稿。</span><button class="btn quiet" id="discardDraft">放弃草稿</button></div>` : ""}
      ${!state.gh.unlocked ? `<div class="banner"><span>你可以先写，保存时再输入密码。草稿会自动保存在这台设备上。</span></div>` : ""}
      <form class="sheet" id="editor" autocomplete="off">
        <label class="field"><span class="visually-hidden">标题</span><input class="title-input" name="title" maxlength="200" placeholder="这次做了什么"></label>
        <div class="meta-grid">
          <label class="field"><span>日期</span><input name="date" type="date"></label>
          <label class="field"><span>用时（小时）</span><input name="hours" type="number" min="0" max="200" step="0.5" inputmode="decimal" placeholder="可以留空"></label>
          <label class="field"><span>项目</span><input name="project" list="lprojList" maxlength="60" placeholder="可以留空"></label>
          <label class="field"><span>标签</span><input name="tags" list="ltagList" placeholder="用逗号分开"></label>
          <label class="field"><span>环境 / 工具</span><input name="env" maxlength="200" placeholder="语言、框架、硬件等"></label>
          <label class="field"><span>代码链接</span><input name="link" maxlength="500" placeholder="仓库、提交或笔记本的网址"></label>
          <div class="field"><span class="label" id="lstatusLabel">状态</span><div class="seg" role="group" aria-labelledby="lstatusLabel">
            <button type="button" data-status="doing">进行中</button><button type="button" data-status="done">完成</button></div></div>
        </div>
        <div class="pdf-field"><span class="label">代码文件</span>
          <div class="btn-row"><button type="button" class="btn small" id="pickFiles">上传文件</button><button type="button" class="btn small" id="pickFolder">上传文件夹</button><span class="muted small" id="uploadState"></span></div>
          <ul class="file-edit" id="fileList"></ul>
          <p class="hint small">文件马上存进 GitHub 仓库的 code/ 文件夹，之后在记录页可以查看和下载；同名文件再传会覆盖。仓库是公开的，会自动跳过 .env、密钥文件、node_modules、.git 等。单个文件最大 25 MB，一次最多 200 个文件、共 100 MB。</p>
          <input type="file" id="filePick" multiple hidden><input type="file" id="folderPick" webkitdirectory multiple hidden></div>
        <datalist id="lprojList">${projects.map((p) => `<option value="${h(p)}">`).join("")}</datalist>
        <datalist id="ltagList">${allTags.map((t) => `<option value="${h(t)}">`).join("")}</datalist>

        <section class="stage"><h2><span class="stage-n">1</span>开始前</h2>
          <label class="field"><span>目标（一行）</span><input name="goal" maxlength="300" placeholder="这次想做成什么、验证什么"></label></section>

        <section class="stage"><h2><span class="stage-n">2</span>过程中</h2>
          <p class="hint">随手记，每条自动记下时间。选一个符号，写几个字，回车记下一条。卡住的问题勾上「待解决」，做完后在下面写怎么解决的。</p>
          <div class="mark-input">
            <div class="mark-types"><div class="mark-kinds" role="radiogroup" aria-label="记录类型">${L.STEPS.map((s, k) => `<button type="button" role="radio" class="s${k}" data-type="${s.type}" aria-checked="${k === 0}"><b>${s.type}</b>${s.label}</button>`).join("")}</div>
              <div class="mark-opts"><label class="solve-flag"><input type="checkbox" id="stepSolve"> 待解决</label><div class="fmt-pair"><button type="button" class="fmt" data-fmt="**" data-for="stepText" title="加粗（⌘/Ctrl + B）" aria-label="加粗"><b>B</b></button><button type="button" class="fmt" data-fmt="*" data-for="stepText" title="斜体（⌘/Ctrl + I）" aria-label="斜体"><i>I</i></button>${ctx.imageButton("stepText")}</div></div></div>
            <div class="mark-line"><textarea class="input grow" id="stepText" rows="1" maxlength="500" placeholder="做了什么、看到什么，回车记下；命令可用 \`反引号\` 包住" aria-label="过程记录" enterkeyhint="done"></textarea><button type="button" class="btn" id="addStep">记下</button></div>
          </div>
          <ol class="marks-list" id="steps"></ol></section>

        <section class="stage"><h2><span class="stage-n">3</span>做完后</h2>
          <div class="esec"><h3>结论</h3><p class="hint">一句话：做成了什么、学到了什么。</p>
            <textarea class="textarea one" name="conclusion" rows="2" maxlength="400" placeholder="一句话总结这次的结果"></textarea></div>
          <div class="esec"><h3>问题与解决</h3><p class="hint">勾了「待解决」的记录列在这里，写下怎么解决的；没解决就留空。</p>
            <p class="small" id="fixCount"></p>
            <ol class="solve-list" id="fixList"></ol>
            <textarea class="textarea" name="fixes" rows="3" placeholder="其他遇到的问题和解决办法" style="margin-top:10px"></textarea>${tools("fixes")}</div>
          <div class="esec"><h3>关键代码 / 命令</h3><p class="hint">值得留下的代码或命令，直接粘贴即可。</p>
            <textarea class="textarea code" name="code" rows="6" spellcheck="false" placeholder="代码或命令"></textarea></div>
          <div class="esec"><h3>结果</h3><textarea class="textarea" name="results" rows="3" placeholder="指标、输出、截图"></textarea>${tools("results", true)}</div>
          <div class="esec"><h3>下次要做</h3><textarea class="textarea" name="next" rows="3" placeholder="接下来要做或要改的"></textarea>${tools("next")}</div>
          <div class="esec"><h3>相关论文</h3><p class="hint">这次实践对应的论文卡片，两边都会显示。</p>
            <div class="link-chosen" id="paperChosen"></div>
            ${state.index.cards.length ? `<div class="link-search"><input class="input" id="paperSearch" placeholder="输入论文标题或关键词…" autocomplete="off" aria-label="搜索论文卡片"><div class="link-results" id="paperResults"></div></div>` : `<p class="muted small">还没有论文卡片。</p>`}</div>
        </section>

        <section class="stage"><h2><span class="stage-n">+</span>笔记</h2>
          <p class="hint">任何想记的，支持 Markdown、公式 $…$ 和图片。</p>
          <textarea class="textarea" name="notes" rows="5"></textarea>${tools("notes", true)}</section>
      </form>
      <div class="sheet" id="preview" hidden></div>
      <div class="editor-bar">
        <div class="bar-state"><b id="progress"></b><span class="save-state" id="saveState">${restored ? "草稿已恢复" : "草稿自动保存在这台设备"}</span></div>
        <div class="btn-row">
          ${existing ? `<button type="button" class="btn quiet danger" id="deleteLog">删除</button>` : ""}
          <button type="button" class="btn primary" id="publish">保存</button>
        </div>
      </div>`;

    const form = $("#editor");
    for (const k of ["title", "date", "project", "env", "link", "goal", "conclusion", "fixes", "code", "results", "next", "notes"]) form[k].value = log[k] ?? "";
    form.hours.value = log.hours ?? "";
    form.tags.value = log.tags.join(", ");

    let status = log.status;
    const paintStatus = () => $$("[data-status]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === status)));
    paintStatus();
    $$("[data-status]").forEach((b) => (b.onclick = () => { status = b.dataset.status; paintStatus(); changed(); }));

    // Steps
    let stepType = L.STEPS[0].type;
    const typeIndex = (t) => L.STEPS.findIndex((s) => s.type === t);
    const stepRow = (s) =>
      `<li data-row="step"><button type="button" class="mark-sym s${typeIndex(s.type)}" data-type="${s.type}" title="${L.stepLabel(s.type)}（点一下换符号）">${s.type}</button><input class="input page" data-k="time" value="${h(s.time)}" placeholder="时间" aria-label="时间" maxlength="5"><textarea class="input grow" data-k="text" rows="1" maxlength="500" aria-label="记录内容">${h(s.text)}</textarea><input type="hidden" data-k="answer" value="${h(s.answer || "")}"><label class="row-flag" title="待解决：勾上后出现在「问题与解决」里"><input type="checkbox" data-k="solve"${s.solve ? " checked" : ""}><span>待解决</span></label><button type="button" class="x" aria-label="删除">×</button></li>`;
    $("#steps").innerHTML = log.steps.map(stepRow).join("");
    const paintTypes = () => $$(".mark-kinds [data-type]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === stepType)));
    $$(".mark-kinds [data-type]").forEach((b) => (b.onclick = () => { stepType = b.dataset.type; paintTypes(); $("#stepText").focus(); }));
    const addStep = () => {
      const text = $("#stepText").value.trim();
      if (!text) return $("#stepText").focus();
      $("#steps").insertAdjacentHTML("beforeend", stepRow({ type: stepType, time: L.nowTime(), text, solve: $("#stepSolve").checked }));
      $("#stepText").value = "";
      ctx.growBox($("#stepText"));
      $("#stepSolve").checked = false; // flag each unsolved step on its own
      $("#stepText").focus();
      renderFixes();
      changed();
    };
    $("#addStep").onclick = addStep;
    $("#stepText").addEventListener("keydown", (e) => { if (ctx.plainEnter(e)) { e.preventDefault(); addStep(); } });

    // 问题与解决: one answer box per step flagged 待解决.
    let fixRows = [];
    const paintFixCount = () => {
      const open = fixRows.filter((r) => !$("[data-k=answer]", r).value.trim()).length;
      $("#fixCount").textContent = fixRows.length ? (open ? `还有 ${open} 条待解决，已解决 ${fixRows.length - open} 条。` : `${fixRows.length} 条都解决了。`) : "";
    };
    function renderFixes() {
      fixRows = $$("#steps [data-row]").filter((r) => $("[data-k=solve]", r).checked);
      $("#fixList").innerHTML = fixRows.length
        ? fixRows.map((r, i) => `<li><div class="q">${sym($(".mark-sym", r).dataset.type)}<span>${renderInline($("[data-k=text]", r).value)}</span></div>
            <textarea class="input grow" data-solve="${i}" rows="1" maxlength="2000" placeholder="怎么解决的，没解决就留空" aria-label="解决办法">${h($("[data-k=answer]", r).value)}</textarea></li>`).join("")
        : `<li class="muted small">还没有勾「待解决」的记录。</li>`;
      paintFixCount();
    }
    renderFixes();
    $("#fixList").addEventListener("input", (e) => {
      const row = fixRows[e.target.dataset.solve];
      if (row) { $("[data-k=answer]", row).value = e.target.value; paintFixCount(); }
    });
    $("#steps").addEventListener("input", renderFixes);
    $("#steps").addEventListener("click", (e) => {
      const s = e.target.closest(".mark-sym");
      if (!s) return;
      const next = L.STEPS[(typeIndex(s.dataset.type) + 1) % L.STEPS.length];
      s.dataset.type = next.type;
      s.textContent = next.type;
      s.className = "mark-sym s" + typeIndex(next.type);
      s.title = next.label + "（点一下换符号）";
      renderFixes();
      changed();
    });
    form.addEventListener("click", (e) => {
      const x = e.target.closest(".x");
      if (x) { x.closest("[data-row]").remove(); renderFixes(); changed(); }
      const fmt = e.target.closest(".fmt");
      if (fmt) ctx.wrapSelection(fmt.dataset.for === "stepText" ? $("#stepText") : form[fmt.dataset.for], fmt.dataset.fmt);
    });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("input") && !e.target.closest(".mark-input")) e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && /^[bi]$/i.test(e.key) && e.target.matches("#stepText, [data-k=text], [data-solve], textarea:not(.one):not(.code)")) {
        e.preventDefault();
        ctx.wrapSelection(e.target, e.key.toLowerCase() === "b" ? "**" : "*");
      }
      // Tab indents inside the code box instead of leaving it.
      if (e.key === "Tab" && !e.shiftKey && e.target.matches("textarea.code")) {
        e.preventDefault();
        e.target.setRangeText("  ", e.target.selectionStart, e.target.selectionEnd, "end");
        changed();
      }
    });

    // 相关论文: chips plus search over paper cards.
    let papers = [...log.papers];
    const paintPapers = () => {
      $("#paperChosen").innerHTML = papers.map((x) => `<span class="link-chip">${h(paperOf(x)?.title || x)}<button type="button" class="unlink" data-unpaper="${h(x)}" aria-label="取消关联">×</button></span>`).join("");
    };
    const paintPaperResults = () => {
      const box = $("#paperResults");
      if (!box) return;
      const q = $("#paperSearch").value.trim().toLowerCase();
      const focused = document.activeElement === $("#paperSearch");
      if (!q && !focused) return (box.innerHTML = "");
      const terms = q.split(/\s+/).filter(Boolean);
      const list = state.index.cards
        .filter((x) => !papers.includes(x.id) && terms.every((t) => (x.title + " " + x.authors + " " + x.oneLine + " " + x.tags.join(" ")).toLowerCase().includes(t)))
        .slice(0, 6);
      box.innerHTML = list.length
        ? (q ? "" : `<p class="muted small">最近的卡片：</p>`) + list.map((x) => `<button type="button" class="link-result" data-paper="${h(x.id)}"><b>${h(x.title || x.id)}</b>${x.oneLine ? `<span>${h(x.oneLine)}</span>` : ""}</button>`).join("")
        : q ? `<p class="muted small">没有找到匹配的卡片。</p>` : "";
    };
    paintPapers();
    $("#paperSearch")?.addEventListener("input", paintPaperResults);
    $("#paperSearch")?.addEventListener("focus", paintPaperResults);
    $("#paperSearch")?.addEventListener("blur", () => setTimeout(paintPaperResults, 200));
    $("#paperResults")?.addEventListener("pointerdown", (e) => e.preventDefault());
    form.addEventListener("click", (e) => {
      const add = e.target.closest("[data-paper]");
      const remove = e.target.closest("[data-unpaper]");
      if (!add && !remove) return;
      if (add) { papers.push(add.dataset.paper); $("#paperSearch").value = ""; }
      else papers = papers.filter((x) => x !== remove.dataset.unpaper);
      paintPapers();
      paintPaperResults();
      changed();
    });

    ctx.enableImages(form, images);

    // Code files: uploaded to the repository right away so they are never lost.
    let files = [...log.files];
    const uploadedPaths = new Set();
    const codeId = () => {
      if (!isNew) return id;
      pendingId ||= L.newLogId(form.date.value || M.todayISO(), form.title.value);
      return pendingId;
    };
    const paintFiles = () => {
      $("#fileList").innerHTML = files
        .map((f) => `<li><span class="fname" title="${h(f.path)}">${h(relOf(f.path))}</span><span class="muted small">${L.formatSize(f.size)}</span><button type="button" class="unlink" data-unfile="${h(f.path)}" aria-label="移除">×</button></li>`)
        .join("");
    };
    paintFiles();
    $("#pickFiles").onclick = () => $("#filePick").click();
    $("#pickFolder").onclick = () => $("#folderPick").click();
    const upload = async (event) => {
      const picked = [...event.target.files];
      event.target.value = "";
      if (!picked.length) return;
      if (!(await ctx.ensureUnlocked())) return;
      const skipped = [];
      const chosen = [];
      let total = 0;
      for (const f of picked) {
        const rel = L.cleanRelPath(f.webkitRelativePath || f.name);
        const why = !rel ? "文件名无效" : L.skipReason(rel) || (f.size > L.FILE_MAX_BYTES ? "超过 25 MB" : "");
        if (why || chosen.length >= L.UPLOAD_MAX_FILES || total + f.size > L.UPLOAD_MAX_BYTES) { skipped.push(rel || f.name); continue; }
        total += f.size;
        chosen.push({ f, rel });
      }
      if (!chosen.length) return toast(`没有可上传的文件（跳过了 ${skipped.length} 个：依赖、缓存、密钥或过大）。`, "error");
      const dir = L.CODE_DIR + codeId() + "/";
      const buttons = [$("#pickFiles"), $("#pickFolder")];
      buttons.forEach((b) => (b.disabled = true));
      $("#uploadState").textContent = `正在上传 ${chosen.length} 个文件（${L.formatSize(total)}）…`;
      try {
        const out = [];
        for (const { f, rel } of chosen) out.push({ path: dir + rel, size: f.size, base64: await ctx.fileToBase64(f) });
        await state.gh.commitLatest(async () => ({
          message: `上传代码 ${out.length} 个文件` + (form.title.value ? "：" + form.title.value.slice(0, 50) : ""),
          files: out.map(({ path, base64 }) => ({ path, base64 })),
        }));
        for (const o of out) {
          uploadedPaths.add(o.path);
          files = files.filter((x) => x.path !== o.path);
          files.push({ path: o.path, size: o.size });
        }
        files.sort((a, b) => a.path.localeCompare(b.path));
        paintFiles();
        changed();
        toast(`已上传 ${out.length} 个文件` + (skipped.length ? `，跳过 ${skipped.length} 个（依赖、缓存、密钥或过大）` : "") + "。记得点「保存」。");
      } catch (error) {
        console.error(error);
        toast("上传失败：" + error.message, "error");
      } finally {
        buttons.forEach((b) => (b.disabled = false));
        $("#uploadState").textContent = "";
      }
    };
    $("#filePick").onchange = upload;
    $("#folderPick").onchange = upload;
    form.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-unfile]");
      if (!rm) return;
      files = files.filter((f) => f.path !== rm.dataset.unfile);
      paintFiles();
      changed();
    });

    const collect = () =>
      L.normalizeLog({
        ...log,
        title: form.title.value,
        date: form.date.value,
        status,
        hours: form.hours.value === "" ? null : form.hours.value,
        project: form.project.value,
        tags: form.tags.value,
        env: form.env.value,
        link: form.link.value,
        goal: form.goal.value,
        steps: $$("#steps [data-row]").map((r) => ({ type: $(".mark-sym", r).dataset.type, time: $("[data-k=time]", r).value.trim(), text: $("[data-k=text]", r).value, solve: $("[data-k=solve]", r).checked, answer: $("[data-k=answer]", r).value })),
        conclusion: form.conclusion.value,
        fixes: form.fixes.value,
        code: form.code.value,
        results: form.results.value,
        next: form.next.value,
        papers,
        files,
        notes: form.notes.value,
      });

    const paintProgress = () => {
      const l = collect();
      const open = L.openSteps(l).length;
      $("#progress").textContent = `${l.steps.length} 条过程记录` + (open ? ` · 待解决 ${open}` : "");
    };
    paintProgress();

    let saveTimer;
    const saveDraft = () => store.set(draftKey, { log: collect(), images, pendingId, savedAt: new Date().toISOString() });
    function changed() {
      ctx.setDirty(true);
      paintProgress();
      clearTimeout(saveTimer);
      $("#saveState").textContent = "正在保存草稿…";
      saveTimer = setTimeout(() => {
        if (!form.isConnected) return;
        $("#saveState").textContent = saveDraft() ? "草稿已保存在这台设备" : "这台设备无法保存草稿（存储已满或被禁用）";
      }, 600);
    }
    form.addEventListener("input", changed);
    form.addEventListener("change", changed);
    ctx.setLeave(async () => { clearTimeout(saveTimer); saveDraft(); return true; });
    window.onbeforeunload = () => { if (ctx.isDirty()) saveDraft(); };

    $("#discardDraft")?.addEventListener("click", async () => {
      if (!(await confirmDialog("放弃草稿？", "这台设备上还没保存的修改会被删除。", "放弃草稿", true))) return;
      store.del(draftKey);
      ctx.setDirty(false);
      ctx.route();
    });

    $$("[data-tab]").forEach((tab) => (tab.onclick = () => {
      const preview = tab.dataset.tab === "preview";
      $$("[data-tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      form.hidden = preview;
      const box = $("#preview");
      box.hidden = !preview;
      if (preview) {
        const l = collect();
        box.innerHTML = headHtml(l) + bodyHtml(l, images);
        bindFiles(box, l);
        typesetMath(box);
      }
    }));

    $("#publish").onclick = async () => {
      const draftLog = collect();
      if (!draftLog.title) {
        toast("先写上标题再保存。", "error");
        form.title.focus();
        return;
      }
      if (!(await ctx.ensureUnlocked())) return;
      clearTimeout(saveTimer);
      const btn = $("#publish");
      btn.disabled = true;
      btn.textContent = "正在保存…";
      try {
        const finalId = isNew ? pendingId || L.newLogId(draftLog.date || M.todayISO(), draftLog.title) : id;
        const l = { ...draftLog, id: finalId };
        const uploads = ctx.usedImages(images, l);
        // Code files removed while editing are deleted from the repository too.
        const kept = new Set(l.files.map((f) => f.path));
        const stale = [...new Set([...(existing?.files || []).map((f) => f.path), ...uploadedPaths])].filter((p) => !kept.has(p));
        await saveLog(l, (isNew ? "新增实操记录：" : "更新实操记录：") + l.title.slice(0, 60), [
          ...uploads.map(([path, url]) => ({ path, base64: url.split(",")[1] })),
          ...stale.map((path) => ({ path, remove: true })),
        ]);
        store.del(draftKey);
        ctx.setDirty(false);
        window.onbeforeunload = null;
        if (uploads.length) store.set("pc-imgcache", { ...(store.get("pc-imgcache") || {}), ...Object.fromEntries(uploads) });
        toast("已保存。网站大约 1 分钟后对所有人更新。");
        location.hash = "#/lab/e/" + finalId;
      } catch (error) {
        console.error(error);
        if (error.status === 401) ctx.lock(true);
        toast("保存失败：" + error.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "保存";
      }
    };

    $("#deleteLog")?.addEventListener("click", async () => {
      if (!(await confirmDialog("删除这条记录？", "删除后网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。", "删除", true))) return;
      if (!(await ctx.ensureUnlocked())) return;
      try {
        await state.gh.commitLatest(async (head) => {
          const index = L.normalizeIndex(await state.gh.readJSON(L.LOGS_INDEX_PATH, head));
          return {
            message: "删除实操记录：" + (existing.title || id).slice(0, 60),
            files: [
              { path: L.LOG_DIR + id + ".json", remove: true },
              ...existing.files.map((f) => ({ path: f.path, remove: true })),
              { path: L.LOGS_INDEX_PATH, text: JSON.stringify(L.removeFromIndex(index, id), null, 1) + "\n" },
            ],
          };
        });
        state.logCache.delete(id);
        state.logs = L.removeFromIndex(state.logs, id);
        rememberRecent({ id }, true);
        clearTimeout(saveTimer);
        store.del(draftKey);
        ctx.setDirty(false);
        toast("已删除。");
        location.hash = "#/lab";
      } catch (error) {
        toast("删除失败：" + error.message, "error");
      }
    });
  }

  async function loadAll() {
    return (await Promise.all(state.logs.logs.map((x) => getLog(x.id)))).filter(Boolean);
  }

  return { loadLogs, home, view, edit, relatedHtml, loadAll, clearCache: () => state.logCache.clear() };
}
