import * as M from "./model.mjs";
import { renderMarkdown, renderInline, escapeHtml as h } from "./markdown.mjs";
import { GitHubClient } from "./github.mjs";
import { sealToken, openVault, passwordProblem, validToken } from "./vault.mjs";
import * as L from "./lab.mjs";
import { createLab } from "./lab-views.mjs";
import { createMaps } from "./map-views.mjs";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const main = $("#main");
const IDLE_LOCK_MS = 30 * 60 * 1000;
const REMEMBER_MS = 30 * 24 * 3600 * 1000;
const ONE_LINE_TEMPLATE = "用【什么方法】解决了【什么问题】，结果【比谁好多少】";

const state = {
  site: { ...M.DEFAULT_SITE },
  index: M.emptyIndex(),
  cards: new Map(),
  gh: null,
  vault: undefined,
  filter: { query: "", tag: "", project: "", status: "" },
  lastActive: Date.now(),
};

/* ---------- storage helpers (browser storage may be unavailable) ---------- */
const store = {
  get(key, area = localStorage) {
    try { return JSON.parse(area.getItem(key)); } catch { return null; }
  },
  set(key, value, area = localStorage) {
    try { area.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  del(key, area = localStorage) {
    try { area.removeItem(key); } catch {}
  },
};
const session = (() => { try { return sessionStorage; } catch { return null; } })();

/* ---------- formatting ---------- */
const short = (iso) => { const d = new Date(iso + "T00:00:00Z"); return d.getUTCMonth() + 1 + "/" + d.getUTCDate(); };
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return y + " 年 " + m + " 月 " + d + " 日"; };
const inDays = (n) => (n <= 0 ? "今天" : n === 1 ? "明天" : n + " 天后");
const linkLabel = (url) => {
  if (/^arxiv:/i.test(url)) return "arXiv:" + url.slice(6).trim();
  if (/^(doi:|10\.)/i.test(url)) return "DOI";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
};

/* ---------- input helpers ---------- */
// Chinese/Japanese input methods use Enter to confirm a word; that Enter must
// not also submit. Safari reports it with keyCode 229 or right after compositionend.
let composing = false;
let compositionEndAt = 0;
addEventListener("compositionstart", () => (composing = true), true);
addEventListener("compositionend", () => { composing = false; compositionEndAt = Date.now(); }, true);
const plainEnter = (e) =>
  e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && !composing && Date.now() - compositionEndAt > 80;

// Wraps the selection in ** (bold) or * (italic); applied again it unwraps.
function wrapSelection(el, mark) {
  const v = el.value;
  const s = el.selectionStart ?? v.length;
  const e = el.selectionEnd ?? s;
  const n = mark.length;
  const wrapped = v.slice(s - n, s) === mark && v.slice(e, e + n) === mark &&
    !(n === 1 && (v[s - n - 1] === "*" || v[e + n] === "*"));
  if (s >= n && wrapped) {
    el.setRangeText(v.slice(s, e), s - n, e + n, "select");
  } else {
    const inner = v.slice(s, e) || (n === 2 ? "粗体" : "斜体");
    el.setRangeText(mark + inner + mark, s, e, "end");
    el.setSelectionRange(s + n, s + n + inner.length);
  }
  el.focus();
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
// Fields whose text is rendered as Markdown, so bold/italic show up.
const FORMATTABLE = "#markText, [data-k=text], [data-solve], textarea:not([name=oneLine]):not(.short)";

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("读取文件失败。"));
    reader.readAsDataURL(file);
  });
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + " MB";

/* ---------- UI primitives ---------- */
let toastTimer;
function toast(message, kind = "") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast " + kind), kind === "error" ? 6000 : 3500);
}

function dialog(html, setup) {
  const el = $("#dialog");
  el.innerHTML = html;
  return new Promise((resolve) => {
    const close = (value) => { el.close(); resolve(value); };
    el.onclose = () => resolve(undefined);
    el.oncancel = () => resolve(undefined);
    setup?.(el, close);
    el.showModal();
    $("[autofocus]", el)?.focus();
  });
}

async function confirmDialog(title, text, ok = "确定", danger = false) {
  return dialog(
    `<h2>${h(title)}</h2><p>${h(text)}</p><div class="dialog-actions"><button class="btn" data-v="0">取消</button><button class="btn ${danger ? "danger" : "primary"}" data-v="1" autofocus>${h(ok)}</button></div>`,
    (el, close) => $$("[data-v]", el).forEach((b) => (b.onclick = () => close(b.dataset.v === "1"))),
  );
}

function download(name, text, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("已复制。");
  } catch {
    download("copy.md", text);
  }
}

/* ---------- math (KaTeX loaded only when a page contains formulas) ---------- */
let katexLoading;
function loadKatex() {
  katexLoading ||= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    document.head.append(css);
    const js = document.createElement("script");
    js.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    js.onload = resolve;
    js.onerror = reject;
    document.head.append(js);
  });
  return katexLoading;
}
async function typesetMath(root) {
  const nodes = $$(".math", root);
  if (!nodes.length) return;
  try {
    await loadKatex();
    for (const node of nodes) {
      const display = node.classList.contains("display");
      const tex = node.textContent;
      try { window.katex.render(tex, node, { displayMode: display, throwOnError: false }); } catch {}
    }
  } catch {
    /* formulas stay readable as plain TeX */
  }
}

/* ---------- repository & data ---------- */
function detectRepo(site) {
  const host = location.hostname.toLowerCase();
  if (host.endsWith(".github.io")) {
    const owner = host.slice(0, -".github.io".length);
    const name = location.pathname.split("/").filter(Boolean)[0] || host;
    return owner + "/" + name;
  }
  return site.repo;
}

