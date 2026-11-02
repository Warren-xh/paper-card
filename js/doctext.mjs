// The text inside uploaded files (paper PDFs, course materials, code), so the
// terms of the term library (词库) they mention can be linked both ways.
// PDF, PowerPoint and Word files are read once when uploaded and their text is
// saved at data/texts/<file path>.json; plain-text files (code, Markdown) are
// read as they are. Matching runs against the library of the moment, so terms
// added later are found in files uploaded earlier.
import { termNames, findMentions, termKey } from "./terms.mjs";

export const TEXT_DIR = "data/texts/";
export const MAX_TEXT = 400000;
export const textPath = (path) => TEXT_DIR + path + ".json";

const PLAIN = /\.(txt|md|markdown|tex|bib|csv|tsv|json|ya?ml|toml|ini|cfg|py|ipynb|r|jl|m|js|mjs|cjs|ts|tsx|jsx|java|kt|scala|go|rs|c|h|cc|cpp|hpp|cs|swift|rb|php|pl|lua|sh|bash|zsh|ps1|sql|html?|css|scss|vue|svelte|xml|dart)$/i;
// What kind of text a file holds: "pdf", "pptx", "docx", "plain", or "" (none, e.g. images).
export function fileKind(path) {
  const p = String(path || "");
  if (/\.pdf$/i.test(p)) return "pdf";
  if (/\.pptx$/i.test(p)) return "pptx";
  if (/\.docx$/i.test(p)) return "docx";
  return PLAIN.test(p) ? "plain" : "";
}
// Files whose text is saved apart (plain files are read directly).
export const needsSavedText = (path) => ["pdf", "pptx", "docx"].includes(fileKind(path));

// Lines broken inside Chinese text are joined; other runs of spaces become one.
export function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/([　-〿㐀-鿿＀-￯])[ \t]*\n[ \t]*(?=[　-〿㐀-鿿＀-￯])/g, "$1")
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

// Library terms mentioned in a text, most mentioned first, with one line of context.
export function termsInText(text, terms) {
  // Line breaks count as spaces, so "Chain of⏎Hindsight" is still found.
  const src = String(text || "").replace(/\n/g, " ");
  if (!src || !terms.length) return [];
  const found = new Map();
  for (const m of findMentions(src, termNames(terms))) {
    const k = termKey(m.entry.term);
    const hit = found.get(k);
    if (hit) { hit.count++; continue; }
    const before = src.slice(Math.max(0, m.start - 24), m.start).replace(/\s+/g, " ");
    const after = src.slice(m.end, m.end + 24).replace(/\s+/g, " ");
    found.set(k, { entry: m.entry, count: 1, shown: m.shown, context: (m.start > 24 ? "…" : "") + before + "【" + m.shown + "】" + after + (m.end + 24 < src.length ? "…" : "") });
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.entry.term.localeCompare(b.entry.term));
}

/* ---------- reading files (browser) ---------- */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/";
let pdfjs;
async function loadPdfJs() {
  pdfjs ||= import(PDFJS + "pdf.min.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
    return lib;
  });
  return pdfjs;
}

async function pdfText(bytes) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const pages = [];
  let size = 0;
  for (let n = 1; n <= doc.numPages && size < MAX_TEXT; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((i) => (i.str || "") + (i.hasEOL ? "\n" : "")).join("");
    pages.push(text);
    size += text.length;
  }
  await doc.destroy();
  return pages.join("\n\n");
}

// A minimal .zip reader (PowerPoint and Word files are zip archives of XML).
async function unzip(bytes, want) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("不是有效的文件。");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extra + comment;
    if (!want(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    let raw;
    if (method === 0) raw = data;
    else if (method === 8) raw = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else continue;
    out.push({ name, xml: dec.decode(raw) });
  }
  return out;
}

const xmlText = (xml, tag) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>|<(?:a|w):(?:br|tab)\\b[^>]*/>|</(?:a|w):p>`, "g"))]
    .map((m) => (m[1] != null ? m[1] : m[0].startsWith("</") ? "\n" : " "))
    .join("")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function officeText(bytes, kind) {
  if (kind === "pptx") {
    const slides = await unzip(bytes, (n) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n));
    const num = (n) => +n.match(/(\d+)\.xml$/)[1] + (n.includes("notes") ? 0.5 : 0);
    return slides.sort((a, b) => num(a.name) - num(b.name)).map((s) => xmlText(s.xml, "a:t")).join("\n\n");
  }
  const parts = await unzip(bytes, (n) => /^word\/(document|footnotes|endnotes)\.xml$/.test(n));
  return parts.map((p) => xmlText(p.xml, "w:t")).join("\n\n");
}

// The text of a file (a File, Blob or bytes), or "" when it holds none we can read.
export async function extractText(file, path) {
  const kind = fileKind(path || file.name);
  if (!kind) return "";
  const bytes = new Uint8Array(file instanceof Uint8Array ? file : await file.arrayBuffer());
  if (kind === "plain") return normalizeText(new TextDecoder().decode(bytes));
  if (kind === "pdf") return normalizeText(await pdfText(bytes));
  return normalizeText(await officeText(bytes, kind));
}

// Extra files to commit with an upload: the saved text of each PDF / PPT / Word
// file. A file that cannot be read is simply left out (the upload still works).
export async function textFiles(items) {
  const out = [];
  for (const { path, file } of items) {
    if (!needsSavedText(path)) continue;
    try {
      const text = await extractText(file, path);
      if (text) out.push({ path: textPath(path), text: JSON.stringify({ version: 1, path, text }) + "\n" });
    } catch (error) {
      console.warn("读不出文字：" + path, error);
    }
  }
  return out;
}
