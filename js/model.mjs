// Data model: paper cards, the public index, review scheduling and export.

export const CARD_DIR = "data/cards/";
export const INDEX_PATH = "data/index.json";
export const SITE_PATH = "data/site.json";
export const VAULT_PATH = "data/vault.json";

export const DEFAULT_SITE = Object.freeze({
  version: 1,
  title: "文献卡片",
  subtitle: "读一篇，记一张；回头看，一眼想起。",
  author: "",
  repo: "",
  branch: "main",
});

// Reading marks: only a symbol, an optional page and a few words.
export const MARKS = Object.freeze([
  { type: "?", label: "没看懂" },
  { type: "!", label: "关键结论" },
  { type: "★", label: "可以借鉴" },
  { type: "×", label: "有问题" },
  { type: "✎", label: "普通笔记" },
]);
const MARK_TYPES = new Set(MARKS.map((m) => m.type));
export const markLabel = (type) => MARKS.find((m) => m.type === type)?.label || "";

export const STATUS_LABELS = { reading: "在读", done: "读完" };

// The seven parts of a card written after reading, without looking at the paper.
export const SECTIONS = Object.freeze([
  { n: 1, mark: "①", key: "oneLine", title: "一句话" },
  { n: 2, mark: "②", key: "pain", title: "痛点" },
  { n: 3, mark: "③", key: "idea", title: "核心想法" },
  { n: 4, mark: "④", key: "proof", title: "怎么证明的" },
  { n: 5, mark: "⑤", key: "doubts", title: "疑问 / 局限" },
  { n: 6, mark: "⑥", key: "relevance", title: "和我有什么关系" },
  { n: 7, mark: "⑦", key: "links", title: "关联" },
]);

// Review intervals in days for each "想起来了"; the first review is the day after reading.
export const INTERVALS = Object.freeze([1, 7, 30, 90, 180]);
export const GRADES = Object.freeze({
  forgot: { label: "忘了", days: () => 1 },
  fuzzy: { label: "有点模糊", days: () => 3 },
  good: { label: "想起来了", days: (level) => INTERVALS[Math.min(level + 1, INTERVALS.length - 1)] },
});

const str = (value, max = 20000) =>
  typeof value === "string" ? value.slice(0, max) : "";
const int = (value, min, max) => {
  const n = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayISO(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  const date = new Date(iso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayDiff(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/* ---------- ids ---------- */
export const ID_RE = /^\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{4}$/;
export const validId = (id) => typeof id === "string" && id.length <= 60 && ID_RE.test(id);

export function slugify(title) {
  const words = String(title || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  return (words[0] || "card").slice(0, 24);
}

export function makeId(date, title, random = Math.random) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += chars[Math.floor(random() * chars.length)];
  const day = validDate(date) ? date : todayISO();
  return day.replace(/-/g, "") + "-" + slugify(title) + "-" + tail;
}

/* ---------- cards ---------- */
export function emptyCard(id = "") {
  return {
    version: 1,
    id,
    title: "",
    authors: "",
    year: null,
    venue: "",
    link: "",
    pdf: "",
    pdfName: "",
    tags: [],
    project: "",
    readDate: "",
    status: "reading",
    doneAt: "",
    why: "",
    marks: [],
    solved: "",
    oneLine: "",
    pain: "",
    idea: "",
    proof: { datasets: "", baselines: "", numbers: "" },
    doubts: "",
    relevance: "",
    links: [],
    linkNote: "",
    notes: "",
    srs: null,
    reviews: [],
    createdAt: "",
    updatedAt: "",
  };
}

export function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[,，、\s]+/);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const tag = String(raw).replace(/^#/, "").trim().slice(0, 30);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out.slice(0, 12);
}

export function safeUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^(10\.\d{4,}\/|arxiv:|doi:)/i.test(url)) return url;
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(url)) return "arXiv:" + url;
  return "";
}

