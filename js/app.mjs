import * as M from "./model.mjs";
import { renderMarkdown, renderInline, escapeHtml as h } from "./markdown.mjs";
import { GitHubClient } from "./github.mjs";
import { sealToken, openVault, passwordProblem, validToken } from "./vault.mjs";
import * as L from "./lab.mjs";
import { createLab } from "./lab-views.mjs";
import { createMaps } from "./map-views.mjs";
import { createCourses } from "./course-views.mjs";
import * as CO from "./course.mjs";
import { startTranslation, getLang, setLang, LANGS } from "./i18n.mjs";
import { createOverview } from "./overview-views.mjs";
import { createPalette, kindIcon } from "./palette.mjs";
import { startEnhancements, highlightCode } from "./enhance.mjs";
import { createTerms } from "./terms-views.mjs";
import * as PI from "./paperinfo.mjs";
import * as R from "./reading.mjs";
import { attachRich, fieldOf, setImageResolver } from "./rich.mjs";

export const VERSION = "4.6";
const PROJECT_URL = "https://github.com/Warren-xh/paper-card";
// Interface language: Chinese by default; English swaps interface text as it appears.
const T = startTranslation();

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
// `area` defaults to localStorage, looked up inside the try: reading it throws when storage is blocked.
const store = {
  get(key, area) {
    try { return JSON.parse((area === undefined ? localStorage : area).getItem(key)); } catch { return null; }
  },
  set(key, value, area) {
    try { (area === undefined ? localStorage : area).setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  del(key, area) {
    try { (area === undefined ? localStorage : area).removeItem(key); } catch {}
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
// One-line text boxes (marks, steps, answers) that wrap and grow instead of hiding
// long text. Enter never adds a line break: it keeps meaning "add this entry".
function growBox(el) {
  if (!el.isConnected || !el.offsetWidth) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + 2 + "px";
}
const growWatch = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    // Only react to width changes (or becoming visible); our own height change is ignored.
    if (+target.dataset.growWidth !== target.offsetWidth) { target.dataset.growWidth = target.offsetWidth; growBox(target); }
  }
});
// Note boxes that show bold, italic, terms and images as they look (see rich.mjs).
const RICH = "#markText, #stepText, textarea[data-k=text], textarea[data-solve], textarea.textarea:not(.one):not(.short):not(.code):not(#recallText)";
new MutationObserver((records) => {
  for (const r of records) for (const n of r.addedNodes) {
    if (n.nodeType !== 1) continue;
    for (const t of n.matches(RICH) ? [n] : n.querySelectorAll(RICH)) attachRich(t);
    // Size new boxes right away (layout is ready here); the observer handles later width changes.
    for (const t of n.matches("textarea.grow:not(.rich-src)") ? [n] : n.querySelectorAll("textarea.grow:not(.rich-src)")) { growBox(t); growWatch.observe(t); }
  }
}).observe(document.body, { childList: true, subtree: true });
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t.matches?.("textarea.grow")) return;
  if (/\n/.test(t.value)) t.value = t.value.replace(/\s*\n+\s*/g, " ");
  growBox(t);
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches?.("textarea.grow") && !e.isComposing && e.keyCode !== 229) e.preventDefault();
}, true);

// Fields whose text is rendered as Markdown, so bold/italic show up.
const FORMATTABLE = "#markText, [data-k=text], [data-solve], textarea:not([name=oneLine]):not(.short)";

// Text boxes where an image can go (button, Ctrl+V paste, drag and drop): every
// box shown as Markdown, plus the one-line marks and steps.
const IMAGE_FIELDS = "#markText, #stepText, [data-k=text], [data-solve], textarea.textarea:not(.one):not(.short):not(.code)";
const imageButton = (name) => `<button type="button" class="btn quiet small" data-image="${name}" title="插入图片（也可以直接 Ctrl+V 粘贴截图）">插入图片</button>`;
const mdTools = (name) =>
  `<div class="md-tools"><button type="button" class="fmt" data-fmt="**" data-for="${name}" title="加粗（⌘/Ctrl + B）" aria-label="加粗"><b>B</b></button><button type="button" class="fmt" data-fmt="*" data-for="${name}" title="斜体（⌘/Ctrl + I）" aria-label="斜体"><i>I</i></button><button type="button" class="fmt term-btn" data-term-for="${name}" title="标为术语：先选中文字，再点这里，可以写中英文和解释并收进词库" aria-label="标为术语">术语</button>${imageButton(name)}<span class="hint small paste-hint">可以直接 Ctrl+V 粘贴截图</span></div>`;