async function fetchStatic(path) {
  const res = await fetch(path + "?v=" + Date.now(), { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("读取 " + path + " 失败（" + res.status + "）。");
  return res.json();
}

async function readData(path) {
  if (state.gh?.unlocked) {
    try { return await state.gh.readJSON(path); } catch (error) {
      if (error.status === 401) lock(true);
      else throw error;
    }
  }
  return fetchStatic(path);
}

async function loadSite() {
  const site = (await fetchStatic(M.SITE_PATH).catch(() => null)) || {};
  state.site = { ...M.DEFAULT_SITE, ...site };
  const repo = detectRepo(state.site);
  // Local preview can talk to a simulated GitHub (scripts/serve.mjs --mock).
  const mock = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("mock");
  state.gh = new GitHubClient(repo, state.site.branch || "main", fetch, mock ? location.origin + "/__mock_github" : undefined);
  applySite();
}

function applySite() {
  const mode = document.body.dataset.mode;
  const name = mode === "lab" ? "实操记录" : mode === "map" ? "思维导图" : state.site.title || "文献卡片";
  $("#brandName").textContent = name;
  document.title = name;
}

// Two modes share one site: paper cards (文献) and practice logs (实操).
function setMode(mode) {
  document.body.dataset.mode = mode;
  $$(".mode-switch a").forEach((a) => (a.dataset.mode === mode ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#brand").setAttribute("href", mode === "lab" ? "#/lab" : mode === "map" ? "#/map" : "#/");
  store.set("pc-mode", mode);
  applySite();
}

async function loadIndex() {
  state.index = M.normalizeIndex(await readData(M.INDEX_PATH));
  // Cards this device just published may not be on the static site yet.
  const recent = store.get("pc-recent") || [];
  const fresh = recent.filter((r) => Date.now() - r.at < 15 * 60 * 1000);
  for (const r of fresh) {
    const known = state.index.cards.find((x) => x.id === r.summary.id);
    if (r.removed) state.index.cards = state.index.cards.filter((x) => x.id !== r.summary.id);
    else if (!known || (known.updatedAt || "") < (r.summary.updatedAt || "")) {
      state.index.cards = state.index.cards.filter((x) => x.id !== r.summary.id);
      state.index.cards.push(r.summary);
    }
  }
  state.index = M.normalizeIndex(state.index);
  store.set("pc-recent", fresh);
  updateBadge();
  await lab.loadLogs();
  await maps.loadMaps();
}

async function getCard(id) {
  if (state.cards.has(id)) return state.cards.get(id);
  const raw = await readData(M.CARD_DIR + id + ".json");
  const card = raw ? M.normalizeCard(raw) : null;
  if (card) state.cards.set(id, card);
  return card;
}

function rememberRecent(summary, removed = false) {
  const recent = (store.get("pc-recent") || []).filter((r) => r.summary.id !== summary.id);
  recent.push({ at: Date.now(), summary, removed });
  store.set("pc-recent", recent);
}

// Saves one card (and the index) in a single commit; `change` turns the card
// found at the branch head into the card to save, so other devices' edits merge.
// A brand-new card passes change = null: there is nothing to merge with yet.
async function saveCard(card, message, change, extraFiles = []) {
  const now = new Date().toISOString();
  let saved;
  await state.gh.commitLatest(async (head) => {
    const index = M.normalizeIndex(await state.gh.readJSON(M.INDEX_PATH, head));
    const latestRaw = change && (await state.gh.readJSON(M.CARD_DIR + card.id + ".json", head));
    saved = { ...(change ? change(latestRaw ? M.normalizeCard(latestRaw) : card) : card), updatedAt: now };
    saved.createdAt ||= now;
    return {
      message,
      files: [
        { path: M.CARD_DIR + card.id + ".json", text: JSON.stringify(saved, null, 2) + "\n" },
        { path: M.INDEX_PATH, text: JSON.stringify(M.upsertIndex(index, saved, now), null, 1) + "\n" },
        ...extraFiles,
      ],
    };
  });
  state.cards.set(saved.id, saved);
  state.index = M.upsertIndex(state.index, saved, now);
  rememberRecent(M.summarize(saved));
  updateBadge();
  return saved;
}

function updateBadge() {
  const badge = $("#dueBadge");
  const n = M.dueCards(state.index.cards).length;
  badge.textContent = n;
  badge.hidden = !n;
  badge.title = n ? "今天有 " + n + " 张该回顾" : "";
}

/* ---------- unlocking ---------- */
function saveToken(token, remember) {
  const record = { token, at: Date.now() };
  if (session) store.set("pc-token", record, session);
  if (remember) store.set("pc-token", { ...record, until: Date.now() + REMEMBER_MS });
}

function restoreToken() {
  const s = session ? store.get("pc-token", session) : null;
  const l = store.get("pc-token");
  const rec = s || (l && l.until > Date.now() ? l : null);
  if (l && !(l.until > Date.now())) store.del("pc-token");
  if (rec && validToken(rec.token)) state.gh.setToken(rec.token);
  updateLockButton();
}

function lock(expired = false) {
  state.gh?.setToken("");
  if (session) store.del("pc-token", session);
  store.del("pc-token");
  updateLockButton();
  if (expired) toast("授权已失效，请重新输入密码。", "error");
}

function updateLockButton() {
  const btn = $("#lockBtn");
  const on = !!state.gh?.unlocked;
  btn.textContent = on ? "已解锁" : "登录编辑";
  btn.classList.toggle("unlocked", on);
  btn.title = on ? "点击锁定（退出编辑）" : "输入密码后可以编辑";
}

async function loadVault() {
  if (state.vault !== undefined) return state.vault;
  let vault = null;
  try {
    vault = await state.gh.readJSON(M.VAULT_PATH, undefined, { auth: false });
  } catch {
    vault = await fetchStatic(M.VAULT_PATH).catch(() => null);
  }
  state.vault = vault;
  return vault;
}

// Resolves true when the editor is unlocked.
async function ensureUnlocked() {
  if (state.gh.unlocked) return true;
  const vault = await loadVault();
  if (!vault) {
    const go = await confirmDialog("还没有设置密码", "第一次使用需要先完成一次设置：连接 GitHub 并设定你的密码。", "去设置");
    if (go) location.hash = "#/setup";
    return false;
  }
  const ok = await dialog(
    `<form method="dialog" id="unlockForm">
      <h2>输入密码</h2>
      <p>解锁后就可以写卡片和修改网站。</p>
      <label class="field"><span>密码</span><input type="password" name="pw" autocomplete="current-password" required autofocus></label>
      <label class="check-row small" style="margin-top:10px"><input type="checkbox" name="remember"> 在这台设备上记住我 30 天</label>
      <p class="error" id="unlockErr"></p>
      <div class="dialog-actions"><button type="button" class="btn" data-cancel>取消</button><button class="btn primary" type="submit">解锁</button></div>
    </form>`,
    (el, close) => {
      $("[data-cancel]", el).onclick = () => close(false);
      $("#unlockForm", el).onsubmit = async (event) => {
        event.preventDefault();
        const form = event.target;
        const btn = $("button[type=submit]", form);
        btn.disabled = true;
        btn.textContent = "正在解锁…";
        try {
          const token = await openVault(vault, form.pw.value, state.gh.repo);
          state.gh.setToken(token);
          saveToken(token, form.remember.checked);
          updateLockButton();
          close(true);
        } catch (error) {
          $("#unlockErr", el).textContent = error.message;
          form.pw.select();
        } finally {
          btn.disabled = false;
          btn.textContent = "解锁";
        }
      };
    },
  );
  if (ok) {
    toast("已解锁，可以编辑了。");
    state.cards.clear();
    lab.clearCache();
    maps.clearCache();
    await loadIndex().catch(() => {});
  }
  return !!ok;
}

/* ---------- views ---------- */
const views = { home, card: cardView, edit: editView, review: reviewView, settings: settingsView, setup: setupView };
const ROUTES = { c: "card", edit: "edit", new: "edit", review: "review", settings: "settings", setup: "setup" };

async function route() {
  if (editorDirty && !(await leaveEditor())) {
    history.replaceState(null, "", currentHash);
    return;
  }
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, arg, arg2] = hash.split("/");
  currentHash = location.hash || "#/";
  editorDirty = false;
  window.onbeforeunload = null;
  // #/map is the list of mind maps; #/map/<id> browses one, #/map/<id>/edit edits it.
  document.body.classList.toggle("wide", name === "map" && !!arg);
  if (name === "map") {
    setMode("map");
    $$(".topnav a").forEach((a) => a.removeAttribute("aria-current"));
    try {
      await (arg ? maps.view(decodeURIComponent(arg), arg2 === "edit" ? "edit" : "browse") : maps.list());
    } catch (error) {
      console.error(error);
      main.innerHTML = `<div class="sheet"><h1>页面打不开</h1><p>${h(error.message)}</p><p><a href="#/map">回到全部导图</a></p></div>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  // #/lab, #/lab/new, #/lab/e/<id>, #/lab/edit/<id> are practice logs.
  const isLab = name === "lab";
  const view = isLab ? (arg === "e" ? "view" : arg === "edit" || arg === "new" ? "edit" : "home") : ROUTES[name] || "home";
  const param = isLab ? (arg === "e" || arg === "edit" ? arg2 : "") : name === "new" ? "" : arg;
  if (isLab) setMode("lab");
  else if (view !== "settings" && view !== "setup") setMode("cards");
  const nav = view === "review" || view === "settings" ? view : view === "setup" ? "settings" : "";
  $$(".topnav a").forEach((a) => (a.dataset.nav === nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  try {
    await (isLab ? lab : views)[view](decodeURIComponent(param || ""));
  } catch (error) {
    console.error(error);
    main.innerHTML = `<div class="sheet"><h1>页面打不开</h1><p>${h(error.message)}</p><p><a href="#/">回到首页</a></p></div>`;
  }
  if (view !== "home") window.scrollTo(0, 0);
}
let currentHash = location.hash;
let editorDirty = false;
let leaveEditor = async () => true;

const lab = createLab({
  state, $, $$, h, renderMarkdown, renderInline, toast, confirmDialog, copyText, typesetMath, store,
  readData: (path) => readData(path),
  ensureUnlocked: () => ensureUnlocked(),
  lock: (expired) => lock(expired),
  route: () => route(),
  plainEnter, wrapSelection, fileToBase64, shrinkImage: (file) => shrinkImage(file),
  setDirty: (dirty) => { editorDirty = dirty; },
  isDirty: () => editorDirty,
  setLeave: (fn) => { leaveEditor = fn; },
});

const maps = createMaps({
  state, $, $$, h, toast, dialog, confirmDialog, copyText, store,
  readData: (path) => readData(path),
  ensureUnlocked: () => ensureUnlocked(),
  lock: (expired) => lock(expired),
  route: () => route(),
  plainEnter,
  setDirty: (dirty) => { editorDirty = dirty; },
  setLeave: (fn) => { leaveEditor = fn; },
});

/* Home */
async function home() {
  const today = M.todayISO();
  const cards = state.index.cards;
  const s = M.stats(cards, today);
  const next = M.nextReview(cards, today);
  const site = state.site;

  const due = s.due
    ? `<a class="due-banner" href="#/review"><b>今天有 ${s.due} 张该回顾</b><span>先想，再看答案 →</span></a>`
    : `<p class="due-none">${next ? `今天没有要回顾的卡片。下一次：${short(next.date)}（${next.count} 张）` : cards.length ? "今天没有要回顾的卡片。卡片标成「读完」后，第二天开始提醒回顾。" : "写下第一张卡片吧：读之前想清楚为什么读，边读边打标记，读完合上论文再写。"}</p>`;

  const statsHtml = cards.length
    ? `<div class="stats">
        <span class="stat"><b>${s.total}</b>张卡片</span>
        <span class="stat"><b>${s.done}</b>篇读完 · ${s.reading} 篇在读</span>
        <span class="stat"><b>${s.thisMonth}</b>篇本月</span>
        <span class="stat"><b>${s.reviews}</b>次回顾</span>
        ${s.questions ? `<span class="stat"><b>${s.questions}</b>条待解决</span>` : ""}
      </div>`
    : "";

  main.innerHTML = `
    <div class="sheet">
      <h1 class="site-title">${h(site.title)}</h1>
      <p class="site-sub">${h(site.subtitle)}</p>
      <div class="home-actions">${due}<a class="btn primary" href="#/new">写一张新卡片</a></div>
      ${statsHtml}
    </div>
    <section aria-label="全部卡片">
      <div class="filters">
        <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span class="visually-hidden">搜索卡片</span><input type="search" id="q" placeholder="搜索标题、作者、一句话、笔记…" value="${h(state.filter.query)}"></label>
        <label><span class="visually-hidden">按状态筛选</span><select class="inline" id="status">
          ${[["", "全部状态"], ["reading", "在读"], ["done", "读完"], ["questions", "有待解决的"]].map(([v, t]) => `<option value="${v}"${state.filter.status === v ? " selected" : ""}>${t}</option>`).join("")}
        </select></label>
        ${projectSelect()}
      </div>
      <div class="chips" id="tagChips"></div>
      <div class="card-grid" id="grid"></div>
    </section>`;
  $("#q").addEventListener("input", (e) => { state.filter.query = e.target.value; renderGrid(); });
  $("#status").addEventListener("change", (e) => { state.filter.status = e.target.value; renderGrid(); });
  $("#proj")?.addEventListener("change", (e) => { state.filter.project = e.target.value; renderGrid(); });
  renderTags();
  renderGrid();
}

function projectSelect() {
  const list = M.projectList(state.index.cards);
  if (!list.length) return "";
  return `<label><span class="visually-hidden">按项目筛选</span><select class="inline" id="proj"><option value="">全部项目</option>${list
    .map(([p, n]) => `<option value="${h(p)}"${state.filter.project === p ? " selected" : ""}>${h(p)}（${n}）</option>`)
    .join("")}</select></label>`;
}

function renderTags() {
  const box = $("#tagChips");
  const tags = M.tagCounts(state.index.cards).slice(0, 24);
  box.innerHTML = tags
    .map(([t, n]) => `<button type="button" class="chip" aria-pressed="${state.filter.tag === t}" data-tag="${h(t)}">#${h(t)}<span class="n">${n}</span></button>`)
    .join("");
  $$("[data-tag]", box).forEach((b) => (b.onclick = () => {
    state.filter.tag = state.filter.tag === b.dataset.tag ? "" : b.dataset.tag;
    renderTags();
    renderGrid();
  }));
}

function renderGrid() {
  const box = $("#grid");
  const all = state.index.cards;
  const list = M.search(all, state.filter);
  if (!all.length) {
    box.innerHTML = `<p class="empty">还没有卡片。点上面的「写一张新卡片」开始。</p>`;
    return;
  }
  if (!list.length) {
    box.innerHTML = `<p class="empty">没有找到匹配的卡片。换个关键词，或清除筛选。</p>`;
    return;
  }
  const today = M.todayISO();
  box.innerHTML = list.map((x) => tileHtml(x, today)).join("");
}

function tileHtml(x, today) {
  const cite = M.citation(x);
  const tags = x.tags.slice(0, 4).map((t) => `#${h(t)}`).join(" ");
  return `<a class="pcard" href="#/c/${h(x.id)}">
    <div class="pcard-top">
      <span class="status s-${x.status}">${M.STATUS_LABELS[x.status]}</span>
      ${M.isDue(x, today) ? `<span class="due-tag">该回顾</span>` : ""}
      ${x.pdf ? `<span class="pdf-tag" title="附有论文 PDF">PDF</span>` : ""}
      ${x.questions ? `<span class="qbadge" title="还有 ${x.questions} 条待解决">待解决 ${x.questions}</span>` : ""}
    </div>
    <p class="pcard-one">${x.oneLine ? h(x.oneLine) : '<span class="untitled">还没写一句话</span>'}</p>
    <div class="pcard-paper"><h3>${x.title ? h(x.title) : '<span class="untitled">未写标题</span>'}</h3>
      ${cite ? `<p>${h(cite)}</p>` : ""}</div>
    <div class="pcard-foot"><span class="tags">${tags}</span><span class="prog" title="七栏写了 ${x.filled} 栏">${x.filled}/7</span></div>
  </a>`;
}

/* Card detail */
const imageResolver = (images) => (src) => images?.[src] || "";
const mdOf = (images) => (text) => renderMarkdown(text, { shiftHeadings: 2, resolveImage: imageResolver(images) });
function cardBodyHtml(c, images, { recall = false } = {}) {
  const md = mdOf(images);
  const titleOf = (id) => state.index.cards.find((x) => x.id === id);
  // Sections left empty are not shown.
  const block = (n, body, cls = "wide") => {
    if (!body) return "";
    const s = M.SECTIONS[n - 1];
    return `<section class="sec recall-block ${cls}" data-sec="${n}">
      <h2 class="sec-label"><span class="num">${s.mark}</span>${s.title}</h2>
      <div class="sec-body">${body}</div>
      ${recall ? `<button type="button" class="reveal">揭晓</button>` : ""}
    </section>`;
  };
  const proof = c.proof.datasets || c.proof.baselines || c.proof.numbers
    ? `<dl class="proof">${[["数据集", c.proof.datasets], ["对比对象", c.proof.baselines], ["关键数字", c.proof.numbers]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v ? h(v) : '<span class="muted">—</span>'}</dd></div>`).join("")}</dl>`
    : "";
  const linked = c.links.map(titleOf).filter(Boolean);
  const back = M.backlinks(state.index.cards, c.id).filter((x) => !c.links.includes(x.id));
  const linkItem = (x) => `<li><a href="#/c/${h(x.id)}">${h(x.title || x.id)}</a>${x.oneLine ? `<p>${h(x.oneLine)}</p>` : ""}</li>`;
  const links = linked.length || back.length || c.linkNote.trim()
    ? (linked.length ? `<ul class="link-list">${linked.map(linkItem).join("")}</ul>` : "") +
      (back.length ? `<p class="small muted" style="margin:8px 0 4px">被这些卡片关联：</p><ul class="link-list">${back.map(linkItem).join("")}</ul>` : "") +
      (c.linkNote.trim() ? `<div class="md">${md(c.linkNote)}</div>` : "")
    : "";
  const one = `<section class="one-line recall-block" data-sec="1">
      <h2 class="sec-label"><span class="num">①</span>一句话</h2>
      <div class="sec-body"><p>${c.oneLine ? h(c.oneLine) : '<span class="blank">还没写一句话</span>'}</p></div>
      ${recall ? `<button type="button" class="reveal">揭晓</button>` : ""}
    </section>`;
  const text = (v) => (v.trim() ? `<div class="md">${md(v)}</div>` : "");
  // ⑤ and ⑥ sit side by side only when both are written.
  const pair = c.doubts.trim() && c.relevance.trim() ? "half" : "wide";
  return one +
    `<div class="sec-grid">
      ${block(2, text(c.pain))}
      ${block(3, text(c.idea))}
      ${block(4, proof)}
      ${block(5, text(c.doubts), pair)}
      ${block(6, text(c.relevance), pair)}
      ${block(7, links)}
    </div>`;
}

const markSym = (type) => `<span class="mark-sym t${M.MARKS.findIndex((x) => x.type === type)}" title="${M.markLabel(type)}">${type}</span>`;

function marksHtml(c) {
  if (!c.marks.length) return "";
  return `<section class="section"><h2>阅读标记</h2>
    <ul class="mark-view">${c.marks
      .map((m) => `<li>${markSym(m.type)}${m.page ? `<span class="page">p.${h(m.page)}</span>` : ""}<span>${renderInline(m.text)}${m.solve ? (m.answer ? ` <span class="solved-tick" title="已初步解决">✓</span>` : ` <span class="todo-tag">待解决</span>`) : ""}</span></li>`)
      .join("")}</ul></section>`;
}

// First pass: each mark flagged 待解决 with the answer found after reading once.
function solvedHtml(c, images) {
  const questions = c.marks.filter((m) => m.solve);
  if (!questions.length && !c.solved.trim()) return "";
  return `<section class="section"><h2>初步解决</h2>
    ${questions.length ? `<ul class="solve-view">${questions
      .map((m) => `<li><div class="q">${markSym(m.type)}${m.page ? `<span class="page">p.${h(m.page)}</span>` : ""}<span>${renderInline(m.text)}</span></div>
        <div class="a">${m.answer ? renderInline(m.answer) : '<span class="muted">还没解决</span>'}</div></li>`)
      .join("")}</ul>` : ""}
    ${c.solved.trim() ? `<div class="md">${mdOf(images)(c.solved)}</div>` : ""}</section>`;
}

const pdfName = (c) => c.pdfName || c.pdf.split("/").pop();

function headHtml(c) {
  const meta = [`<span class="status s-${c.status}">${M.STATUS_LABELS[c.status]}</span>`];
  if (c.readDate) meta.push(`<span>${longDate(c.readDate)} 阅读</span>`);
  if (c.project) meta.push(`<span>项目：${h(c.project)}</span>`);
  if (c.tags.length) meta.push(`<span>${c.tags.map((t) => `<a href="#/" data-goto-tag="${h(t)}">#${h(t)}</a>`).join(" ")}</span>`);
  const cite = M.citation(c);
  return `<div class="meta-line">${meta.join("")}</div>
    <h1 class="card-title">${c.title ? h(c.title) : '<span class="untitled">未写标题</span>'}</h1>
    ${cite || c.link ? `<p class="cite">${h(cite)}${c.link ? `${cite ? " · " : ""}<a href="${h(M.paperHref(c.link))}" target="_blank" rel="noopener">${h(linkLabel(c.link))}</a>` : ""}</p>` : ""}
    ${c.pdf ? `<p class="pdf-line"><a class="btn small" href="${h(c.pdf)}" download="${h(pdfName(c))}">下载论文 PDF</a><a class="small" href="${h(c.pdf)}" target="_blank" rel="noopener">在新标签页打开</a></p>` : ""}
    ${c.why ? `<p class="why"><b>为什么读：</b>${h(c.why)}</p>` : ""}`;
}

function reviewsHtml(c) {
  if (c.status !== "done") return "";
  const next = c.srs?.due;
  const today = M.todayISO();
  return `<section class="section"><h2>回顾记录</h2>
    <p class="muted small">${next ? (next <= today ? "今天该回顾了。" : `下次回顾：${longDate(next)}（${inDays(M.dayDiff(today, next))}）`) : ""}</p>
    ${c.reviews.length ? `<ul class="review-log">${c.reviews.slice().reverse()
      .map((r) => `<li><span>${r.date}</span><span class="grade g-${r.grade}">${M.GRADES[r.grade].label}</span>${r.next ? `<span class="muted">→ ${r.next}</span>` : ""}</li>`)
      .join("")}</ul>` : `<p class="muted small">还没回顾过。</p>`}</section>`;
}

async function cardView(id) {
  if (!M.validId(id)) return home();
  main.innerHTML = `<p class="loading">正在打开卡片…</p>`;
  const c = await getCard(id);
  if (!c) {
    main.innerHTML = `<div class="sheet"><h1>找不到这张卡片</h1><p>它可能刚发布、网站还没更新，或者已经删除了。</p><div class="btn-row"><a class="btn" href="#/">回到首页</a></div></div>`;
    return;
  }
  main.innerHTML = `
    <div class="toolbar">
      <a class="btn quiet" href="#/">← 全部卡片</a>
      <div class="btn-row">
        <button class="btn" id="recallBtn" aria-pressed="false">回忆模式</button>
        <button class="btn quiet" id="revealAll" hidden>全部揭晓</button>
        <button class="btn quiet" id="copyMd">复制 Markdown</button>
        <a class="btn" href="#/edit/${h(id)}">编辑</a>
      </div>
    </div>
    <article class="sheet card-page" id="cardPage">
      ${headHtml(c)}
      <p class="recall-hint" hidden>先别看：试着自己说出每一栏，再点「揭晓」对照。</p>
      ${cardBodyHtml(c, null, { recall: true })}
      ${marksHtml(c)}
      ${solvedHtml(c)}
      ${c.notes.trim() ? `<section class="section"><h2>自由笔记</h2><div class="md">${mdOf(null)(c.notes)}</div></section>` : ""}
      ${lab.relatedHtml(c.id)}
      ${reviewsHtml(c)}
    </article>`;
  const page = $("#cardPage");
  const setRecall = (on) => {
    page.classList.toggle("recall", on);
    $$(".recall-block", page).forEach((b) => b.classList.remove("revealed"));
    $("#recallBtn").setAttribute("aria-pressed", String(on));
    $("#recallBtn").textContent = on ? "退出回忆模式" : "回忆模式";
    $("#revealAll").hidden = !on;
    $(".recall-hint", page).hidden = !on;
  };
  $("#recallBtn").onclick = () => setRecall(!page.classList.contains("recall"));
  $("#revealAll").onclick = () => $$(".recall-block", page).forEach((b) => b.classList.add("revealed"));
  page.addEventListener("click", (e) => {
    const btn = e.target.closest(".reveal");
    if (btn) btn.closest(".recall-block").classList.add("revealed");
  });
  const titles = new Map(state.index.cards.map((x) => [x.id, x.title]));
  $("#copyMd").onclick = () => copyText(M.cardToMarkdown(c, titles));
  $$("[data-goto-tag]").forEach((a) => (a.onclick = () => { state.filter = { query: "", tag: a.dataset.gotoTag, project: "", status: "" }; }));
  typesetMath(main);
}

/* ---------- review ---------- */
async function reviewView() {
  const today = M.todayISO();
  const queue = M.dueCards(state.index.cards, today).map((x) => x.id);
  const tally = { forgot: 0, fuzzy: 0, good: 0 };
  let i = 0;

  const empty = () => {
    const next = M.nextReview(state.index.cards, today);
    const reviewed = tally.forgot + tally.fuzzy + tally.good;
    main.innerHTML = `<div class="sheet review-done">
      <h1>${reviewed ? "今天的回顾做完了" : "今天没有要回顾的卡片"}</h1>
      ${reviewed ? `<p>回顾了 ${reviewed} 张：想起来 ${tally.good} 张，有点模糊 ${tally.fuzzy} 张，忘了 ${tally.forgot} 张。忘了的明天会再出现。</p>` : `<p class="muted">卡片标成「读完」后，第二天开始提醒回顾；之后想得起来，间隔就会越来越长（1 → 7 → 30 → 90 → 180 天）。</p>`}
      ${next ? `<p class="muted">下一次：${longDate(next.date)}，${next.count} 张。</p>` : ""}
      <div class="btn-row"><a class="btn primary" href="#/">回到卡片</a></div></div>`;
  };

  async function show() {
    if (i >= queue.length) return empty();
    main.innerHTML = `<p class="loading">正在取出下一张…</p>`;
    const card = await getCard(queue[i]);
    if (!card) { i++; return show(); }
    const cite = M.citation(card);
    main.innerHTML = `
      <div class="toolbar"><span class="muted">第 ${i + 1} / ${queue.length} 张</span><a class="btn quiet" href="#/c/${h(card.id)}">打开卡片</a></div>
      <article class="sheet review">
        <h1 class="card-title">${h(card.title || "（未写标题）")}</h1>
        ${cite ? `<p class="cite">${h(cite)}</p>` : ""}
        <p class="review-prompt">用一句话说出它<b>用什么方法</b>、<b>解决了什么问题</b>、<b>结果如何</b>。</p>
        <label class="field"><span class="visually-hidden">我想起来的</span>
          <textarea class="textarea" id="recallText" rows="4" placeholder="先自己写下想起来的（只是帮你想，不会保存）"></textarea></label>
        <div class="btn-row" style="margin-top:12px"><button class="btn primary" id="revealBtn">揭晓答案</button></div>
        <div id="answer" hidden></div>
      </article>`;
    $("#recallText").focus();
    $("#revealBtn").onclick = () => {
      const mine = $("#recallText").value.trim();
      $("#revealBtn").parentElement.hidden = true;
      $("#recallText").closest(".field").hidden = true;
      const box = $("#answer");
      box.hidden = false;
      const grade = (g) => {
        const d = M.previewInterval(card, g);
        return `<button class="btn grade-btn g-${g}" data-grade="${g}"><b>${M.GRADES[g].label}</b><small>${inDays(d)}再看</small></button>`;
      };
      box.innerHTML = `
        ${mine ? `<div class="mine"><span class="label">我想起来的</span><p>${h(mine)}</p></div>` : ""}
        ${cardBodyHtml(card)}
        <div class="grade-bar"><span class="label">想得怎么样？</span><div class="grades">${grade("forgot")}${grade("fuzzy")}${grade("good")}</div></div>`;
      typesetMath(box);
      $$("[data-grade]", box).forEach((b) => (b.onclick = () => submit(card, b.dataset.grade)));
      $(".grade-bar", box).scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
  }

  async function submit(card, grade) {
    if (!(await ensureUnlocked())) return;
    const buttons = $$("[data-grade]");
    buttons.forEach((b) => (b.disabled = true));
    try {
      await saveCard(card, "回顾 " + (card.title || card.id).slice(0, 50) + "：" + M.GRADES[grade].label, (latest) => M.gradeCard(latest, grade, today));
      tally[grade]++;
      i++;
      show();
    } catch (error) {
      console.error(error);
      if (error.status === 401) lock(true);
      toast("保存失败：" + error.message, "error");
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  if (!queue.length) return empty();
  return show();
}

/* ---------- editor ---------- */
async function editView(id) {
  const isNew = !id;
  if (!isNew && !M.validId(id)) return home();
  main.innerHTML = `<p class="loading">正在打开编辑器…</p>`;
  const existing = isNew ? null : await getCard(id).catch(() => null);
  if (!isNew && !existing) {
    main.innerHTML = `<div class="sheet"><h1>找不到这张卡片</h1><p>它可能刚发布、网站还没更新。稍等一分钟再试。</p><div class="btn-row"><a class="btn" href="#/">回到首页</a></div></div>`;
    return;
  }
  const draftKey = "pc-draft-" + (id || "new");
  const draft = store.get(draftKey);
  let card;
  let images = {};
  let restored = false;
  if (draft && (!existing || (draft.savedAt || "") > (existing.updatedAt || ""))) {
    try {
      card = M.normalizeCard({ ...draft.card, id: id || "00000000-new-0000" });
      images = draft.images || {};
      restored = true;
    } catch { card = null; }
  }
  if (!card) card = existing ? structuredClone(existing) : { ...M.emptyCard("00000000-new-0000"), readDate: M.todayISO() };
  const others = state.index.cards.filter((x) => x.id !== id);
  const back = isNew ? [] : M.backlinks(state.index.cards, id);
  const projects = M.projectList(state.index.cards).map(([p]) => p);
  const allTags = M.tagCounts(state.index.cards).map(([t]) => t);
  const sec = (n) => M.SECTIONS[n - 1];
  const tools = (name, image = false) =>
    `<div class="md-tools"><button type="button" class="fmt" data-fmt="**" data-for="${name}" title="加粗（⌘/Ctrl + B）" aria-label="加粗"><b>B</b></button><button type="button" class="fmt" data-fmt="*" data-for="${name}" title="斜体（⌘/Ctrl + I）" aria-label="斜体"><i>I</i></button>${image ? `<button type="button" class="btn quiet small" data-image="${name}">插入图片</button>` : ""}</div>`;
  const secHead = (n, hint) => `<h3><span class="num">${sec(n).mark}</span>${sec(n).title}</h3>${hint ? `<p class="hint">${hint}</p>` : ""}`;

  main.innerHTML = `
    <div class="toolbar">
      <a class="btn quiet" href="${existing ? "#/c/" + h(id) : "#/"}">← 返回</a>
      <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="edit">编辑</button><button role="tab" aria-selected="false" data-tab="preview">预览</button></div>
    </div>
    ${restored ? `<div class="banner warn"><span>已恢复这台设备上还没发布的草稿。</span><button class="btn quiet" id="discardDraft">放弃草稿</button></div>` : ""}
    ${!state.gh.unlocked ? `<div class="banner"><span>你可以先写，发布时再输入密码。草稿会自动保存在这台设备上。</span></div>` : ""}
    <form class="sheet" id="editor" autocomplete="off">
      <label class="field"><span class="visually-hidden">论文标题</span>
        <input class="title-input" name="title" maxlength="300" placeholder="论文标题"></label>
      <div class="meta-grid">
        <label class="field"><span>作者</span><input name="authors" maxlength="300" placeholder="作者姓名"></label>
        <label class="field"><span>年份</span><input name="year" type="number" min="1800" max="2200" inputmode="numeric" placeholder="发表年份"></label>
        <label class="field"><span>会议 / 期刊</span><input name="venue" maxlength="120" placeholder="会议或期刊名称"></label>
        <label class="field"><span>链接</span><input name="link" maxlength="500" placeholder="网址、DOI 或 arXiv 编号"></label>
        <label class="field"><span>标签</span><input name="tags" list="tagList" placeholder="用逗号分开"></label>
        <label class="field"><span>项目</span><input name="project" list="projList" maxlength="60" placeholder="可以留空"></label>
        <label class="field"><span>阅读日期</span><input name="readDate" type="date"></label>
        <div class="field"><span class="label" id="statusLabel">状态</span><div class="seg" role="group" aria-labelledby="statusLabel">
          <button type="button" data-status="reading">在读</button><button type="button" data-status="done">读完</button></div></div>
      </div>
      <div class="pdf-field"><span class="label">论文 PDF</span>
        <div class="pdf-box" id="pdfBox"></div>
        <p class="hint small">PDF 会存到 GitHub 仓库的 papers/ 文件夹，之后在卡片页可以下载。仓库是公开的，知道链接的人都能下载，付费期刊的论文请留意版权。最大 50 MB。</p>
        <input type="file" id="pdfPick" accept="application/pdf,.pdf" hidden></div>
      <datalist id="projList">${projects.map((p) => `<option value="${h(p)}">`).join("")}</datalist>
      <datalist id="tagList">${allTags.map((t) => `<option value="${h(t)}">`).join("")}</datalist>

      <section class="stage"><h2><span class="stage-n">1</span>读之前</h2>
        <label class="field"><span>为什么读这篇、想从里面得到什么？（一行）</span>
          <input name="why" maxlength="300" placeholder="为什么读这篇，想从中得到什么"></label></section>

      <section class="stage"><h2><span class="stage-n">2</span>边读边记</h2>
        <p class="hint">只打标记，不写长句。选一个符号，写几个字，回车就记下一条。页码从 1 开始，翻页时点 ＋（也可以直接改数字，或清空不填）。觉得这一条还没解决，就勾上「待解决」，它会出现在下面的「初步解决」里。</p>
        <div class="mark-input">
          <div class="mark-types"><div class="mark-kinds" role="radiogroup" aria-label="标记类型">${M.MARKS.map((m, k) => `<button type="button" role="radio" class="t${k}" data-type="${m.type}" aria-checked="${k === 0}"><b>${m.type}</b>${m.label}</button>`).join("")}</div>
            <div class="mark-opts"><label class="solve-flag"><input type="checkbox" id="markSolve"> 待解决</label><div class="fmt-pair"><button type="button" class="fmt" data-fmt="**" data-for="markText" title="加粗（⌘/Ctrl + B）" aria-label="加粗"><b>B</b></button><button type="button" class="fmt" data-fmt="*" data-for="markText" title="斜体（⌘/Ctrl + I）" aria-label="斜体"><i>I</i></button></div></div></div>
          <div class="mark-line">
            <div class="page-step"><button type="button" class="step" data-step="-1" aria-label="上一页">−</button><input class="input page" id="markPage" placeholder="页" maxlength="12" inputmode="numeric" aria-label="页码"><button type="button" class="step" data-step="1" aria-label="下一页">＋</button></div>
            <input class="input" id="markText" maxlength="300" placeholder="写几个字，回车记下" aria-label="标记内容" enterkeyhint="done">
            <button type="button" class="btn" id="addMark">记下</button></div>
        </div>
        <ol class="marks-list" id="marks"></ol></section>

      <section class="stage"><h2><span class="stage-n">3</span>初步解决问题</h2>
        <div id="solveBody">
          <p class="hint">「边读边记」里勾了「待解决」的标记列在这里。读完第一遍后给它们写答案；没弄懂的留空，之后可以「带入」到 ⑤。</p>
          <p class="small" id="solveCount"></p>
          <ol class="solve-list" id="solveList"></ol>
          <label class="field" style="margin-top:12px"><span>其他初步弄懂的</span><textarea class="textarea" name="solved" rows="3" placeholder="其他读完第一遍弄懂的地方"></textarea></label>
          ${tools("solved")}
        </div></section>

      <section class="stage"><h2><span class="stage-n">4</span>读完 · 合上论文再写</h2>
        <p class="callout">写的时候不看原文，写不出来的那栏就是没懂的地方。</p>

        <div class="esec">${secHead(1, "最重要的一栏。点下面的句式，直接打字填空，按 Tab 跳到下一个空。")}
          <div class="prompts"><button type="button" id="oneLineTpl">用【什么方法】解决了【什么问题】，结果【比谁好多少】</button></div>
          <textarea class="textarea one" name="oneLine" rows="2" maxlength="400" placeholder="用一句话概括这篇论文"></textarea></div>

        <div class="esec">${secHead(2, "它要解决什么问题？之前的方法差在哪？")}
          <textarea class="textarea" name="pain" rows="3"></textarea>${tools("pain")}</div>

        <div class="esec">${secHead(3, "它的关键一招是什么？能画出来就画一张图。")}
          <textarea class="textarea" name="idea" rows="5"></textarea>${tools("idea", true)}</div>

        <div class="esec">${secHead(4, "用什么数据、和谁比、关键数字是多少。")}
          <div class="proof-grid">
            <label class="field"><span>数据集</span><textarea class="textarea short" name="datasets" rows="2"></textarea></label>
            <label class="field"><span>对比对象</span><textarea class="textarea short" name="baselines" rows="2"></textarea></label>
            <label class="field"><span>关键数字</span><textarea class="textarea short" name="numbers" rows="2"></textarea></label>
          </div></div>

        <div class="esec">${secHead(5, "哪里没看懂、哪里站不住、哪些情况它不适用。")}
          <div class="prompts"><button type="button" data-bring="doubts">带入阅读时的 ? 和 ×（已解决的不带）</button></div>
          <textarea class="textarea" name="doubts" rows="4"></textarea>${tools("doubts")}</div>

        <div class="esec">${secHead(6, "我能借鉴什么？对我的研究有什么用？")}
          <div class="prompts"><button type="button" data-bring="relevance">带入 ★</button></div>
          <textarea class="textarea" name="relevance" rows="4"></textarea>${tools("relevance")}</div>

        <div class="esec">${secHead(7, "搜索并选中相关的已有卡片，再写一句它们的区别。关联只记下对方的编号，不会多出卡片；两张卡片上都会显示。")}
          <div class="link-chosen" id="linkChosen"></div>
          ${others.length ? `<div class="link-search"><input class="input" id="linkSearch" placeholder="输入标题、作者或关键词找卡片…" autocomplete="off" aria-label="搜索要关联的卡片"><div class="link-results" id="linkResults"></div></div>` : `<p class="muted small">还没有其他卡片可以关联。</p>`}
          ${back.length ? `<p class="hint small" style="margin-top:6px">这些卡片已经关联了这张，会自动显示在两边，不用再选：${back.map((b) => h(b.title || b.id)).join("、")}</p>` : ""}
          <textarea class="textarea" name="linkNote" rows="3" placeholder="这篇和关联论文的区别" style="margin-top:8px"></textarea>${tools("linkNote")}</div>
      </section>

      <section class="stage"><h2><span class="stage-n">+</span>自由笔记</h2>
        <p class="hint">任何想记的：公式、推导、代码、截图。支持 Markdown，公式用 $…$。</p>
        <textarea class="textarea" name="notes" rows="6"></textarea>${tools("notes", true)}</section>
      <input type="file" id="imgPick" accept="image/*" hidden>
    </form>
    <div class="sheet" id="preview" hidden></div>
    <div class="editor-bar">
      <div class="bar-state"><b id="progress"></b><span class="save-state" id="saveState">${restored ? "草稿已恢复" : "草稿自动保存在这台设备"}</span></div>
      <div class="btn-row">
        ${existing ? `<button type="button" class="btn quiet danger" id="deleteCard">删除</button>` : ""}
        <button type="button" class="btn primary" id="publish">发布</button>
      </div>
    </div>`;

  const form = $("#editor");
  for (const k of ["title", "authors", "venue", "link", "project", "readDate", "why", "oneLine", "pain", "idea", "doubts", "relevance", "linkNote", "notes", "solved"]) form[k].value = card[k] ?? "";
  form.year.value = card.year ?? "";
  form.tags.value = card.tags.join(", ");
  for (const k of ["datasets", "baselines", "numbers"]) form[k].value = card.proof[k];

  let status = card.status;
  const paintStatus = () => $$("[data-status]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === status)));
  paintStatus();
  $$("[data-status]").forEach((b) => (b.onclick = () => { status = b.dataset.status; paintStatus(); changed(); }));

  // Reading marks
  let markType = M.MARKS[0].type;
  const typeIndex = (t) => M.MARKS.findIndex((m) => m.type === t);
  const markRow = (m) =>
    `<li data-row="mark"><button type="button" class="mark-sym t${typeIndex(m.type)}" data-type="${m.type}" title="${M.markLabel(m.type)}（点一下换符号）">${m.type}</button><input class="input page" data-k="page" value="${h(m.page)}" placeholder="页" aria-label="页码"><input class="input" data-k="text" value="${h(m.text)}" aria-label="标记内容"><input type="hidden" data-k="answer" value="${h(m.answer || "")}"><label class="row-flag" title="待解决：勾上后出现在「初步解决」里"><input type="checkbox" data-k="solve"${m.solve ? " checked" : ""}><span>待解决</span></label><button type="button" class="x" aria-label="删除">×</button></li>`;
  $("#marks").innerHTML = card.marks.map(markRow).join("");
  const paintTypes = () => $$(".mark-kinds [data-type]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === markType)));
  $$(".mark-kinds [data-type]").forEach((b) => (b.onclick = () => { markType = b.dataset.type; paintTypes(); $("#markText").focus(); }));
  // Page number: starts at 1 (or where the last mark was) and steps with − / ＋.
  $("#markPage").value = card.marks.at(-1)?.page || "1";
  const stepPage = (d) => {
    const input = $("#markPage");
    input.value = String(Math.max(1, (parseInt(input.value, 10) || 0) + d));
  };
  $$(".page-step [data-step]").forEach((b) => (b.onclick = () => stepPage(+b.dataset.step)));
  const addMark = () => {
    const text = $("#markText").value.trim();
    if (!text) return $("#markText").focus();
    $("#marks").insertAdjacentHTML("beforeend", markRow({ type: markType, page: $("#markPage").value.trim(), text, solve: $("#markSolve").checked }));
    $("#markText").value = "";
    $("#markSolve").checked = false; // flag each unsolved mark on its own
    $("#markText").focus();
    renderSolve();
    changed();
  };
  $("#addMark").onclick = addMark;
  $("#markText").addEventListener("keydown", (e) => { if (plainEnter(e)) { e.preventDefault(); addMark(); } });
  $("#markPage").addEventListener("keydown", (e) => {
    if (plainEnter(e)) { e.preventDefault(); $("#markText").focus(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); stepPage(e.key === "ArrowUp" ? 1 : -1); }
  });

  // First pass: one answer box per mark flagged 待解决, stored on the mark itself.
  let solveRows = [];
  const paintSolveCount = () => {
    const open = solveRows.filter((r) => !$("[data-k=answer]", r).value.trim()).length;
    $("#solveCount").textContent = solveRows.length ? (open ? `还有 ${open} 条待解决，已解决 ${solveRows.length - open} 条。` : `${solveRows.length} 条都初步解决了。`) : "";
  };
  function renderSolve() {
    solveRows = $$("#marks [data-row]").filter((r) => $("[data-k=solve]", r).checked);
    $("#solveList").innerHTML = solveRows.length
      ? solveRows.map((r, i) => {
          const page = $("[data-k=page]", r).value.trim();
          return `<li><div class="q">${markSym($(".mark-sym", r).dataset.type)}${page ? `<span class="page">p.${h(page)}</span>` : ""}<span>${renderInline($("[data-k=text]", r).value)}</span></div>
            <input class="input" data-solve="${i}" value="${h($("[data-k=answer]", r).value)}" placeholder="这个问题的答案，没弄懂就留空" aria-label="答案"></li>`;
        }).join("")
      : `<li class="muted small">还没有勾「待解决」的标记。</li>`;
    paintSolveCount();
  }
  renderSolve();
  $("#solveList").addEventListener("input", (e) => {
    const row = solveRows[e.target.dataset.solve];
    if (row) { $("[data-k=answer]", row).value = e.target.value; paintSolveCount(); }
  });
  $("#marks").addEventListener("input", renderSolve);
  $("#marks").addEventListener("click", (e) => {
    const sym = e.target.closest(".mark-sym");
    if (!sym) return;
    const next = M.MARKS[(typeIndex(sym.dataset.type) + 1) % M.MARKS.length];
    sym.dataset.type = next.type;
    sym.textContent = next.type;
    sym.className = "mark-sym t" + typeIndex(next.type);
    sym.title = next.label + "（点一下换符号）";
    renderSolve();
    changed();
  });
  form.addEventListener("click", (e) => {
    const x = e.target.closest(".x");
    if (x) { x.closest("[data-row]").remove(); renderSolve(); changed(); }
    const fmt = e.target.closest(".fmt");
    if (fmt) wrapSelection(fmt.dataset.for === "markText" ? $("#markText") : form[fmt.dataset.for], fmt.dataset.fmt);
  });
  form.addEventListener("keydown", (e) => {
    // Enter never submits the form (input methods confirm words with it).
    if (e.key === "Enter" && e.target.matches("input") && !e.target.closest(".mark-input")) e.preventDefault();
    if ((e.metaKey || e.ctrlKey) && !e.altKey && /^[bi]$/i.test(e.key) && e.target.matches(FORMATTABLE)) {
      e.preventDefault();
      wrapSelection(e.target, e.key.toLowerCase() === "b" ? "**" : "*");
    }
  });

  // ① sentence pattern: insert it and select the first unfilled blank; Tab jumps to the next one.
  const BLANK = /【(什么方法|什么问题|比谁好多少)】/;
  const selectBlank = () => {
    const area = form.oneLine;
    const m = BLANK.exec(area.value);
    if (!m) return false;
    area.focus();
    area.setSelectionRange(m.index + 1, m.index + m[0].length - 1);
    return true;
  };
  $("#oneLineTpl").onclick = () => {
    const area = form.oneLine;
    if (!BLANK.test(area.value)) area.value = (area.value.trim() ? area.value.trim() + " " : "") + ONE_LINE_TEMPLATE;
    selectBlank();
    changed();
  };
  form.oneLine.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey && !e.isComposing && BLANK.test(form.oneLine.value)) {
      e.preventDefault();
      selectBlank();
    }
  });
  // Filled-in blanks lose their brackets when leaving the box.
  form.oneLine.addEventListener("blur", () => {
    const v = form.oneLine.value.replace(/【([^】]*)】/g, (all, inner) => (BLANK.test(all) ? all : inner));
    if (v !== form.oneLine.value) { form.oneLine.value = v; changed(); }
  });

  // "带入": copy reading marks into ⑤ / ⑥.
  $$("[data-bring]").forEach((b) => {
    const types = b.dataset.bring === "doubts" ? ["?", "×"] : ["★"];
    b.onclick = () => {
      const area = form[b.dataset.bring];
      const lines = M.marksToLines(collectMarks(), types, area.value);
      if (!lines.length) return toast(b.dataset.bring === "doubts" ? "没有新的 ? 或 × 标记可以带入。" : "没有新的 ★ 标记可以带入。");
      area.value = (area.value.trim() ? area.value.replace(/\s*$/, "\n") : "") + lines.join("\n") + "\n";
      area.focus();
      changed();
    };
  });

  // ⑦ links: chosen cards as chips; search to add more.
  let links = [...card.links];
  const titleOfId = (x) => state.index.cards.find((c) => c.id === x)?.title || x;
  const paintLinks = () => {
    $("#linkChosen").innerHTML = links
      .map((x) => `<span class="link-chip">${h(titleOfId(x))}<button type="button" class="unlink" data-unlink="${h(x)}" aria-label="取消关联">×</button></span>`)
      .join("");
  };
  const paintResults = () => {
    const box = $("#linkResults");
    if (!box) return;
    const q = $("#linkSearch").value.trim().toLowerCase();
    const focused = document.activeElement === $("#linkSearch");
    if (!q && !focused) return (box.innerHTML = "");
    const terms = q.split(/\s+/).filter(Boolean);
    const list = others
      .filter((x) => !links.includes(x.id) && terms.every((t) => (x.title + " " + x.authors + " " + x.oneLine + " " + x.tags.join(" ")).toLowerCase().includes(t)))
      .slice(0, 6);
    box.innerHTML = list.length
      ? (q ? "" : `<p class="muted small">最近的卡片：</p>`) + list.map((x) => `<button type="button" class="link-result" data-link="${h(x.id)}"><b>${h(x.title || x.id)}</b>${x.oneLine ? `<span>${h(x.oneLine)}</span>` : ""}</button>`).join("")
      : q ? `<p class="muted small">没有找到匹配的卡片。</p>` : "";
  };
  paintLinks();
  $("#linkSearch")?.addEventListener("input", paintResults);
  $("#linkSearch")?.addEventListener("focus", paintResults);
  $("#linkSearch")?.addEventListener("blur", () => setTimeout(paintResults, 200));
  // Picking a result must not blur the search box first.
  $("#linkResults")?.addEventListener("pointerdown", (e) => e.preventDefault());
  form.addEventListener("click", (e) => {
    const add = e.target.closest("[data-link]");
    const remove = e.target.closest("[data-unlink]");
    if (!add && !remove) return;
    if (add) { links.push(add.dataset.link); $("#linkSearch").value = ""; }
    else links = links.filter((x) => x !== remove.dataset.unlink);
    paintLinks();
    paintResults();
    changed();
  });

  // Paper PDF: uploaded to the repository right away so it is never lost.
  let pdf = card.pdf;
  let pdfLabel = card.pdfName;
  const uploadedPdfs = new Set();
  const paintPdf = () => {
    $("#pdfBox").innerHTML = pdf
      ? `<span class="pdf-file" title="${h(pdf)}">${h(pdfLabel || pdf.split("/").pop())}</span><button type="button" class="btn small" id="pdfReplace">换一个</button><button type="button" class="btn quiet small danger" id="pdfRemove">移除</button>`
      : `<button type="button" class="btn small" id="pdfUpload">上传 PDF</button>`;
    ($("#pdfUpload") || $("#pdfReplace")).onclick = () => $("#pdfPick").click();
    $("#pdfRemove")?.addEventListener("click", () => { pdf = ""; pdfLabel = ""; paintPdf(); changed(); toast("已移除。发布后仓库里的 PDF 也会删掉。"); });
  };
  paintPdf();
  $("#pdfPick").onchange = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return toast("请选择 PDF 文件。", "error");
    if (file.size > M.PDF_MAX_BYTES) return toast("PDF 太大了（" + mb(file.size) + "），最大 50 MB。", "error");
    if (!(await ensureUnlocked())) return;
    const box = $("#pdfBox");
    box.innerHTML = `<span class="muted">正在上传 ${h(file.name)}（${mb(file.size)}）…</span>`;
    try {
      const path = M.pdfPath(isNew ? M.makeId(form.readDate.value || M.todayISO(), form.title.value || file.name.replace(/\.pdf$/i, "")) : id);
      const base64 = await fileToBase64(file);
      await state.gh.commitLatest(async () => ({ message: "上传论文 PDF：" + file.name.slice(0, 80), files: [{ path, base64 }] }));
      uploadedPdfs.add(path);
      pdf = path;
      pdfLabel = file.name;
      changed();
      toast("PDF 已上传到仓库。记得点「发布」保存卡片。");
    } catch (error) {
      console.error(error);
      toast("上传失败：" + error.message, "error");
    }
    paintPdf();
  };

  // Images: resized in the browser, published with the card.
  let imageTarget = "notes";
  $$("[data-image]").forEach((b) => (b.onclick = () => { imageTarget = b.dataset.image; $("#imgPick").click(); }));
  $("#imgPick").onchange = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await shrinkImage(file);
      const ext = dataUrl.startsWith("data:image/webp") ? "webp" : "jpg";
      const day = M.todayISO();
      const path = "uploads/" + day.slice(0, 7) + "/" + day.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      images[path] = dataUrl;
      const area = form[imageTarget];
      const pos = area.selectionStart ?? area.value.length;
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
      const snippet = (pos && area.value[pos - 1] !== "\n" ? "\n" : "") + "![" + name + "](" + path + ")\n";
      area.setRangeText(snippet, pos, pos, "end");
      changed();
      toast("图片已插入，发布时一起上传。");
    } catch (error) {
      toast(error.message, "error");
    }
  };

  const collectMarks = () =>
    $$("#marks [data-row]").map((r) => ({ type: $(".mark-sym", r).dataset.type, page: $("[data-k=page]", r).value, text: $("[data-k=text]", r).value, answer: $("[data-k=answer]", r).value, solve: $("[data-k=solve]", r).checked }));
  const collect = () =>
    M.normalizeCard({
      ...card,
      title: form.title.value,
      authors: form.authors.value,
      year: form.year.value,
      venue: form.venue.value,
      link: form.link.value,
      pdf,
      pdfName: pdfLabel,
      tags: form.tags.value,
      project: form.project.value,
      readDate: form.readDate.value,
      status,
      why: form.why.value,
      marks: collectMarks(),
      solved: form.solved.value,
      oneLine: form.oneLine.value,
      pain: form.pain.value,
      idea: form.idea.value,
      proof: { datasets: form.datasets.value, baselines: form.baselines.value, numbers: form.numbers.value },
      doubts: form.doubts.value,
      relevance: form.relevance.value,
      links,
      linkNote: form.linkNote.value,
      notes: form.notes.value,
    });

  const paintProgress = () => {
    const c = collect();
    const p = M.filledSections(c);
    const el = $("#progress");
    el.textContent = M.progressText(c);
    el.classList.toggle("complete", !p.missing.length);
  };
  paintProgress();

  let saveTimer;
  const saveDraft = () => store.set(draftKey, { card: collect(), images, savedAt: new Date().toISOString() });
  function changed() {
    editorDirty = true;
    paintProgress();
    clearTimeout(saveTimer);
    $("#saveState").textContent = "正在保存草稿…";
    saveTimer = setTimeout(() => {
      if (!form.isConnected) return; // published or left in the meantime
      $("#saveState").textContent = saveDraft() ? "草稿已保存在这台设备" : "这台设备无法保存草稿（存储已满或被禁用）";
    }, 600);
  }
  form.addEventListener("input", changed);
  form.addEventListener("change", changed);
  leaveEditor = async () => {
    clearTimeout(saveTimer);
    saveDraft();
    return true; // the draft is kept, so leaving never loses work
  };
  window.onbeforeunload = () => { if (editorDirty) saveDraft(); };

  $("#discardDraft")?.addEventListener("click", async () => {
    if (!(await confirmDialog("放弃草稿？", "这台设备上还没发布的修改会被删除。", "放弃草稿", true))) return;
    store.del(draftKey);
    editorDirty = false;
    route();
  });

  $$("[data-tab]").forEach((tab) => (tab.onclick = () => {
    const preview = tab.dataset.tab === "preview";
    $$("[data-tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    form.hidden = preview;
    const box = $("#preview");
    box.hidden = !preview;
    if (preview) {
      const c = collect();
      box.innerHTML = headHtml(c) + cardBodyHtml(c, images) + marksHtml(c) + solvedHtml(c, images) +
        (c.notes.trim() ? `<section class="section"><h2>自由笔记</h2><div class="md">${mdOf(images)(c.notes)}</div></section>` : "");
      typesetMath(box);
    }
  }));

  $("#publish").onclick = async () => {
    const draftCard = collect();
    if (!draftCard.title) {
      toast("先写上论文标题再发布。", "error");
      form.title.focus();
      return;
    }
    if (!(await ensureUnlocked())) return;
    clearTimeout(saveTimer);
    const btn = $("#publish");
    btn.disabled = true;
    btn.textContent = "正在发布…";
    try {
      const today = M.todayISO();
      const finalId = isNew ? M.makeId(draftCard.readDate || today, draftCard.title) : id;
      const c = M.applyStatus({ ...draftCard, id: finalId }, today);
      // Only upload images still referenced in the text.
      const text = c.idea + c.notes + c.pain + c.doubts + c.relevance + c.linkNote + c.solved;
      const uploads = Object.entries(images).filter(([path]) => text.includes(path));
      // PDFs replaced or removed while editing are deleted from the repository.
      const stalePdfs = [...new Set([existing?.pdf, ...uploadedPdfs])].filter((p) => p && p !== c.pdf);
      await saveCard(c, (isNew ? "新增卡片：" : "更新卡片：") + c.title.slice(0, 60), isNew ? null : (latest) =>
        // Keep review history recorded on other devices in the meantime.
        ({ ...c, srs: c.status === "done" ? latest.srs || c.srs : c.srs, reviews: latest.reviews.length > c.reviews.length ? latest.reviews : c.reviews }),
        [
          ...uploads.map(([path, url]) => ({ path, base64: url.split(",")[1] })),
          ...stalePdfs.map((path) => ({ path, remove: true })),
        ],
      );
      store.del(draftKey);
      editorDirty = false;
      window.onbeforeunload = null;
      // Keep local previews of new images until the site has rebuilt.
      if (uploads.length) store.set("pc-imgcache", { ...(store.get("pc-imgcache") || {}), ...Object.fromEntries(uploads) });
      toast("已发布。网站大约 1 分钟后对所有人更新。");
      location.hash = "#/c/" + finalId;
    } catch (error) {
      console.error(error);
      if (error.status === 401) lock(true);
      toast("发布失败：" + error.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "发布";
    }
  };

  $("#deleteCard")?.addEventListener("click", async () => {
    if (!(await confirmDialog("删除这张卡片？", "删除后网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。", "删除", true))) return;
    if (!(await ensureUnlocked())) return;
    try {
      await state.gh.commitLatest(async (head) => {
        const index = M.normalizeIndex(await state.gh.readJSON(M.INDEX_PATH, head));
        return {
          message: "删除卡片：" + (existing.title || id).slice(0, 60),
          files: [
            { path: M.CARD_DIR + id + ".json", remove: true },
            ...(existing.pdf ? [{ path: existing.pdf, remove: true }] : []),
            { path: M.INDEX_PATH, text: JSON.stringify(M.removeFromIndex(index, id), null, 1) + "\n" },
          ],
        };
      });
      state.cards.delete(id);
      state.index = M.removeFromIndex(state.index, id);
      rememberRecent({ id }, true);
      updateBadge();
      clearTimeout(saveTimer);
      store.del(draftKey);
      editorDirty = false;
      toast("已删除。");
      location.hash = "#/";
    } catch (error) {
      toast("删除失败：" + error.message, "error");
    }
  });
}

async function shrinkImage(file, max = 1600) {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件。");
  if (file.size > 25 * 1024 * 1024) throw new Error("图片太大了（超过 25 MB）。");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("无法读取这张图片。");
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let url = canvas.toDataURL("image/webp", 0.82);
  if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", 0.85);
  return url;
}

/* ---------- settings ---------- */
async function settingsView() {
  const site = state.site;
  const vault = await loadVault();
  const unlocked = state.gh.unlocked;
  main.innerHTML = `
    <div class="sheet">
      <h1 style="margin-top:0">设置</h1>
      ${!vault ? `<div class="banner warn"><span>还没有设置密码，网站暂时不能编辑。</span><a class="btn primary" href="#/setup">开始设置</a></div>` : ""}
      <form class="form-grid" id="siteForm">
        <label class="field"><span>网站标题</span><input name="title" maxlength="40" value="${h(site.title)}"></label>
        <label class="field"><span>一句话介绍</span><input name="subtitle" maxlength="120" value="${h(site.subtitle)}"></label>
        <label class="field"><span>作者</span><input name="author" maxlength="40" value="${h(site.author)}" placeholder="可以留空"></label>
        <div class="btn-row"><button class="btn primary">保存设置</button><span class="muted small">保存后会发布到网站。</span></div>
      </form>
    </div>
    <div class="sheet">
      <h2 style="margin-top:0">密码与授权</h2>
      ${vault ? `<p class="muted">上次设置：${h((vault.updatedAt || "").slice(0, 10) || "未知")}。这台设备${unlocked ? "已解锁" : "未解锁"}。</p>` : ""}
      <div class="btn-row">
        ${vault ? `<button class="btn" id="changePw">修改密码 / 更换令牌</button>` : `<a class="btn primary" href="#/setup">开始设置</a>`}
        ${unlocked ? `<button class="btn" id="lockNow">在这台设备上锁定</button>` : ""}
      </div>
    </div>
    <div class="sheet">
      <h2 style="margin-top:0">备份</h2>
      <p class="muted">所有卡片都保存在 GitHub 仓库 <a href="https://github.com/${h(state.gh.repo)}" target="_blank" rel="noopener">${h(state.gh.repo)}</a> 里，每次发布都有历史记录。也可以随时下载一份。</p>
      <div class="btn-row"><button class="btn" id="exportMd">下载全部论文卡片（Markdown）</button><button class="btn" id="exportLogs">下载全部实操记录（Markdown）</button><button class="btn" id="exportJson">下载全部（JSON）</button></div>
    </div>`;

  $("#siteForm").onsubmit = async (event) => {
    event.preventDefault();
    const f = event.target;
    const next = { ...state.site, title: f.title.value.trim() || "文献卡片", subtitle: f.subtitle.value.trim(), author: f.author.value.trim() };
    if (!(await ensureUnlocked())) return;
    const btn = $("button.primary", f);
    btn.disabled = true;
    try {
      await state.gh.commitLatest(async () => ({ message: "更新网站设置", files: [{ path: M.SITE_PATH, text: JSON.stringify(next, null, 2) + "\n" }] }));
      state.site = next;
      applySite();
      toast("设置已保存。网站大约 1 分钟后更新。");
    } catch (error) {
      toast("保存失败：" + error.message, "error");
    } finally {
      btn.disabled = false;
    }
  };
  $("#lockNow")?.addEventListener("click", () => { lock(); toast("已锁定。"); settingsView(); });
  $("#changePw")?.addEventListener("click", changePassword);
  const loadAll = async () => {
    toast("正在整理全部卡片…");
    return (await Promise.all(state.index.cards.map((x) => getCard(x.id)))).filter(Boolean);
  };
  const titles = () => new Map(state.index.cards.map((x) => [x.id, x.title]));
  $("#exportMd").onclick = async () => download("文献卡片-全部-" + M.todayISO() + ".md", (await loadAll()).map((c) => M.cardToMarkdown(c, titles())).join("\n---\n\n"));
  $("#exportLogs").onclick = async () => download("实操记录-全部-" + M.todayISO() + ".md", (await lab.loadAll()).map((l) => L.logToMarkdown(l, titles())).join("\n---\n\n"));
  $("#exportJson").onclick = async () => download("文献卡片-全部-" + M.todayISO() + ".json", JSON.stringify({ site: state.site, cards: await loadAll(), logs: await lab.loadAll(), maps: await maps.loadAll() }, null, 2), "application/json");
}

async function changePassword() {
  const vault = await loadVault();
  await dialog(
    `<form method="dialog" id="pwForm"><h2>修改密码 / 更换令牌</h2>
      <p>先输入现在的密码。令牌过期时，在这里粘贴新令牌。</p>
      <div class="form-grid">
        <label class="field"><span>现在的密码</span><input type="password" name="old" autocomplete="current-password" required autofocus></label>
        <label class="field"><span>新密码（不改就留空）</span><input type="password" name="pw" autocomplete="new-password"></label>
        <label class="field"><span>新令牌（不换就留空）</span><input type="password" name="token" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
      </div>
      <p class="error" id="pwErr"></p>
      <div class="dialog-actions"><button type="button" class="btn" data-c>取消</button><button class="btn primary">保存</button></div></form>`,
    (el, close) => {
      $("[data-c]", el).onclick = () => close();
      $("#pwForm", el).onsubmit = async (event) => {
        event.preventDefault();
        const f = event.target;
        const err = $("#pwErr", el);
        const btn = $("button.primary", f);
        err.textContent = "";
        btn.disabled = true;
        try {
          let token;
          try {
            token = await openVault(vault, f.old.value, state.gh.repo);
          } catch {
            throw new Error("现在的密码不对。");
          }
          const newToken = f.token.value.trim() || token;
          if (!validToken(newToken)) throw new Error("令牌应该以 github_pat_ 开头，请检查是否复制完整。");
          const newPw = f.pw.value || f.old.value;
          if (f.pw.value) { const p = passwordProblem(newPw); if (p) throw new Error(p); }
          state.gh.setToken(newToken);
          await state.gh.checkAccess();
          const sealed = await sealToken(newToken, newPw, state.gh.repo);
          await state.gh.commitLatest(async () => ({ message: "更新编辑授权", files: [{ path: M.VAULT_PATH, text: JSON.stringify(sealed, null, 2) + "\n" }] }));
          state.vault = sealed;
          saveToken(newToken, false);
          updateLockButton();
          close();
          toast("已保存。其他设备下次用新密码解锁。");
        } catch (error) {
          err.textContent = error.message;
        } finally {
          btn.disabled = false;
        }
      };
    },
  );
}

/* ---------- first-time setup ---------- */
async function setupView() {
  const vault = await loadVault();
  const [owner, repoName] = state.gh.repo.split("/");
  const tokenUrl =
    "https://github.com/settings/personal-access-tokens/new?" +
    new URLSearchParams({ name: "文献卡片 " + repoName, description: "只用于文献卡片网站发布，只授权 " + repoName + " 仓库", target_name: owner, expires_in: "365", contents: "write" });
  main.innerHTML = `
    <div class="sheet">
      <h1 style="margin-top:0">第一次设置</h1>
      ${vault ? `<div class="banner warn"><span>这个网站已经设置过密码了。重新设置会让旧密码失效。</span><a class="btn" href="#/settings">返回设置</a></div>` : ""}
      <p>只需要做一次。完成后，在任何设备上输入密码就能写卡片。</p>
      <ol class="steps">
        <li><div><h3>在 GitHub 生成一个令牌</h3>
          <p>打开下面的链接，名称和权限已经填好。在「Repository access」里选 <b>Only select repositories</b>，再选 <b>${h(repoName)}</b>；确认「Permissions」里 <b>Contents</b> 是 <b>Read and write</b>，然后点页面底部的「Generate token」，复制生成的令牌。</p>
          <a class="btn" href="${h(tokenUrl)}" target="_blank" rel="noopener">打开 GitHub 令牌页面</a></div></li>
        <li><div><h3>粘贴令牌，设一个密码</h3>
          <p>令牌会用你的密码加密后保存，网站和仓库里都不会出现原文。</p>
          <form class="form-grid" id="setupForm">
            <label class="field"><span>GitHub 令牌</span><input type="password" name="token" required autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
            <label class="field"><span>设一个密码</span><input type="password" name="pw" required autocomplete="new-password" placeholder="至少 8 位，字母加数字"></label>
            <label class="field"><span>再输一次</span><input type="password" name="pw2" required autocomplete="new-password"></label>
            <p class="error" id="setupErr"></p>
            <div><button class="btn primary">完成设置</button></div>
          </form></div></li>
      </ol>
      <details class="box" style="margin-top:22px"><summary>这样安全吗？</summary>
        <p class="small">令牌只授权这一个仓库，只能改这个卡片网站，碰不到你的其他仓库和账号。加密后的令牌保存在公开仓库里，所以密码别太简单，也别和其他账号共用。万一密码泄露，到 GitHub 删除令牌，再回这里重新设置即可；卡片的每次修改都能从 GitHub 历史里恢复。</p></details>
    </div>`;
  $("#setupForm").onsubmit = async (event) => {
    event.preventDefault();
    const f = event.target;
    const err = $("#setupErr");
    const btn = $("button", f);
    err.textContent = "";
    const token = f.token.value.trim();
    if (!validToken(token)) return (err.textContent = "令牌应该以 github_pat_ 开头，请检查是否复制完整。");
    const problem = passwordProblem(f.pw.value);
    if (problem) return (err.textContent = problem);
    if (f.pw.value !== f.pw2.value) return (err.textContent = "两次输入的密码不一样。");
    btn.disabled = true;
    btn.textContent = "正在检查令牌…";
    try {
      state.gh.setToken(token);
      await state.gh.checkAccess();
      btn.textContent = "正在加密保存…";
      const sealed = await sealToken(token, f.pw.value, state.gh.repo);
      await state.gh.commitLatest(async () => ({ message: "设置编辑密码", files: [{ path: M.VAULT_PATH, text: JSON.stringify(sealed, null, 2) + "\n" }] }));
      state.vault = sealed;
      saveToken(token, false);
      updateLockButton();
      f.reset();
      toast("设置完成，现在可以写卡片了。");
      location.hash = "#/new";
    } catch (error) {
      state.gh.setToken("");
      updateLockButton();
      err.textContent = error.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "完成设置";
    }
  };
}

/* ---------- boot ---------- */
async function boot() {
  $("#themeBtn").onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("pc-theme", root.dataset.theme);
  };
  $("#lockBtn").onclick = async () => {
    if (state.gh.unlocked) {
      if (await confirmDialog("锁定编辑？", "锁定后需要重新输入密码才能编辑。", "锁定")) { lock(); toast("已锁定。"); route(); }
    } else if (await ensureUnlocked()) route();
  };
  ["pointerdown", "keydown"].forEach((t) => addEventListener(t, () => (state.lastActive = Date.now()), { passive: true }));
  setInterval(() => {
    const remembered = (store.get("pc-token") || {}).until > Date.now();
    if (state.gh?.unlocked && !remembered && Date.now() - state.lastActive > IDLE_LOCK_MS) { lock(); toast("闲置太久，已自动锁定。"); }
  }, 60000);
  try {
    await loadSite();
    restoreToken();
    await loadIndex();
  } catch (error) {
    console.error(error);
    toast(error.message, "error");
  }
  // Local previews of just-published images (until the site rebuilds).
  const cache = store.get("pc-imgcache") || {};
  if (Object.keys(cache).length) {
    document.addEventListener("error", (e) => {
      const img = e.target;
      if (img.tagName === "IMG" && !img.dataset.fallback) {
        const key = Object.keys(cache).find((k) => img.src.endsWith(k));
        if (key) { img.dataset.fallback = "1"; img.src = cache[key]; }
      }
    }, true);
  }
  addEventListener("hashchange", route);
  if (!location.hash && store.get("pc-mode") === "lab") history.replaceState(null, "", "#/lab");
  if (!location.hash && store.get("pc-mode") === "map") history.replaceState(null, "", "#/map");
  route();
}

boot();
