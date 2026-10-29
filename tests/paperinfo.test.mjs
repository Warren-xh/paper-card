import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../js/paperinfo.mjs";

test("DOIs and arXiv numbers are recognised in any form", () => {
  const cases = [
    ["2508.10016", { type: "arxiv", id: "2508.10016" }],
    ["arXiv:2508.10016v4", { type: "arxiv", id: "2508.10016" }],
    ["https://arxiv.org/abs/1706.03762v7", { type: "arxiv", id: "1706.03762" }],
    ["https://arxiv.org/pdf/1706.03762", { type: "arxiv", id: "1706.03762" }],
    ["arxiv.org/abs/hep-th/9901001", { type: "arxiv", id: "hep-th/9901001" }],
    ["10.48550/arXiv.1706.03762", { type: "arxiv", id: "1706.03762" }],
    ["10.1038/nature14539", { type: "doi", id: "10.1038/nature14539" }],
    ["doi:10.1038/nature14539.", { type: "doi", id: "10.1038/nature14539" }],
    ["https://doi.org/10.1145/3292500.3330701", { type: "doi", id: "10.1145/3292500.3330701" }],
    ["https://dl.acm.org/doi/pdf/10.1145/3292500.3330701?download=true", { type: "doi", id: "10.1145/3292500.3330701" }],
    ["https://link.springer.com/content/pdf/10.1007/s11263-015-0816-y.pdf", { type: "doi", id: "10.1007/s11263-015-0816-y" }],
  ];
  for (const [input, want] of cases) assert.deepEqual(P.parsePaperId(input), want, input);
  for (const bad of ["", "Attention is all you need", "https://example.com/paper", "12345", "2023.1"]) assert.equal(P.parsePaperId(bad), null, bad);
});

test("Crossref and DataCite records become card fields", () => {
  const cr = P.fromCrossref({
    DOI: "10.1038/nature14539", type: "journal-article", title: ["Deep  learning"], "container-title": ["Nature"],
    author: [{ given: "Yann", family: "LeCun" }, { given: "Yoshua", family: "Bengio" }, { name: "Some Consortium" }],
    issued: { "date-parts": [[2015, 5, 27]] }, abstract: "<jats:p>Deep learning allows &amp; more</jats:p>",
  });
  assert.deepEqual(cr, { title: "Deep learning", authors: "Yann LeCun, Yoshua Bengio, Some Consortium", year: 2015, venue: "Nature", link: "doi:10.1038/nature14539", abstract: "Deep learning allows & more" });
  const proc = P.fromCrossref({ DOI: "10.1/x", title: ["T"], event: { name: "KDD '19" }, created: { "date-parts": [[2019]] } });
  assert.deepEqual([proc.venue, proc.year, proc.authors], ["KDD '19", 2019, ""]);

  const dc = P.fromDataCite({
    doi: "10.48550/arxiv.1706.03762", titles: [{ title: "Attention Is All You Need" }], publicationYear: "2017", publisher: "arXiv",
    creators: [{ name: "Vaswani, Ashish", givenName: "Ashish", familyName: "Vaswani" }, { name: "Shazeer, Noam" }],
    descriptions: [{ descriptionType: "Other", description: "x" }, { descriptionType: "Abstract", description: "The dominant models" }],
  });
  assert.deepEqual(dc, { title: "Attention Is All You Need", authors: "Ashish Vaswani, Noam Shazeer", year: 2017, venue: "arXiv", link: "arXiv:1706.03762", abstract: "The dominant models" });
  assert.equal(P.fromDataCite({ doi: "10.5281/zenodo.1", titles: [{ title: "D" }], publisher: { name: "Zenodo" } }).venue, "Zenodo");
  assert.equal(P.joinAuthors(Array.from({ length: 10 }, (_, i) => "A" + i)), "A0, A1, A2, A3, A4, A5, A6, A7, et al.");
});

// A stand-in for fetch that answers from a table of URLs.
const fakeFetch = (routes) => async (url) => {
  const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
  if (!hit) return { ok: false, status: 404, json: async () => ({}) };
  const [, body] = hit;
  if (body instanceof Error) throw body;
  return { ok: true, status: 200, json: async () => body };
};