export function paperHref(url) {
  if (/^10\.\d{4,}\//.test(url)) return "https://doi.org/" + url;
  if (/^doi:/i.test(url)) return "https://doi.org/" + url.slice(4).trim();
  if (/^arxiv:/i.test(url)) return "https://arxiv.org/abs/" + url.slice(6).trim();
  return url;
}

function normalizeSrs(raw) {
  if (!raw || !validDate(raw.due)) return null;
  return { level: int(raw.level, 0, INTERVALS.length - 1) ?? 0, due: raw.due };
}

// Uploaded paper PDFs live under papers/ in the repository.
export const PDF_RE = /^papers\/[A-Za-z0-9._-]{1,80}\.pdf$/;
export const PDF_MAX_BYTES = 50 * 1024 * 1024;

export function pdfPath(id) {
  return "papers/" + id + ".pdf";
}

export function normalizeCard(raw) {
  if (!raw || typeof raw !== "object") throw new Error("卡片格式不正确。");
  if (!validId(raw.id)) throw new Error("卡片编号不正确。");
  const c = emptyCard(raw.id);
  c.title = str(raw.title, 300).trim();
  c.authors = str(raw.authors, 300).trim();
  c.year = int(raw.year, 1800, 2200);
  c.venue = str(raw.venue, 120).trim();
  c.link = safeUrl(str(raw.link, 500).trim());
  c.pdf = PDF_RE.test(raw.pdf) ? raw.pdf : "";
  c.pdfName = c.pdf ? str(raw.pdfName, 200).trim() : "";
  c.tags = normalizeTags(raw.tags);
  c.project = str(raw.project, 60).trim();
  c.readDate = validDate(raw.readDate) ? raw.readDate : "";
  c.status = raw.status === "done" ? "done" : "reading";
  c.doneAt = validDate(raw.doneAt) ? raw.doneAt : "";
  c.why = str(raw.why, 300).trim();
  c.marks = (Array.isArray(raw.marks) ? raw.marks : [])
    .map((m) => ({
      type: MARK_TYPES.has(m?.type) ? m.type : "!",
      page: str(String(m?.page ?? ""), 12).trim(),
      text: str(m?.text, 300).trim(),
      answer: str(m?.answer, 2000).trim(),
      // "待解决": the mark gets an answer box in the first-pass solving stage.
      // Older marks that already have an answer count as flagged.
      solve: typeof m?.solve === "boolean" ? m.solve : !!str(m?.answer, 2000).trim(),
    }))
    .filter((m) => m.text)
    .slice(0, 200);
  c.solved = str(raw.solved);
  c.oneLine = str(raw.oneLine, 400).trim();
  c.pain = str(raw.pain);
  c.idea = str(raw.idea);
  const proof = raw.proof && typeof raw.proof === "object" ? raw.proof : {};
  c.proof = {
    datasets: str(proof.datasets, 2000).trim(),
    baselines: str(proof.baselines, 2000).trim(),
    numbers: str(proof.numbers, 2000).trim(),
  };
  c.doubts = str(raw.doubts);
  c.relevance = str(raw.relevance);
  c.links = [...new Set((Array.isArray(raw.links) ? raw.links : []).filter((id) => validId(id) && id !== c.id))].slice(0, 50);
  c.linkNote = str(raw.linkNote, 4000);
  c.notes = str(raw.notes, 50000);
  c.srs = normalizeSrs(raw.srs);
  c.reviews = (Array.isArray(raw.reviews) ? raw.reviews : [])
    .filter((r) => r && validDate(r.date) && GRADES[r.grade])
    .map((r) => ({ date: r.date, grade: r.grade, next: validDate(r.next) ? r.next : "" }))
    .slice(-200);
  c.createdAt = str(raw.createdAt, 40);
  c.updatedAt = str(raw.updatedAt, 40);
  return c;
}

export function isEmptyCard(c) {
  return !(c.title || c.oneLine || c.why || c.marks.length || c.pain.trim() || c.idea.trim() || c.notes.trim() || c.pdf);
}

// Which of the seven parts are written.
export function filledSections(c) {
  const has = {
    oneLine: !!c.oneLine.trim(),
    pain: !!c.pain.trim(),
    idea: !!c.idea.trim(),
    proof: !!(c.proof.datasets || c.proof.baselines || c.proof.numbers),
    doubts: !!c.doubts.trim(),
    relevance: !!c.relevance.trim(),
    links: !!(c.links.length || c.linkNote.trim()),
  };
  const missing = SECTIONS.filter((s) => !has[s.key]);
  return { filled: SECTIONS.length - missing.length, total: SECTIONS.length, missing: missing.map((s) => s.mark) };
}

export function progressText(c) {
  const p = filledSections(c);
  return "卡片 " + p.filled + "/" + p.total + (p.missing.length ? "，还差 " + p.missing.join("") : "，写完了");
}

// Called when publishing: the first time a card is marked done, reviews start the next day.
export function applyStatus(card, today = todayISO()) {
  const c = { ...card };
  if (c.status === "done") {
    c.doneAt ||= today;
    c.srs ||= { level: 0, due: addDays(c.doneAt, INTERVALS[0]) };
  }
  return c;
}

// Marks flagged 待解决 that have no answer yet.
export const openQuestions = (c) => c.marks.filter((m) => m.solve && !m.answer);
const answered = (m) => m.solve && !!m.answer;

export function isDue(x, today = todayISO()) {
  return x.status === "done" && !!x.due && x.due <= today;
}

export function dueCards(summaries, today = todayISO()) {
  return summaries
    .filter((x) => isDue(x, today))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.id < b.id ? -1 : 1));
}

