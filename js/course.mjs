// Courses (课程): notes taken while watching a course. A course holds its
// lessons; each lesson has notes, uploaded materials (slides, handouts, images),
// time-stamped marks and a one-liner.
// One file per course in data/courses/<id>.json; data/courses-index.json lists them.
// Materials are stored at materials/<course id>/<lesson id>/<file name>.
import { validDate, todayISO, normalizeTags, validId, makeId, safeUrl, stripMd, sortBy } from "./model.mjs";

export const COURSE_DIR = "data/courses/";
export const COURSES_INDEX_PATH = "data/courses-index.json";
export const MAX_LESSONS = 300;
export const MATERIAL_DIR = "materials/";
export const MAX_MATERIALS = 100;

export const STATUS_LABELS = { learning: "在学", done: "学完", paused: "暂停" };

// Marks made while watching, each with the video time.
export const MARKS = Object.freeze([
  { type: "?", label: "没听懂" },
  { type: "!", label: "重点" },
  { type: "★", label: "可以用" },
  { type: "✎", label: "笔记" },
]);
const MARK_TYPES = new Set(MARKS.map((m) => m.type));
export const markLabel = (type) => MARKS.find((m) => m.type === type)?.label || "";

const str = (value, max = 20000) => (typeof value === "string" ? value.slice(0, max) : "");
const LESSON_ID = /^[a-z0-9]{1,16}$/;
// Video time: 5:07, 12:34 or 1:02:03.
const TIME_RE = /^(\d{1,2}:)?\d{1,3}:[0-5]\d$/;

export const cleanTime = (value) => {
  const t = str(String(value ?? ""), 9).trim().replace(/：/g, ":");
  return TIME_RE.test(t) ? t : "";
};

// Seconds, for ordering marks by time ("" sorts last).
export function timeSeconds(t) {
  if (!t) return Infinity;
  return t.split(":").reduce((s, part) => s * 60 + Number(part), 0);
}

export function newLessonId(random = Math.random) {
  let id = "";
  for (let i = 0; i < 8; i++) id += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)];
  return id;
}

export const newCourseId = (title, date = todayISO(), random = Math.random) => makeId(date, title, random, "course");

export function emptyLesson(fields = {}) {
  return { id: newLessonId(), title: "", link: "", date: "", done: false, oneLine: "", marks: [], notes: "", files: [], ...fields };
}

/* ---------- materials ---------- */
export const materialDir = (courseId, lessonId) => MATERIAL_DIR + courseId + "/" + lessonId + "/";

const BAD_NAME = /[\x00-\x1f\\/:*?"<>|]/;
export function validMaterialPath(path) {
  if (typeof path !== "string" || path.length > 300 || !path.startsWith(MATERIAL_DIR)) return false;
  const [course, lesson, name, ...rest] = path.slice(MATERIAL_DIR.length).split("/");
  return !rest.length && validId(course) && LESSON_ID.test(lesson) && !!name && name !== "." && name !== ".." && !BAD_NAME.test(name);
}

export const materialName = (path) => path.split("/").pop();
export const isImageFile = (path) => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(path);
export const isPdfFile = (path) => /\.pdf$/i.test(path);

/* ---------- video: play inside the lesson page, jump to a mark's time ---------- */
// YouTube and Bilibili links become a player; other links just open.
export function videoInfo(link) {
  let u;
  try { u = new URL(String(link || "").trim()); } catch { return null; }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let m;
  if (host === "youtu.be" && (m = u.pathname.match(/^\/([\w-]{11})/))) return { site: "youtube", id: m[1] };
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.searchParams.get("v")?.match(/^[\w-]{11}$/)) return { site: "youtube", id: u.searchParams.get("v") };
    if ((m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/))) return { site: "youtube", id: m[1] };
  }
  if (host === "bilibili.com" || host === "b23.tv") {
    const page = Math.max(1, parseInt(u.searchParams.get("p"), 10) || 1);
    if ((m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]{10})/))) return { site: "bilibili", id: m[1], page };
    if ((m = u.pathname.match(/\/video\/av(\d+)/i))) return { site: "bilibili", id: "av" + m[1], page };
  }
  if (host === "player.bilibili.com") {
    const page = Math.max(1, parseInt(u.searchParams.get("page") || u.searchParams.get("p"), 10) || 1);
    const bvid = u.searchParams.get("bvid");
    if (/^BV[0-9A-Za-z]{10}$/.test(bvid || "")) return { site: "bilibili", id: bvid, page };
    if (/^\d+$/.test(u.searchParams.get("aid") || "")) return { site: "bilibili", id: "av" + u.searchParams.get("aid"), page };
  }
  return null;
}

