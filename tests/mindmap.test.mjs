import test from "node:test";
import assert from "node:assert/strict";
import * as MM from "../js/mindmap.mjs";

const ID = "20261022-dl-ab12";
const CARD = "20261019-bert-demo";
const LOG = "20261021-ddp-33j6";

test("normalizeMap cleans trees and keeps valid links", () => {
  const m = MM.normalizeMap({
    id: ID, title: " 深度学习 ",
    root: { id: "zzz", text: "深度学习", children: [
      { id: "a1", text: "预训练", kind: "card", ref: CARD, color: "pink", children: [{ id: "a1", text: "重复 id" }] },
      { id: "BAD ID", text: "实操", kind: "log", ref: "not-an-id" },
      null,
      { id: "c3", text: "x".repeat(400), kind: "log", ref: LOG, note: " 备注 " },
    ] },
  });
  assert.equal(m.title, "深度学习");
  assert.equal(m.root.id, "root");
  const [a, b, c] = m.root.children;
  assert.deepEqual([a.kind, a.ref, a.color], ["card", CARD, ""]);
  assert.notEqual(a.children[0].id, "a1");                 // repeated id replaced
  assert.deepEqual([b.kind, b.ref], ["text", ""]);         // broken link becomes plain text
  assert.match(b.id, /^[a-z0-9]{8}$/);
  assert.equal(c.text.length, 400);                         // no length limit
  assert.equal(c.note, "备注");
  assert.equal(MM.countNodes(m.root), 5);
  assert.throws(() => MM.normalizeMap({ id: "nope" }));
});

test("adding, moving and removing branches", () => {
  const m = MM.emptyMap(ID, "主题");
  const a = MM.addChild(m.root, "root", MM.newNode({ id: "n1", text: "A" }));
  const b = MM.addChild(m.root, "root", MM.newNode({ id: "n2", text: "B" }));
  const a1 = MM.addChild(m.root, a.id, MM.newNode({ id: "n3", text: "A1" }));
  const a2 = MM.addSibling(m.root, a1.id, MM.newNode({ id: "n4", text: "A2" }));
  assert.deepEqual(MM.find(m.root, a.id).node.children.map((n) => n.text), ["A1", "A2"]);
  assert.equal(MM.find(m.root, a2.id).depth, 2);
  assert.ok(MM.moveAmongSiblings(m.root, a2.id, -1));
  assert.deepEqual(MM.find(m.root, a.id).node.children.map((n) => n.text), ["A2", "A1"]);
  assert.ok(!MM.moveAmongSiblings(m.root, a2.id, -1));     // already first
  assert.ok(!MM.moveNode(m.root, a.id, a1.id));            // not into its own branch
  assert.ok(MM.moveNode(m.root, a1.id, b.id));
  assert.deepEqual(MM.find(m.root, b.id).node.children.map((n) => n.text), ["A1"]);
  assert.equal(MM.removeNode(m.root, "root"), null);       // the centre stays
  MM.removeNode(m.root, a.id);
  assert.equal(MM.countNodes(m.root), 3);
  assert.equal(MM.find(m.root, a2.id), null);
});

test("links, colours and the index", () => {
  const m = MM.emptyMap(ID, "主题");
  const p = MM.addChild(m.root, "root", MM.newNode({ id: "n5", text: "论文", color: "red" }));
  MM.addChild(m.root, p.id, MM.newNode({ id: "n6", kind: "card", ref: CARD, text: "BERT" }));
  const q = MM.addChild(m.root, "root", MM.newNode({ id: "n7", text: "实操" }));
  MM.addChild(m.root, q.id, MM.newNode({ id: "n8", kind: "log", ref: LOG, text: "DDP" }));
  const refs = MM.linkedRefs(m.root);
  assert.deepEqual([[...refs.card], [...refs.log]], [[CARD], [LOG]]);
  const colors = MM.branchColors(m.root);
  assert.equal(colors.get(p.children[0].id), "red");        // inherits its branch colour
  assert.equal(colors.get(q.id), MM.AUTO_COLORS[1]);
  const s = MM.summarize({ ...m, updatedAt: "2026-10-22T00:00:00Z" });
  assert.deepEqual([s.nodes, s.cards, s.logs, s.branches], [5, 1, 1, ["论文", "实操"]]);
  let idx = MM.upsertIndex(MM.emptyIndex(), m);
  idx = MM.upsertIndex(idx, { ...m, title: "改名" });
  assert.deepEqual(idx.maps.map((x) => x.title), ["改名"]);
  assert.equal(MM.removeFromIndex(idx, ID).maps.length, 0);
  const md = MM.mapToMarkdown(m, (kind, ref) => (ref === CARD ? "BERT: Pre-training" : ""));
  assert.equal(md, "# 主题\n- 论文\n  - [论文] BERT: Pre-training\n- 实操\n  - [实操] DDP\n");
});

