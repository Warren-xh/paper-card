// The overview page (#/today): a greeting, what is waiting today, a calendar of
// study activity, quick starts and the latest changes across every module.
import * as O from "./overview.mjs";
import * as M from "./model.mjs";
import * as L from "./lab.mjs";
import * as C from "./course.mjs";
import { kindIcon } from "./palette.mjs";

export function createOverview(ctx) {
  const { state, $, h, store, session } = ctx;
  const main = $("#main");
  const ACTIVITY_KEY = "pc-activity";

  // The newest save this device knows of, in any module.
  const lastSave = () =>
    [state.index.cards, state.logs.logs, state.courses.courses, state.maps.maps].flat().reduce((t, x) => (x.updatedAt > t ? x.updatedAt : t), "");

  // Save history from GitHub (kept for 10 minutes, or until something new is
  // saved); entry dates if GitHub is not reachable.
  async function activity(today) {
    const since = O.addDays(today, -7 * 27);
    const cached = store.get(ACTIVITY_KEY, session);
    if (cached && cached.since === since && Date.now() - cached.at < 10 * 60 * 1000 && lastSave() <= new Date(cached.at).toISOString())
      return { counts: O.activityFromCommits(cached.dates), exact: true };
    try {
      const dates = await state.gh.commitDates(new Date(since + "T00:00:00").toISOString());
      store.set(ACTIVITY_KEY, { at: Date.now(), since, dates }, session);
      return { counts: O.activityFromCommits(dates), exact: true };
    } catch {
      const files = await ctx.loadCourseFiles().catch(() => []);
      return {
        counts: O.activityFromEntries({ cards: state.index.cards, logs: state.logs.logs, courses: state.courses.courses, lessons: files.flatMap((c) => c.lessons), maps: state.maps.maps }),
        exact: false,
      };
    }
  }

  const MONTHS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
  function heatmapHtml(counts, today, exact) {
    const weeks = O.heatmapWeeks(counts, today, 26);
    let lastMonth = -1;
    const months = weeks.map((w) => {
      const m = +w[0].day.slice(5, 7) - 1;
      if (m === lastMonth) return "<span></span>";
      lastMonth = m;
      return `<span>${MONTHS[m]}</span>`;
    }).join("");
    const unit = exact ? "次保存" : "条记录";
    const cells = weeks.map((w) => `<div class="hm-col">${w.map((d) => d.future
      ? `<i class="hm-cell future"></i>`
      : `<i class="hm-cell l${d.level}" title="${+d.day.slice(5, 7)} 月 ${+d.day.slice(8)} 日：${d.n ? d.n + " " + unit : "没有记录"}"></i>`).join("")}</div>`).join("");
    const st = O.streak(counts, today);
    const active = O.activeDays(counts, today, 30);
    const total = weeks.flat().reduce((t, d) => t + d.n, 0);
    return `
      <div class="hm-stats">
        <span class="stat-inline"><b>${st}</b><span data-en="day streak">天连续学习</span></span>
        <span class="stat-inline"><b>${active}</b><span data-en="${active === 1 ? "day" : "days"} active in the last 30">天 · 近 30 天</span></span>
        <span class="stat-inline"><b>${total}</b><span data-en="${exact ? (total === 1 ? "save" : "saves") : total === 1 ? "entry" : "entries"} in six months">${unit} · 近半年</span></span>
      </div>
      <div class="heatmap" role="img" aria-label="近半年每天的学习记录">
        <div class="hm-months">${months}</div>
        <div class="hm-body"><div class="hm-days"><span data-en="M">一</span><span></span><span data-en="W">三</span><span></span><span data-en="F">五</span><span></span><span data-en="S">日</span></div><div class="hm-grid">${cells}</div></div>
      </div>
      <div class="hm-legend"><span>${exact ? "按每天在网站上保存的次数" : "按卡片、记录和课时的日期"}</span><span class="hm-scale">少<i class="hm-cell l0"></i><i class="hm-cell l1"></i><i class="hm-cell l2"></i><i class="hm-cell l3"></i><i class="hm-cell l4"></i>多</span></div>`;
  }

  async function view() {
    const now = new Date();
    const today = M.todayISO();
    const cards = state.index.cards;
    const logs = state.logs.logs;
    const courses = state.courses.courses;
    const maps = state.maps.maps;
    const cs = M.stats(cards, today);
    const ls = L.stats(logs);
    const ks = C.stats(courses);
    const going = O.continueCourses(courses);
    const open = { card: cs.questions || 0, log: ls.open || 0, course: ks.open || 0 };
    const openTotal = open.card + open.log + open.course;
    const doing = logs.filter((x) => x.status === "doing").slice(0, 3);
    const reading = cards.filter((x) => x.status === "reading");
    const empty = !cards.length && !logs.length && !courses.length && !maps.length;
    const name = state.site.author ? "，" + state.site.author : "";

    const todo = [];
    for (const c of going.slice(0, 2))
      todo.push(`<a class="todo-tile t-course" href="#/course/${h(c.id)}${c.nextId ? "/l/" + h(c.nextId) : ""}"><span class="tt-icon">${kindIcon("course")}</span><span class="tt-main"><b>继续：${h(c.next || "下一课")}</b><small>${h(c.title)} · 已看 ${c.done} / ${c.lessons} 课</small><span class="progress"><span style="width:${Math.round((c.done / c.lessons) * 100)}%"></span></span></span><span class="tt-go">上课 →</span></a>`);
    for (const l of doing.slice(0, going.length ? 1 : 2))
      todo.push(`<a class="todo-tile t-log" href="#/lab/e/${h(l.id)}"><span class="tt-icon">${kindIcon("log")}</span><span class="tt-main"><b>${h(l.title || "未写标题")}</b><small>实操进行中${l.open ? ` · 待解决 ${l.open}` : ""}</small></span><span class="tt-go">接着做 →</span></a>`);
    if (openTotal)
      todo.push(`<div class="todo-tile t-open"><span class="tt-icon">${icon("question")}</span><span class="tt-main"><b>${openTotal} 个待解决的问题</b><small class="tt-links">${open.card ? `<a href="#/" data-filter="questions">论文 ${open.card}</a>` : ""}${open.log ? `<a href="#/lab" data-filter="open">实操 ${open.log}</a>` : ""}${open.course ? `<a href="#/course" data-filter="open">课程 ${open.course}</a>` : ""}</small></span></div>`);
    if (reading.length && todo.length < 4)
      todo.push(`<a class="todo-tile t-card" href="#/c/${h(reading[0].id)}"><span class="tt-icon">${kindIcon("card")}</span><span class="tt-main"><b>${h(reading[0].title || reading[0].oneLine || "未写标题")}</b><small>在读${reading.length > 1 ? ` · 还有 ${reading.length - 1} 篇在读` : ""}</small></span><span class="tt-go">读 →</span></a>`);

    const recent = O.recentItems({ cards, logs, courses, maps }, 8);
    main.innerHTML = `
      <section class="hello">
        <p class="hello-date">${O.dateLine(now)}</p>
        <h1>${O.greeting(now.getHours())}${h(name)}</h1>
        <p class="hello-sub">${empty ? "从下面任意一个开始：读一篇论文、记一次实操、跟一门课，或者画一张导图。" : "这是你今天的学习桌面。"}</p>
        <button type="button" class="hello-search" id="helloSearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>搜索论文、实操、课程、课时、导图…</span><kbd>Ctrl K</kbd></button>
      </section>
      ${empty ? "" : `<section class="todo-grid" aria-label="今天">${todo.join("")}</section>`}
      <section class="sheet overview-sec" aria-labelledby="hmTitle">
        <div class="sec-head"><h2 id="hmTitle">学习日历</h2></div>
        <div id="heatmap"><p class="loading small">正在统计…</p></div>
      </section>
      <div class="overview-cols">
        <section class="sheet overview-sec" aria-labelledby="startTitle">
          <div class="sec-head"><h2 id="startTitle">快速开始</h2></div>
          <div class="quick-grid">
            <a class="quick k-card" href="#/new">${kindIcon("card")}<b>写论文卡片</b><small>${cards.length} 张</small></a>
            <a class="quick k-log" href="#/lab/new">${kindIcon("log")}<b>记一次实操</b><small>${logs.length} 条</small></a>
            <a class="quick k-course" href="#/course/new">${kindIcon("course")}<b>添加课程</b><small>${courses.length} 门 · ${ks.lessonsDone} 课看完</small></a>
            <a class="quick k-map" href="#/map">${kindIcon("map")}<b>思维导图</b><small>${maps.length} 张</small></a>
          </div>
        </section>
        <section class="sheet overview-sec" aria-labelledby="recentTitle">
          <div class="sec-head"><h2 id="recentTitle">最近更新</h2></div>
          ${recent.length ? `<ul class="recent-list">${recent.map((x) => `<li><a class="k-${x.kind}" href="${h(x.href)}"><span class="pl-icon">${kindIcon(x.kind)}</span><span class="rl-main"><b>${h(x.title || "未写标题")}</b>${x.sub ? `<small>${h(x.sub)}</small>` : ""}</span><time datetime="${h(x.at)}">${O.timeAgo(x.at, now)}</time></a></li>`).join("")}</ul>` : `<p class="muted">还没有内容。写下第一条之后会出现在这里。</p>`}
        </section>
      </div>`;
    $("#helloSearch").onclick = () => ctx.openSearch();
    main.querySelectorAll("[data-filter]").forEach((a) => (a.onclick = () => ctx.setFilter(a.getAttribute("href"), a.dataset.filter)));
    // The calendar fills in when GitHub answers; the page does not wait for it.
    const box = $("#heatmap");
    activity(today).then(({ counts, exact }) => { if (box.isConnected) box.innerHTML = heatmapHtml(counts, today, exact); })
      .catch(() => { if (box.isConnected) box.innerHTML = `<p class="muted small">暂时统计不了。</p>`; });
  }

  function icon(name) {
    const paths = {
      review: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
      question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  return { view };
}