export function videoEmbedUrl(v, seconds = 0, autoplay = false) {
  const t = Math.max(0, Math.floor(seconds) || 0);
  if (v.site === "youtube") return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&start=${t}${autoplay ? "&autoplay=1" : ""}`;
  const id = v.id.startsWith("av") ? "aid=" + v.id.slice(2) : "bvid=" + v.id;
  return `https://player.bilibili.com/player.html?${id}&page=${v.page || 1}&t=${t}&autoplay=${autoplay ? 1 : 0}&high_quality=1&danmaku=0`;
}

export function videoWatchUrl(v, seconds = 0) {
  const t = Math.max(0, Math.floor(seconds) || 0);
  if (v.site === "youtube") return `https://www.youtube.com/watch?v=${v.id}${t ? "&t=" + t + "s" : ""}`;
  return `https://www.bilibili.com/video/${v.id}${v.page > 1 ? "?p=" + v.page : ""}${t ? (v.page > 1 ? "&" : "?") + "t=" + t : ""}`;
}

// Every material file of a course (for deleting it).
export const coursePaths = (course) => course.lessons.flatMap((l) => l.files.map((f) => f.path));

export function emptyCourse(id = "") {
  return {
    version: 1,
    id,
    title: "",
    teacher: "",
    link: "",
    tags: [],
    project: "",
    status: "learning",
    startDate: "",
    goal: "",
    summary: "",
    lessons: [],
    createdAt: "",
    updatedAt: "",
  };
}

export function normalizeLesson(raw, seen = new Set()) {
  if (!raw || typeof raw !== "object") return null;
  let id = LESSON_ID.test(raw.id) && !seen.has(raw.id) ? raw.id : newLessonId();
  while (seen.has(id)) id = newLessonId();
  seen.add(id);
  return {
    id,
    title: str(raw.title, 200).trim(),
    link: safeUrl(str(raw.link, 500).trim()),
    date: validDate(raw.date) ? raw.date : "",
    done: !!raw.done,
    oneLine: str(raw.oneLine, 400).trim(),
    marks: (Array.isArray(raw.marks) ? raw.marks : [])
      .map((m) => ({
        time: cleanTime(m?.time),
        type: MARK_TYPES.has(m?.type) ? m.type : "✎",
        text: str(m?.text, 500).trim(),
        solve: !!m?.solve,
        answer: str(m?.answer, 2000).trim(),
      }))
      .filter((m) => m.text)
      .slice(0, 300),
    notes: str(raw.notes, 50000),
    files: (Array.isArray(raw.files) ? raw.files : [])
      .filter((f) => validMaterialPath(f?.path))
      .map((f) => ({ path: f.path, size: Number.isFinite(f.size) && f.size >= 0 ? Math.round(f.size) : 0 }))
      .filter((f, i, all) => all.findIndex((x) => x.path === f.path) === i)
      .slice(0, MAX_MATERIALS),
  };
}