// Images are resized in the browser and kept in `images` (path → data URL) until
// the editor saves; a Markdown image line is put where the cursor is.
// Images pasted in this editor show in the boxes before they are uploaded.
let editorImages = {};
setImageResolver((src) => editorImages[src] || (store.get("pc-imgcache") || {})[src] || "");
function enableImages(form, images) {
  editorImages = images;
  form.dataset.images = "1";
  const pick = Object.assign(document.createElement("input"), { type: "file", accept: "image/*", multiple: true, hidden: true });
  form.append(pick);
  let target = null;
  const onlyImages = (files) => [...files].filter((f) => f && f.type.startsWith("image/"));
  async function insert(area, files) {
    for (const file of files) {
      try {
        const dataUrl = await shrinkImage(file);
        const day = M.todayISO();
        const path = "uploads/" + day.slice(0, 7) + "/" + day.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8) + "." + (dataUrl.startsWith("data:image/webp") ? "webp" : "jpg");
        images[path] = dataUrl;
        const raw = (file.name || "").replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
        const image = "![" + (!raw || /^image$/i.test(raw) ? "截图" : raw) + "](" + path + ")";
        const start = area.selectionStart ?? area.value.length;
        const before = area.value.slice(0, start);
        // One-line boxes never take a line break.
        const snippet = area.classList.contains("grow")
          ? (before && !/\s$/.test(before) ? " " : "") + image + " "
          : (before && !before.endsWith("\n") ? "\n" : "") + image + "\n";
        area.setRangeText(snippet, start, area.selectionEnd ?? start, "end");
        area.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (error) {
        return toast(error.message, "error");
      }
    }
    area.focus();
    toast(files.length > 1 ? `已插入 ${files.length} 张图片，保存时一起上传。` : "图片已插入，保存时一起上传。");
  }
  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-image]");
    if (!b) return;
    target = form.querySelector(`[name="${b.dataset.image}"]`) || form.querySelector("#" + b.dataset.image);
    pick.click();
  });
  pick.onchange = () => {
    const files = onlyImages(pick.files);
    pick.value = "";
    if (target && files.length) insert(target, files);
  };
  // In a rich box the event comes from inside it; the field is its textarea.
  const field = (e) => { const f = fieldOf(e.target); return f?.matches?.(IMAGE_FIELDS) ? f : null; };
  form.addEventListener("paste", (e) => {
    const area = field(e);
    if (!area) return;
    const files = onlyImages([...(e.clipboardData?.items || [])].filter((i) => i.kind === "file").map((i) => i.getAsFile()));
    if (!files.length) return;
    e.preventDefault();
    insert(area, files);
  });
  form.addEventListener("dragover", (e) => { if (field(e) && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  form.addEventListener("drop", (e) => {
    const area = field(e);
    if (!area) return;
    const files = onlyImages(e.dataTransfer.files);
    if (!files.length) return;
    e.preventDefault();
    insert(area, files);
  });
}
// Images still referenced anywhere in what is being saved.
const usedImages = (images, saved) => {
  const text = JSON.stringify(saved);
  return Object.entries(images).filter(([path]) => text.includes(path));
};

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
  el.onclick = null;
  return new Promise((resolve) => {
    const close = (value) => { el.close(); resolve(value); };
    el.onclose = () => { if (!el.open) resolve(undefined); };
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
  highlightCode(root);
  terms.autoMark(root);
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
  const site = state.site.title || "文献卡片";
  const module = { lab: "实操记录", course: "课程笔记", map: "思维导图", terms: "词库", today: "今天" }[mode];
  $("#brandName").textContent = site;
  document.title = (module ? T(module) + " · " : "") + T(site);
}

// Two modes share one site: paper cards (文献) and practice logs (实操).
function setMode(mode) {
  document.body.dataset.mode = mode;
  $$(".mode-switch a").forEach((a) => (a.dataset.mode === mode ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#brand").setAttribute("href", "#/today");
  store.set("pc-mode", mode);
  applySite();
  fitModeSwitch(true);
}

// On a narrow phone (or in English) the modules may not all fit: the switch
// scrolls sideways, keeps the current module in view and fades the cut-off side.
function fitModeSwitch(reveal) {
  const ms = $(".mode-switch");
  const cur = ms.querySelector("[aria-current]");
  if (reveal && cur && ms.scrollWidth > ms.clientWidth) {
    const a = cur.getBoundingClientRect();
    const b = ms.getBoundingClientRect();
    if (a.left < b.left) ms.scrollLeft -= b.left - a.left + 24;
    else if (a.right > b.right) ms.scrollLeft += a.right - b.right + 24;
  }
  const start = ms.scrollLeft > 1;
  const end = ms.scrollLeft + ms.clientWidth < ms.scrollWidth - 1;
  ms.dataset.clip = [start && "start", end && "end"].filter(Boolean).join(" ");
}
const modeSwitchWatch = new ResizeObserver(() => fitModeSwitch(true));

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
  await courses.loadCourses();
  await maps.loadMaps();
  await terms.loadTerms();
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

function updateBadge() {}

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
  // On phones only the icon shows; the label is kept for screen readers and wider screens.
  btn.innerHTML = (on ? `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>` : `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`) + `<span class="nav-label">${on ? "已解锁" : "登录编辑"}</span>`;
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
    courses.clearCache();
    await loadIndex().catch(() => {});
  }
  return !!ok;
}

/* ---------- views ---------- */
// Spaced review (回顾) was removed in v4.6; old #/review links land on the paper list.
const views = { home, card: cardView, edit: editView, review: home, settings: settingsView, setup: setupView };
const ROUTES = { c: "card", edit: "edit", new: "edit", review: "review", settings: "settings", setup: "setup" };

async function route() {
  if (editorDirty && !(await leaveEditor())) {
    history.replaceState(null, "", currentHash);
    return;
  }
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, arg, arg2, arg3, arg4] = hash.split("/");
  currentHash = location.hash || "#/";
  editorDirty = false;
  window.onbeforeunload = null;
  // #/map/<id> pages use the full width; everything else does not.
  document.body.classList.toggle("wide", name === "map" && !!arg);
  // #/terms is the term library; #/terms/<name> opens one term.
  if (name === "terms") {
    setMode("terms");
    $$(".topnav a").forEach((a) => (a.dataset.nav === "terms" ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    try {
      await terms.page(decodeURIComponent(arg || ""));
    } catch (error) {
      console.error(error);
      main.innerHTML = `<div class="sheet"><h1>页面打不开</h1><p>${h(error.message)}</p><p><a href="#/terms">回到词库</a></p></div>`;
    }
    if (!arg) window.scrollTo(0, 0);
    return;
  }
  // #/today is the overview of everything.
  if (name === "today") {
    setMode("today");
    $$(".topnav a").forEach((a) => a.removeAttribute("aria-current"));
    try {
      await overview.view();
    } catch (error) {
      console.error(error);
      main.innerHTML = `<div class="sheet"><h1>页面打不开</h1><p>${h(error.message)}</p><p><a href="#/">回到首页</a></p></div>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  // #/map is the list of mind maps; #/map/<id> browses one, #/map/<id>/edit edits it.
  if (name === "map") {
    setMode("map");
    $$(".topnav a").forEach((a) => a.removeAttribute("aria-current"));
    try {
      await (arg ? maps.view(decodeURIComponent(arg), arg2 === "edit" || arg2 === "outline" ? arg2 : "browse") : maps.list());
    } catch (error) {
      console.error(error);
      main.innerHTML = `<div class="sheet"><h1>页面打不开</h1><p>${h(error.message)}</p><p><a href="#/map">回到全部导图</a></p></div>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  // #/course: list; #/course/new; #/course/<id>[/edit]; #/course/<id>/l/<lesson>[/edit].
  if (name === "course") {
    setMode("course");
    $$(".topnav a").forEach((a) => a.removeAttribute("aria-current"));
    const id = decodeURIComponent(arg || "");
    try {
      if (!arg) await courses.list();
      else if (arg === "new") await courses.edit("");
      else if (arg2 === "edit") await courses.edit(id);
      else if (arg2 === "l" && arg3) await (arg4 === "edit" ? courses.lessonEdit(id, decodeURIComponent(arg3)) : courses.lessonView(id, decodeURIComponent(arg3)));
      else await courses.view(id);
    } catch (error) {
      console.error(error);
      main.innerHTML = `<div class="sheet"><h1>页面打不开</h1><p>${h(error.message)}</p><p><a href="#/course">回到全部课程</a></p></div>`;
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
  else { document.body.dataset.mode = "settings"; $$(".mode-switch a").forEach((a) => a.removeAttribute("aria-current")); applySite(); }
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
  state, $, $$, h, renderMarkdown, renderInline, toast, dialog, confirmDialog, copyText, typesetMath, store, session,
  readData: (path) => readData(path),
  ensureUnlocked: () => ensureUnlocked(),
  lock: (expired) => lock(expired),
  route: () => route(),
  plainEnter, wrapSelection, fileToBase64, growBox, sortSelect, shrinkImage: (file) => shrinkImage(file), enableImages, usedImages, mdTools, imageButton,
  setDirty: (dirty) => { editorDirty = dirty; },
  isDirty: () => editorDirty,
  setLeave: (fn) => { leaveEditor = fn; },
});

const courses = createCourses({
  state, $, $$, h, renderMarkdown, renderInline, toast, confirmDialog, copyText, typesetMath, store,
  readData: (path) => readData(path),
  ensureUnlocked: () => ensureUnlocked(),
  lock: (expired) => lock(expired),
  route: () => route(),
  plainEnter, wrapSelection, fileToBase64, growBox, sortSelect, shrinkImage: (file) => shrinkImage(file), enableImages, usedImages, mdTools, imageButton,
  setDirty: (dirty) => { editorDirty = dirty; },
  isDirty: () => editorDirty,
  setLeave: (fn) => { leaveEditor = fn; },
});

const overview = createOverview({
  state, $, h, store, session,
  loadCourseFiles: () => courses.loadAll(),
  openSearch: () => palette.open(),
  setFilter: (href, status) => {
    if (href === "#/") state.filter.status = status;
    else if (href === "#/lab") state.labFilter.status = status;
    else if (href === "#/course") courses.setStatus(status);
  },
});

const terms = createTerms({
  state, $, $$, h, toast, dialog, confirmDialog, store, renderMarkdown, renderInline, typesetMath, sortSelect,
  autoTerms: () => state.reading.autoTerms,
  readData: (path) => readData(path),
  ensureUnlocked: () => ensureUnlocked(),
  lock: (expired) => lock(expired),
  loadCourseFiles: () => courses.loadAll(),
});

const palette = createPalette({
  state,
  loadCourseFiles: () => courses.loadAll(),
  actions: () => [
    { label: "今天", hint: "总览", href: "#/today", keys: "today home jintian" },
    { label: "写一张新卡片", hint: "文献", href: "#/new", keys: "new card paper" },
    { label: "新建一条实操记录", hint: "实操", href: "#/lab/new", keys: "new lab log" },
    { label: "添加课程", hint: "课程", href: "#/course/new", keys: "new course" },
    { label: "思维导图", hint: "导图", href: "#/map", keys: "map" },
    { label: "词库", hint: state.terms.terms.length + " 个术语", href: "#/terms", keys: "terms glossary ciku" },
    { label: "设置", href: "#/settings", keys: "settings" },
    { label: "阅读设置", hint: "主题 · 字体 · 字号", run: () => openReading(), keys: "theme dark light sepia font reading zhuti ziti" },
  ],
});

const maps = createMaps({
  state, $, $$, h, toast, dialog, confirmDialog, copyText, store,
  readData: (path) => readData(path),
  ensureUnlocked: () => ensureUnlocked(),
  lock: (expired) => lock(expired),
  route: () => route(),
  plainEnter, sortSelect,
  setDirty: (dirty) => { editorDirty = dirty; },
  setLeave: (fn) => { leaveEditor = fn; },
});


// A "sort by" menu; the choice is remembered per module on this device.
function sortSelect(id, options, current) {
  return `<label><span class="visually-hidden">排序</span><select class="inline sort-select" id="${id}" title="排序">${options
    .map(([v, t]) => `<option value="${v}"${current === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
}

/* Home */
async function home() {
  state.filter.sort ||= store.get("pc-sort-cards") || "read";
  if (!M.CARD_SORTS.some(([k]) => k === state.filter.sort)) state.filter.sort = "read";
  const today = M.todayISO();
  const cards = state.index.cards;
  const s = M.stats(cards, today);
  const site = state.site;

  const due = cards.length ? "" : `<p class="due-none">写下第一张卡片吧：读之前想清楚为什么读，边读边打标记，读完合上论文再写。</p>`;

  const statsHtml = cards.length
    ? `<div class="stats">
        <span class="stat"><b>${s.total}</b>张卡片</span>
        <span class="stat"><b>${s.done}</b>篇读完</span>
        <span class="stat"><b>${s.reading}</b>篇在读</span>
        <span class="stat"><b>${s.thisMonth}</b>篇本月</span>
        ${s.questions ? `<span class="stat"><b>${s.questions}</b>条待解决</span>` : ""}
      </div>`
    : "";

  main.innerHTML = `
    <div class="sheet hero">
      <div class="hero-head"><span class="hero-icon">${kindIcon("card")}</span><div><h1 class="site-title">${h(site.title)}</h1>
      <p class="site-sub">${h(site.subtitle)}</p></div></div>
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
        ${sortSelect("sort", M.CARD_SORTS, state.filter.sort)}
      </div>
      <div class="chips" id="tagChips"></div>
      <div class="card-grid" id="grid"></div>
    </section>`;
  $("#q").addEventListener("input", (e) => { state.filter.query = e.target.value; renderGrid(); });
  $("#sort").addEventListener("change", (e) => { state.filter.sort = e.target.value; store.set("pc-sort-cards", e.target.value); renderGrid(); });
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
  const list = M.sortCards(M.search(all, state.filter), state.filter.sort);
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
      ${x.pdf ? `<span class="pdf-tag" title="附有论文 PDF">PDF</span>` : ""}
      ${x.questions ? `<span class="qbadge" title="还有 ${x.questions} 条待解决">待解决 ${x.questions}</span>` : ""}
    </div>
    <p class="pcard-one">${x.oneLine ? h(x.oneLine) : '<span class="untitled">还没写一句话</span>'}</p>
    <div class="pcard-paper"><h3>${x.title ? h(x.title) : '<span class="untitled">未写标题</span>'}</h3>
      ${cite ? `<p>${h(cite)}</p>` : ""}</div>
    <div class="pcard-foot"><span class="tags">${tags}</span><span class="dots" title="七栏写了 ${x.filled} 栏" aria-label="${x.filled}/7">${Array.from({ length: 7 }, (_, i) => `<i${i < x.filled ? ' class="on"' : ""}></i>`).join("")}</span></div>
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
  return `<header class="card-head"><div class="meta-line">${meta.join("")}</div>
    <h1 class="card-title">${c.title ? h(c.title) : '<span class="untitled">未写标题</span>'}</h1>
    ${cite || c.link ? `<p class="cite">${h(cite)}${c.link ? `${cite ? " · " : ""}<a href="${h(M.paperHref(c.link))}" target="_blank" rel="noopener">${h(linkLabel(c.link))}</a>` : ""}</p>` : ""}</header>
    ${c.pdf ? `<div class="pdf-block"><p class="pdf-line"><button type="button" class="btn small" data-preview="${h(c.pdf)}" aria-expanded="false">预览</button><a class="btn small" href="${h(c.pdf)}" download="${h(pdfName(c))}">下载论文 PDF</a><a class="small" href="${h(c.pdf)}" target="_blank" rel="noopener">在新标签页打开</a></p><div class="pdf-preview" hidden></div></div>` : ""}
    ${c.why ? `<p class="why"><b>为什么读：</b>${h(c.why)}</p>` : ""}`;
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
  $$("[data-goto-tag]").forEach((a) => (a.onclick = () => { state.filter = { ...state.filter, query: "", tag: a.dataset.gotoTag, project: "", status: "" }; }));
  typesetMath(main);
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
  const tools = mdTools;
  const secHead = (n, hint) => `<h3><span class="num">${sec(n).mark}</span>${sec(n).title}</h3>${hint ? `<p class="hint">${hint}</p>` : ""}`;

  main.innerHTML = `
    <div class="toolbar">
      <a class="btn quiet" href="${existing ? "#/c/" + h(id) : "#/"}">← 返回</a>
      
    </div>
    ${restored ? `<div class="banner warn"><span>已恢复这台设备上还没发布的草稿。</span><button class="btn quiet" id="discardDraft">放弃草稿</button></div>` : ""}
    ${!state.gh.unlocked ? `<div class="banner"><span>你可以先写，发布时再输入密码。草稿会自动保存在这台设备上。</span></div>` : ""}
    <form class="sheet" id="editor" autocomplete="off">
      <label class="field"><span class="visually-hidden">论文标题</span>
        <input class="title-input" name="title" placeholder="论文标题"></label>
      <div class="meta-grid">
        <label class="field"><span>作者</span><input name="authors" placeholder="作者姓名"></label>
        <label class="field"><span>年份</span><input name="year" type="number" min="1800" max="2200" inputmode="numeric" placeholder="发表年份"></label>
        <label class="field"${M.unusedAttr(card.venue)}><span>会议 / 期刊</span><input name="venue" placeholder="会议或期刊名称"></label>
        <div class="field"><label class="label" for="cardLink">链接</label><div class="input-btn"><input id="cardLink" name="link" placeholder="DOI、arXiv 编号或网址"><button type="button" class="btn small" id="autoFill" title="填了 DOI 或 arXiv 编号：自动填写标题、作者、年份、会议；只写了标题：按标题查找论文">自动填写</button></div></div>
        <label class="field"><span>标签</span><input name="tags" list="tagList" placeholder="用逗号分开"></label>
        <label class="field"${M.unusedAttr(card.project)}><span>项目</span><input name="project" list="projList" placeholder="可以留空"></label>
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
          <input name="why" placeholder="为什么读这篇，想从中得到什么"></label></section>

      <section class="stage"><h2><span class="stage-n">2</span>边读边记</h2>
        <p class="hint">只打标记，不写长句。选一个符号，写几个字，回车就记下一条。页码从 1 开始，翻页时点 ＋（也可以直接改数字，或清空不填）。觉得这一条还没解决，就勾上「待解决」，它会出现在下面的「初步解决」里。</p>
        <div class="mark-input">
          <div class="mark-types"><div class="mark-kinds" role="radiogroup" aria-label="标记类型">${M.MARKS.map((m, k) => `<button type="button" role="radio" class="t${k}" data-type="${m.type}" aria-checked="${k === 0}"><b>${m.type}</b>${m.label}</button>`).join("")}</div>
            <div class="mark-opts"><label class="solve-flag"><input type="checkbox" id="markSolve"> 待解决</label><div class="fmt-pair"><button type="button" class="fmt" data-fmt="**" data-for="markText" title="加粗（⌘/Ctrl + B）" aria-label="加粗"><b>B</b></button><button type="button" class="fmt" data-fmt="*" data-for="markText" title="斜体（⌘/Ctrl + I）" aria-label="斜体"><i>I</i></button><button type="button" class="fmt term-btn" data-term-for="markText" title="标为术语：先选中文字，再点这里，可以写中英文和解释并收进词库" aria-label="标为术语">术语</button>${imageButton("markText")}</div></div></div>
          <div class="mark-line">
            <div class="page-step"><button type="button" class="step" data-step="-1" aria-label="上一页">−</button><input class="input page" id="markPage" placeholder="页" maxlength="12" inputmode="numeric" aria-label="页码"><button type="button" class="step" data-step="1" aria-label="下一页">＋</button></div>
            <textarea class="input grow" id="markText" rows="1" placeholder="写几个字，回车记下" aria-label="标记内容" enterkeyhint="done"></textarea>
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
          <textarea class="textarea one" name="oneLine" rows="2" placeholder="用一句话概括这篇论文"></textarea></div>

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

        <div class="esec"${M.unusedAttr(card.links, card.linkNote)}>${secHead(7, "搜索并选中相关的已有卡片，再写一句它们的区别。关联只记下对方的编号，不会多出卡片；两张卡片上都会显示。")}
          <div class="link-chosen" id="linkChosen"></div>
          ${others.length ? `<div class="link-search"><input class="input" id="linkSearch" placeholder="输入标题、作者或关键词找卡片…" autocomplete="off" aria-label="搜索要关联的卡片"><div class="link-results" id="linkResults"></div></div>` : `<p class="muted small">还没有其他卡片可以关联。</p>`}
          ${back.length ? `<p class="hint small" style="margin-top:6px">这些卡片已经关联了这张，会自动显示在两边，不用再选：${back.map((b) => h(b.title || b.id)).join("、")}</p>` : ""}
          <textarea class="textarea" name="linkNote" rows="3" placeholder="这篇和关联论文的区别" style="margin-top:8px"></textarea>${tools("linkNote")}</div>
      </section>

      <section class="stage"><h2><span class="stage-n">+</span>自由笔记</h2>
        <p class="hint">任何想记的：公式、推导、代码、截图。支持 Markdown，公式用 $…$。</p>
        <textarea class="textarea" name="notes" rows="6"></textarea>${tools("notes", true)}</section>
    </form>
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

  // Paper details from a DOI, an arXiv number or the title (Crossref, DataCite).
  const FIELD_NAMES = { title: "标题", authors: "作者", year: "年份", venue: "会议 / 期刊", link: "链接" };
  const autoBtn = $("#autoFill");
  const applyFound = async (found, quiet = false) => {
    if (!form.isConnected) return;
    const now = { title: form.title.value, authors: form.authors.value, year: form.year.value, venue: form.venue.value, link: form.link.value };
    const { fill, conflicts } = PI.planFill(now, found);
    if (conflicts.length && !(await confirmDialog("覆盖已经写的内容？", "查到的和这些栏里写的不一样：" + conflicts.map((k) => FIELD_NAMES[k]).join("、") + "。点「覆盖」用查到的；点「取消」只填空着的栏。", "覆盖")))
      conflicts.forEach((k) => delete fill[k]);
    if (!form.isConnected) return;
    for (const [k, v] of Object.entries(fill)) form[k].value = v;
    if (Object.keys(fill).length) {
      changed();
      toast("已填好" + Object.keys(fill).map((k) => FIELD_NAMES[k]).join("、") + "（来自 " + found.source + "）。");
    } else if (!quiet) toast("查到的和已经写的一样。");
  };
  const pickPaper = (list, q) => dialog(`
    <h2>选一篇论文</h2>
    <p class="small">${list.length ? `按标题「${h(q)}」找到下面这些，点一篇填进卡片。` : `按标题「${h(q)}」没有找到。换个写法试试，或者直接在「链接」里填 DOI / arXiv 编号。`}</p>
    ${list.length ? `<div class="paper-picks">${list.map((p, i) => {
      const names = p.authors ? p.authors.split(", ") : [];
      const who = names.slice(0, 3).join(", ") + (names.length > 3 ? " 等" : "");
      return `<button type="button" class="paper-pick" data-i="${i}"><b>${h(p.title)}</b><span>${h([who, p.year, p.venue].filter(Boolean).join(" · "))}</span><em>${h(p.source)}</em></button>`;
    }).join("")}</div>` : ""}
    <div class="dialog-actions"><button type="button" class="btn quiet" data-v="0">取消</button></div>`,
  (el, close) => {
    $("[data-v]", el).onclick = () => close(null);
    $$("[data-i]", el).forEach((b) => (b.onclick = () => close(list[+b.dataset.i])));
  });
  async function autoFill(quiet = false) {
    if (autoBtn.disabled) return;
    const link = form.link.value.trim();
    const title = form.title.value.trim();
    if (!PI.parsePaperId(link) && !title) {
      toast("先在「链接」里填 DOI 或 arXiv 编号，或者写好标题，再点「自动填写」。", "error");
      return form.link.focus();
    }
    autoBtn.disabled = true;
    autoBtn.textContent = "正在查…";
    try {
      if (PI.parsePaperId(link)) await applyFound(await PI.lookupPaper(link), quiet);
      else {
        const found = await PI.searchPapers(title);
        if (!form.isConnected) return;
        const pick = await pickPaper(found, title);
        if (pick) await applyFound(pick);
      }
    } catch (error) {
      toast(error.message, "error");
    } finally {
      autoBtn.disabled = false;
      autoBtn.textContent = "自动填写";
    }
  }
  autoBtn.onclick = () => autoFill();
  // A DOI or arXiv number pasted into a card without a title fills it right away.
  let tried = "";
  const autoOnPaste = () => setTimeout(() => {
    const v = form.link.value.trim();
    if (v === tried || form.title.value.trim() || !PI.parsePaperId(v)) return;
    tried = v;
    autoFill(true);
  }, 0);
  form.link.addEventListener("paste", autoOnPaste);
  form.link.addEventListener("change", autoOnPaste);

  let status = card.status;
  const paintStatus = () => $$("[data-status]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === status)));
  paintStatus();
  $$("[data-status]").forEach((b) => (b.onclick = () => { status = b.dataset.status; paintStatus(); changed(); }));

  // Reading marks
  let markType = M.MARKS[0].type;
  const typeIndex = (t) => M.MARKS.findIndex((m) => m.type === t);
  const markRow = (m) =>
    `<li data-row="mark"><button type="button" class="mark-sym t${typeIndex(m.type)}" data-type="${m.type}" title="${M.markLabel(m.type)}（点一下换符号）">${m.type}</button><input class="input page" data-k="page" value="${h(m.page)}" placeholder="页" aria-label="页码"><textarea class="input grow" data-k="text" rows="1" aria-label="标记内容">${h(m.text)}</textarea><input type="hidden" data-k="answer" value="${h(m.answer || "")}"><label class="row-flag" title="待解决：勾上后出现在「初步解决」里"><input type="checkbox" data-k="solve"${m.solve ? " checked" : ""}><span>待解决</span></label><button type="button" class="x" aria-label="删除">×</button></li>`;
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
    growBox($("#markText"));
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
            <textarea class="input grow" data-solve="${i}" rows="1" placeholder="这个问题的答案，没弄懂就留空" aria-label="答案">${h($("[data-k=answer]", r).value)}</textarea></li>`;
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

  enableImages(form, images);

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
      // Only upload images still referenced in the card.
      const uploads = usedImages(images, c);
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
        <label class="field"><span>网站标题</span><input name="title" value="${h(site.title)}"></label>
        <label class="field"><span>一句话介绍</span><input name="subtitle" value="${h(site.subtitle)}"></label>
        <label class="field"><span>作者</span><input name="author" value="${h(site.author)}" placeholder="可以留空"></label>
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
      <div class="btn-row"><button class="btn" id="exportMd">下载全部论文卡片（Markdown）</button><button class="btn" id="exportLogs">下载全部实操记录（Markdown）</button><button class="btn" id="exportCourses">下载全部课程笔记（Markdown）</button><button class="btn" id="exportTerms">下载词库（Markdown）</button><button class="btn" id="exportJson">下载全部（JSON）</button></div>
    </div>
    <div class="sheet">
      <h2 style="margin-top:0">阅读与外观</h2>
      <p class="muted small">只保存在这台设备上。电脑上也可以点顶栏的「Aa」随时调整。</p>
      <div id="readingHere">${R.readingFormHtml(state.reading, h)}</div>
    </div>
    <div class="sheet">
      <h2 style="margin-top:0">界面语言</h2>
      <p class="muted small">只翻译界面，你写的内容不会被翻译。</p>
      <div class="seg" role="group" aria-label="界面语言">${Object.entries(LANGS).map(([k, label]) => `<button type="button" data-lang="${k}" aria-pressed="${getLang() === k}" data-no-tr>${label}</button>`).join("")}</div>
      <p class="muted small" style="margin:18px 0 0">版本 ${VERSION} · <a href="${PROJECT_URL}" target="_blank" rel="noopener">源代码与部署说明</a></p>
    </div>`;
  $$("[data-lang]").forEach((b) => (b.onclick = () => { if (b.dataset.lang !== getLang()) { setLang(b.dataset.lang); location.reload(); } }));
  R.bindReadingForm($("#readingHere"), () => state.reading, setReading);

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
  $("#exportCourses").onclick = async () => download("课程笔记-全部-" + M.todayISO() + ".md", (await courses.loadAll()).map(CO.courseToMarkdown).join("\n---\n\n"));
  $("#exportTerms").onclick = () => download("词库-" + M.todayISO() + ".md", terms.toMarkdown());
  $("#exportJson").onclick = async () => download("文献卡片-全部-" + M.todayISO() + ".json", JSON.stringify({ site: state.site, cards: await loadAll(), logs: await lab.loadAll(), courses: await courses.loadAll(), maps: await maps.loadAll(), terms: state.terms }, null, 2), "application/json");
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

/* ---------- reading settings (theme, font, size, width, spacing) ---------- */
state.reading = R.normalizeReading(store.get(R.READING_KEY), store.get("pc-theme"));
R.applyReading(state.reading);
function setReading(next) {
  const before = state.reading;
  state.reading = R.normalizeReading(next);
  store.set(R.READING_KEY, state.reading);
  store.del("pc-theme");
  R.applyReading(state.reading);
  if (before.autoTerms !== state.reading.autoTerms) {
    if (state.reading.autoTerms) terms.autoMark(main);
    else $$(".term.auto", main).forEach((el) => el.replaceWith(el.textContent));
  }
}
// The "Aa" panel under the top bar button (on phones: the settings page).
let readingPop;
function openReading() {
  const btn = $("#themeBtn");
  if (!btn.offsetParent) { location.hash = "#/settings"; return; }
  if (readingPop && !readingPop.hidden) return closeReading();
  if (!readingPop) {
    readingPop = Object.assign(document.createElement("div"), { className: "reading-pop", hidden: true, id: "readingPop" });
    readingPop.setAttribute("role", "dialog");
    readingPop.setAttribute("aria-label", "阅读设置");
    document.body.append(readingPop);
    R.bindReadingForm(readingPop, () => state.reading, setReading);
  }
  readingPop.innerHTML = `<div class="rp-head"><b>阅读设置</b><a href="#/settings" class="small">更多设置</a></div>${R.readingFormHtml(state.reading, h)}`;
  const r = btn.getBoundingClientRect();
  readingPop.style.top = r.bottom + 8 + "px";
  readingPop.style.right = Math.max(8, innerWidth - r.right - 8) + "px";
  readingPop.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  document.addEventListener("keydown", onEsc, true);
  readingPop.querySelector("button[aria-checked=true]")?.focus();
}
function closeReading() {
  if (!readingPop) return;
  readingPop.hidden = true;
  $("#themeBtn").setAttribute("aria-expanded", "false");
  document.removeEventListener("pointerdown", outside, true);
  document.removeEventListener("keydown", onEsc, true);
}
const outside = (e) => { if (!readingPop.contains(e.target) && !e.target.closest("#themeBtn")) closeReading(); };
const onEsc = (e) => { if (e.key === "Escape") { e.preventDefault(); closeReading(); $("#themeBtn").focus(); } };
addEventListener("hashchange", () => closeReading());

/* ---------- boot ---------- */
async function boot() {
  // The language button shows the language you can switch to.
  const langBtn = $("#langBtn");
  langBtn.textContent = getLang() === "en" ? "中" : "EN";
  langBtn.onclick = () => { setLang(getLang() === "en" ? "zh" : "en"); location.reload(); };
  $("#themeBtn").onclick = () => openReading();
  $("#lockBtn").onclick = async () => {
    if (state.gh.unlocked) {
      if (await confirmDialog("锁定编辑？", "锁定后需要重新输入密码才能编辑。", "锁定")) { lock(); toast("已锁定。"); route(); }
    } else if (await ensureUnlocked()) route();
  };
  $("#searchBtn").onclick = () => palette.open();
  const modeSwitch = $(".mode-switch");
  modeSwitch.addEventListener("scroll", () => fitModeSwitch(false), { passive: true });
  [modeSwitch, ...modeSwitch.children].forEach((el) => modeSwitchWatch.observe(el));
  startEnhancements();
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
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.fallback) return;
    const cache = store.get("pc-imgcache") || {};
    const key = Object.keys(cache).find((k) => img.src.endsWith(k));
    if (key) { img.dataset.fallback = "1"; img.src = cache[key]; }
  }, true);
  addEventListener("hashchange", route);
  if (!location.hash && store.get("pc-mode") === "lab") history.replaceState(null, "", "#/lab");
  if (!location.hash && store.get("pc-mode") === "map") history.replaceState(null, "", "#/map");
  if (!location.hash && store.get("pc-mode") === "course") history.replaceState(null, "", "#/course");
  if (!location.hash && (store.get("pc-mode") === "today" || !store.get("pc-mode"))) history.replaceState(null, "", "#/today");
  route();
}

boot();
