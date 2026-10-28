// The term library (词库): marking a term in any notes box, the card that pops
// up over a marked term, and the #/terms page that lists and edits them all.
import * as T from "./terms.mjs";
import * as S from "./search.mjs";
import { kindIcon } from "./palette.mjs";

export function createTerms(ctx) {
  const { state, $, $$, h, toast, dialog, confirmDialog, store, renderMarkdown, renderInline } = ctx;
  const main = $("#main");
  const PENDING = "pc-terms-pending";
  const LOCAL = "pc-terms-local";
  state.terms = T.emptyLibrary();
  let sort = store.get("pc-sort-terms") || "name";
  let query = "";

  /* ---------- data ---------- */
  const pending = () => store.get(PENDING) || [];
  const applyPending = (lib, list = pending()) => list.reduce((l, p) => (p.remove ? T.removeTerm(l, p.name, p.at) : T.upsertTerm(l, p.entry, p.at, p.was)), lib);

  async function loadTerms() {
    let lib = T.normalizeLibrary(await ctx.readData(T.TERMS_PATH).catch(() => null));
    // Just saved on this device: the static site may still show the old file.
    const local = store.get(LOCAL);
    if (local && Date.now() - local.at < 15 * 60 * 1000 && (local.lib?.updatedAt || "") > lib.updatedAt) lib = T.normalizeLibrary(local.lib);
    state.terms = applyPending(lib);
  }

  // One commit for the library: the latest file plus every change waiting on this device.
  async function commit(change, message) {
    const list = [...pending(), change].filter(Boolean);
    if (!(await ctx.ensureUnlocked())) {
      store.set(PENDING, list);
      state.terms = applyPending(state.terms, change ? [change] : []);
      return false;
    }
    let saved;
    await state.gh.commitLatest(async (head) => {
      saved = applyPending(T.normalizeLibrary(await state.gh.readJSON(T.TERMS_PATH, head)), list);
      return { message, files: [{ path: T.TERMS_PATH, text: JSON.stringify(saved, null, 1) + "\n" }] };
    });
    store.del(PENDING);
    store.set(LOCAL, { at: Date.now(), lib: saved });
    state.terms = saved;
    return true;
  }

  async function saveTerm(entry, was = "") {
    const at = new Date().toISOString();
    try {
      const ok = await commit({ entry, was, at }, (T.findTerm(state.terms, was || entry.term) ? "更新术语：" : "新增术语：") + entry.term.slice(0, 60));
      toast(ok ? "已保存到词库。" : "已记下。登录后再保存一次，词条就会存进词库。");
      return true;
    } catch (error) {
      if (error.status === 401) ctx.lock(true);
      toast("保存失败：" + error.message, "error");
      return false;
    }
  }

  /* ---------- the form for one term ---------- */
  function editor(start = {}) {
    const known = start.term ? T.findTerm(state.terms, start.term) : null;
    const t = { term: "", zh: "", en: "", def: "", ...(known || {}), ...(known ? {} : start) };
    return dialog(`
      <form method="dialog" class="term-form">
        <h2>${known ? "编辑术语" : "标注术语"}</h2>
        ${known ? `<p class="small">词库里已经有这个词，修改会更新词库。</p>` : `<p class="small">写下中英文和解释，保存后会收进词库；笔记里这个词会显示成术语，指上去就能看到解释。</p>`}
        <label class="field"><span>术语</span><input name="term" required autofocus value="${h(t.term)}" placeholder="在词库里用的名字"></label>
        <div class="meta-grid">
          <label class="field"><span>中文</span><input name="zh" value="${h(t.zh)}" placeholder="中文名"></label>
          <label class="field"><span>English</span><input name="en" value="${h(t.en)}" placeholder="English name"></label>
        </div>
        <label class="field" style="margin-top:12px"><span>解释</span><textarea class="textarea" name="def" rows="5" placeholder="它是什么、怎么用；支持 Markdown 和公式 $…$">${h(t.def)}</textarea></label>
        <p class="error" id="termErr"></p>
        <div class="dialog-actions"><button type="button" class="btn quiet" data-v="0">取消</button><button type="submit" class="btn primary">${start.marking ? "标注并保存" : "保存"}</button></div>
      </form>`, (el, close) => {
      const form = $("form", el);
      $("[data-v]", el).onclick = () => close(null);
      form.onsubmit = (e) => {
        e.preventDefault();
        const entry = T.normalizeTerm({ term: form.term.value, zh: form.zh.value, en: form.en.value, def: form.def.value });
        if (!entry) { $("#termErr", el).textContent = "先写上术语。"; return form.term.focus(); }
        close({ entry, was: known?.term || "" });
      };
    });
  }

  // "术语" next to bold and italic: the selected words become a marked term.
  async function markSelection(area) {
    const s = area.selectionStart ?? 0;
    const e = area.selectionEnd ?? s;
    const shown = area.value.slice(s, e).replace(/^\s+|\s+$/g, "");
    if (!shown || /[\n[\]|]/.test(shown)) { toast(shown ? "术语里不能有换行或方括号。" : "先选中要标注的词。", "error"); return area.focus(); }
    const res = await editor({ term: shown, marking: true });
    area.focus();
    if (!res) return;
    const lead = area.value.slice(s, e).match(/^\s*/)[0];
    const tail = area.value.slice(s, e).match(/\s*$/)[0];
    area.setRangeText(lead + T.markTerm(shown, res.entry.term) + tail, s, e, "end");
    area.dispatchEvent(new Event("input", { bubbles: true }));
    await saveTerm(res.entry, res.was);
  }

  /* ---------- the card over a marked term ---------- */
  const pop = Object.assign(document.createElement("div"), { className: "term-pop", hidden: true });
  pop.setAttribute("role", "tooltip");
  document.body.append(pop);
  let anchor = null;
  let hideTimer;
  function showPop(el) {
    clearTimeout(hideTimer);
    if (anchor === el && !pop.hidden) return;
    anchor = el;
    const name = el.dataset.term;
    const t = T.findTerm(state.terms, name);
    pop.innerHTML = t
      ? `<div class="tp-head"><b>${h(t.term)}</b></div>
         ${t.zh || t.en ? `<dl class="tp-names">${t.zh ? `<dt>中文</dt><dd>${h(t.zh)}</dd>` : ""}${t.en ? `<dt>English</dt><dd>${h(t.en)}</dd>` : ""}</dl>` : ""}
         ${t.def ? `<div class="md tp-def">${renderMarkdown(t.def)}</div>` : `<p class="muted small">还没有写解释。</p>`}
         <a class="tp-link" href="#/terms/${encodeURIComponent(t.term)}">在词库中查看 →</a>`
      : `<div class="tp-head"><b>${h(name)}</b></div><p class="muted small">词库里还没有这个词。</p><a class="tp-link" href="#/terms/${encodeURIComponent(name)}">加入词库 →</a>`;
    pop.hidden = false;
    ctx.typesetMath(pop);
    const r = el.getBoundingClientRect();
    const w = Math.min(340, innerWidth - 16);
    pop.style.width = w + "px";
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const below = r.bottom + 8 + pop.offsetHeight < innerHeight || r.top < pop.offsetHeight + 16;
    pop.style.left = left + "px";
    pop.style.top = (below ? r.bottom + 8 : r.top - pop.offsetHeight - 8) + "px";
    pop.dataset.side = below ? "below" : "above";
  }
  const hidePop = (now = false) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { pop.hidden = true; anchor = null; }, now ? 0 : 180);
  };
  let hoverTimer;
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest?.(".term");
    if (el) { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => showPop(el), 220); }
    else if (e.target.closest?.(".term-pop")) clearTimeout(hideTimer);
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest?.(".term, .term-pop")) { clearTimeout(hoverTimer); hidePop(); }
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest?.(".term");
    if (el) { e.preventDefault(); return anchor === el && !pop.hidden ? hidePop(true) : showPop(el); }
    if (!e.target.closest?.(".term-pop")) hidePop(true);
    if (e.target.closest?.(".tp-link")) hidePop(true);
  });
  document.addEventListener("focusin", (e) => { if (e.target.matches?.(".term")) showPop(e.target); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) hidePop(true);
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".term")) { e.preventDefault(); showPop(e.target); }
  });
  addEventListener("scroll", () => { if (!pop.hidden) hidePop(true); }, { passive: true });
  addEventListener("hashchange", () => hidePop(true));

  // The "术语" button in every editor.
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-term-for]");
    if (!b) return;
    const form = b.closest("form") || document;
    const area = form.querySelector(`[name="${b.dataset.termFor}"]`) || document.getElementById(b.dataset.termFor);
    if (area) markSelection(area);
  });

  /* ---------- #/terms ---------- */
  const SORTS = [["name", "名称 A→Z"], ["new", "最近添加"], ["used", "出现最多"]];
  let usage = new Map();

  async function page(focus = "") {
    const lib = state.terms;
    const waiting = pending().length;
    const month = new Date().toISOString().slice(0, 7);
    main.innerHTML = `
      <div class="sheet hero">
        <div class="hero-head"><span class="hero-icon">${kindIcon("term")}</span><div><h1 class="site-title">词库</h1>
        <p class="site-sub">笔记里标注的专业词汇：中英对照，附上解释。</p></div></div>
        <div class="home-actions"><p class="due-none">${lib.terms.length ? "在任何笔记框里选中一个词，点「术语」就能标注并收进这里。" : "还没有术语。在笔记里选中一个词点「术语」，或者点右边直接添加。"}</p>
          <button class="btn primary" id="newTerm">添加术语</button></div>
        ${lib.terms.length ? `<div class="stats"><span class="stat"><b>${lib.terms.length}</b>个术语</span><span class="stat"><b>${lib.terms.filter((t) => (t.createdAt || "").startsWith(month)).length}</b>个本月新增</span><span class="stat"><b>${lib.terms.filter((t) => t.en).length}</b>个有英文</span></div>` : ""}
      </div>
      ${waiting ? `<div class="banner warn"><span>有 ${waiting} 个词条还只存在这台设备上。</span><button class="btn small" id="flushTerms">保存到词库</button></div>` : ""}
      ${lib.terms.length ? `<div class="filters">
        <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span class="visually-hidden">搜索术语</span><input type="search" id="tq" placeholder="搜索术语、中文、英文、解释…" value="${h(query)}"></label>
        ${ctx.sortSelect("tsort", SORTS, sort)}
      </div>` : ""}
      <section class="term-list" id="termList" aria-label="全部术语"></section>`;
    $("#newTerm").onclick = async () => {
      const res = await editor({});
      if (res && (await saveTerm(res.entry, res.was))) page(res.entry.term);
    };
    $("#flushTerms")?.addEventListener("click", async () => {
      try {
        if (await commit(null, "保存术语 " + waiting + " 个")) { toast("已保存到词库。"); page(); }
      } catch (error) { toast("保存失败：" + error.message, "error"); }
    });
    $("#tq")?.addEventListener("input", (e) => { query = e.target.value; renderList(); });
    $("#tsort")?.addEventListener("change", (e) => { sort = e.target.value; store.set("pc-sort-terms", sort); renderList(); });
    $("#termList").addEventListener("click", onListClick);
    renderList(focus);
    // A name that is not in the library yet: offer to add it.
    if (focus && !T.findTerm(lib, focus)) {
      const res = await editor({ term: focus });
      if (res && (await saveTerm(res.entry, res.was))) page(res.entry.term);
      return;
    }
    // Where each term is mentioned: needs every lesson, so it fills in afterwards.
    const files = await ctx.loadCourseFiles().catch(() => []);
    const entries = S.buildEntries({ cards: state.index.cards, logs: state.logs.logs, courses: state.courses.courses, courseFiles: files, maps: state.maps.maps })
      .filter((e) => e.kind !== "course" || !files.length);
    usage = new Map(state.terms.terms.map((t) => [T.termKey(t.term), T.usages(entries, t)]));
    if ($("#termList")) renderList(focus);
  }

  function renderList(focus = "") {
    const box = $("#termList");
    if (!box) return;
    const all = state.terms.terms;
    let list = T.searchTerms(all, query);
    if (!query) {
      if (sort === "new") list = [...list].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      if (sort === "used") list = [...list].sort((a, b) => (usage.get(T.termKey(b.term))?.length || 0) - (usage.get(T.termKey(a.term))?.length || 0));
    }
    if (!all.length) return (box.innerHTML = `<p class="empty">还没有术语。</p>`);
    if (!list.length) return (box.innerHTML = `<p class="empty">没有找到匹配的术语。</p>`);
    const fk = T.termKey(focus);
    box.innerHTML = list.map((t) => {
      const k = T.termKey(t.term);
      const used = usage.get(k);
      return `<article class="term-card${k === fk ? " focus" : ""}" data-key="${h(t.term)}" id="term-${h(encodeURIComponent(k))}">
        <div class="tc-head"><h2>${h(t.term)}</h2>${t.zh || t.en ? `<p>${[t.zh, t.en].filter(Boolean).map(h).join(" · ")}</p>` : ""}</div>
        ${t.def ? `<div class="md tc-def">${renderMarkdown(t.def)}</div>` : `<p class="muted small">还没有写解释。</p>`}
        <div class="tc-foot">
          ${used ? (used.length ? `<button type="button" class="btn quiet small" data-used aria-expanded="${k === fk}">出现在 ${used.length} 处</button>` : `<span class="muted small">笔记里还没出现</span>`) : `<span class="muted small">正在统计…</span>`}
          <span class="tc-actions"><button type="button" class="btn quiet small" data-edit>编辑</button><button type="button" class="btn quiet small danger" data-del>删除</button></span>
        </div>
        ${used?.length ? `<ul class="tc-used"${k === fk ? "" : " hidden"}>${used.slice(0, 30).map((e) => `<li><a class="k-${e.kind}" href="${h(e.href)}"><span class="pl-kind">${S.KIND_LABELS[e.kind]}</span>${h(e.title)}</a></li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("");
    ctx.typesetMath(box);
    if (fk) document.getElementById("term-" + encodeURIComponent(fk))?.scrollIntoView({ block: "center" });
  }

  async function onListClick(e) {
    const card = e.target.closest(".term-card");
    if (!card) return;
    const name = card.dataset.key;
    if (e.target.closest("[data-used]")) {
      const b = e.target.closest("[data-used]");
      const ul = $(".tc-used", card);
      ul.hidden = !ul.hidden;
      b.setAttribute("aria-expanded", String(!ul.hidden));
    } else if (e.target.closest("[data-edit]")) {
      const res = await editor({ term: name });
      if (res && (await saveTerm(res.entry, res.was))) page(res.entry.term);
    } else if (e.target.closest("[data-del]")) {
      if (!(await confirmDialog("删除这个术语？", "词库里的解释会删除；笔记里标注的词还在，只是不再有解释。需要时可以从 GitHub 的历史记录里找回。", "删除", true))) return;
      try {
        const ok = await commit({ remove: true, name, at: new Date().toISOString() }, "删除术语：" + name.slice(0, 60));
        toast(ok ? "已删除。" : "已记下。登录后再保存一次就会删除。");
        page();
      } catch (error) { toast("删除失败：" + error.message, "error"); }
    }
  }

  return { loadTerms, page, markSelection, toMarkdown: () => T.libraryToMarkdown(state.terms) };
}
