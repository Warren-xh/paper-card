import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../js/terms.mjs";
import * as C from "../js/course.mjs";
import * as M from "../js/model.mjs";
import { renderMarkdown, renderInline } from "../js/markdown.mjs";
import { buildEntries } from "../js/search.mjs";

test("the term library keeps one entry per term", () => {
  const lib = T.normalizeLibrary({ version: 1, terms: [
    { term: " Transformer ", zh: "变换器", en: "Transformer", def: "基于**注意力**的模型", updatedAt: "2026-10-01" },
    { term: "transformer", zh: "新的", updatedAt: "2026-10-02" },
    { term: "注意力", en: "attention" },
    { term: "" }, null,
  ] });
  assert.deepEqual(lib.terms.map((t) => t.term), ["transformer", "注意力"].sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { sensitivity: "base" })));
  assert.equal(T.findTerm(lib, "TRANSFORMER").zh, "新的");
  assert.equal(T.findTerm(lib, "Attention").term, "注意力");
  assert.equal(T.findTerm(lib, "没有"), null);
  assert.deepEqual(T.normalizeLibrary({ version: 2 }), T.emptyLibrary());

  let next = T.upsertTerm(lib, { term: "RNN", zh: "循环神经网络", en: "Recurrent Neural Network" }, "2026-10-28T00:00:00Z");
  assert.equal(next.terms.length, 3);
  assert.equal(T.findTerm(next, "rnn").createdAt, "2026-10-28T00:00:00Z");
  // Renaming keeps when it was first added.
  next = T.upsertTerm(next, { term: "循环网络", zh: "循环神经网络" }, "2026-10-29T00:00:00Z", "RNN");
  assert.equal(T.findTerm(next, "rnn"), null);
  assert.equal(T.findTerm(next, "循环网络").createdAt, "2026-10-28T00:00:00Z");
  next = T.removeTerm(next, "循环网络");
  assert.equal(next.terms.length, 2);
  assert.equal(T.upsertTerm(lib, { term: "  " }), lib);
});

