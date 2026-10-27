import test from "node:test";
import assert from "node:assert/strict";
import * as O from "../js/overview.mjs";

test("days, weeks and streaks", () => {
  assert.equal(O.localDay(new Date(2026, 9, 27, 23, 59)), "2026-10-27");
  assert.equal(O.localDay("nonsense"), "");
  assert.equal(O.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(O.addDays("2026-03-01", -1), "2026-02-28");

  const counts = O.activityFromCommits([
    new Date(2026, 9, 27, 9).toISOString(), new Date(2026, 9, 27, 21).toISOString(),
    new Date(2026, 9, 26, 12).toISOString(), new Date(2026, 9, 24, 12).toISOString(), "bad",
  ]);
  assert.equal(counts.get("2026-10-27"), 2);
  assert.equal(counts.size, 3);
  assert.equal(O.streak(counts, "2026-10-27"), 2);
  // Today still empty: the streak up to yesterday still counts.
  assert.equal(O.streak(counts, "2026-10-28"), 2);
  assert.equal(O.streak(counts, "2026-10-30"), 0);
  assert.equal(O.activeDays(counts, "2026-10-27", 7), 3);

  // 2026-10-27 is a Tuesday: the last column runs Monday 26th to Sunday 1st.
  const weeks = O.heatmapWeeks(counts, "2026-10-27", 4);
  assert.equal(weeks.length, 4);
  assert.ok(weeks.every((w) => w.length === 7));
  const last = weeks.at(-1);
  assert.equal(last[0].day, "2026-10-26");
  assert.deepEqual([last[1].n, last[1].level, last[1].future], [2, 2, false]);
  assert.equal(last[2].future, true);
  assert.equal(weeks[0][0].day, "2026-10-05");
  assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 30].map(O.level), [0, 1, 2, 2, 3, 3, 4, 4]);
});

test("activity from entries when commits are not available", () => {
  const counts = O.activityFromEntries({
    cards: [{ readDate: "2026-10-20", updatedAt: "2026-10-22T03:00:00Z" }, { readDate: "bad" }],
    logs: [{ date: "2026-10-21" }],
    lessons: [{ date: "2026-10-21" }, { date: "" }],
    courses: [{}],
    maps: [{ updatedAt: "" }],
  });
  assert.equal(counts.get("2026-10-20"), 1);
  assert.equal(counts.get("2026-10-21"), 2);
  assert.equal(counts.has("bad"), false);
});

test("greeting, dates, recent items and continuing courses", () => {
  assert.deepEqual([3, 8, 12, 15, 21].map(O.greeting), ["夜深了", "早上好", "中午好", "下午好", "晚上好"]);
  assert.equal(O.dateLine(new Date(2026, 9, 27)), "10 月 27 日 星期二");
  const now = new Date(2026, 9, 27, 12, 0);
  assert.equal(O.timeAgo(new Date(2026, 9, 27, 11, 59, 30).toISOString(), now), "刚刚");
  assert.equal(O.timeAgo(new Date(2026, 9, 27, 11, 15).toISOString(), now), "45 分钟前");
  assert.equal(O.timeAgo(new Date(2026, 9, 27, 8, 0).toISOString(), now), "4 小时前");
  assert.equal(O.timeAgo(new Date(2026, 9, 26, 23, 0).toISOString(), now), "昨天");
  assert.equal(O.timeAgo(new Date(2026, 9, 23).toISOString(), now), "4 天前");
  assert.equal(O.timeAgo(new Date(2026, 8, 1).toISOString(), now), "2026-09-01");

  const recent = O.recentItems({
    cards: [{ id: "c1", title: "A", oneLine: "一句话", updatedAt: "2026-10-25T00:00:00Z" }],
    logs: [{ id: "l1", title: "B", updatedAt: "2026-10-27T00:00:00Z" }],
    courses: [{ id: "k1", title: "C", lessons: 4, done: 1, updatedAt: "2026-10-26T00:00:00Z" }],
    maps: [{ id: "m1", title: "D", nodes: 3, updatedAt: "" }],
  });
  assert.deepEqual(recent.map((x) => x.kind), ["log", "course", "card"]);
  assert.equal(recent[1].sub, "已看 1 / 4 课");
  assert.equal(recent[2].href, "#/c/c1");

  const going = O.continueCourses([
    { id: "a", status: "learning", lessons: 3, done: 3 },
    { id: "b", status: "learning", lessons: 3, done: 1, lastDate: "2026-10-20" },
    { id: "c", status: "paused", lessons: 3, done: 1 },
    { id: "d", status: "learning", lessons: 5, done: 0, lastDate: "2026-10-26" },
  ]);
  assert.deepEqual(going.map((x) => x.id), ["d", "b"]);
});
