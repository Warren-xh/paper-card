// Paper details from a DOI, an arXiv number or a title. Crossref knows
// published papers; DataCite knows every arXiv paper (arXiv's own API and
// Semantic Scholar cannot be called from a web page, so they are not used).

const CROSSREF = "https://api.crossref.org/works";
const DATACITE = "https://api.datacite.org/dois";
const ARXIV_ID = String.raw`(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})`;

// "arXiv:2508.10016v4", arxiv.org/abs|pdf/… , a DOI, doi.org/… or any page
// address with a DOI in it. Returns { type: "arxiv" | "doi", id } or null.
export function parsePaperId(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const arxiv =
    s.match(new RegExp(String.raw`arxiv\.org\/(?:abs|pdf|html)\/` + ARXIV_ID + String.raw`(?:v\d+)?`, "i")) ||
    s.match(new RegExp(String.raw`^(?:arxiv:\s*)?` + ARXIV_ID + String.raw`(?:v\d+)?(?:\.pdf)?$`, "i")) ||
    s.match(new RegExp(String.raw`10\.48550\/arxiv\.` + ARXIV_ID, "i"));
  if (arxiv) return { type: "arxiv", id: arxiv[1] };
  const doi = s.match(/\b(10\.\d{4,9}\/[^\s"<>?#]+)/i);
  if (doi) return { type: "doi", id: doi[1].replace(/\.pdf$/i, "").replace(/[.,;:)\]}]+$/, "") };
  return null;
}

const clean = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// "Vaswani, Ashish" → "Ashish Vaswani".
const personName = (p) => {
  if (p.given || p.givenName || p.family || p.familyName) return clean([p.given || p.givenName, p.family || p.familyName].filter(Boolean).join(" "));
  const n = clean(p.name);
  const m = n.match(/^([^,]+),\s*(.+)$/);
  return m ? m[2] + " " + m[1] : n;
};

// Long author lists keep the first eight.
export const joinAuthors = (names) => {
  const list = names.filter(Boolean);
  return list.length > 8 ? list.slice(0, 8).join(", ") + ", et al." : list.join(", ");
};

export function fromCrossref(m) {
  const year = (m.issued || m["published-print"] || m["published-online"] || m.created)?.["date-parts"]?.[0]?.[0];
  return {
    title: clean(m.title?.[0]),
    authors: joinAuthors((m.author || []).map(personName)),
    year: Number.isInteger(year) ? year : null,
    venue: clean(m["container-title"]?.[0] || m.event?.name || (m.type === "posted-content" ? m.institution?.[0]?.name : "") || ""),
    link: m.DOI ? "doi:" + m.DOI : "",
    abstract: clean(m.abstract),
  };
}

export function fromDataCite(a) {
  const arxiv = String(a.doi || "").match(/^10\.48550\/arxiv\.(.+)$/i);
  const year = parseInt(a.publicationYear, 10);
  return {
    title: clean(a.titles?.[0]?.title),
    authors: joinAuthors((a.creators || []).map(personName)),
    year: Number.isInteger(year) ? year : null,
    venue: arxiv ? "arXiv" : clean(a.container?.title || a.publisher?.name || a.publisher || ""),
    link: arxiv ? "arXiv:" + arxiv[1] : a.doi ? "doi:" + a.doi : "",
    abstract: clean((a.descriptions || []).find((d) => d.descriptionType === "Abstract")?.description),
  };
}

async function getJSON(fetcher, url) {
  let res;
  try {
    res = await fetcher(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("连不上论文数据库，请稍后再试。");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("论文数据库暂时不可用（" + res.status + "）。");
  return res.json();
}

// The details of one paper, or an error saying why not.
export async function lookupPaper(input, fetcher = globalThis.fetch) {
  const id = parsePaperId(input);
  if (!id) throw new Error("认不出这个编号：请填 DOI（如 10.1038/nature14539）或 arXiv 编号（如 2508.10016）。");
  if (id.type === "arxiv") {
    const r = await getJSON(fetcher, DATACITE + "/" + encodeURIComponent("10.48550/arXiv." + id.id));
    if (!r?.data) throw new Error("arXiv 上找不到 " + id.id + "。");
    return { ...fromDataCite(r.data.attributes), link: "arXiv:" + id.id, source: "DataCite" };
  }
  const cr = await getJSON(fetcher, CROSSREF + "/" + encodeURIComponent(id.id));
  if (cr?.message) return { ...fromCrossref(cr.message), source: "Crossref" };
  const dc = await getJSON(fetcher, DATACITE + "/" + encodeURIComponent(id.id));
  if (dc?.data) return { ...fromDataCite(dc.data.attributes), source: "DataCite" };
  throw new Error("找不到 DOI " + id.id + "。");
}

// How close two titles are, from 0 to 1 (shared words, exact match first).
export function titleScore(a, b) {
  const words = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const x = words(a), y = words(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const xs = new Set(x.split(" ")), ys = new Set(y.split(" "));
  let common = 0;
  for (const w of xs) if (ys.has(w)) common++;
  return (0.9 * common) / Math.max(xs.size, ys.size);
}

// Papers whose title matches, best first: published papers and arXiv preprints.
export async function searchPapers(title, fetcher = globalThis.fetch) {
  const q = clean(title);
  if (!q) return [];
  const [cr, dc] = await Promise.allSettled([
    getJSON(fetcher, CROSSREF + "?rows=8&select=DOI,title,author,issued,container-title,event,type&query.bibliographic=" + encodeURIComponent(q)),
    getJSON(fetcher, DATACITE + "?prefix=10.48550&page[size]=10&query=" + encodeURIComponent("titles.title:(" + q.replace(/[():"\\]/g, " ") + ")")),
  ]);
  if (cr.status === "rejected" && dc.status === "rejected") throw cr.reason;
  const found = [
    ...(cr.value?.message?.items || []).map((m) => ({ ...fromCrossref(m), source: "Crossref" })),
    ...(dc.value?.data || []).map((d) => ({ ...fromDataCite(d.attributes), source: "arXiv" })),
  ].filter((p) => p.title);
  const seen = new Set();
  return found
    .map((p, i) => ({ p, s: titleScore(q, p.title), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p)
    .filter((p) => { const k = p.title.toLowerCase() + p.year; return seen.has(k) ? false : seen.add(k); })
    .slice(0, 8);
}

// Which card fields a lookup would fill, and which would replace something already written.
export function planFill(current, found) {
  const fields = ["title", "authors", "year", "venue", "link"];
  const fill = {};
  const conflicts = [];
  for (const k of fields) {
    const v = found[k];
    if (v == null || v === "") continue;
    const now = String(current[k] ?? "").trim();
    // The same paper written another way is not a conflict: a web address you
    // pasted stays as it is; a bare number ("2508.10016") becomes "arXiv:2508.10016".
    const a = k === "link" && parsePaperId(now);
    const b = k === "link" && parsePaperId(v);
    if (a && b && a.type === b.type && a.id.toLowerCase() === b.id.toLowerCase()) { if (now !== v && !/:\/\//.test(now)) fill[k] = v; continue; }
    if (!now) fill[k] = v;
    else if (now.toLowerCase() !== String(v).toLowerCase()) { fill[k] = v; conflicts.push(k); }
  }
  return { fill, conflicts };
}
