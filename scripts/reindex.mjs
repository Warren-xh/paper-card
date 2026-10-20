// Rebuilds data/index.json from data/cards/*.json.
//   node scripts/reindex.mjs
// Only needed if the index was edited by hand; the website keeps it up to date.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../js/model.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, M.CARD_DIR);
let index = M.emptyIndex();
for (const name of (await readdir(dir)).filter((n) => n.endsWith(".json"))) {
  const card = M.normalizeCard(JSON.parse(await readFile(join(dir, name), "utf8")));
  index = M.upsertIndex(index, card);
}
await writeFile(join(root, M.INDEX_PATH), JSON.stringify(index, null, 1) + "\n");
console.log("已重建索引：" + index.cards.length + " 张卡片");
