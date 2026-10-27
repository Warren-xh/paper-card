import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/course.mjs";
import * as M from "../js/model.mjs";
import * as L from "../js/lab.mjs";
import * as MM from "../js/mindmap.mjs";

const ID = "20261027-cs231n-ab12";

test("courses and lessons are cleaned", () => {
  assert.match(C.newCourseId("CS231n 深度学习"), /^\d{8}-cs231n-[a-z0-9]{4}$/);
  assert.match(C.newCourseId("深度学习"), /^\d{8}-course-[a-z0-9]{4}$/);
  const c = C.normalizeCourse({
    id: ID, title: " CS231n ", status: "weird", tags: "CV, 课程", link: "javascript:x",
    lessons: [
      { id: "l1", title: "第 1 课 图像分类", date: "2026-10-20", done: 1, marks: [
        { time: "12:34", type: "?", text: " kNN 为什么慢 ", solve: true },
        { time: "1:02:03", type: "!", text: "交叉验证" },
        { time: "99", type: "bogus", text: "时间不对" },
        { time: "3：05", type: "★", text: "全角冒号" },
        { text: "" },
      ] },
      { id: "l1", title: "重复 id" },
      null,
    ],
  });
  assert.equal(c.title, "CS231n");
  assert.equal(c.status, "learning");
  assert.equal(c.link, "");
  assert.deepEqual(c.tags, ["CV", "课程"]);
  assert.equal(c.lessons.length, 2);
  assert.notEqual(c.lessons[1].id, "l1");
  const [a, b, d, e] = c.lessons[0].marks;
  assert.deepEqual([a.time, a.type, a.text, a.solve], ["12:34", "?", "kNN 为什么慢", true]);
  assert.equal(b.time, "1:02:03");
  assert.deepEqual([d.time, d.type], ["", "✎"]);
  assert.equal(e.time, "3:05");
  assert.equal(c.lessons[0].done, true);
  assert.throws(() => C.normalizeCourse({ id: "nope" }));
});

