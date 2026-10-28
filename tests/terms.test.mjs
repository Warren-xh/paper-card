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

test("lessons keep one notes box: time points and questions inside it", () => {
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
  const merged = C.marksToNotes(old);
  assert.deepEqual(merged.marks, []);
  assert.equal(merged.notes, "我的笔记\n\n### 边看边记\n\n- [ ] [3:20] ? 没懂\n- [12:05] ! 重点\n- [x] 随手 → 懂了\n");
  assert.equal(C.openCount(merged), 1);
  assert.equal(C.marksToNotes(merged), merged);
  assert.equal(C.marksToNotes(C.normalizeLesson({ id: "x1", marks: [{ text: "只有标记" }] })).notes, "### 边看边记\n\n- 只有标记\n");
});

test("long text is never cut", () => {
  const long = "字".repeat(80000);
  assert.equal(C.normalizeLesson({ id: "l1", title: long, notes: long }).title.length, 80000);
  assert.equal(M.normalizeCard({ id: "20261028-long-ab12", title: long, why: long }).why.length, 80000);
});
