// Practice logs (实操记录): a lighter companion to paper cards for coding and
// training sessions. One log per session, kept in data/logs/<id>.json.
import { validDate, todayISO, normalizeTags, validId, makeId, safeUrl, stripMd } from "./model.mjs";

export const LOG_DIR = "data/logs/";
export const LOGS_INDEX_PATH = "data/logs-index.json";

export const STATUS_LABELS = { doing: "进行中", done: "完成" };

// Quick entries recorded while working, each stamped with the time.
export const STEPS = Object.freeze([
  { type: "▶", label: "操作" },
  { type: "✗", label: "报错" },
  { type: "✓", label: "成功" },
  { type: "?", label: "疑问" },
  { type: "✎", label: "笔记" },
]);
const STEP_TYPES = new Set(STEPS.map((s) => s.type));
export const stepLabel = (type) => STEPS.find((s) => s.type === type)?.label || "";

// The parts written once the session is over.
export const PARTS = Object.freeze([
  { key: "conclusion", title: "结论" },
  { key: "fixes", title: "问题与解决" },
  { key: "code", title: "关键代码 / 命令" },
  { key: "results", title: "结果" },
  { key: "next", title: "下次要做" },
]);

const str = (value, max = 20000) => (typeof value === "string" ? value.slice(0, max) : "");
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function nowTime(now = new Date()) {
  return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

export function newLogId(date, title, random = Math.random) {
  return makeId(date, title, random, "log");
}

export function emptyLog(id = "") {
  return {
    version: 1,
    id,
    title: "",
    date: "",
    status: "doing",
    hours: null,
    project: "",
    tags: [],
    env: "",
    link: "",
    goal: "",
    steps: [],
    conclusion: "",
    fixes: "",
    code: "",
    results: "",
    next: "",
    papers: [],
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}

export function normalizeLog(raw) {
  if (!raw || typeof raw !== "object") throw new Error("记录格式不正确。");
  if (!validId(raw.id)) throw new Error("记录编号不正确。");
  const l = emptyLog(raw.id);
  l.title = str(raw.title, 200).trim();
  l.date = validDate(raw.date) ? raw.date : "";
  l.status = raw.status === "done" ? "done" : "doing";
  const hours = typeof raw.hours === "number" ? raw.hours : parseFloat(raw.hours);
  l.hours = Number.isFinite(hours) && hours >= 0 && hours <= 200 ? Math.round(hours * 10) / 10 : null;
  l.project = str(raw.project, 60).trim();
  l.tags = normalizeTags(raw.tags);
  l.env = str(raw.env, 200).trim();
  l.link = safeUrl(str(raw.link, 500).trim());
  l.goal = str(raw.goal, 300).trim();
  l.steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s) => ({
      type: STEP_TYPES.has(s?.type) ? s.type : "✎",
      time: TIME_RE.test(s?.time) ? s.time : "",
      text: str(s?.text, 500).trim(),
      solve: !!s?.solve,
      answer: str(s?.answer, 2000).trim(),
    }))
    .filter((s) => s.text)
    .slice(0, 300);
  l.conclusion = str(raw.conclusion, 400).trim();
  for (const k of ["fixes", "code", "results", "next"]) l[k] = str(raw[k], 50000);
  l.papers = [...new Set((Array.isArray(raw.papers) ? raw.papers : []).filter(validId))].slice(0, 30);
  l.notes = str(raw.notes, 50000);
  l.createdAt = str(raw.createdAt, 40);
  l.updatedAt = str(raw.updatedAt, 40);
  return l;
}

// Steps flagged 待解决 that have no fix written yet.
export const openSteps = (l) => l.steps.filter((s) => s.solve && !s.answer);

