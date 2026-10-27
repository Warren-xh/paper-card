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

test("overview, search and video have English", async () => {
  const { KIND_LABELS } = await import("../js/search.mjs");
  for (const l of Object.values(KIND_LABELS)) assert.ok(tr(l), "missing English for " + l);
  assert.equal(tr("晚上好，Warren"), "Good evening, Warren");
  assert.equal(tr("10 月 27 日 星期二"), "Tuesday, Oct 27");
  assert.equal(tr("10 月 27 日：2 次保存"), "Oct 27: 2 saves");
  assert.equal(tr("3 月 1 日：没有记录"), "Mar 1: nothing");
  assert.equal(tr("2 张卡片该回顾"), "2 cards to review");
  assert.equal(tr("下一次：10 月 30 日（2 张）"), "Next: Oct 30 (2)");
  assert.equal(tr("CS329 · 已看 1 / 4 课"), "CS329 · watched 1 / 4");
  assert.equal(tr("45 分钟前"), "45 min ago");
  assert.equal(tr("4 天前"), "4 days ago");
  assert.equal(tr("没有找到「agent」。换个关键词试试。"), "Nothing found for “agent”. Try another word.");
  assert.equal(tr("从 3:20 开始播放"), "Play from 3:20");
  assert.equal(tr("1 个待解决的问题"), "1 open question");
});