// Next upcoming review after today: { date, count } or null.
export function nextReview(summaries, today = todayISO()) {
  const future = summaries.filter((x) => x.status === "done" && x.due && x.due > today).map((x) => x.due).sort();
  if (!future.length) return null;
  return { date: future[0], count: future.filter((d) => d === future[0]).length };
}

export function previewInterval(card, grade) {
  return GRADES[grade].days(card.srs?.level ?? 0);
}

export function gradeCard(card, grade, today = todayISO()) {
  if (!GRADES[grade]) throw new Error("未知的回顾结果。");
  const level = card.srs?.level ?? 0;
  const nextLevel = grade === "good" ? Math.min(level + 1, INTERVALS.length - 1) : grade === "forgot" ? 0 : level;
  const next = addDays(today, GRADES[grade].days(level));
  return {
    ...card,
    srs: { level: nextLevel, due: next },
    reviews: [...card.reviews, { date: today, grade, next }].slice(-200),
  };
}

/* ---------- index ---------- */
const stripMd = (text) =>
  String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|$-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function plainText(c) {
  return [
    c.title, c.authors, c.venue, c.year, c.project, c.tags.join(" "), c.why,
    c.marks.map((m) => m.text + (m.solve ? " " + m.answer : "")).join(" "),
    stripMd(c.solved),
    c.oneLine, stripMd(c.pain), stripMd(c.idea),
    c.proof.datasets, c.proof.baselines, c.proof.numbers,
    stripMd(c.doubts), stripMd(c.relevance), stripMd(c.linkNote), stripMd(c.notes),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarize(c) {
  const p = filledSections(c);
  return {
    id: c.id,
    title: c.title,
    authors: c.authors,
    year: c.year,
    venue: c.venue,
    tags: c.tags,
    project: c.project,
    readDate: c.readDate,
    status: c.status,
    oneLine: c.oneLine,
    questions: openQuestions(c).length,
    pdf: !!c.pdf,
    marks: c.marks.length,
    filled: p.filled,
    links: c.links,
    due: c.status === "done" ? c.srs?.due || "" : "",
    level: c.srs?.level ?? 0,
    reviews: c.reviews.length,
    text: plainText(c).slice(0, 4000),
    updatedAt: c.updatedAt,
  };
}

export function emptyIndex() {
  return { version: 1, updatedAt: "", cards: [] };
}

const byNewest = (a, b) =>
  (b.readDate || "").localeCompare(a.readDate || "") || (b.updatedAt || "").localeCompare(a.updatedAt || "") || (a.id < b.id ? 1 : -1);

export function normalizeIndex(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.cards)) return emptyIndex();
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    cards: raw.cards
      .filter((x) => x && validId(x.id))
      .map((x) => ({ ...x, tags: Array.isArray(x.tags) ? x.tags : [], links: Array.isArray(x.links) ? x.links : [] }))
      .sort(byNewest),
  };
}

export function upsertIndex(index, card, now = new Date().toISOString()) {
  const cards = index.cards.filter((x) => x.id !== card.id);
  cards.push(summarize(card));
  cards.sort(byNewest);
  return { version: 1, updatedAt: now, cards };
}

export function removeFromIndex(index, id, now = new Date().toISOString()) {
  return { version: 1, updatedAt: now, cards: index.cards.filter((x) => x.id !== id) };
}

