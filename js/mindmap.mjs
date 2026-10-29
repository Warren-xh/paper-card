// Mind maps (思维导图): a tree of branches. A branch is plain text, or points
// to a paper card or a practice log so the map can jump to it.
// Maps are stored in data/maps/<id>.json; data/maps-index.json lists them.
import { validId, makeId, todayISO, sortBy } from "./model.mjs";

export const MAP_DIR = "data/maps/";
export const MAPS_INDEX_PATH = "data/maps-index.json";
export const MAX_NODES = 2000;
const MAX_DEPTH = 40;

export const KINDS = Object.freeze({ text: "文字", card: "论文", log: "实操", course: "课程" });
// Branch colours; "" means "pick one by position".
export const COLORS = Object.freeze(["", "blue", "green", "orange", "red", "purple", "teal", "gray"]);
export const AUTO_COLORS = Object.freeze(["blue", "orange", "green", "purple", "red", "teal"]);
export const COLOR_LABELS = { "": "自动", blue: "蓝", green: "绿", orange: "橙", red: "红", purple: "紫", teal: "青", gray: "灰" };

const str = (value, max = Infinity) => (typeof value === "string" ? value.slice(0, max) : "");
const NODE_ID = /^[a-z0-9]{1,16}$/;

export function newNodeId(random = Math.random) {
  let id = "";
  for (let i = 0; i < 8; i++) id += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)];
  return id;
}

export const newMapId = (title, date = todayISO(), random = Math.random) => makeId(date, title, random, "map");

export function newNode(fields = {}, random = Math.random) {
  return { id: newNodeId(random), text: "", kind: "text", ref: "", color: "", note: "", children: [], ...fields };
}

export function emptyMap(id, title = "") {
  return { version: 1, id, title, root: newNode({ id: "root", text: title || "中心主题" }), createdAt: "", updatedAt: "" };
}

// Cleans a node tree; drops broken links, repeated ids and anything past the limits.
function normalizeNode(raw, seen, depth) {
  if (!raw || typeof raw !== "object" || seen.size >= MAX_NODES) return null;
  let id = NODE_ID.test(raw.id) && !seen.has(raw.id) ? raw.id : newNodeId();
  while (seen.has(id)) id = newNodeId();
  seen.add(id);
  const kind = raw.kind === "card" || raw.kind === "log" || raw.kind === "course" ? raw.kind : "text";
  const ref = kind !== "text" && validId(raw.ref) ? raw.ref : "";
  const node = {
    id,
    text: str(raw.text).trim(),
    kind: ref ? kind : "text",
    ref,
    color: COLORS.includes(raw.color) ? raw.color : "",
    note: str(raw.note).trim(),
    children: [],
  };
  if (depth < MAX_DEPTH && Array.isArray(raw.children))
    for (const child of raw.children) {
      const c = normalizeNode(child, seen, depth + 1);
      if (c) node.children.push(c);
    }
  return node;
}

export function normalizeMap(raw) {
  if (!raw || typeof raw !== "object") throw new Error("导图格式不正确。");
  if (!validId(raw.id)) throw new Error("导图编号不正确。");
  const root = normalizeNode(raw.root || {}, new Set(), 0) || newNode();
  root.id = "root";
  return {
    version: 1,
    id: raw.id,
    title: str(raw.title).trim(),
    root,
    createdAt: str(raw.createdAt, 40),
    updatedAt: str(raw.updatedAt, 40),
  };
}

/* ---------- tree helpers (they change the map in place) ---------- */
export function walk(node, fn, parent = null, depth = 0) {
  fn(node, parent, depth);
  for (const c of node.children) walk(c, fn, node, depth + 1);
}

export function find(root, id) {
  let hit = null;
  walk(root, (node, parent, depth) => { if (!hit && node.id === id) hit = { node, parent, depth, index: parent ? parent.children.indexOf(node) : -1 }; });
  return hit;
}

export function countNodes(root) {
  let n = 0;
  walk(root, () => n++);
  return n;
}

const isInside = (node, id) => node.id === id || node.children.some((c) => isInside(c, id));

export function addChild(root, parentId, node, index) {
  const hit = find(root, parentId);
  if (!hit) throw new Error("找不到要添加到的分支。");
  if (countNodes(root) >= MAX_NODES) throw new Error("一张导图最多 " + MAX_NODES + " 个分支。");
  const list = hit.node.children;
  list.splice(index == null ? list.length : Math.max(0, Math.min(index, list.length)), 0, node);
  return node;
}