export function plainText(l) {
  return [
    l.title, l.project, l.tags.join(" "), l.env, l.goal,
    l.steps.map((s) => s.text + " " + s.answer).join(" "),
    l.conclusion, stripMd(l.fixes), stripMd(l.code), stripMd(l.results), stripMd(l.next), stripMd(l.notes),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarize(l) {
  return {
    id: l.id,
    title: l.title,
    date: l.date,
    status: l.status,
    hours: l.hours,
    project: l.project,
    tags: l.tags,
    conclusion: l.conclusion,
    steps: l.steps.length,
    errors: l.steps.filter((s) => s.type === "✗").length,
    open: openSteps(l).length,
    papers: l.papers,
    text: plainText(l).slice(0, 4000),
    updatedAt: l.updatedAt,
  };
}

export function emptyIndex() {
  return { version: 1, updatedAt: "", logs: [] };
}

const byNewest = (a, b) =>
  (b.date || "").localeCompare(a.date || "") || (b.updatedAt || "").localeCompare(a.updatedAt || "") || (a.id < b.id ? 1 : -1);

export function normalizeIndex(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.logs)) return emptyIndex();
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    logs: raw.logs
      .filter((x) => x && validId(x.id))
      .map((x) => ({ ...x, tags: Array.isArray(x.tags) ? x.tags : [], papers: Array.isArray(x.papers) ? x.papers : [] }))
      .sort(byNewest),
  };
}

export function upsertIndex(index, log, now = new Date().toISOString()) {
  const logs = index.logs.filter((x) => x.id !== log.id);
  logs.push(summarize(log));
  logs.sort(byNewest);
  return { version: 1, updatedAt: now, logs };
}

export function removeFromIndex(index, id, now = new Date().toISOString()) {
  return { version: 1, updatedAt: now, logs: index.logs.filter((x) => x.id !== id) };
}

// Logs that mention a paper card (shown on that card's page).
export const logsForPaper = (logs, cardId) => logs.filter((x) => x.papers.includes(cardId));

export function search(logs, { query = "", tag = "", project = "", status = "" } = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return logs.filter((x) => {
    if (tag && !x.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (project && x.project !== project) return false;
    if (status === "open" ? !x.open : status && x.status !== status) return false;
    if (!terms.length) return true;
    const hay = (x.date + " " + x.title + " " + x.conclusion + " " + x.text).toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function stats(logs, today = todayISO()) {
  const sum = (list) => Math.round(list.reduce((t, x) => t + (Number(x.hours) || 0), 0) * 10) / 10;
  const month = today.slice(0, 7);
  return {
    total: logs.length,
    doing: logs.filter((x) => x.status !== "done").length,
    thisMonth: logs.filter((x) => (x.date || "").startsWith(month)).length,
    hours: sum(logs),
    open: logs.reduce((t, x) => t + (x.open || 0), 0),
  };
}

export function tagCounts(logs) {
  const counts = new Map();
  for (const x of logs) for (const t of x.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function projectList(logs) {
  const counts = new Map();
  for (const x of logs) if (x.project) counts.set(x.project, (counts.get(x.project) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

export function logToMarkdown(l, paperTitles = new Map()) {
  const out = ["# " + (l.date ? l.date + " · " : "") + (l.title || "（未写标题）")];
  const meta = ["状态：" + STATUS_LABELS[l.status]];
  if (l.hours != null) meta.push("用时：" + l.hours + " 小时");
  if (l.project) meta.push("项目：" + l.project);
  if (l.env) meta.push("环境：" + l.env);
  if (l.link) meta.push("代码：" + l.link);
  if (l.tags.length) meta.push("标签：" + l.tags.map((t) => "#" + t).join(" "));
  out.push(meta.join(" ｜ "));
  if (l.goal) out.push("**目标**：" + l.goal);
  if (l.conclusion) out.push("> **结论**：" + l.conclusion);
  if (l.steps.length)
    out.push("## 过程\n" + l.steps.map((s) => "- " + (s.time ? s.time + " " : "") + s.type + " " + s.text + (s.solve ? "\n  → " + (s.answer || "（待解决）") : "")).join("\n"));
  const sec = (title, body) => body && body.trim() && out.push("## " + title + "\n" + body.trim());
  sec("问题与解决", l.fixes);
  sec("关键代码 / 命令", l.code);
  sec("结果", l.results);
  sec("下次要做", l.next);
  if (l.papers.length) out.push("## 相关论文\n" + l.papers.map((id) => "- " + (paperTitles.get(id) || id)).join("\n"));
  sec("笔记", l.notes);
  return out.join("\n\n") + "\n";
}

export function newLog(date = todayISO()) {
  return { ...emptyLog("00000000-new-0000"), date };
}