export function normalizeCourse(raw) {
  if (!raw || typeof raw !== "object") throw new Error("课程格式不正确。");
  if (!validId(raw.id)) throw new Error("课程编号不正确。");
  const c = emptyCourse(raw.id);
  c.title = str(raw.title, 200).trim();
  c.teacher = str(raw.teacher, 120).trim();
  c.link = safeUrl(str(raw.link, 500).trim());
  c.tags = normalizeTags(raw.tags);
  c.project = str(raw.project, 60).trim();
  c.status = STATUS_LABELS[raw.status] ? raw.status : "learning";
  c.startDate = validDate(raw.startDate) ? raw.startDate : "";
  c.goal = str(raw.goal, 300).trim();
  c.summary = str(raw.summary, 50000);
  const seen = new Set();
  c.lessons = (Array.isArray(raw.lessons) ? raw.lessons : [])
    .map((l) => normalizeLesson(l, seen))
    .filter(Boolean)
    .slice(0, MAX_LESSONS);
  c.createdAt = str(raw.createdAt, 40);
  c.updatedAt = str(raw.updatedAt, 40);
  return c;
}

/* ---------- lessons ---------- */
export const progress = (c) => ({ done: c.lessons.filter((l) => l.done).length, total: c.lessons.length });

// Marks flagged 待解决 without an answer yet.
export const openMarks = (lesson) => lesson.marks.filter((m) => m.solve && !m.answer);

// The first lesson not watched yet (where to continue).
export const nextLesson = (c) => c.lessons.find((l) => !l.done) || null;

// Replaces a lesson by id, or adds it at the end; returns a new course.
export function upsertLesson(course, lesson) {
  const i = course.lessons.findIndex((l) => l.id === lesson.id);
  const lessons = [...course.lessons];
  if (i >= 0) lessons[i] = lesson;
  else lessons.push(lesson);
  return { ...course, lessons };
}

export const removeLesson = (course, id) => ({ ...course, lessons: course.lessons.filter((l) => l.id !== id) });

// "Add several lessons": one title per line; leading numbering like "1." or "第3课" is kept as written.
export const parseLessonTitles = (text) =>
  String(text || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, MAX_LESSONS);

// Marks sorted by video time (marks without a time keep their order, at the end).
export const marksByTime = (marks) =>
  marks.map((m, i) => [m, i]).sort((a, b) => timeSeconds(a[0].time) - timeSeconds(b[0].time) || a[1] - b[1]).map(([m]) => m);

/* ---------- index ---------- */
export function plainText(c) {
  return [
    c.title, c.teacher, c.project, c.tags.join(" "), c.goal, stripMd(c.summary),
    ...c.lessons.map((l) => [l.title, l.oneLine, l.marks.map((m) => m.text + " " + m.answer).join(" "), stripMd(l.notes), l.files.map((f) => materialName(f.path)).join(" ")].join(" ")),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarize(c) {
  const p = progress(c);
  const dates = c.lessons.map((l) => l.date).filter(Boolean).sort();
  return {
    id: c.id,
    title: c.title,
    teacher: c.teacher,
    status: c.status,
    tags: c.tags,
    project: c.project,
    goal: c.goal,
    startDate: c.startDate,
    lastDate: dates.at(-1) || c.startDate || "",
    lessons: p.total,
    done: p.done,
    open: c.lessons.reduce((t, l) => t + openMarks(l).length, 0),
    next: nextLesson(c)?.title || "",
    nextId: nextLesson(c)?.id || "",
    text: plainText(c).slice(0, 4000),
    updatedAt: c.updatedAt,
  };
}

export function emptyIndex() {
  return { version: 1, updatedAt: "", courses: [] };
}

export function normalizeIndex(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.courses)) return emptyIndex();
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    courses: sortCourses(
      raw.courses.filter((x) => x && validId(x.id)).map((x) => ({ ...x, tags: Array.isArray(x.tags) ? x.tags : [] })),
      "updated",
    ),
  };
}

export function upsertIndex(index, course, now = new Date().toISOString()) {
  const courses = index.courses.filter((x) => x.id !== course.id);
  courses.push(summarize(course));
  return normalizeIndex({ version: 1, updatedAt: now, courses });
}

