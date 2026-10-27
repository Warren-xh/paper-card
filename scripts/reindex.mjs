// Rebuilds the summary indexes from the data files:
//   data/index.json          ← data/cards/*.json
//   data/logs-index.json     ← data/logs/*.json
//   data/courses-index.json  ← data/courses/*.json
//   data/maps-index.json     ← data/maps/*.json
//   node scripts/reindex.mjs
// Only needed after editing data files by hand; the website keeps them up to date.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../js/model.mjs";
import * as L from "../js/lab.mjs";
import * as C from "../js/course.mjs";
import * as MM from "../js/mindmap.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const modules = [
  { name: "卡片", dir: M.CARD_DIR, out: M.INDEX_PATH, empty: M.emptyIndex, norm: M.normalizeCard, upsert: M.upsertIndex, list: (i) => i.cards },
  { name: "实操记录", dir: L.LOG_DIR, out: L.LOGS_INDEX_PATH, empty: L.emptyIndex, norm: L.normalizeLog, upsert: L.upsertIndex, list: (i) => i.logs },
  { name: "课程", dir: C.COURSE_DIR, out: C.COURSES_INDEX_PATH, empty: C.emptyIndex, norm: C.normalizeCourse, upsert: C.upsertIndex, list: (i) => i.courses },
  { name: "导图", dir: MM.MAP_DIR, out: MM.MAPS_INDEX_PATH, empty: MM.emptyIndex, norm: MM.normalizeMap, upsert: MM.upsertIndex, list: (i) => i.maps },
];

for (const m of modules) {
  const names = await readdir(join(root, m.dir)).catch(() => []);
  let index = m.empty();
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const item = m.norm(JSON.parse(await readFile(join(root, m.dir, name), "utf8")));
    index = m.upsert(index, item);
  }
  await writeFile(join(root, m.out), JSON.stringify(index, null, 1) + "\n");
  console.log("已重建索引：" + m.list(index).length + " 个" + m.name);
}
