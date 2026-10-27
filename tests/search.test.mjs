import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/search.mjs";
import * as C from "../js/course.mjs";

const course = C.normalizeCourse({
  id: "20261027-cs329-lzad", title: "斯坦福 CS329", updatedAt: "2026-10-27T00:00:00Z",
  lessons: [{ id: "abc123", title: "Agent 概览", notes: "planning 和 memory", marks: [{ text: "工具调用" }] }, { id: "def456", title: "" }],
});
const entries = S.buildEntries({
  cards: [{ id: "c1", title: "Attention Is All You Need", oneLine: "Transformer 只用注意力", authors: "Vaswani", year: 2017, text: "self-attention", updatedAt: "2026-10-20" }],
  logs: [{ id: "l1", title: "把文字变成数字", conclusion: "TF-IDF", text: "CountVectorizer", updatedAt: "2026-10-21" }],
  courses: [{ id: "20261027-cs329-lzad", title: "斯坦福 CS329", teacher: "Stanford", text: "", updatedAt: "2026-10-27" }],
  courseFiles: [course],
  maps: [{ id: "m1", title: "Agent 研究", branches: ["记忆", "工具"], text: "", updatedAt: "2026-10-22" }],
});

test("entries cover every module, including lessons", () => {
  assert.deepEqual(entries.map((e) => e.kind), ["card", "log", "course", "lesson", "lesson", "map"]);
  const lesson = entries.find((e) => e.kind === "lesson");
  assert.equal(lesson.href, "#/course/20261027-cs329-lzad/l/abc123");
  assert.equal(lesson.sub, "斯坦福 CS329 · 第 1 课");
  assert.equal(entries[4].title, "第 2 课");
  assert.equal(S.KIND_LABELS.lesson, "课时");
});

test("ranking puts title matches first and needs every word", () => {
  assert.deepEqual(S.searchEntries(entries, "agent").map((e) => e.kind), ["lesson", "map"]);
  assert.equal(S.searchEntries(entries, "memory")[0].title, "Agent 概览");
  assert.equal(S.searchEntries(entries, "attention transformer")[0].kind, "card");
  assert.equal(S.searchEntries(entries, "attention 不存在").length, 0);
  assert.equal(S.searchEntries(entries, "  ").length, 0);
  assert.equal(S.searchEntries(entries, "tf-idf")[0].kind, "log");
  assert.ok(S.rank(entries[0], "attention is all you need") > S.rank(entries[0], "attention"));
});

test("snippets show the words around a match", () => {
  assert.equal(S.snippet("abc planning and memory xyz", "memory", 12), "…and memory x…");
  assert.equal(S.snippet("short text", "short"), "short text");
  assert.equal(S.snippet("nothing here", "zzz"), "");
});
