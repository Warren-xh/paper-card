// The search box over everything (Ctrl+K, or the magnifier in the top bar):
// type to find papers, practice logs, courses, lessons and mind maps, or run
// a quick action. ↑ ↓ to move, Enter to open, Esc to close.
import * as S from "./search.mjs";
import { recentItems } from "./overview.mjs";
import { escapeHtml as h } from "./markdown.mjs";

const ICONS = {
  card: '<path d="M4 5h16v14H4z"/><path d="M4 9h16" class="red"/><path d="M8 13h8M8 16h5"/>',
  log: '<path d="m5 7 5 5-5 5M12 17h7"/>',
  course: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c3 2 7 2 10 0v-5"/>',
  lesson: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h5"/>',
  map: '<circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M10 11 6 7M14 11l4-4M10 13l-4 4M14 13l4 4"/>',
  term: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>',
  action: '<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>',
};
export const kindIcon = (kind) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[kind] || ICONS.action}</svg>`;

// Wraps every query word found in `text` in <mark>, escaping the rest.
export function highlight(text, query) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const s = String(text || "");
  if (!terms.length) return h(s);
  const lower = s.toLowerCase();
  const hit = new Array(s.length).fill(false);
  for (const t of terms) for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + 1)) hit.fill(true, i, i + t.length);
  let out = "";
  for (let i = 0; i < s.length;) {
    let j = i;
    while (j < s.length && hit[j] === hit[i]) j++;
    out += hit[i] ? "<mark>" + h(s.slice(i, j)) + "</mark>" : h(s.slice(i, j));
    i = j;
  }
  return out;
}

export function createPalette({ state, loadCourseFiles, actions }) {
  const wrap = Object.assign(document.createElement("div"), { className: "palette-wrap", hidden: true });
  wrap.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true" aria-label="搜索">
      <label class="palette-input"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <span class="visually-hidden">搜索全部内容</span>
        <input type="search" placeholder="搜索论文、实操、课程、课时、导图…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="paletteList" aria-autocomplete="list">
        <kbd>Esc</kbd></label>
      <div class="palette-list" id="paletteList" role="listbox"></div>
      <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>
    </div>`;
  document.body.append(wrap);
  const input = wrap.querySelector("input");
  const list = wrap.querySelector(".palette-list");
  let entries = [];
  let shown = [];
  let active = 0;
  let lastFocus = null;

  const rebuild = (courseFiles = []) => {
    entries = S.buildEntries({ cards: state.index.cards, logs: state.logs.logs, courses: state.courses.courses, courseFiles, maps: state.maps.maps, terms: state.terms?.terms || [] });
  };

  function render() {
    const q = input.value.trim();
    const acts = actions().filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase()) || (a.keys || "").includes(q.toLowerCase()));
    let groups;
    if (!q) {
      const recent = recentItems({ cards: state.index.cards, logs: state.logs.logs, courses: state.courses.courses, maps: state.maps.maps }, 6);
      groups = [["快速操作", acts.map((a) => ({ ...a, kind: "action" }))], ["最近更新", recent]];
    } else {
      const found = S.searchEntries(entries, q, 40);
      groups = [["快速操作", acts.map((a) => ({ ...a, kind: "action" }))]];
      for (const kind of ["term", "card", "lesson", "course", "log", "map"]) groups.push([S.KIND_LABELS[kind], found.filter((e) => e.kind === kind).slice(0, 8)]);
    }
    groups = groups.filter(([, items]) => items.length);
    shown = groups.flatMap(([, items]) => items);
    active = Math.min(active, Math.max(0, shown.length - 1));
    let n = 0;
    list.innerHTML = shown.length
      ? groups.map(([label, items]) => `<div class="pl-group" role="presentation">${h(label)}</div>` + items.map((e) => {
          const i = n++;
          const snip = q && e.text && !S.rank({ title: e.title, sub: e.sub, text: "" }, q) ? S.snippet(e.text, q) : "";
          return `<a class="pl-item k-${e.kind}" role="option" id="pl-${i}" data-i="${i}" href="${h(e.href || "#")}" aria-selected="${i === active}">
            <span class="pl-icon">${kindIcon(e.kind)}</span>
            <span class="pl-main"><b>${highlight(e.label || e.title, q)}</b>${e.sub ? `<small>${highlight(e.sub, q)}</small>` : ""}${snip ? `<small class="pl-snip">${highlight(snip, q)}</small>` : ""}</span>
            ${e.kind === "action" ? (e.hint ? `<span class="pl-kind">${h(e.hint)}</span>` : "") : q ? "" : `<span class="pl-kind">${S.KIND_LABELS[e.kind] || ""}</span>`}</a>`;
        }).join("")).join("")
      : `<p class="pl-empty">没有找到「${h(q)}」。换个关键词试试。</p>`;
    input.setAttribute("aria-activedescendant", shown.length ? "pl-" + active : "");
  }

  const move = (d) => {
    if (!shown.length) return;
    active = (active + d + shown.length) % shown.length;
    list.querySelectorAll(".pl-item").forEach((el) => el.setAttribute("aria-selected", String(+el.dataset.i === active)));
    list.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", "pl-" + active);
  };
  const choose = (i) => {
    const e = shown[i];
    if (!e) return;
    close();
    if (e.run) e.run();
    else if (e.href) location.hash = e.href;
  };

  function open(query = "") {
    lastFocus = document.activeElement;
    rebuild();
    input.value = query;
    active = 0;
    render();
    wrap.hidden = false;
    document.body.classList.add("palette-open");
    input.focus();
    // Lessons live inside course files: load them, then search them too.
    loadCourseFiles().then((files) => { if (!wrap.hidden) { rebuild(files); render(); } }).catch(() => {});
  }
  function close() {
    wrap.hidden = true;
    document.body.classList.remove("palette-open");
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }

  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  list.addEventListener("click", (e) => {
    const a = e.target.closest(".pl-item");
    if (!a) return;
    e.preventDefault();
    choose(+a.dataset.i);
  });
  list.addEventListener("mousemove", (e) => {
    const a = e.target.closest(".pl-item");
    if (a && +a.dataset.i !== active) { active = +a.dataset.i; list.querySelectorAll(".pl-item").forEach((el) => el.setAttribute("aria-selected", String(el === a))); }
  });
  wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
  addEventListener("hashchange", () => { if (!wrap.hidden) close(); });

  // Ctrl+K / ⌘K anywhere; "/" when not typing.
  document.addEventListener("keydown", (e) => {
    const typing = e.target.matches?.("input, textarea, select, [contenteditable]");
    if (((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") || (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey)) {
      if (document.body.classList.contains("viewing")) return;
      e.preventDefault();
      wrap.hidden ? open() : close();
    }
  });

  return { open, close };
}
