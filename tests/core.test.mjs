import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as M from "../js/model.mjs";
import { renderMarkdown } from "../js/markdown.mjs";
import { sealToken, openVault, passwordProblem } from "../js/vault.mjs";
import { GitHubClient, utf8ToBase64, base64ToUtf8 } from "../js/github.mjs";

const ID = "20261020-bert-ab12";
const card = (extra = {}) => M.normalizeCard({ id: ID, ...extra });

test("ids look like 20261020-bert-xxxx", () => {
  const id = M.makeId("2026-10-20", "BERT: Pre-training of Deep Bidirectional Transformers");
  assert.match(id, /^20261020-bert-[a-z0-9]{4}$/);
  assert.ok(M.validId(id));
  assert.match(M.makeId("2026-10-20", "注意力机制综述"), /^20261020-card-/);
  assert.ok(!M.validId("../../etc"));
  assert.ok(!M.validId("20261020-bert"));
});

test("normalizeCard cleans input", () => {
  const c = card({
    title: "  BERT ",
    year: "2019",
    link: "javascript:alert(1)",
    tags: "#NLP, 预训练，nlp",
    status: "weird",
    marks: [{ type: "?", page: 4, text: " 为什么 15% " }, { type: "bogus", text: "x" }, { type: "!", text: "" }],
    links: [ID, "20261001-gpt-aaaa", "bad id"],
  });
  assert.equal(c.title, "BERT");
  assert.equal(c.year, 2019);
  assert.equal(c.link, "");
  assert.deepEqual(c.tags, ["NLP", "预训练"]);
  assert.equal(c.status, "reading");
  assert.deepEqual(c.marks, [{ type: "?", page: "4", text: "为什么 15%" }, { type: "!", page: "", text: "x" }]);
  assert.deepEqual(c.links, ["20261001-gpt-aaaa"]);
  assert.equal(card({ link: "1810.04805" }).link, "arXiv:1810.04805");
  assert.equal(M.paperHref("arXiv:1810.04805"), "https://arxiv.org/abs/1810.04805");
  assert.equal(M.paperHref("10.18653/v1/N19-1423"), "https://doi.org/10.18653/v1/N19-1423");
  assert.throws(() => M.normalizeCard({ id: "nope" }));
});

test("progress counts the seven parts", () => {
  const c = card({ oneLine: "x", idea: "y", proof: { numbers: "93.2" }, linkNote: "z" });
  assert.deepEqual(M.filledSections(c), { filled: 4, total: 7, missing: ["②", "⑤", "⑥"] });
  assert.equal(M.progressText(c), "卡片 4/7，还差 ②⑤⑥");
  const full = card({ oneLine: "a", pain: "b", idea: "c", proof: { datasets: "d" }, doubts: "e", relevance: "f", links: ["20261001-gpt-aaaa"] });
  assert.equal(M.progressText(full), "卡片 7/7，写完了");
});

test("marks are brought into doubts and relevance once", () => {
  const marks = [
    { type: "?", page: "4", text: "为什么 15%" },
    { type: "★", page: "", text: "只加一层输出" },
    { type: "×", page: "5", text: "NSP 没用" },
    { type: "!", page: "1", text: "双向" },
  ];
  assert.deepEqual(M.marksToLines(marks, ["?", "×"]), ["- ? p.4 为什么 15%", "- × p.5 NSP 没用"]);
  assert.deepEqual(M.marksToLines(marks, ["?", "×"], "- ? p.4 为什么 15%\n"), ["- × p.5 NSP 没用"]);
  assert.deepEqual(M.marksToLines(marks, ["★"]), ["- ★ 只加一层输出"]);
});

test("reviews start the day after a card is marked done", () => {
  const reading = M.applyStatus(card({ status: "reading" }), "2026-10-20");
  assert.equal(reading.srs, null);
  const done = M.applyStatus(card({ status: "done" }), "2026-10-20");
  assert.equal(done.doneAt, "2026-10-20");
  assert.deepEqual(done.srs, { level: 0, due: "2026-10-21" });
  // Marking done again later does not restart the schedule.
  assert.deepEqual(M.applyStatus({ ...done, srs: { level: 2, due: "2026-12-01" } }, "2026-11-01").srs, { level: 2, due: "2026-12-01" });
  const s = M.summarize(done);
  assert.ok(!M.isDue(s, "2026-10-20"));
  assert.ok(M.isDue(s, "2026-10-21"));
});

