// Pages for courses (课程): list, course page, course editor, lesson notes and
// the lesson editor. Shared helpers come from app.mjs through `ctx`.
import * as C from "./course.mjs";
import * as M from "./model.mjs";
import * as L from "./lab.mjs";
import { kindIcon } from "./palette.mjs";

export function createCourses(ctx) {
  const { state, $, $$, h, renderMarkdown, renderInline, toast, confirmDialog, copyText, typesetMath, store } = ctx;
  const main = $("#main");
  state.courses = C.emptyIndex();
  state.courseCache = new Map();
  const filter = { query: "", tag: "", project: "", status: "", sort: store.get("pc-sort-courses") || "recent" };

  /* ---------- data ---------- */
  async function loadCourses() {
    state.courses = C.normalizeIndex(await ctx.readData(C.COURSES_INDEX_PATH).catch(() => null));
    // Courses this device just saved may not be on the static site yet.
    const recent = (store.get("pc-recent-courses") || []).filter((r) => Date.now() - r.at < 15 * 60 * 1000);
    for (const r of recent) {
      const known = state.courses.courses.find((x) => x.id === r.summary.id);
      state.courses.courses = state.courses.courses.filter((x) => x.id !== r.summary.id);
      if (!r.removed) state.courses.courses.push(known && (known.updatedAt || "") >= (r.summary.updatedAt || "") ? known : r.summary);
    }
    state.courses = C.normalizeIndex(state.courses);
    store.set("pc-recent-courses", recent);
  }

  function rememberRecent(summary, removed = false) {
    const recent = (store.get("pc-recent-courses") || []).filter((r) => r.summary.id !== summary.id);
    recent.push({ at: Date.now(), summary, removed });
    store.set("pc-recent-courses", recent);
  }

  async function getCourse(id) {
    if (state.courseCache.has(id)) return state.courseCache.get(id);
    const raw = await ctx.readData(C.COURSE_DIR + id + ".json");
    const course = raw ? C.normalizeCourse(raw) : null;
    if (course) state.courseCache.set(id, course);
    return course;
  }

  // One commit: the course file and the index (plus any images). `change` turns
  // the course found at the branch head into the one to save, so edits made to
  // other lessons on another device are kept. `extraFiles` may be a function,
  // called after `change`.
  async function saveCourse(course, message, change = (latest) => latest, extraFiles = []) {
    const now = new Date().toISOString();
    let saved;
    await state.gh.commitLatest(async (head) => {
      const index = C.normalizeIndex(await state.gh.readJSON(C.COURSES_INDEX_PATH, head));
      const latestRaw = await state.gh.readJSON(C.COURSE_DIR + course.id + ".json", head);
      const base = latestRaw ? C.normalizeCourse(latestRaw) : course;
      saved = { ...change(base), updatedAt: now };
      saved.createdAt ||= now;
      return {
        message,
        files: [
          { path: C.COURSE_DIR + course.id + ".json", text: JSON.stringify(saved, null, 1) + "\n" },
          { path: C.COURSES_INDEX_PATH, text: JSON.stringify(C.upsertIndex(index, saved, now), null, 1) + "\n" },
          ...(typeof extraFiles === "function" ? extraFiles() : extraFiles),
        ],
      };
    });
    state.courseCache.set(saved.id, saved);
    state.courses = C.upsertIndex(state.courses, saved, now);
    rememberRecent(C.summarize(saved));
    return saved;
  }

  /* ---------- shared bits ---------- */
  const sym = (type) => `<span class="mark-sym t${C.MARKS.findIndex((m) => m.type === type)}" title="${C.markLabel(type)}">${type}</span>`;
  const md = (images) => (text) => renderMarkdown(text, { shiftHeadings: 2, resolveImage: (src) => images?.[src] || "" });
  const statusChip = (s) => `<span class="status s-${s === "done" ? "done" : s === "paused" ? "paused" : "reading"}">${C.STATUS_LABELS[s]}</span>`;
  const bar = (done, total) => `<div class="progress" role="img" aria-label="${done} / ${total}"><span style="width:${total ? Math.round((done / total) * 100) : 0}%"></span></div>`;
  const notFound = (what) => {
    main.innerHTML = `<div class="sheet"><h1>${what === "lesson" ? "找不到这一课" : "找不到这门课程"}</h1><p>它可能刚保存、网站还没更新，或者已经删除了。</p><div class="btn-row"><a class="btn" href="#/course">回到全部课程</a></div></div>`;
  };
  const tools = ctx.mdTools;
  const lessonName = (l, i) => l.title || "第 " + (i + 1) + " 课";

  // Materials are served by the site at their repository path.
  const fileUrl = (path) => path.split("/").map(encodeURIComponent).join("/");
  function materialsHtml(l) {
    if (!l.files.length) return "";
    const images = l.files.filter((f) => C.isImageFile(f.path));
    const others = l.files.filter((f) => !C.isImageFile(f.path));
    const total = l.files.reduce((t, f) => t + (f.size || 0), 0);
    return `<section class="section files-section"><div class="sec-head"><h2>课件与资料</h2><span class="muted small">${l.files.length} 个 · ${L.formatSize(total)}</span></div>
      ${others.length ? `<ul class="file-view">${others.map((f) => `<li><div class="file-row"><span class="fname" title="${h(C.materialName(f.path))}">${h(C.materialName(f.path))}</span><span class="muted small">${L.formatSize(f.size)}</span>
        ${C.isPdfFile(f.path) ? `<button type="button" class="btn quiet small" data-preview="${h(fileUrl(f.path))}" aria-expanded="false">预览</button><a class="btn quiet small" href="${h(fileUrl(f.path))}" target="_blank" rel="noopener">打开</a>` : ""}
        <a class="btn quiet small" href="${h(fileUrl(f.path))}" download="${h(C.materialName(f.path))}">下载</a></div><div class="pdf-preview" hidden></div></li>`).join("")}</ul>` : ""}
      ${images.length ? `<div class="material-images">${images.map((f) => `<a href="${h(fileUrl(f.path))}" target="_blank" rel="noopener" title="${h(C.materialName(f.path))}"><img src="${h(fileUrl(f.path))}" alt="${h(C.materialName(f.path))}" loading="lazy"><span>${h(C.materialName(f.path))}</span></a>`).join("")}</div>` : ""}
    </section>`;
  }

  /* ---------- list ---------- */
  async function list() {
    const all = state.courses.courses;
    const s = C.stats(all);
    main.innerHTML = `
      <div class="sheet hero">
        <div class="hero-head"><span class="hero-icon">${kindIcon("course")}</span><div><h1 class="site-title">课程笔记</h1>
        <p class="site-sub">看课时随手记，看完一课写一句话。</p></div></div>
        <div class="home-actions">
          <p class="due-none">${s.open ? `还有 ${s.open} 个待解决的问题。` : all.length ? "边看边记时间点，回看时一眼找到。" : "添加一门课程，列出课时，看每一课时边看边记。"}</p>
          <a class="btn primary" href="#/course/new">添加课程</a></div>
        ${all.length ? `<div class="stats">
          <span class="stat"><b>${s.total}</b>门课程</span>
          <span class="stat"><b>${s.learning}</b>门在学</span>
          <span class="stat"><b>${s.finished}</b>门学完</span>
          <span class="stat"><b>${s.lessonsDone}</b>课看完</span>
          ${s.open ? `<span class="stat"><b>${s.open}</b>条待解决</span>` : ""}
        </div>` : ""}
      </div>
      <section aria-label="全部课程">
        ${all.length ? `<div class="filters">
          <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <span class="visually-hidden">搜索课程</span><input type="search" id="cq" placeholder="搜索课程、课时、笔记…" value="${h(filter.query)}"></label>
          <label><span class="visually-hidden">按状态筛选</span><select class="inline" id="cstatus">
            ${[["", "全部状态"], ["learning", "在学"], ["done", "学完"], ["paused", "暂停"], ["open", "有待解决的"]].map(([v, t]) => `<option value="${v}"${filter.status === v ? " selected" : ""}>${t}</option>`).join("")}
          </select></label>
          ${C.projectList(all).length ? `<label><span class="visually-hidden">按项目筛选</span><select class="inline" id="cproj"><option value="">全部项目</option>${C.projectList(all).map(([p, n]) => `<option value="${h(p)}"${filter.project === p ? " selected" : ""}>${h(p)}（${n}）</option>`).join("")}</select></label>` : ""}
          ${ctx.sortSelect("csort", C.COURSE_SORTS, filter.sort)}
        </div>
        <div class="chips" id="ctags"></div>` : ""}
        <div class="card-grid" id="cgrid"></div>
      </section>`;
    $("#cq")?.addEventListener("input", (e) => { filter.query = e.target.value; renderGrid(); });
    $("#cstatus")?.addEventListener("change", (e) => { filter.status = e.target.value; renderGrid(); });
    $("#cproj")?.addEventListener("change", (e) => { filter.project = e.target.value; renderGrid(); });
    $("#csort")?.addEventListener("change", (e) => { filter.sort = e.target.value; store.set("pc-sort-courses", e.target.value); renderGrid(); });
    renderTags();
    renderGrid();
  }

  function renderTags() {
    const box = $("#ctags");
    if (!box) return;
    box.innerHTML = C.tagCounts(state.courses.courses).slice(0, 24)
      .map(([t, n]) => `<button type="button" class="chip" aria-pressed="${filter.tag === t}" data-tag="${h(t)}">#${h(t)}<span class="n">${n}</span></button>`).join("");
    $$("[data-tag]", box).forEach((b) => (b.onclick = () => { filter.tag = filter.tag === b.dataset.tag ? "" : b.dataset.tag; renderTags(); renderGrid(); }));
  }

  function renderGrid() {
    const box = $("#cgrid");
    const all = state.courses.courses;
    const list = C.sortCourses(C.search(all, filter), filter.sort);
    if (!all.length) return (box.innerHTML = `<p class="empty">还没有课程。</p>`);
    if (!list.length) return (box.innerHTML = `<p class="empty">没有找到匹配的课程。换个关键词，或清除筛选。</p>`);
    box.innerHTML = list.map((x) => `<a class="pcard course-tile" href="#/course/${h(x.id)}">
      <div class="pcard-top">${statusChip(x.status)}${x.open ? `<span class="qbadge" title="还有 ${x.open} 条待解决">待解决 ${x.open}</span>` : ""}</div>
      <p class="pcard-one">${h(x.title || "未命名课程")}</p>
      ${x.teacher ? `<div class="pcard-paper"><p>${h(x.teacher)}</p></div>` : ""}
      ${bar(x.done, x.lessons)}
      <div class="pcard-foot"><span>${x.lessons ? `已看 ${x.done} / ${x.lessons} 课` : "还没有课时"}${x.next && x.status !== "done" ? ` · 下一课：${h(x.next)}` : ""}</span><span class="prog">${h(x.lastDate || "")}</span></div>
    </a>`).join("");
  }

  /* ---------- course page ---------- */
  async function view(id) {
    if (!M.validId(id)) return list();
    main.innerHTML = `<p class="loading">正在打开课程…</p>`;
    const c = await getCourse(id);
    if (!c) return notFound("course");
    const p = C.progress(c);
    const next = C.nextLesson(c);
    const meta = [statusChip(c.status)];
    if (c.startDate) meta.push(`<span>${c.startDate} 开始</span>`);
    if (c.project) meta.push(`<span>项目：${h(c.project)}</span>`);
    if (c.tags.length) meta.push(`<span>${c.tags.map((t) => "#" + h(t)).join(" ")}</span>`);
    const cite = [c.teacher && h(c.teacher), c.link && `<a href="${h(M.paperHref(c.link))}" target="_blank" rel="noopener">课程链接</a>`].filter(Boolean).join(" · ");
    main.innerHTML = `
      <div class="toolbar">
        <a class="btn quiet" href="#/course">← 全部课程</a>
        <div class="btn-row"><button class="btn quiet" id="copyCourse">复制 Markdown</button><a class="btn" href="#/course/${h(id)}/edit">编辑课程</a></div>
      </div>
      <article class="sheet course-page">
        <div class="meta-line">${meta.join("")}</div>
        <h1 class="card-title">${h(c.title || "未命名课程")}</h1>
        ${cite ? `<p class="cite">${cite}</p>` : ""}
        ${c.goal ? `<p class="why"><b>为什么学：</b>${h(c.goal)}</p>` : ""}
        <div class="course-progress">${bar(p.done, p.total)}<span>已看 ${p.done} / ${p.total} 课</span>
          ${next ? `<a class="btn primary small" href="#/course/${h(id)}/l/${h(next.id)}/edit">继续：${h(next.title || "下一课")}</a>` : ""}</div>
        <section class="section"><div class="sec-head"><h2>课时</h2><a class="btn small${c.lessons.length ? "" : " primary"}" href="#/course/${h(id)}/l/new/edit">＋ 新的一课</a></div>
          ${c.lessons.length ? `<p class="hint small">点任意一课进去看笔记和资料；点左边的圆圈标成看完了。</p><ol class="lesson-list">${c.lessons.map((l, i) => `<li class="${l.done ? "done" : ""}">
            <button type="button" class="lesson-check" data-done="${h(l.id)}" aria-pressed="${l.done}" title="${l.done ? "标成没看完" : "标成看完了"}">${l.done ? "✓" : i + 1}</button>
            <div class="lesson-main"><a class="lesson-title" href="#/course/${h(id)}/l/${h(l.id)}"><span class="lesson-n">第 ${i + 1} 课</span>${l.title ? h(l.title) : ""}</a>
              ${l.oneLine ? `<p>${h(l.oneLine)}</p>` : ""}
              <div class="facts">${l.date ? `<span>${l.date}</span>` : ""}${l.notes.trim() ? `<span>有笔记</span>` : ""}${l.files.length ? `<span>${l.files.length} 个资料</span>` : ""}${l.marks.length ? `<span>${l.marks.length} 个标记</span>` : ""}${C.openMarks(l).length ? `<span class="todo-tag">待解决 ${C.openMarks(l).length}</span>` : ""}</div></div>
            <a class="btn quiet small" href="#/course/${h(id)}/l/${h(l.id)}/edit">记笔记</a>
          </li>`).join("")}</ol>` : `<p class="muted">还没有课时。点「＋ 新的一课」开始记第 1 课；也可以在「编辑课程」里一次列出全部课时的标题。</p>`}
        </section>
        ${c.summary.trim() ? `<section class="section"><h2>学完总结</h2><div class="md">${md()(c.summary)}</div></section>` : ""}
      </article>`;
    $("#copyCourse").onclick = () => copyText(C.courseToMarkdown(c));
    // Quick "watched" toggle without opening the lesson.
    $$("[data-done]").forEach((b) => (b.onclick = async () => {
      if (!(await ctx.ensureUnlocked())) return;
      b.disabled = true;
      try {
        const lid = b.dataset.done;
        await saveCourse(c, "更新课程进度：" + c.title.slice(0, 50), (latest) => {
          const l = latest.lessons.find((x) => x.id === lid);
          return l ? C.upsertLesson(latest, { ...l, done: !l.done, date: l.date || (!l.done ? M.todayISO() : "") }) : latest;
        });
        view(id);
      } catch (error) {
        toast("保存失败：" + error.message, "error");
        b.disabled = false;
      }
    }));
    typesetMath(main);
  }

  /* ---------- lesson page ---------- */
  async function lessonView(id, lid) {
    main.innerHTML = `<p class="loading">正在打开…</p>`;
    const c = await getCourse(id);
    if (!c) return notFound("course");
    const i = c.lessons.findIndex((l) => l.id === lid);
    if (i < 0) return notFound("lesson");
    const l = c.lessons[i];
    const prev = c.lessons[i - 1];
    const next = c.lessons[i + 1];
    const flagged = l.marks.filter((m) => m.solve);
    const video = C.videoInfo(l.link);
    const at = (m) => (video && m.time ? `<button type="button" class="time seek" data-seek="${C.timeSeconds(m.time)}" title="从 ${h(m.time)} 开始播放">${h(m.time)}</button>` : `<span class="time">${h(m.time)}</span>`);
    main.innerHTML = `
      <div class="toolbar">
        <a class="btn quiet" href="#/course/${h(id)}">← ${h(c.title || "课程")}</a>
        <div class="btn-row"><a class="btn" href="#/course/${h(id)}/l/${h(lid)}/edit">记笔记</a></div>
      </div>
      <article class="sheet">
        <div class="meta-line"><span class="status s-${l.done ? "done" : "reading"}">${l.done ? "看完了" : "没看完"}</span><span>第 ${i + 1} 课</span>${l.date ? `<span>${l.date}</span>` : ""}${l.link ? `<a href="${h(M.paperHref(l.link))}" target="_blank" rel="noopener">视频链接</a>` : ""}</div>
        <h1 class="card-title">${h(lessonName(l, i))}</h1>
        ${l.oneLine ? `<section class="one-line"><h2 class="sec-label">这一课讲了什么</h2><div class="sec-body"><p>${h(l.oneLine)}</p></div></section>` : ""}
        ${video ? `<section class="section video-sec"><div class="sec-head"><h2>视频</h2><a class="small" href="${h(C.videoWatchUrl(video))}" target="_blank" rel="noopener">在${video.site === "youtube" ? " YouTube " : " B 站"}打开</a></div>
          <div class="video-box" id="videoBox"><button type="button" class="video-start" data-seek="0"><span>▶</span>在页面里播放</button></div>
          ${l.marks.some((m) => m.time) ? `<p class="hint small">点「边看边记」里的时间，视频会跳到那一刻。</p>` : ""}</section>` : ""}
        ${l.notes.trim() ? `<section class="section"><h2>笔记</h2><div class="md">${md()(l.notes)}</div></section>` : ""}
        ${materialsHtml(l)}
        ${l.marks.length ? `<section class="section"><h2>边看边记</h2><ol class="step-view">${C.marksByTime(l.marks).map((m) => `<li>${at(m)}${sym(m.type)}<span>${renderInline(m.text)}${m.solve ? (m.answer ? ` <span class="solved-tick" title="已解决">✓</span>` : ` <span class="todo-tag">待解决</span>`) : ""}</span></li>`).join("")}</ol></section>` : ""}
        ${flagged.length ? `<section class="section"><h2>问题与解答</h2><ul class="solve-view">${flagged.map((m) => `<li><div class="q">${sym(m.type)}${m.time ? at(m).replace('class="time', 'class="page') : ""}<span>${renderInline(m.text)}</span></div><div class="a">${m.answer ? renderInline(m.answer) : '<span class="muted">还没解决</span>'}</div></li>`).join("")}</ul></section>` : ""}
        ${!l.oneLine && !l.marks.length && !l.notes.trim() && !l.files.length ? `<div class="empty-lesson"><p class="muted">这一课还没有笔记和资料。</p><a class="btn primary" href="#/course/${h(id)}/l/${h(lid)}/edit">开始记笔记</a></div>` : ""}
        <nav class="entry-nav" aria-label="翻页">
          ${prev ? `<a href="#/course/${h(id)}/l/${h(prev.id)}">← ${h(lessonName(prev, i - 1))}</a>` : "<span></span>"}
          ${next ? `<a href="#/course/${h(id)}/l/${h(next.id)}">${h(lessonName(next, i + 1))} →</a>` : "<span></span>"}
        </nav>
      </article>`;
    // The player loads only when asked; a time jumps the video there.
    if (video) $("article", main).addEventListener("click", (e) => {
      const b = e.target.closest("[data-seek]");
      if (!b) return;
      const box = $("#videoBox");
      box.innerHTML = `<iframe src="${h(C.videoEmbedUrl(video, +b.dataset.seek, true))}" title="视频" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      if (!b.classList.contains("video-start")) box.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    typesetMath(main);
  }


  /* ---------- course editor ---------- */
  async function edit(id) {
    const isNew = !id;
    if (!isNew && !M.validId(id)) return list();
    main.innerHTML = `<p class="loading">正在打开编辑器…</p>`;
    const existing = isNew ? null : await getCourse(id).catch(() => null);
    if (!isNew && !existing) return notFound("course");
    const draftKey = "pc-coursedraft-" + (id || "new");
    const draft = store.get(draftKey);
    let course = null;
    let images = {};
    let restored = false;
    if (draft && (!existing || (draft.savedAt || "") > (existing.updatedAt || ""))) {
      try { course = C.normalizeCourse({ ...draft.course, id: id || "00000000-new-0000" }); images = draft.images || {}; restored = true; } catch { course = null; }
    }
    if (!course) course = existing ? structuredClone(existing) : { ...C.emptyCourse("00000000-new-0000"), startDate: M.todayISO() };
    const projects = C.projectList(state.courses.courses).map(([p]) => p);
    const allTags = C.tagCounts(state.courses.courses).map(([t]) => t);

    main.innerHTML = `
      <div class="toolbar"><a class="btn quiet" href="${existing ? "#/course/" + h(id) : "#/course"}">← 返回</a></div>
      ${restored ? `<div class="banner warn"><span>已恢复这台设备上还没保存的草稿。</span><button class="btn quiet" id="discardDraft">放弃草稿</button></div>` : ""}
      ${!state.gh.unlocked ? `<div class="banner"><span>你可以先写，保存时再输入密码。草稿会自动保存在这台设备上。</span></div>` : ""}
      <form class="sheet" id="editor" autocomplete="off">
        <label class="field"><span class="visually-hidden">课程名称</span><input class="title-input" name="title" maxlength="200" placeholder="课程名称"></label>
        <div class="meta-grid">
          <label class="field"><span>讲师 / 平台</span><input name="teacher" maxlength="120" placeholder="讲师、学校或平台"></label>
          <label class="field"><span>课程链接</span><input name="link" maxlength="500" placeholder="课程主页或播放列表的网址"></label>
          <label class="field"><span>标签</span><input name="tags" list="ctagList" placeholder="用逗号分开"></label>
          <label class="field"><span>项目</span><input name="project" list="cprojList" maxlength="60" placeholder="可以留空"></label>
          <label class="field"><span>开始日期</span><input name="startDate" type="date"></label>
          <div class="field"><span class="label" id="cstatusLabel">状态</span><div class="seg" role="group" aria-labelledby="cstatusLabel">
            ${Object.entries(C.STATUS_LABELS).map(([k, t]) => `<button type="button" data-status="${k}">${t}</button>`).join("")}</div></div>
        </div>
        <datalist id="cprojList">${projects.map((p) => `<option value="${h(p)}">`).join("")}</datalist>
        <datalist id="ctagList">${allTags.map((t) => `<option value="${h(t)}">`).join("")}</datalist>
        <section class="stage"><h2><span class="stage-n">1</span>为什么学</h2>
          <label class="field"><span>目标（一行）</span><input name="goal" maxlength="300" placeholder="学这门课想得到什么"></label></section>
        <section class="stage"><h2><span class="stage-n">2</span>课时</h2>
          <p class="hint">这里只列每一课的标题，比如「Agent 概览」。笔记、截图和课件保存后在课程页点进每一课里写和上传。</p>
          <ol class="lesson-edit" id="lessonRows"></ol>
          <label class="field" style="margin-top:12px"><span>批量添加（每行一课）</span><textarea class="textarea short" id="bulkLessons" rows="3" placeholder="每行写一课的标题"></textarea></label>
          <div class="btn-row" style="margin-top:6px"><button type="button" class="btn small" id="addBulk">添加这些课时</button></div></section>
        <section class="stage"><h2><span class="stage-n">3</span>学完总结</h2>
          <p class="hint">整门课学完后，写下最重要的收获。</p>
          <textarea class="textarea" name="summary" rows="5" placeholder="这门课最重要的收获"></textarea>${tools("summary")}</section>
      </form>
      <div class="editor-bar">
        <div class="bar-state"><b id="progress"></b><span class="save-state" id="saveState">${restored ? "草稿已恢复" : "草稿自动保存在这台设备"}</span></div>
        <div class="btn-row">${existing ? `<button type="button" class="btn quiet danger" id="deleteCourse">删除课程</button>` : ""}<button type="button" class="btn primary" id="publish">保存</button></div>
      </div>`;

    const form = $("#editor");
    for (const k of ["title", "teacher", "link", "project", "startDate", "goal", "summary"]) form[k].value = course[k] ?? "";
    form.tags.value = course.tags.join(", ");
    let status = course.status;
    const paintStatus = () => $$("[data-status]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === status)));
    paintStatus();
    $$("[data-status]").forEach((b) => (b.onclick = () => { status = b.dataset.status; paintStatus(); changed(); }));

    // Lesson rows keep their ids so notes stay attached when titles or order change.
    let lessons = course.lessons.map((l) => ({ id: l.id, title: l.title, hasNotes: !!(l.oneLine || l.marks.length || l.notes.trim() || l.files.length) }));
    const paintRows = () => {
      $("#lessonRows").innerHTML = lessons.map((l, i) => `<li data-lid="${h(l.id)}"><span class="lnum">${i + 1}</span>
        <input class="input" data-k="ltitle" value="${h(l.title)}" maxlength="200" placeholder="这一课的标题" aria-label="课时标题">
        <button type="button" class="btn quiet small" data-move="-1" aria-label="上移">↑</button><button type="button" class="btn quiet small" data-move="1" aria-label="下移">↓</button>
        <button type="button" class="unlink" data-drop="${h(l.id)}" aria-label="删除这一课">×</button></li>`).join("");
    };
    paintRows();
    $("#lessonRows").addEventListener("input", (e) => {
      const li = e.target.closest("[data-lid]");
      const l = lessons.find((x) => x.id === li?.dataset.lid);
      if (l) l.title = e.target.value;
    });
    $("#lessonRows").addEventListener("click", async (e) => {
      const li = e.target.closest("[data-lid]");
      if (!li) return;
      const i = lessons.findIndex((x) => x.id === li.dataset.lid);
      const move = e.target.closest("[data-move]");
      if (move) {
        const j = i + Number(move.dataset.move);
        if (j < 0 || j >= lessons.length) return;
        [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
        paintRows();
        changed();
      } else if (e.target.closest("[data-drop]")) {
        if (lessons[i].hasNotes && !(await confirmDialog("删除这一课？", "这一课已经有笔记或资料，保存后会一起删除。", "删除", true))) return;
        lessons.splice(i, 1);
        paintRows();
        changed();
      }
    });
    $("#addBulk").onclick = () => {
      const titles = C.parseLessonTitles($("#bulkLessons").value);
      if (!titles.length) return $("#bulkLessons").focus();
      lessons.push(...titles.map((title) => ({ id: C.newLessonId(), title, hasNotes: false })));
      $("#bulkLessons").value = "";
      paintRows();
      changed();
      toast("已添加 " + titles.length + " 课。");
    };

    form.addEventListener("click", (e) => {
      const fmt = e.target.closest(".fmt");
      if (fmt) ctx.wrapSelection(form[fmt.dataset.for], fmt.dataset.fmt);
    });
    form.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input")) e.preventDefault(); });
    ctx.enableImages(form, images);

    const collect = () => {
      const byId = new Map(course.lessons.map((l) => [l.id, l]));
      return C.normalizeCourse({
        ...course,
        title: form.title.value, teacher: form.teacher.value, link: form.link.value, tags: form.tags.value, project: form.project.value,
        startDate: form.startDate.value, status, goal: form.goal.value, summary: form.summary.value,
        lessons: lessons.map((l) => ({ ...(byId.get(l.id) || C.emptyLesson({ id: l.id })), title: l.title })),
      });
    };
    const paintProgress = () => { const p = C.progress(collect()); $("#progress").textContent = `${p.total} 课 · 已看 ${p.done}`; };
    paintProgress();

    let saveTimer;
    const saveDraft = () => store.set(draftKey, { course: collect(), images, savedAt: new Date().toISOString() });
    function changed() {
      ctx.setDirty(true);
      paintProgress();
      clearTimeout(saveTimer);
      $("#saveState").textContent = "正在保存草稿…";
      saveTimer = setTimeout(() => { if (form.isConnected) $("#saveState").textContent = saveDraft() ? "草稿已保存在这台设备" : "这台设备无法保存草稿（存储已满或被禁用）"; }, 600);
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

    $("#publish").onclick = async () => {
      const draftCourse = collect();
      if (!draftCourse.title) { toast("先写上课程名称再保存。", "error"); form.title.focus(); return; }
      if (!(await ctx.ensureUnlocked())) return;
      clearTimeout(saveTimer);
      const btn = $("#publish");
      btn.disabled = true;
      btn.textContent = "正在保存…";
      try {
        const finalId = isNew ? C.newCourseId(draftCourse.title, draftCourse.startDate || M.todayISO()) : id;
        const mine = { ...draftCourse, id: finalId };
        const uploads = ctx.usedImages(images, mine.summary);
        // Take order, titles and course details from here; lesson notes from the latest saved copy.
        // Materials of lessons removed here are deleted from the repository too.
        let dropped = [];
        await saveCourse(mine, (isNew ? "新增课程：" : "更新课程：") + mine.title.slice(0, 60), (latest) => {
          const saved = new Map(latest.lessons.map((l) => [l.id, l]));
          const kept = new Set(mine.lessons.map((l) => l.id));
          dropped = latest.lessons.filter((l) => !kept.has(l.id)).flatMap((l) => l.files.map((f) => ({ path: f.path, remove: true })));
          return { ...mine, lessons: mine.lessons.map((l) => ({ ...(saved.get(l.id) || l), title: l.title })) };
        }, () => [...uploads.map(([path, url]) => ({ path, base64: url.split(",")[1] })), ...dropped]);
        store.del(draftKey);
        ctx.setDirty(false);
        window.onbeforeunload = null;
        if (uploads.length) store.set("pc-imgcache", { ...(store.get("pc-imgcache") || {}), ...Object.fromEntries(uploads) });
        toast("已保存。网站大约 1 分钟后对所有人更新。");
        location.hash = "#/course/" + finalId;
      } catch (error) {
        console.error(error);
        if (error.status === 401) ctx.lock(true);
        toast("保存失败：" + error.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "保存";
      }
    };

    $("#deleteCourse")?.addEventListener("click", async () => {
      if (!(await confirmDialog("删除这门课程？", "课程和所有课时笔记都会删除，网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。", "删除", true))) return;
      if (!(await ctx.ensureUnlocked())) return;
      try {
        await state.gh.commitLatest(async (head) => {
          const index = C.normalizeIndex(await state.gh.readJSON(C.COURSES_INDEX_PATH, head));
          return {
            message: "删除课程：" + (existing.title || id).slice(0, 60),
            files: [
              { path: C.COURSE_DIR + id + ".json", remove: true },
              ...C.coursePaths(existing).map((path) => ({ path, remove: true })),
              { path: C.COURSES_INDEX_PATH, text: JSON.stringify(C.removeFromIndex(index, id), null, 1) + "\n" },
            ],
          };
        });
        state.courseCache.delete(id);
        state.courses = C.removeFromIndex(state.courses, id);
        rememberRecent({ id }, true);
        clearTimeout(saveTimer);
        store.del(draftKey);
        ctx.setDirty(false);
        toast("已删除。");
        location.hash = "#/course";
      } catch (error) {
        toast("删除失败：" + error.message, "error");
      }
    });
  }

  /* ---------- lesson editor ---------- */
  async function lessonEdit(id, lid) {
    main.innerHTML = `<p class="loading">正在打开编辑器…</p>`;
    const course = await getCourse(id).catch(() => null);
    if (!course) return notFound("course");
    const isNew = lid === "new";
    const existing = isNew ? null : course.lessons.find((l) => l.id === lid);
    if (!isNew && !existing) return notFound("lesson");
    const index = isNew ? course.lessons.length : course.lessons.indexOf(existing);
    const draftKey = "pc-lessondraft-" + id + "-" + lid;
    const draft = store.get(draftKey);
    let lesson = null;
    let images = {};
    let restored = false;
    if (draft && (!existing || (draft.savedAt || "") > (course.updatedAt || ""))) {
      lesson = C.normalizeLesson(draft.lesson);
      if (lesson) { images = draft.images || {}; restored = true; }
    }
    if (!lesson) lesson = existing ? structuredClone(existing) : C.emptyLesson({ date: M.todayISO() });
    if (!isNew) lesson.id = lid;

    main.innerHTML = `
      <div class="toolbar">
        <a class="btn quiet" href="#/course/${h(id)}${existing ? "/l/" + h(lid) : ""}">← 返回</a>
        <span class="muted small">${h(course.title)} · 第 ${index + 1} 课</span>
      </div>
      ${restored ? `<div class="banner warn"><span>已恢复这台设备上还没保存的草稿。</span><button class="btn quiet" id="discardDraft">放弃草稿</button></div>` : ""}
      ${!state.gh.unlocked ? `<div class="banner"><span>你可以先写，保存时再输入密码。草稿会自动保存在这台设备上。</span></div>` : ""}
      <form class="sheet" id="editor" autocomplete="off">
        <label class="field"><span class="visually-hidden">这一课的标题</span><input class="title-input" name="title" maxlength="200" placeholder="这一课的标题"></label>
        <div class="meta-grid">
          <label class="field"><span>视频链接</span><input name="link" maxlength="500" placeholder="这一课视频的网址"></label>
          <label class="field"><span>学习日期</span><input name="date" type="date"></label>
          <div class="field"><span class="label" id="ldoneLabel">进度</span><div class="seg" role="group" aria-labelledby="ldoneLabel">
            <button type="button" data-done="0">没看完</button><button type="button" data-done="1">看完了</button></div></div>
        </div>
        <section class="stage"><h2><span class="stage-n">1</span>笔记</h2>
          <p class="hint">这一课的要点、公式、推导、代码都写在这里。支持 Markdown，公式用 $…$。截图可以直接 Ctrl+V 粘贴，或点「插入图片」。</p>
          <textarea class="textarea" name="notes" rows="12" placeholder="这一课的笔记"></textarea>${tools("notes")}</section>
        <section class="stage" id="materials"><h2><span class="stage-n">2</span>课件与资料</h2>
          <p class="hint">课件 PDF、PPT、讲义、图片、代码等。选好后马上存进 GitHub 仓库的 materials/ 文件夹，在这一课的页面可以打开和下载；也可以把文件直接拖到这里。同名文件再传会覆盖。仓库是公开的，别传私密文件。单个文件最大 25 MB。</p>
          <div class="btn-row"><button type="button" class="btn" id="pickFiles">上传文件</button><span class="muted small" id="uploadState"></span></div>
          <ul class="file-edit" id="fileList"></ul>
          <input type="file" id="filePick" multiple hidden></section>
        <section class="stage"><h2><span class="stage-n">3</span>边看边记（可选）</h2>
          <p class="hint">写下视频时间（分:秒），选一个符号，写几个字，回车记下一条。时间会保留，接着改就行。没听懂的勾上「待解决」，看完后在下面写答案。</p>
          <div class="mark-input">
            <div class="mark-types"><div class="mark-kinds" role="radiogroup" aria-label="标记类型">${C.MARKS.map((m, k) => `<button type="button" role="radio" class="t${k}" data-type="${m.type}" aria-checked="${k === 0}"><b>${m.type}</b>${m.label}</button>`).join("")}</div>
              <div class="mark-opts"><label class="solve-flag"><input type="checkbox" id="markSolve"> 待解决</label><div class="fmt-pair"><button type="button" class="fmt" data-fmt="**" data-for="markText" title="加粗（⌘/Ctrl + B）" aria-label="加粗"><b>B</b></button><button type="button" class="fmt" data-fmt="*" data-for="markText" title="斜体（⌘/Ctrl + I）" aria-label="斜体"><i>I</i></button>${ctx.imageButton("markText")}</div></div></div>
            <div class="mark-line"><input class="input page time-input" id="markTime" placeholder="分:秒" maxlength="9" inputmode="numeric" aria-label="视频时间">
              <textarea class="input grow" id="markText" rows="1" maxlength="500" placeholder="写几个字，回车记下" aria-label="标记内容" enterkeyhint="done"></textarea>
              <button type="button" class="btn" id="addMark">记下</button></div>
          </div>
          <ol class="marks-list" id="marks"></ol></section>
        <section class="stage"><h2><span class="stage-n">4</span>看完后</h2>
          <div class="esec"><h3>这一课讲了什么</h3><p class="hint">一句话说出这一课的核心。</p>
            <textarea class="textarea one" name="oneLine" rows="2" maxlength="400" placeholder="一句话总结这一课"></textarea></div>
          <div class="esec"><h3>问题与解答</h3><p class="hint">勾了「待解决」的标记列在这里，写下答案；没弄懂的留空。</p>
            <p class="small" id="fixCount"></p><ol class="solve-list" id="fixList"></ol></div>
        </section>
      </form>
      <div class="editor-bar">
        <div class="bar-state"><b id="progress"></b><span class="save-state" id="saveState">${restored ? "草稿已恢复" : "草稿自动保存在这台设备"}</span></div>
        <div class="btn-row">${existing ? `<button type="button" class="btn quiet danger" id="deleteLesson">删除这一课</button>` : ""}<button type="button" class="btn primary" id="publish">保存</button></div>
      </div>`;

    const form = $("#editor");
    for (const k of ["title", "link", "date", "oneLine", "notes"]) form[k].value = lesson[k] ?? "";
    let done = lesson.done;
    const paintDone = () => $$("[data-done]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.done === "1") === done)));
    paintDone();
    $$("[data-done]").forEach((b) => (b.onclick = () => { done = b.dataset.done === "1"; paintDone(); changed(); }));

    // Marks with video time
    let markType = C.MARKS[0].type;
    const typeIndex = (t) => C.MARKS.findIndex((m) => m.type === t);
    const markRow = (m) =>
      `<li data-row="mark"><button type="button" class="mark-sym t${typeIndex(m.type)}" data-type="${m.type}" title="${C.markLabel(m.type)}（点一下换符号）">${m.type}</button><input class="input page time-input" data-k="time" value="${h(m.time)}" placeholder="时间" maxlength="9" aria-label="视频时间"><textarea class="input grow" data-k="text" rows="1" maxlength="500" aria-label="标记内容">${h(m.text)}</textarea><input type="hidden" data-k="answer" value="${h(m.answer || "")}"><label class="row-flag" title="待解决：勾上后出现在「问题与解答」里"><input type="checkbox" data-k="solve"${m.solve ? " checked" : ""}><span>待解决</span></label><button type="button" class="x" aria-label="删除">×</button></li>`;
    $("#marks").innerHTML = lesson.marks.map(markRow).join("");
    $("#markTime").value = lesson.marks.at(-1)?.time || "";
    const paintTypes = () => $$(".mark-kinds [data-type]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === markType)));
    $$(".mark-kinds [data-type]").forEach((b) => (b.onclick = () => { markType = b.dataset.type; paintTypes(); $("#markText").focus(); }));
    const addMark = () => {
      const text = $("#markText").value.trim();
      if (!text) return $("#markText").focus();
      $("#marks").insertAdjacentHTML("beforeend", markRow({ type: markType, time: C.cleanTime($("#markTime").value), text, solve: $("#markSolve").checked }));
      $("#markText").value = "";
      ctx.growBox($("#markText"));
      $("#markSolve").checked = false;
      $("#markText").focus();
      renderFixes();
      changed();
    };
    $("#addMark").onclick = addMark;
    $("#markText").addEventListener("keydown", (e) => { if (ctx.plainEnter(e)) { e.preventDefault(); addMark(); } });
    $("#markTime").addEventListener("keydown", (e) => { if (ctx.plainEnter(e)) { e.preventDefault(); $("#markText").focus(); } });

    let fixRows = [];
    const paintFixCount = () => {
      const open = fixRows.filter((r) => !$("[data-k=answer]", r).value.trim()).length;
      $("#fixCount").textContent = fixRows.length ? (open ? `还有 ${open} 条待解决，已解决 ${fixRows.length - open} 条。` : `${fixRows.length} 条都解决了。`) : "";
    };
    function renderFixes() {
      fixRows = $$("#marks [data-row]").filter((r) => $("[data-k=solve]", r).checked);
      $("#fixList").innerHTML = fixRows.length
        ? fixRows.map((r, i) => `<li><div class="q">${sym($(".mark-sym", r).dataset.type)}${$("[data-k=time]", r).value ? `<span class="page">${h($("[data-k=time]", r).value)}</span>` : ""}<span>${renderInline($("[data-k=text]", r).value)}</span></div>
            <textarea class="input grow" data-solve="${i}" rows="1" maxlength="2000" placeholder="答案，没弄懂就留空" aria-label="答案">${h($("[data-k=answer]", r).value)}</textarea></li>`).join("")
        : `<li class="muted small">还没有勾「待解决」的标记。</li>`;
      paintFixCount();
    }
    renderFixes();
    $("#fixList").addEventListener("input", (e) => {
      const row = fixRows[e.target.dataset.solve];
      if (row) { $("[data-k=answer]", row).value = e.target.value; paintFixCount(); }
    });
    $("#marks").addEventListener("input", renderFixes);
    $("#marks").addEventListener("click", (e) => {
      const s = e.target.closest(".mark-sym");
      if (!s) return;
      const next = C.MARKS[(typeIndex(s.dataset.type) + 1) % C.MARKS.length];
      s.dataset.type = next.type;
      s.textContent = next.type;
      s.className = "mark-sym t" + typeIndex(next.type);
      s.title = next.label + "（点一下换符号）";
      renderFixes();
      changed();
    });
    form.addEventListener("click", (e) => {
      const x = e.target.closest(".x");
      if (x) { x.closest("[data-row]").remove(); renderFixes(); changed(); }
      const fmt = e.target.closest(".fmt");
      if (fmt) ctx.wrapSelection(fmt.dataset.for === "markText" ? $("#markText") : form[fmt.dataset.for], fmt.dataset.fmt);
    });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("input") && !e.target.closest(".mark-input")) e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && /^[bi]$/i.test(e.key) && e.target.matches("#markText, [data-k=text], [data-solve], textarea[name=notes]")) {
        e.preventDefault();
        ctx.wrapSelection(e.target, e.key.toLowerCase() === "b" ? "**" : "*");
      }
    });

    // Images in notes, marks and answers: button, Ctrl+V or drag and drop.
    ctx.enableImages(form, images);

    // Materials: uploaded to the repository right away so they are never lost.
    let files = [...lesson.files];
    const uploadedPaths = new Set();
    const paintFiles = () => {
      $("#fileList").innerHTML = files
        .map((f) => `<li><span class="fname" title="${h(C.materialName(f.path))}">${h(C.materialName(f.path))}</span><span class="muted small">${L.formatSize(f.size)}</span><button type="button" class="unlink" data-unfile="${h(f.path)}" aria-label="移除">×</button></li>`)
        .join("");
    };
    paintFiles();
    async function uploadMaterials(picked) {
      if (!picked.length) return;
      if (!(await ctx.ensureUnlocked())) return;
      const dir = C.materialDir(id, lesson.id);
      const chosen = [];
      const skipped = [];
      let total = 0;
      for (const f of picked) {
        const name = L.cleanRelPath(f.name).replace(/\//g, "_");
        if (!name || L.skipReason(name) || f.size > L.FILE_MAX_BYTES || total + f.size > L.UPLOAD_MAX_BYTES || files.length + chosen.length >= C.MAX_MATERIALS) { skipped.push(f.name); continue; }
        total += f.size;
        chosen.push({ f, path: dir + name });
      }
      if (!chosen.length) return toast(`没有可上传的文件（跳过了 ${skipped.length} 个：可能含密钥或超过 25 MB）。`, "error");
      $("#pickFiles").disabled = true;
      $("#uploadState").textContent = `正在上传 ${chosen.length} 个文件（${L.formatSize(total)}）…`;
      try {
        const out = [];
        for (const { f, path } of chosen) out.push({ path, size: f.size, base64: await ctx.fileToBase64(f) });
        await state.gh.commitLatest(async () => ({
          message: `上传课程资料 ${out.length} 个文件：` + (course.title + " · " + (form.title.value || "第 " + (index + 1) + " 课")).slice(0, 60),
          files: out.map(({ path, base64 }) => ({ path, base64 })),
        }));
        for (const o of out) {
          uploadedPaths.add(o.path);
          files = files.filter((x) => x.path !== o.path);
          files.push({ path: o.path, size: o.size });
        }
        paintFiles();
        changed();
        toast(`已上传 ${out.length} 个文件` + (skipped.length ? `，跳过 ${skipped.length} 个` : "") + "。记得点「保存」。");
      } catch (error) {
        console.error(error);
        toast("上传失败：" + error.message, "error");
      } finally {
        $("#pickFiles").disabled = false;
        $("#uploadState").textContent = "";
      }
    }
    $("#pickFiles").onclick = () => $("#filePick").click();
    $("#filePick").onchange = (e) => { const picked = [...e.target.files]; e.target.value = ""; uploadMaterials(picked); };
    const box = $("#materials");
    box.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); box.classList.add("drop"); } });
    box.addEventListener("dragleave", () => box.classList.remove("drop"));
    box.addEventListener("drop", (e) => {
      box.classList.remove("drop");
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      uploadMaterials([...e.dataTransfer.files]);
    });
    $("#fileList").addEventListener("click", (e) => {
      const rm = e.target.closest("[data-unfile]");
      if (!rm) return;
      files = files.filter((f) => f.path !== rm.dataset.unfile);
      paintFiles();
      changed();
    });

    const collect = () =>
      C.normalizeLesson({
        ...lesson,
        title: form.title.value, link: form.link.value, date: form.date.value, done,
        oneLine: form.oneLine.value, notes: form.notes.value, files,
        marks: $$("#marks [data-row]").map((r) => ({ type: $(".mark-sym", r).dataset.type, time: $("[data-k=time]", r).value, text: $("[data-k=text]", r).value, solve: $("[data-k=solve]", r).checked, answer: $("[data-k=answer]", r).value })),
      });
    const paintProgress = () => {
      const l = collect();
      const open = C.openMarks(l).length;
      $("#progress").textContent = `${l.marks.length} 个标记` + (open ? ` · 待解决 ${open}` : "");
    };
    paintProgress();

    let saveTimer;
    const saveDraft = () => store.set(draftKey, { lesson: collect(), images, savedAt: new Date().toISOString() });
    function changed() {
      ctx.setDirty(true);
      paintProgress();
      clearTimeout(saveTimer);
      $("#saveState").textContent = "正在保存草稿…";
      saveTimer = setTimeout(() => { if (form.isConnected) $("#saveState").textContent = saveDraft() ? "草稿已保存在这台设备" : "这台设备无法保存草稿（存储已满或被禁用）"; }, 600);
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

    $("#publish").onclick = async () => {
      const l = collect();
      if (!l.title) l.title = "第 " + (index + 1) + " 课";
      if (!(await ctx.ensureUnlocked())) return;
      clearTimeout(saveTimer);
      const btn = $("#publish");
      btn.disabled = true;
      btn.textContent = "正在保存…";
      try {
        const uploads = ctx.usedImages(images, l);
        // Materials removed while editing are deleted from the repository too.
        const kept = new Set(l.files.map((f) => f.path));
        const stale = [...new Set([...(existing?.files || []).map((f) => f.path), ...uploadedPaths])].filter((p) => !kept.has(p));
        await saveCourse(course, "课程笔记：" + (course.title + " · " + l.title).slice(0, 70), (latest) => C.upsertLesson(latest, l), [
          ...uploads.map(([path, url]) => ({ path, base64: url.split(",")[1] })),
          ...stale.map((path) => ({ path, remove: true })),
        ]);
        store.del(draftKey);
        ctx.setDirty(false);
        window.onbeforeunload = null;
        if (uploads.length) store.set("pc-imgcache", { ...(store.get("pc-imgcache") || {}), ...Object.fromEntries(uploads) });
        toast("已保存。网站大约 1 分钟后对所有人更新。");
        location.hash = "#/course/" + id + "/l/" + l.id;
      } catch (error) {
        console.error(error);
        if (error.status === 401) ctx.lock(true);
        toast("保存失败：" + error.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "保存";
      }
    };

    $("#deleteLesson")?.addEventListener("click", async () => {
      if (!(await confirmDialog("删除这一课？", "这一课的笔记会一起删除。需要时仍可以从 GitHub 的历史记录里找回。", "删除", true))) return;
      if (!(await ctx.ensureUnlocked())) return;
      try {
        let gone = [];
        await saveCourse(course, "删除课时：" + (course.title + " · " + (existing.title || "")).slice(0, 70), (latest) => {
          gone = [...new Set([...existing.files, ...(latest.lessons.find((x) => x.id === lid)?.files || [])].map((f) => f.path))];
          return C.removeLesson(latest, lid);
        }, () => gone.map((path) => ({ path, remove: true })));
        clearTimeout(saveTimer);
        store.del(draftKey);
        ctx.setDirty(false);
        toast("已删除。");
        location.hash = "#/course/" + id;
      } catch (error) {
        toast("删除失败：" + error.message, "error");
      }
    });
  }

  async function loadAll() {
    return (await Promise.all(state.courses.courses.map((x) => getCourse(x.id).catch(() => null)))).filter(Boolean);
  }

  return { loadCourses, list, view, edit, lessonView, lessonEdit, loadAll, clearCache: () => state.courseCache.clear(), setStatus: (s) => { filter.status = s; } };
}