test("lookups go to the right database, with fallbacks", async () => {
  const arxiv = await P.lookupPaper("arxiv.org/abs/1706.03762", fakeFetch({
    "https://api.datacite.org/dois/10.48550%2FarXiv.1706.03762": { data: { attributes: { doi: "10.48550/arxiv.1706.03762", titles: [{ title: "Attention" }], publicationYear: 2017, creators: [] } } },
  }));
  assert.deepEqual([arxiv.title, arxiv.link, arxiv.source], ["Attention", "arXiv:1706.03762", "DataCite"]);

  const doi = await P.lookupPaper("10.1038/nature14539", fakeFetch({
    "https://api.crossref.org/works/10.1038%2Fnature14539": { message: { DOI: "10.1038/nature14539", title: ["Deep learning"] } },
  }));
  assert.equal(doi.source, "Crossref");

  // Not at Crossref: DataCite has it (e.g. a Zenodo dataset).
  const zen = await P.lookupPaper("10.5281/zenodo.1", fakeFetch({
    "https://api.datacite.org/dois/10.5281%2Fzenodo.1": { data: { attributes: { doi: "10.5281/zenodo.1", titles: [{ title: "Data" }] } } },
  }));
  assert.deepEqual([zen.title, zen.source], ["Data", "DataCite"]);

  await assert.rejects(P.lookupPaper("10.9999/none", fakeFetch({})), /找不到 DOI/);
  await assert.rejects(P.lookupPaper("hello", fakeFetch({})), /认不出/);
  await assert.rejects(P.lookupPaper("10.1234/x", fakeFetch({ "https://api.crossref.org": new TypeError("offline") })), /连不上/);
});

test("title search merges both databases, closest title first", async () => {
  const found = await P.searchPapers("Attention Is All You Need", fakeFetch({
    "https://api.crossref.org/works?": { message: { items: [{ DOI: "10.1/a", title: ["Attention Is All You Need In Speech Separation"], issued: { "date-parts": [[2021]] } }] } },
    "https://api.datacite.org/dois?": { data: [
      { attributes: { doi: "10.48550/arxiv.2501.09166", titles: [{ title: "Attention is All You Need Until You Need Retention" }], publicationYear: 2025 } },
      { attributes: { doi: "10.48550/arxiv.1706.03762", titles: [{ title: "Attention Is All You Need" }], publicationYear: 2017 } },
    ] },
  }));
  assert.equal(found[0].link, "arXiv:1706.03762");
  assert.equal(found.length, 3);
  assert.equal(P.titleScore("Deep Learning", "deep learning!"), 1);
  assert.ok(P.titleScore("a b c", "a b") > P.titleScore("a b c", "x y"));
  assert.deepEqual(await P.searchPapers("  "), []);
});

test("filling a card keeps what you wrote unless you agree", () => {
  const found = { title: "Attention Is All You Need", authors: "Ashish Vaswani", year: 2017, venue: "arXiv", link: "arXiv:1706.03762" };
  assert.deepEqual(P.planFill({ title: "", authors: "", year: "", venue: "", link: "1706.03762" }, found), {
    fill: { title: found.title, authors: found.authors, year: 2017, venue: "arXiv", link: "arXiv:1706.03762" }, conflicts: [],
  });
  const p = P.planFill({ title: "我自己的标题", authors: "ashish vaswani", year: "2017", venue: "", link: "arXiv:1706.03762" }, found);
  assert.deepEqual(p.conflicts, ["title"]);
  assert.deepEqual(Object.keys(p.fill), ["title", "venue"]);
});

test("a web address you pasted is kept when it is the same paper", () => {
  const found = { title: "T", link: "arXiv:1706.03762" };
  assert.deepEqual(P.planFill({ title: "", link: "https://arxiv.org/abs/1706.03762v2" }, found).fill, { title: "T" });
  assert.deepEqual(P.planFill({ title: "T", link: "1706.03762" }, found).fill, { link: "arXiv:1706.03762" });
  assert.deepEqual(P.planFill({ title: "T", link: "https://link.springer.com/content/pdf/10.1007/x.pdf" }, { link: "doi:10.1007/x" }).fill, {});
});
