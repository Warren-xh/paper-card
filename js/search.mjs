// Search across every module (the Ctrl+K search box): papers, practice logs,
// courses and their lessons, and mind maps.

export const KIND_LABELS = { card: "论文", log: "实操", course: "课程", lesson: "课时", map: "导图" };

const lower = (s) => String(s || "").toLowerCase();

// One entry per thing that can be opened. `courseFiles` (full courses, when
// loaded) adds their lessons; otherwise only courses themselves are found.
export function buildEntries({ cards = [], logs = [], courses = [], courseFiles = [], maps = [] } = {}) {
  const out = [];
  for (const x of cards) out.push({ kind: "card", title: x.title || x.oneLine || "未写标题", sub: x.oneLine && x.title ? x.oneLine : [x.authors, x.year].filter(Boolean).join(" · "), text: x.text || "", href: "#/c/" + x.id, at: x.updatedAt || "" });
  for (const x of logs) out.push({ kind: "log", title: x.title || "未写标题", sub: x.conclusion || x.date || "", text: x.text || "", href: "#/lab/e/" + x.id, at: x.updatedAt || "" });
  for (const x of courses) out.push({ kind: "course", title: x.title || "未命名课程", sub: x.teacher || "", text: x.text || "", href: "#/course/" + x.id, at: x.updatedAt || "" });
  for (const c of courseFiles)
    c.lessons.forEach((l, i) => out.push({
      kind: "lesson",
      title: l.title || "第 " + (i + 1) + " 课",
      sub: (c.title || "") + " · 第 " + (i + 1) + " 课",
      text: [l.oneLine, l.notes, l.marks.map((m) => m.text + " " + m.answer).join(" "), l.files.map((f) => f.path.split("/").pop()).join(" ")].join(" "),
      href: "#/course/" + c.id + "/l/" + l.id,
      at: c.updatedAt || "",
    }));
  for (const x of maps) out.push({ kind: "map", title: x.title || "未命名导图", sub: (x.branches || []).join(" · "), text: x.text || "", href: "#/map/" + x.id, at: x.updatedAt || "" });
  return out;
}

// Every word must appear somewhere; matches in the title count most.
export function rank(entry, query) {
  const q = lower(query).trim();
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  const title = lower(entry.title);
  const sub = lower(entry.sub);
  const text = lower(entry.text);
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += title.startsWith(t) ? 40 : 25;
    else if (sub.includes(t)) score += 10;
    else if (text.includes(t)) score += 3;
    else return 0;
  }
  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 50;
  else if (title.includes(q)) score += 20;
  return score;
}

export function searchEntries(entries, query, limit = 40) {
  return entries
    .map((e) => [e, rank(e, query)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || b[0].at.localeCompare(a[0].at))
    .slice(0, limit)
    .map(([e]) => e);
}

// A short piece of `text` around the first matching word, for showing why it matched.
export function snippet(text, query, width = 60) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  const terms = lower(query).split(/\s+/).filter(Boolean);
  const hay = lower(s);
  const at = terms.map((t) => hay.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (at == null) return "";
  const start = Math.max(0, at - Math.floor(width / 3));
  return (start ? "…" : "") + s.slice(start, start + width) + (start + width < s.length ? "…" : "");
}
