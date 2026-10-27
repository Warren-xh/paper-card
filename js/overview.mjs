// The overview page (今天): what to do today, a calendar of study activity and
// what changed lately, across papers, practice logs, courses and mind maps.
// Pure functions only; the page itself is in overview-views.mjs.

const pad = (n) => String(n).padStart(2, "0");

// YYYY-MM-DD of a moment in local time.
export function localDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (day) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (day, n) => { const d = toDate(day); d.setDate(d.getDate() + n); return localDay(d); };

// Counts per day. Commits are the most faithful record (every save is one
// commit); without them, the dates written in the entries are used.
export function activityFromCommits(dates) {
  const counts = new Map();
  for (const iso of dates || []) {
    const day = localDay(iso);
    if (day) counts.set(day, (counts.get(day) || 0) + 1);
  }
  return counts;
}

export function activityFromEntries({ cards = [], logs = [], courses = [], lessons = [], maps = [] } = {}) {
  const counts = new Map();
  const add = (day) => { if (day && DAY_RE.test(day)) counts.set(day, (counts.get(day) || 0) + 1); };
  const touched = (x) => x.updatedAt && localDay(x.updatedAt);
  for (const c of cards) { add(c.readDate); if (touched(c) !== c.readDate) add(touched(c)); }
  for (const l of logs) { add(l.date); if (touched(l) !== l.date) add(touched(l)); }
  for (const l of lessons) add(l.date);
  for (const c of courses) add(touched(c));
  for (const m of maps) add(touched(m));
  return counts;
}

export const level = (n) => (!n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);

// Columns of weeks (Monday first) ending with the week of `today`.
export function heatmapWeeks(counts, today, weeks = 26) {
  const dow = (toDate(today).getDay() + 6) % 7; // Monday = 0
  let day = addDays(today, -dow - (weeks - 1) * 7);
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const n = counts.get(day) || 0;
      col.push({ day, n, level: level(n), future: day > today });
      day = addDays(day, 1);
    }
    out.push(col);
  }
  return out;
}

// Days in a row with activity, ending today (or yesterday, if today is still empty).
export function streak(counts, today) {
  let day = counts.get(today) ? today : addDays(today, -1);
  let n = 0;
  while (counts.get(day)) { n++; day = addDays(day, -1); }
  return n;
}

export function activeDays(counts, today, days = 30) {
  const from = addDays(today, -(days - 1));
  let n = 0;
  for (const [day, c] of counts) if (c && day >= from && day <= today) n++;
  return n;
}

export function greeting(hour) {
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 13) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
export const dateLine = (d) => `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEKDAYS[d.getDay()]}`;

// The latest changes across every module, newest first.
export function recentItems({ cards = [], logs = [], courses = [], maps = [] } = {}, limit = 8) {
  const items = [
    ...cards.map((x) => ({ kind: "card", id: x.id, title: x.title || x.oneLine, sub: x.oneLine && x.title ? x.oneLine : "", href: "#/c/" + x.id, at: x.updatedAt })),
    ...logs.map((x) => ({ kind: "log", id: x.id, title: x.title, sub: x.conclusion, href: "#/lab/e/" + x.id, at: x.updatedAt })),
    ...courses.map((x) => ({ kind: "course", id: x.id, title: x.title, sub: x.lessons ? `已看 ${x.done} / ${x.lessons} 课` : "", href: "#/course/" + x.id, at: x.updatedAt })),
    ...maps.map((x) => ({ kind: "map", id: x.id, title: x.title, sub: x.nodes ? `${x.nodes} 个分支` : "", href: "#/map/" + x.id, at: x.updatedAt })),
  ];
  return items.filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// "刚刚", "5 分钟前", "3 小时前", "昨天", "4 天前", or the date.
export function timeAgo(iso, now = new Date()) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return Math.floor(s / 60) + " 分钟前";
  const days = Math.round((toDate(localDay(now)) - toDate(localDay(t))) / 86400000);
  if (days === 0) return Math.floor(s / 3600) + " 小时前";
  if (days === 1) return "昨天";
  if (days < 7) return days + " 天前";
  return localDay(t);
}

// Courses still being learned, with the lesson to continue.
export const continueCourses = (courses) =>
  courses.filter((x) => x.status === "learning" && x.lessons && x.done < x.lessons)
    .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