test("terms are searched, found in text and marked", () => {
  const terms = [
    { term: "Transformer", zh: "变换器", en: "", def: "用自注意力处理序列" },
    { term: "注意力", zh: "", en: "attention", def: "" },
  ];
  assert.deepEqual(T.searchTerms(terms, "注意").map((t) => t.term), ["注意力", "Transformer"]);
  assert.deepEqual(T.searchTerms(terms, "ATTENTION").map((t) => t.term), ["注意力"]);
  assert.equal(T.searchTerms(terms, "").length, 2);
  assert.deepEqual(T.termsIn("用 [[Transformer]] 和 [[自注意|注意力]]，不是 [普通](x)"), [{ shown: "Transformer", name: "Transformer" }, { shown: "自注意", name: "注意力" }]);
  assert.equal(T.markTerm("transformer", "Transformer"), "[[transformer]]");
  assert.equal(T.markTerm("自注意", "注意力"), "[[自注意|注意力]]");

  const entries = buildEntries({ logs: [{ id: "l1", title: "跑 Transformer", text: "", updatedAt: "" }, { id: "l2", title: "别的", text: "attention 机制", updatedAt: "" }], terms });
  assert.deepEqual(T.usages(entries.filter((e) => e.kind !== "term"), terms[0]).map((e) => e.href), ["#/lab/e/l1"]);
  assert.deepEqual(T.usages(entries.filter((e) => e.kind !== "term"), terms[1]).map((e) => e.href), ["#/lab/e/l2"]);
  const t = entries.find((e) => e.kind === "term");
  assert.deepEqual([t.title, t.sub, t.href], ["Transformer", "变换器", "#/terms/Transformer"]);
  assert.match(T.libraryToMarkdown({ terms }), /## 注意力\n\n- English：attention/);
});

test("terms, times and questions in Markdown", () => {
  const html = renderInline("用 [[Transformer]] 和 [[注意力|attention<x>]]，[3:20] 讲到 [12:05](http://x)");
  assert.match(html, /<span class="term" tabindex="0" role="button" data-term="Transformer">Transformer<\/span>/);
  assert.match(html, /data-term="attention&lt;x&gt;">注意力<\/span>/);
  assert.match(html, /<span class="time-tag">3:20<\/span>/);
  assert.match(html, /<a href="http:\/\/x"[^>]*>12:05<\/a>/);
  assert.match(renderInline("[1:02:03]", { timeTag: (t) => "<b>" + t + "</b>" }), /<b>1:02:03<\/b>/);
  const tasks = { n: 0 };
  const list = renderMarkdown("- [ ] 一\n- [x] 二\n\n```\n- [ ] 代码\n```", { tasks });
  assert.equal(tasks.n, 2);
  assert.match(list, /data-task="0"[^>]*>/);
  assert.match(list, /data-task="1" aria-label="已解决" checked>/);
  assert.match(renderMarkdown("- [ ] 一"), /disabled/);
  assert.equal(M.stripMd("学 [[注意力|attention]] 和 [[RNN]]"), "学 注意力 和 RNN");
});

test("questions and time points inside a lesson's free notes still work", () => {
  const notes = "要点\n- [ ] 为什么慢\n```\n- [ ] 不算\n```\n  - [x] 已懂\n* [ ] 还有";
  assert.equal(C.openTasks(notes), 2);
  const once = C.toggleTask(notes, 0);
  assert.equal(C.openTasks(once), 1);
  assert.match(once, /- \[x\] 为什么慢/);
  assert.match(C.toggleTask(notes, 1), /  - \[ \] 已懂/);
  assert.equal(C.toggleTask(notes, 9), notes);
  assert.equal((notes + " [3:20] [1:02:03] [9:99]").match(C.TIME_TOKEN).length, 2);

  const old = C.normalizeLesson({ id: "abc123", notes: "我的笔记", marks: [
    { time: "12:05", type: "!", text: "重点" },
    { time: "3:20", type: "?", text: "没懂", solve: true },
    { time: "", type: "✎", text: "随手", solve: true, answer: "懂了" },
  ] });
  assert.equal(C.openCount(old), 1);
});

test("a v4.3 notes box is split into one mark per line", () => {
  const lesson = C.normalizeLesson({ id: "abc123", practice: "作业 1", marks: [{ time: "1:00", type: "!", text: "原有" }], notes: [
    "我的笔记 **重点**", "", "### 边看边记", "", "- [ ] [3:20] ? 没懂", "- [12:05] ! 重点", "- [x] 随手 → 懂了", "- [x] 只勾了", "## 小标题", "1.AlphaCode2 编号保留",
  ].join("\n") });
  const split = C.notesToMarks(lesson);
  assert.equal(split.notes, "");
  assert.equal(split.practice, "作业 1");
  assert.deepEqual(split.marks.map((m) => [m.time, m.type, m.text, m.solve, m.answer]), [
    ["1:00", "!", "原有", false, ""],
    ["", "✎", "我的笔记 **重点**", false, ""],
    ["3:20", "?", "没懂", true, ""],
    ["12:05", "!", "重点", false, ""],
    ["", "✎", "随手", true, "懂了"],
    ["", "✎", "只勾了", true, "已解决"],
    ["", "✎", "**小标题**", false, ""],
    ["", "✎", "1.AlphaCode2 编号保留", false, ""],
  ]);
  assert.equal(C.openCount(C.normalizeLesson(split)), 1);
  // Notes with code blocks, tables or formula blocks stay in the notes box.
  for (const notes of ["a\n```\ncode\n```", "| a | b |\n| - | - |", "$$\nx\n$$"]) {
    const l = C.normalizeLesson({ id: "x1", notes });
    assert.equal(C.notesToMarks(l), l);
  }
  const empty = C.normalizeLesson({ id: "x2" });
  assert.equal(C.notesToMarks(empty), empty);
  assert.equal(empty.practice, "");
  assert.match(C.lessonToMarkdown(C.normalizeLesson({ id: "x3", practice: "练习题" }), 1), /### 课外练习\n\n练习题/);
});

test("long text is never cut", () => {
  const long = "字".repeat(80000);
  assert.equal(C.normalizeLesson({ id: "l1", title: long, notes: long }).title.length, 80000);
  assert.equal(M.normalizeCard({ id: "20261028-long-ab12", title: long, why: long }).why.length, 80000);
});

test("terms written but not marked are found", () => {
  const terms = [
    { term: "Transformer", zh: "变换器", en: "", def: "" },
    { term: "注意力", zh: "", en: "attention", def: "" },
    { term: "自注意力", zh: "", en: "self-attention", def: "" },
    { term: "LLM", zh: "大语言模型", en: "Large Language Model", def: "" },
  ];
  const texts = [
    "Transformers 用自注意力，不是 RNN。`attention` 在代码里不算，$attention$ 也不算。",
    "[[变换器]] 已经标过；llm 小写不算，LLMs 算；还有 [链接 attention](http://x) 和 https://a.com/attention 也不算。注意力很重要。",
  ];
  const found = T.unmarkedTerms(texts, terms);
  // Transformer is already marked (as 变换器) in the second box, so it is not suggested.
  assert.deepEqual(found.map((f) => [f.entry.term, f.field, f.shown]), [["自注意力", 0, "自注意力"], ["LLM", 1, "LLMs"], ["注意力", 1, "注意力"]]);
  const llm = found[1];
  assert.equal(T.markAt(texts[1], llm.start, llm.end, "LLM").includes("[[LLMs|LLM]] 算"), true);
  assert.match(found[0].context.before, /Transformers 用$/);

  const m = T.findMentions("self-attention and attention, attentions; inattention", T.termNames(terms));
  assert.deepEqual(m.map((x) => x.shown), ["self-attention", "attention", "attentions"]);
  assert.equal(T.maskMarkdown("a `b` c").length, 7);
  assert.equal(T.maskMarkdown("x\n```\nattention\n```\ny").includes("attention"), false);
  assert.deepEqual(T.unmarkedTerms(["没有术语"], terms), []);
});

test("positions stay right when lowercasing changes a letter's length", () => {
  const terms = [{ term: "注意力", zh: "", en: "attention", def: "" }];
  const text = "İ 注意力 and Attention";
  const [m] = T.findMentions(text, T.termNames(terms));
  assert.equal(text.slice(m.start, m.end), "注意力");
  assert.equal(T.markAt(text, m.start, m.end, "注意力"), "İ [[注意力]] and Attention");
});

test("rich boxes show bold, terms and images, and keep code and formulas as written", async () => {
  const R = await import("../js/rich.mjs");
  assert.equal(R.lineHtml("在 **Pytorch** 和 *斜体* 里"), "在 <b>Pytorch</b> 和 <i>斜体</i> 里");
  assert.equal(R.lineHtml("[[可微]] [[LLMs|LLM]]"), '<span class="term" data-md="[[可微]]" contenteditable="false">可微</span> <span class="term" data-md="[[LLMs|LLM]]" contenteditable="false">LLMs</span>');
  assert.match(R.lineHtml("![截图](uploads/2026-10/x.webp)"), /^<img class="rich-img" data-md="!\[截图\]\(uploads\/2026-10\/x.webp\)" src="uploads\/2026-10\/x.webp"/);
  assert.equal(R.lineHtml("`a*b*c` 和 $x*y*z$"), "`a*b*c` 和 $x*y*z$");
  assert.equal(R.lineHtml("<script>&"), "&lt;script&gt;&amp;");
  assert.equal(R.lineHtml("**[[术语]]**"), '<b><span class="term" data-md="[[术语]]" contenteditable="false">术语</span></b>');
  assert.equal(R.lineHtml("![x](javascript:alert(1))"), "![x](javascript:alert(1))");
  assert.equal(R.toHtml("a\n\nb", false), "<div>a</div><div><br></div><div>b</div>");
  assert.equal(R.toHtml("a\nb", true), "a b");
});

test("a * with a space before it does not end italics (multiplication stays as written)", async () => {
  const { renderInline } = await import("../js/markdown.mjs");
  const R = await import("../js/rich.mjs");
  const text = "tf *idf = 次数 * 稀有程度";
  assert.equal(renderInline(text), "tf *idf = 次数 * 稀有程度");
  assert.equal(R.lineHtml(text), "tf *idf = 次数 * 稀有程度");
  assert.equal(renderInline("*斜体* 和 a*b*c"), "<em>斜体</em> 和 a<em>b</em>c");
  assert.equal(R.lineHtml("*斜体*"), "<i>斜体</i>");
});