export function addSibling(root, id, node) {
  const hit = find(root, id);
  if (!hit?.parent) return addChild(root, id, node);
  return addChild(root, hit.parent.id, node, hit.index + 1);
}

// Removes a branch (with everything under it). The centre cannot be removed.
export function removeNode(root, id) {
  const hit = find(root, id);
  if (!hit?.parent) return null;
  hit.parent.children.splice(hit.index, 1);
  return hit;
}

// Moves a branch under another one; refuses to move it into itself.
export function moveNode(root, id, newParentId, index) {
  const hit = find(root, id);
  const target = find(root, newParentId);
  if (!hit?.parent || !target || isInside(hit.node, newParentId)) return false;
  hit.parent.children.splice(hit.index, 1);
  const list = target.node.children;
  list.splice(index == null ? list.length : Math.max(0, Math.min(index, list.length)), 0, hit.node);
  return true;
}

export function moveAmongSiblings(root, id, delta) {
  const hit = find(root, id);
  if (!hit?.parent) return false;
  const to = hit.index + delta;
  if (to < 0 || to >= hit.parent.children.length) return false;
  hit.parent.children.splice(hit.index, 1);
  hit.parent.children.splice(to, 0, hit.node);
  return true;
}

// Indented text (tabs or spaces, with or without "- ", "* ", "1. " bullets) as
// a list of branches: [{ text, children }]. Used when pasting into the outline.
export function parseOutline(text) {
  const top = { children: [] };
  const stack = [{ indent: -1, node: top }];
  for (const line of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const expanded = line.replace(/\t/g, "    ");
    const body = expanded.trim().replace(/^#{1,6}\s+/, "").replace(/^(?:[-*+•]|\d+[.)、])\s+/, "").replace(/^\[[ xX]\]\s+/, "").trim();
    if (!body) continue;
    const indent = expanded.match(/^ */)[0].length;
    while (stack.at(-1).indent >= indent) stack.pop();
    const node = { text: body, children: [] };
    stack.at(-1).node.children.push(node);
    stack.push({ indent, node });
  }
  return top.children;
}

// Branches from parseOutline as map nodes (new ids).
export const outlineNodes = (list, random = Math.random) =>
  list.map((x) => newNode({ text: x.text, children: outlineNodes(x.children, random) }, random));

// Outline moves: one step in (under the previous sibling) or out (after the parent).
export function indentNode(root, id) {
  const hit = find(root, id);
  if (!hit?.parent || hit.index === 0) return false;
  return moveNode(root, id, hit.parent.children[hit.index - 1].id);
}
export function outdentNode(root, id) {
  const hit = find(root, id);
  if (!hit?.parent) return false;
  const up = find(root, hit.parent.id);
  if (!up?.parent) return false;
  return moveNode(root, id, up.parent.id, up.index + 1);
}

// Which cards and logs a map already points at.
export function linkedRefs(root) {
  const out = { card: new Set(), log: new Set(), course: new Set() };
  walk(root, (n) => { if (n.kind !== "text" && n.ref) out[n.kind].add(n.ref); });
  return out;
}

// Each first-level branch gets a colour; its whole branch inherits it.
export function branchColors(root) {
  const colors = new Map();
  root.children.forEach((child, i) => {
    const base = child.color || AUTO_COLORS[i % AUTO_COLORS.length];
    walk(child, (n, parent) => colors.set(n.id, n.color || (parent && colors.get(parent.id)) || base));
  });
  return colors;
}

/* ---------- layout ---------- */
// Balanced tree: the first half of the main branches go right, the rest left.
// sizeOf(id) → { w, h } in pixels; collapsed is a Set of node ids whose children are hidden.
// Returns boxes { id, x, y, w, h, side, depth } (x = left edge, y = top edge) and edges.
export function layout(root, sizeOf, collapsed = new Set(), { hGap = 56, vGap = 14 } = {}) {
  const boxes = new Map();
  const edges = [];
  const kids = (n) => (collapsed.has(n.id) ? [] : n.children);
  const heights = new Map();
  const heightOf = (n) => {
    if (heights.has(n.id)) return heights.get(n.id);
    const own = sizeOf(n.id).h;
    const list = kids(n);
    const sum = list.reduce((t, c) => t + heightOf(c), 0) + vGap * Math.max(0, list.length - 1);
    const h = Math.max(own, sum);
    heights.set(n.id, h);
    return h;
  };
  // Places a node with its vertical centre at cy; anchorX is the parent edge it hangs from.
  const place = (n, anchorX, cy, side, depth) => {
    const { w, h } = sizeOf(n.id);
    const x = side === "right" ? anchorX + hGap : anchorX - hGap - w;
    boxes.set(n.id, { id: n.id, x, y: cy - h / 2, w, h, side, depth });
    placeChildren(n, side === "right" ? x + w : x, cy, side, depth);
  };
  const placeChildren = (n, edgeX, cy, side, depth, list = kids(n)) => {
    const total = list.reduce((t, c) => t + heightOf(c), 0) + vGap * Math.max(0, list.length - 1);
    let top = cy - total / 2;
    for (const c of list) {
      const ch = heightOf(c);
      place(c, edgeX, top + ch / 2, side, depth + 1);
      edges.push({ from: n.id, to: c.id, side });
      top += ch + vGap;
    }
  };
  const r = sizeOf(root.id);
  boxes.set(root.id, { id: root.id, x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h, side: "center", depth: 0 });
  const main = kids(root);
  const half = Math.ceil(main.length / 2);
  placeChildren(root, r.w / 2, 0, "right", 0, main.slice(0, half));
  placeChildren(root, -r.w / 2, 0, "left", 0, main.slice(half));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes.values()) {
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  return { boxes, edges, bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY } };
}

