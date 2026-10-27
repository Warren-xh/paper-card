import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tr } from "../js/i18n.mjs";
import * as M from "../js/model.mjs";
import * as L from "../js/lab.mjs";
import * as MM from "../js/mindmap.mjs";
import * as C from "../js/course.mjs";

test("fixed labels all have English", () => {
  const labels = [
    ...M.MARKS.map((m) => m.label), ...M.SECTIONS.map((s) => s.title), ...Object.values(M.GRADES).map((g) => g.label),
    ...Object.values(M.STATUS_LABELS), ...L.STEPS.map((s) => s.label), ...Object.values(L.STATUS_LABELS),
    ...Object.values(MM.KINDS), ...Object.values(MM.COLOR_LABELS),
    ...C.MARKS.map((m) => m.label), ...Object.values(C.STATUS_LABELS),
    ...[M.CARD_SORTS, L.LOG_SORTS, C.COURSE_SORTS, MM.MAP_SORTS].flatMap((list) => list.map(([, label]) => label)),
  ];
  for (const l of labels) assert.ok(tr(l), "missing English for " + l);
});

test("error messages shown to people have English", async () => {
  const sources = ["js/github.mjs", "js/vault.mjs"].map((f) => readFile(new URL("../" + f, import.meta.url), "utf8"));
  for (const src of await Promise.all(sources))
    for (const [, msg] of src.matchAll(/"([^"\n]*[一-鿿][^"\n]*。)"/g)) assert.ok(tr(msg), "missing English for " + msg);
});

test("strings with numbers, dates and nested parts", () => {
  assert.equal(tr("今天有 1 张该回顾"), "1 card due today");
  assert.equal(tr("今天有 3 张该回顾"), "3 cards due today");
  assert.equal(tr("2026 年 10 月 21 日 阅读"), "Read Oct 21, 2026");
  assert.equal(tr("下次回顾：2026 年 10 月 27 日（7 天后）"), "Next review: Oct 27, 2026 (in 7 days)");
  assert.equal(tr("明天再看"), "see again tomorrow");
  assert.equal(tr("论文 · 读完"), "Paper · Finished");
  assert.equal(tr("发布失败：密码不正确。"), "Publishing failed: Wrong password.");
  assert.equal(tr("卡片 4/7，还差 ②⑤"), "Card 4/7, missing ②⑤");
});

test("people's own words are never translated", () => {
  assert.equal(tr("我自己写的笔记"), null);
  assert.equal(tr("项目：毕设"), "Project: 毕设");
  assert.equal(tr("已添加「注意力」。"), "Added “注意力”.");
  assert.equal(tr("Already English"), null);
});

test("course materials and image paste have English", () => {
  assert.equal(tr("3 个资料"), "3 files");
  assert.equal(tr("2 个 · 1.5 MB"), "2 files · 1.5 MB");
  assert.equal(tr("已上传 2 个文件，跳过 1 个。记得点「保存」。"), "Uploaded 2 files, skipped 1. Remember to click “Save”.");
  assert.equal(tr("已上传 1 个文件。记得点「保存」。"), "Uploaded 1 file. Remember to click “Save”.");
  assert.equal(tr("已插入 3 张图片，保存时一起上传。"), "Inserted 3 images; they are uploaded when you save.");
  for (const s of ["课件与资料", "上传文件", "开始记笔记", "可以直接 Ctrl+V 粘贴截图", "插入图片（也可以直接 Ctrl+V 粘贴截图）"]) assert.ok(tr(s), "missing English for " + s);
});
