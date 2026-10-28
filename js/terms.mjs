// Term library (词库): technical terms marked in notes as [[term]] (or
// [[shown text|term]]), each with a Chinese name, an English name and an
// explanation. All terms live in one file, data/terms.json.

export const TERMS_PATH = "data/terms.json";
// [[shown]] or [[shown|term]] inside a line of text.
export const TERM_RE = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;

const str = (value) => (typeof value === "string" ? value : "");
const one = (value) => str(value).replace(/\s+/g, " ").trim();

// Terms match whatever the case or spacing.
export const termKey = (text) => one(text).toLowerCase();

export function emptyLibrary() {
  return { version: 1, updatedAt: "", terms: [] };
}

export function normalizeTerm(raw) {
  if (!raw || typeof raw !== "object") return null;
  const term = one(raw.term);
  if (!term) return null;
  return {
    term,
    zh: one(raw.zh),
    en: one(raw.en),
    def: str(raw.def).trim(),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

const byName = (a, b) => a.term.localeCompare(b.term, "zh-Hans-CN", { sensitivity: "base" });

export function normalizeLibrary(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.terms)) return emptyLibrary();
  const seen = new Map();
  for (const t of raw.terms.map(normalizeTerm).filter(Boolean)) {
    const k = termKey(t.term);
    const old = seen.get(k);
    if (!old || (t.updatedAt || "") >= (old.updatedAt || "")) seen.set(k, t);
  }
  return { version: 1, updatedAt: str(raw.updatedAt), terms: [...seen.values()].sort(byName) };
}

// The entry for a name: its term, Chinese or English name all lead to it.
export function findTerm(lib, name) {
  const k = termKey(name);
  if (!k) return null;
  return lib.terms.find((t) => termKey(t.term) === k) || lib.terms.find((t) => termKey(t.zh) === k || termKey(t.en) === k) || null;
}

// Adds or replaces an entry. `was` is the name it had before (when renamed).
export function upsertTerm(lib, entry, now = new Date().toISOString(), was = "") {
  const t = normalizeTerm(entry);
  if (!t) return lib;
  const old = findTerm(lib, was || t.term);
  const gone = new Set([termKey(t.term), old && termKey(old.term)].filter(Boolean));
  const terms = lib.terms.filter((x) => !gone.has(termKey(x.term)));
  terms.push({ ...t, createdAt: old?.createdAt || t.createdAt || now, updatedAt: now });
  return { version: 1, updatedAt: now, terms: terms.sort(byName) };
}

export function removeTerm(lib, name, now = new Date().toISOString()) {
  const k = termKey(name);
  return { version: 1, updatedAt: now, terms: lib.terms.filter((t) => termKey(t.term) !== k) };
}

// Terms whose name, Chinese, English or explanation contain every word.
export function searchTerms(terms, query) {
  const words = termKey(query).split(" ").filter(Boolean);
  if (!words.length) return terms;
  return terms
    .map((t) => {
      const name = [t.term, t.zh, t.en].join(" ").toLowerCase();
      const all = name + " " + t.def.toLowerCase();
      if (!words.every((w) => all.includes(w))) return [t, 0];
      return [t, words.reduce((s, w) => s + (termKey(t.term).startsWith(w) ? 4 : name.includes(w) ? 2 : 1), 0)];
    })
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
    .map(([t]) => t);
}

// The terms marked in a piece of text, in order: [{ shown, name }].
export function termsIn(text) {
  return [...str(text).matchAll(TERM_RE)].map((m) => ({ shown: m[1].trim(), name: (m[2] || m[1]).trim() }));
}

// Text in a marked term, as Markdown: [[shown]] or [[shown|name]].
export function markTerm(shown, name) {
  const s = one(shown);
  const n = one(name);
  return "[[" + (n && termKey(n) !== termKey(s) ? s + "|" + n : s) + "]]";
}

// Where a term is mentioned: entries (from search.buildEntries) whose title or
// text contain its name, Chinese or English name.
export function usages(entries, t) {
  const names = [t.term, t.zh, t.en].map(termKey).filter((n) => n.length > 1);
  if (!names.length) return [];
  return entries.filter((e) => {
    const hay = (e.title + " " + e.sub + " " + e.text).toLowerCase();
    return names.some((n) => hay.includes(n));
  });
}

export function libraryToMarkdown(lib) {
  return "# 词库\n\n" + lib.terms.map((t) =>
    "## " + t.term + "\n\n" + [t.zh && "- 中文：" + t.zh, t.en && "- English：" + t.en].filter(Boolean).join("\n") + (t.def ? "\n\n" + t.def : "")).join("\n\n") + "\n";
}