/* ---------- index & export ---------- */
export function summarize(map) {
  const refs = linkedRefs(map.root);
  return {
    id: map.id,
    title: map.title,
    nodes: countNodes(map.root),
    cards: refs.card.size,
    logs: refs.log.size,
    courses: refs.course.size,
    branches: map.root.children.map((c) => c.text).filter(Boolean).slice(0, 6),
    text: (() => { const t = []; walk(map.root, (n) => t.push(n.text, n.note)); return t.filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 20000); })(),
    updatedAt: map.updatedAt,
  };
}

export function emptyIndex() {
  return { version: 1, updatedAt: "", maps: [] };
}

export const MAP_SORTS = Object.freeze([["updated", "最近修改"], ["title", "标题 A→Z"], ["nodes", "分支最多"]]);

export function sortMaps(list, key = "updated") {
  if (key === "title") return sortBy(list, [[(x) => x.title, "asc"]]);
  if (key === "nodes") return sortBy(list, [[(x) => x.nodes || 0, "desc"], [(x) => x.updatedAt, "desc"]]);
  return sortBy(list, [[(x) => x.updatedAt, "desc"]]);
}

// Map list search: title, main branches and the text of every branch.
export function searchMaps(list, query = "") {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((x) => {
    const hay = [x.title, ...(x.branches || []), x.text || ""].join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// Find-in-map: ids of branches whose text (or linked title) contains the query.
export function findNodes(root, query, titleOf = () => "") {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits = [];
  walk(root, (n) => {
    const hay = [n.text, n.note, n.kind !== "text" ? titleOf(n.kind, n.ref) : ""].join(" ").toLowerCase();
    if (terms.every((t) => hay.includes(t))) hits.push(n.id);
  });
  return hits;
}

// Ids of the branches above a node (to unfold them when it is found).
export function ancestors(root, id) {
  const path = [];
  const visit = (n, trail) => {
    if (n.id === id) { path.push(...trail); return true; }
    return n.children.some((c) => visit(c, [...trail, n.id]));
  };
  visit(root, []);
  return path;
}

export function normalizeIndex(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.maps)) return emptyIndex();
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    maps: raw.maps
      .filter((x) => x && validId(x.id))
      .map((x) => ({ ...x, branches: Array.isArray(x.branches) ? x.branches : [] }))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
  };
}

export function upsertIndex(index, map, now = new Date().toISOString()) {
  const maps = index.maps.filter((x) => x.id !== map.id);
  maps.push(summarize(map));
  return normalizeIndex({ version: 1, updatedAt: now, maps });
}

export function removeFromIndex(index, id, now = new Date().toISOString()) {
  return { version: 1, updatedAt: now, maps: index.maps.filter((x) => x.id !== id) };
}

// Indented outline, for copying into notes.
export function mapToMarkdown(map, titleOf = () => "") {
  const lines = ["# " + (map.title || map.root.text || "思维导图")];
  const label = (n) => {
    const linked = n.kind !== "text" && n.ref ? titleOf(n.kind, n.ref) || n.text : n.text;
    return (n.kind !== "text" ? "[" + KINDS[n.kind] + "] " : "") + (linked || "（空）") + (n.note ? " — " + n.note.replace(/\s+/g, " ") : "");
  };
  walk(map.root, (n, parent, depth) => { if (depth > 0) lines.push("  ".repeat(depth - 1) + "- " + label(n)); });
  return lines.join("\n") + "\n";
}