test("balanced layout without overlaps", () => {
  const m = MM.emptyMap(ID, "中心");
  for (let i = 0; i < 5; i++) {
    const b = MM.addChild(m.root, "root", MM.newNode({ id: "b" + i, text: "B" + i }));
    for (let j = 0; j < 3; j++) MM.addChild(m.root, b.id, MM.newNode({ id: "b" + i + "c" + j, text: "C" }));
  }
  const size = () => ({ w: 80, h: 30 });
  const { boxes, edges, bounds } = MM.layout(m.root, size);
  assert.equal(boxes.size, 21);
  assert.equal(edges.length, 20);
  assert.deepEqual(["b0", "b1", "b2"].map((id) => boxes.get(id).side), ["right", "right", "right"]);
  assert.deepEqual(["b3", "b4"].map((id) => boxes.get(id).side), ["left", "left"]);
  assert.ok(boxes.get("b0c0").x > boxes.get("b0").x + 80);  // children further out
  assert.ok(boxes.get("b3c0").x + 80 < boxes.get("b3").x);
  const all = [...boxes.values()];
  for (const a of all) for (const b of all)
    if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, a.id + " overlaps " + b.id);
  assert.ok(bounds.width > 0 && bounds.height > 0);
  // Collapsing hides a branch's children.
  const folded = MM.layout(m.root, size, new Set(["b0"]));
  assert.equal(folded.boxes.size, 18);
  assert.ok(!folded.boxes.has("b0c0"));
});

test("outline: pasted text becomes branches, and branches move in and out", () => {
  const list = MM.parseOutline("机器学习\n  - 监督学习\n      1. 分类\n      2. 回归\n  - 无监督学习\n\t聚类\n深度学习\n");
  assert.deepEqual(list.map((x) => x.text), ["机器学习", "深度学习"]);
  assert.deepEqual(list[0].children.map((x) => x.text), ["监督学习", "无监督学习"]);
  assert.deepEqual(list[0].children[1].children.map((x) => x.text), ["聚类"]); // a tab is deeper than two spaces
  assert.deepEqual(list[0].children[0].children.map((x) => x.text), ["分类", "回归"]);
  assert.deepEqual(MM.parseOutline("- [ ] 待办\n# 标题\n\n"), [{ text: "待办", children: [] }, { text: "标题", children: [] }]);
  const nodes = MM.outlineNodes(list);
  assert.match(nodes[0].id, /^[a-z0-9]{8}$/);
  assert.equal(nodes[0].children[0].children[1].text, "回归");

  const map = MM.emptyMap("20261028-outline-ab12", "中心");
  const [a, b, c] = ["a", "b", "c"].map((t) => MM.addChild(map.root, "root", MM.newNode({ text: t })));
  assert.equal(MM.indentNode(map.root, a.id), false);          // nothing before it
  assert.equal(MM.indentNode(map.root, b.id), true);           // b goes under a
  assert.deepEqual(a.children.map((x) => x.text), ["b"]);
  assert.equal(MM.outdentNode(map.root, b.id), true);          // and back out, right after a
  assert.deepEqual(map.root.children.map((x) => x.text), ["a", "b", "c"]);
  assert.equal(MM.outdentNode(map.root, c.id), false);         // top-level branches stay
});