export function removeFromIndex(index, id, now = new Date().toISOString()) {
  return { version: 1, updatedAt: now, courses: index.courses.filter((x) => x.id !== id) };
}

/* ---------- list page ---------- */
export function search(courses, { query = "", tag = "", project = "", status = "" } = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return courses.filter((x) => {
    if (tag && !x.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (project && x.project !== project) return false;
    if (status === "open" ? !x.open : status && x.status !== status) return false;
    if (!terms.length) return true;
    const hay = (x.title + " " + x.teacher + " " + x.text).toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export const COURSE_SORTS = Object.freeze([
  ["recent", "最近学习"], ["updated", "最近修改"], ["progress", "进度：高→低"], ["progress-asc", "进度：低→高"], ["title", "标题 A→Z"], ["open", "待解决最多"],
]);

const ratio = (x) => (x.lessons ? x.done / x.lessons : 0);
export function sortCourses(list, key = "recent") {
  const updated = (x) => x.updatedAt;
  switch (key) {
    case "updated": return sortBy(list, [[updated, "desc"]]);
    case "progress": return sortBy(list, [[ratio, "desc"], [updated, "desc"]]);
    case "progress-asc": return sortBy(list, [[ratio, "asc"], [updated, "desc"]]);
    case "title": return sortBy(list, [[(x) => x.title, "asc"]]);
    case "open": return sortBy(list, [[(x) => x.open || 0, "desc"], [updated, "desc"]]);
    default: return sortBy(list, [[(x) => x.lastDate, "desc"], [updated, "desc"]]);
  }
}

export function stats(courses) {
  return {
    total: courses.length,
    learning: courses.filter((x) => x.status === "learning").length,
    finished: courses.filter((x) => x.status === "done").length,
    lessonsDone: courses.reduce((t, x) => t + (x.done || 0), 0),
    open: courses.reduce((t, x) => t + (x.open || 0), 0),
  };
}

export function tagCounts(courses) {
  const counts = new Map();
  for (const x of courses) for (const t of x.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function projectList(courses) {
  const counts = new Map();
  for (const x of courses) if (x.project) counts.set(x.project, (counts.get(x.project) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/* ---------- export ---------- */
const markLine = (m) => "- " + (m.time ? m.time + " " : "") + m.type + " " + m.text + (m.solve ? "\n  → " + (m.answer || "（待解决）") : "");

export function lessonToMarkdown(l, n) {
  const out = ["## 第 " + n + " 课 · " + (l.title || "（未写标题）") + (l.done ? " ✓" : "")];
  const meta = [l.date && "日期：" + l.date, l.link && "链接：" + l.link].filter(Boolean);
  if (meta.length) out.push(meta.join(" ｜ "));
  if (l.oneLine) out.push("> " + l.oneLine);
  if (l.marks.length) out.push(marksByTime(l.marks).map(markLine).join("\n"));
  if (l.notes.trim()) out.push(l.notes.trim());
  if (l.files.length) out.push("课件与资料：\n" + l.files.map((f) => "- [" + materialName(f.path) + "](" + f.path + ")").join("\n"));
  return out.join("\n\n");
}

export function courseToMarkdown(c) {
  const p = progress(c);
  const out = ["# " + (c.title || "（未写标题）")];
  const meta = ["状态：" + STATUS_LABELS[c.status], "进度：" + p.done + "/" + p.total];
  if (c.teacher) meta.push("讲师 / 平台：" + c.teacher);
  if (c.link) meta.push("链接：" + c.link);
  if (c.tags.length) meta.push("标签：" + c.tags.map((t) => "#" + t).join(" "));
  out.push(meta.join(" ｜ "));
  if (c.goal) out.push("**为什么学**：" + c.goal);
  c.lessons.forEach((l, i) => out.push(lessonToMarkdown(l, i + 1)));
  if (c.summary.trim()) out.push("## 学完总结\n" + c.summary.trim());
  return out.join("\n\n") + "\n";
}