test("grading follows 1 → 7 → 30 → 90 → 180 days", () => {
  let c = M.applyStatus(card({ status: "done" }), "2026-10-20");
  const steps = [];
  let day = "2026-10-21";
  for (let i = 0; i < 6; i++) {
    c = M.gradeCard(c, "good", day);
    steps.push(M.dayDiff(day, c.srs.due));
    day = c.srs.due;
  }
  assert.deepEqual(steps, [7, 30, 90, 180, 180, 180]);
  assert.equal(c.reviews.length, 6);
  const fuzzy = M.gradeCard(c, "fuzzy", "2027-06-01");
  assert.equal(fuzzy.srs.due, "2027-06-04");
  assert.equal(fuzzy.srs.level, c.srs.level);
  const forgot = M.gradeCard(c, "forgot", "2027-06-01");
  assert.deepEqual(forgot.srs, { level: 0, due: "2027-06-02" });
  assert.equal(M.gradeCard(forgot, "good", "2027-06-02").srs.due, "2027-06-09");
  assert.equal(M.previewInterval(forgot, "good"), 7);
  assert.deepEqual(forgot.reviews.at(-1), { date: "2027-06-01", grade: "forgot", next: "2027-06-02" });
  assert.throws(() => M.gradeCard(c, "meh"));
});

test("index, due queue, backlinks, search and stats", () => {
  const a = M.applyStatus(card({ id: "20261010-gpt-aaaa", title: "GPT", readDate: "2026-10-10", status: "done", oneLine: "单向猜下一个词", tags: ["NLP"] }), "2026-10-10");
  const b = card({ id: "20261015-bert-bbbb", title: "BERT", readDate: "2026-10-15", links: ["20261010-gpt-aaaa"], marks: [{ type: "?", text: "不懂" }, { type: "?", text: "也不懂" }], project: "毕设" });
  let idx = M.emptyIndex();
  idx = M.upsertIndex(idx, a);
  idx = M.upsertIndex(idx, b);
  idx = M.upsertIndex(idx, { ...b, title: "BERT v2" });
  assert.deepEqual(idx.cards.map((x) => x.title), ["BERT v2", "GPT"]);
  assert.equal(idx.cards[0].questions, 2);
  assert.deepEqual(M.backlinks(idx.cards, "20261010-gpt-aaaa").map((x) => x.id), ["20261015-bert-bbbb"]);
  assert.deepEqual(M.dueCards(idx.cards, "2026-10-11").map((x) => x.id), ["20261010-gpt-aaaa"]);
  assert.deepEqual(M.nextReview(idx.cards, "2026-10-10"), { date: "2026-10-11", count: 1 });
  assert.equal(M.search(idx.cards, { query: "下一个词" }).length, 1);
  assert.equal(M.search(idx.cards, { status: "questions" }).length, 1);
  assert.equal(M.search(idx.cards, { status: "done" })[0].title, "GPT");
  assert.equal(M.search(idx.cards, { project: "毕设", tag: "nlp" }).length, 0);
  const s = M.stats(idx.cards, "2026-10-20");
  assert.deepEqual([s.total, s.done, s.reading, s.thisMonth, s.questions, s.due], [2, 1, 1, 2, 2, 1]);
  assert.equal(M.removeFromIndex(idx, "20261010-gpt-aaaa").cards.length, 1);
});