test("progress, next lesson, open marks and lesson updates", () => {
  let c = C.normalizeCourse({ id: ID, title: "CS231n", lessons: [
    { id: "a", title: "L1", done: true, date: "2026-10-20", marks: [{ type: "?", text: "q1", solve: true }, { type: "?", text: "q2", solve: true, answer: "解决" }] },
    { id: "b", title: "L2", date: "2026-10-22" },
    { id: "c", title: "L3" },
  ] });
  assert.deepEqual(C.progress(c), { done: 1, total: 3 });
  assert.equal(C.nextLesson(c).id, "b");
  assert.equal(C.openMarks(c.lessons[0]).length, 1);
  c = C.upsertLesson(c, { ...c.lessons[1], done: true });
  c = C.upsertLesson(c, C.normalizeLesson({ id: "d", title: "L4" }));
  assert.deepEqual(c.lessons.map((l) => l.id), ["a", "b", "c", "d"]);
  assert.equal(C.nextLesson(c).id, "c");
  assert.deepEqual(C.removeLesson(c, "c").lessons.map((l) => l.id), ["a", "b", "d"]);
  assert.deepEqual(C.parseLessonTitles(" 第1课 导论 \n\n2. 线性分类\r\n"), ["第1课 导论", "2. 线性分类"]);
  const s = C.summarize(c);
  assert.deepEqual([s.lessons, s.done, s.open, s.lastDate, s.next], [4, 2, 1, "2026-10-22", "L3"]);
  assert.deepEqual(C.marksByTime([{ time: "10:00", text: "b" }, { time: "", text: "c" }, { time: "2:00", text: "a" }]).map((m) => m.text), ["a", "b", "c"]);
  assert.match(C.courseToMarkdown(c), /## 第 1 课 · L1 ✓[\s\S]*- \? q1\n {2}→ （待解决）/);
});

test("course index, search, sort and stats", () => {
  const mk = (id, title, extra) => C.normalizeCourse({ id, title, ...extra });
  const a = mk("20261001-a-aaaa", "Deep Learning", { status: "done", lessons: [{ title: "x", done: true, date: "2026-10-05" }] });
  const b = mk("20261010-b-bbbb", "强化学习", { lessons: [{ title: "策略梯度", date: "2026-10-25", marks: [{ type: "?", text: "baseline 为什么能减方差", solve: true }] }, { title: "y" }] });
  let idx = C.emptyIndex();
  idx = C.upsertIndex(idx, { ...a, updatedAt: "2026-10-05T00:00:00Z" });
  idx = C.upsertIndex(idx, { ...b, updatedAt: "2026-10-26T00:00:00Z" });
  assert.equal(C.search(idx.courses, { query: "方差" }).length, 1);
  assert.equal(C.search(idx.courses, { status: "open" })[0].title, "强化学习");
  assert.deepEqual(C.sortCourses(idx.courses, "recent").map((x) => x.title), ["强化学习", "Deep Learning"]);
  assert.deepEqual(C.sortCourses(idx.courses, "progress").map((x) => x.title), ["Deep Learning", "强化学习"]);
  const st = C.stats(idx.courses);
  assert.deepEqual([st.total, st.learning, st.finished, st.lessonsDone, st.open], [2, 1, 1, 1, 1]);
  assert.equal(C.removeFromIndex(idx, a.id).courses.length, 1);
});

test("every module sorts", () => {
  const cards = [{ title: "B", readDate: "2026-10-01", year: 2019, questions: 0 }, { title: "A", readDate: "2026-10-03", year: 2017, questions: 2 }, { title: "C", readDate: "", year: null, questions: 1 }];
  assert.deepEqual(M.sortCards(cards, "read").map((x) => x.title), ["A", "B", "C"]);
  assert.deepEqual(M.sortCards(cards, "read-asc").map((x) => x.title), ["B", "A", "C"]);
  assert.deepEqual(M.sortCards(cards, "title").map((x) => x.title), ["A", "B", "C"]);
  assert.deepEqual(M.sortCards(cards, "year").map((x) => x.title), ["B", "A", "C"]);
  assert.deepEqual(M.sortCards(cards, "open").map((x) => x.title), ["A", "C", "B"]);
  const logs = [{ title: "x", date: "2026-10-02", hours: 1, open: 0 }, { title: "y", date: "2026-10-05", hours: 3, open: 2 }];
  assert.deepEqual(L.sortLogs(logs, "date").map((x) => x.title), ["y", "x"]);
  assert.deepEqual(L.sortLogs(logs, "date-asc").map((x) => x.title), ["x", "y"]);
  assert.deepEqual(L.sortLogs(logs, "hours").map((x) => x.title), ["y", "x"]);
  const maps = [{ title: "b", nodes: 3, updatedAt: "2026-10-01", branches: [] }, { title: "a", nodes: 9, updatedAt: "2026-10-02", branches: ["方法"] }];
  assert.deepEqual(MM.sortMaps(maps, "nodes").map((x) => x.title), ["a", "b"]);
  assert.deepEqual(MM.sortMaps(maps, "title").map((x) => x.title), ["a", "b"]);
  assert.deepEqual(MM.searchMaps(maps, "方法").map((x) => x.title), ["a"]);
  // Pinyin order for Chinese titles.
  assert.deepEqual(M.sortCards([{ title: "变换器" }, { title: "安全" }], "title").map((x) => x.title), ["安全", "变换器"]);
});

test("find in a mind map, and course branches", () => {
  const m = MM.emptyMap("20261027-map-abcd", "中心");
  const a = MM.addChild(m.root, "root", MM.newNode({ id: "a1", text: "方法" }));
  MM.addChild(m.root, a.id, MM.newNode({ id: "a2", text: "注意力机制" }));
  MM.addChild(m.root, a.id, MM.newNode({ id: "a3", kind: "course", ref: ID, text: "" }));
  assert.deepEqual(MM.findNodes(m.root, "注意力"), ["a2"]);
  assert.deepEqual(MM.findNodes(m.root, "cs231n", (kind, ref) => (kind === "course" && ref === ID ? "CS231n" : "")), ["a3"]);
  assert.deepEqual(MM.findNodes(m.root, ""), []);
  assert.deepEqual(MM.ancestors(m.root, "a2"), ["root", "a1"]);
  const n = MM.normalizeMap({ id: "20261027-map-abcd", root: m.root });
  assert.equal(MM.find(n.root, "a3").node.kind, "course");
  assert.equal(MM.summarize(n).courses, 1);
  assert.match(MM.summarize(n).text, /注意力机制/);
});