// Cards that link to `id` (links are stored on one card and shown on both).
export function backlinks(summaries, id) {
  return summaries.filter((x) => x.id !== id && x.links.includes(id));
}

/* ---------- home page ---------- */
export function stats(summaries, today = todayISO()) {
  const month = today.slice(0, 7);
  return {
    total: summaries.length,
    done: summaries.filter((x) => x.status === "done").length,
    reading: summaries.filter((x) => x.status !== "done").length,
    thisMonth: summaries.filter((x) => (x.readDate || "").startsWith(month)).length,
    questions: summaries.reduce((t, x) => t + (x.questions || 0), 0),
    reviews: summaries.reduce((t, x) => t + (x.reviews || 0), 0),
    due: dueCards(summaries, today).length,
  };
}

export function search(summaries, { query = "", tag = "", project = "", status = "" } = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return summaries.filter((x) => {
    if (tag && !x.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (project && x.project !== project) return false;
    if (status === "questions" ? !x.questions : status && x.status !== status) return false;
    if (!terms.length) return true;
    const hay = (x.title + " " + x.oneLine + " " + x.text).toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function tagCounts(summaries) {
  const counts = new Map();
  for (const x of summaries) for (const t of x.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function projectList(summaries) {
  const counts = new Map();
  for (const x of summaries) if (x.project) counts.set(x.project, (counts.get(x.project) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/* ---------- editor helpers ---------- */
// Lines for "带入": marks of the given types not already present in `text`.
// Marks already answered in the first pass are not doubts any more.
export function marksToLines(marks, types, text = "") {
  return marks
    .filter((m) => types.includes(m.type) && m.text && !answered(m) && !text.includes(m.text))
    .map((m) => "- " + m.type + " " + (m.page ? "p." + m.page + " " : "") + m.text);
}

export const citation = (c) => [c.authors, c.year, c.venue].filter(Boolean).join(" · ");

/* ---------- export ---------- */
export function cardToMarkdown(c, titles = new Map()) {
  const out = ["# " + (c.title || "（未写标题）")];
  const meta = [];
  if (citation(c)) meta.push(citation(c));
  if (c.link) meta.push("链接：" + paperHref(c.link));
  if (c.pdf) meta.push("PDF：" + c.pdf);
  meta.push("状态：" + STATUS_LABELS[c.status] + (c.readDate ? "（" + c.readDate + " 阅读）" : ""));
  if (c.project) meta.push("项目：" + c.project);
  if (c.tags.length) meta.push("标签：" + c.tags.map((t) => "#" + t).join(" "));
  out.push(meta.join(" ｜ "));
  if (c.why) out.push("**为什么读**：" + c.why);
  if (c.oneLine) out.push("> **一句话**：" + c.oneLine);
  const sec = (mark, title, body) => body && out.push("## " + mark + " " + title + "\n" + body.trim());
  sec("②", "痛点", c.pain);
  sec("③", "核心想法", c.idea);
  const proof = [
    c.proof.datasets && "- 数据集：" + c.proof.datasets,
    c.proof.baselines && "- 对比对象：" + c.proof.baselines,
    c.proof.numbers && "- 关键数字：" + c.proof.numbers,
  ].filter(Boolean).join("\n");
  sec("④", "怎么证明的", proof);
  sec("⑤", "疑问 / 局限", c.doubts);
  sec("⑥", "和我有什么关系", c.relevance);
  const links = [c.links.map((id) => "- " + (titles.get(id) || id)).join("\n"), c.linkNote.trim()].filter(Boolean).join("\n\n");
  sec("⑦", "关联", links);
  if (c.marks.length)
    out.push("## 阅读标记\n" + c.marks.map((m) => "- " + m.type + " " + (m.page ? "p." + m.page + " " : "") + m.text).join("\n"));
  const flagged = c.marks.filter((m) => m.solve);
  const solved = [
    flagged.map((m) => "- " + m.type + " " + m.text + "\n  → " + (m.answer || "（还没解决）")).join("\n"),
    c.solved.trim(),
  ].filter(Boolean).join("\n\n");
  sec("", "初步解决", solved);
  sec("", "自由笔记", c.notes);
  return out.join("\n\n").replace(/^## {2}/gm, "## ") + "\n";
}