test("markdown export", () => {
  const c = card({ title: "BERT", authors: "Devlin 等", year: 2019, venue: "NAACL", oneLine: "一句话", proof: { numbers: "93.2" }, links: ["20261001-gpt-aaaa"], marks: [{ type: "★", page: "5", text: "微调" }], notes: "笔记" });
  const md = M.cardToMarkdown(c, new Map([["20261001-gpt-aaaa", "GPT"]]));
  assert.match(md, /^# BERT\n\nDevlin 等 · 2019 · NAACL/);
  assert.match(md, /> \*\*一句话\*\*：一句话/);
  assert.match(md, /## ④ 怎么证明的\n- 关键数字：93.2/);
  assert.match(md, /## ⑦ 关联\n- GPT/);
  assert.match(md, /- ★ p.5 微调/);
  assert.match(md, /\n## 自由笔记\n笔记/);
});

test("bundled data files are valid and consistent", async () => {
  const read = async (p) => JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
  const site = await read(M.SITE_PATH);
  assert.equal(site.title, "文献卡片");
  assert.equal(site.repo, "Warren-xh/paper-card");
  const idx = M.normalizeIndex(await read(M.INDEX_PATH));
  assert.ok(idx.cards.length >= 1);
  for (const s of idx.cards) {
    const c = M.normalizeCard(await read(M.CARD_DIR + s.id + ".json"));
    const fresh = M.summarize(c);
    assert.deepEqual({ ...s, updatedAt: "" }, { ...fresh, updatedAt: "" }, "index entry out of date for " + s.id + "; run npm run reindex");
  }
  const bert = M.normalizeCard(await read(M.CARD_DIR + "20261019-bert-demo.json"));
  assert.equal(bert.status, "done");
  assert.ok(bert.tags.includes("示例"));
  assert.equal(M.progressText(bert), "卡片 7/7，写完了");
});

test("markdown renders safely", () => {
  const html = renderMarkdown(
    "# 标题\n**粗** *斜* `x<y`\n\n- [x] 完成\n- 二级\n  - 嵌套\n\n<script>alert(1)</script>\n\n[link](javascript:alert(1)) [ok](https://a.com)\n\n公式 $E=mc^2$",
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("javascript:"));
  assert.match(html, /<code>x&lt;y<\/code>/);
  assert.match(html, /<li>二级<ul><li>嵌套<\/li><\/ul><\/li>/);
  assert.match(html, /class="math">E=mc\^2</);
  assert.match(renderMarkdown("![图](uploads/a.webp)", { resolveImage: (u) => (u === "uploads/a.webp" ? "data:image/webp;base64,AA" : "") }), /src="data:image\/webp;base64,AA"/);
});

test("vault uses the paper-cards namespace and rejects wrong passwords", async () => {
  assert.ok(passwordProblem("123456789"));
  assert.equal(passwordProblem("cards2026ok"), "");
  const token = "github_pat_" + "A".repeat(40);
  const vault = await sealToken(token, "cards2026ok", "Warren-xh/paper-card");
  assert.equal(vault.iterations, 600000);
  assert.equal(await openVault(vault, "cards2026ok", "warren-xh/paper-card"), token);
  await assert.rejects(openVault(vault, "wrong-pass1", "warren-xh/paper-card"), /密码不正确/);
  await assert.rejects(openVault(vault, "cards2026ok", "warren-xh/research-log"), /密码不正确/);
  const src = await readFile(new URL("../js/vault.mjs", import.meta.url), "utf8");
  assert.match(src, /"paper-cards\/vault\/v1\/"/);
});

test("utf8 base64 helpers", () => {
  assert.equal(base64ToUtf8(utf8ToBase64("文献 card ✓")), "文献 card ✓");
});

test("GitHub commitLatest retries when another device saved first", async () => {
  const calls = [];
  let head = "c1";
  let patchFailures = 1;
  const fake = async (url, init = {}) => {
    const path = url.replace("https://api.github.com/repos/o/r", "");
    const method = init.method || "GET";
    calls.push(method + " " + path);
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
    if (path === "/git/ref/heads/main") return ok({ object: { sha: head } });
    if (path.startsWith("/git/commits/")) return ok({ tree: { sha: "t-" + path.slice(13) } });
    if (path === "/git/blobs") return ok({ sha: "blob1" });
    if (path === "/git/trees") return ok({ sha: "tree2" });
    if (path === "/git/commits") return ok({ sha: "c-new" });
    if (method === "PATCH") {
      if (patchFailures-- > 0) {
        head = "c2";
        return ok({ message: "not fast forward" }, 422);
      }
      return ok({});
    }
    return ok({}, 404);
  };
  const gh = new GitHubClient("o/r", "main", fake);
  gh.setToken("github_pat_x");
  const bases = [];
  const sha = await gh.commitLatest(async (h) => {
    bases.push(h);
    return { files: [{ path: "data/cards/a.json", text: "{}" }, { path: "uploads/img.webp", base64: "AA" }], message: "m" };
  });
  assert.equal(sha, "c-new");
  assert.deepEqual(bases, ["c1", "c2"]);
  assert.ok(calls.includes("POST /git/blobs"));
});
