// Rich note boxes: bold, italic, terms, video times and images show as they will
// look, instead of as Markdown symbols. Each box sits on top of its <textarea>,
// which stays in the form (hidden) and always holds the Markdown text, so forms,
// drafts and saving work unchanged. Code that edits the textarea (value,
// selection, setRangeText, focus) is passed through to the box.
import { escapeHtml as h, safeHref } from "./markdown.mjs";

/* ---------- Markdown → box ---------- */
// Kept as written (never shown as formatting): code spans and formulas.
// Shown as one block that is deleted as a whole: terms, video times, images.
const TOKEN = new RegExp(
  [
    /`[^`\n]+`/, /\$\$[^$\n]+\$\$/, /(?<![\\$])\$[^$\n]+?\$(?!\d)/,
    /\[\[[^[\]|\n]+?(?:\|[^[\]\n]+?)?\]\]/, /\[(?:\d{1,2}:)?\d{1,3}:[0-5]\d\](?!\()/, /!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)/,
  ].map((r) => "(" + r.source + ")").join("|"),
  "g",
);

// Maps an upload not published yet to its local copy ("" otherwise; the address is still checked).
let resolveImage = () => "";
export const setImageResolver = (fn) => { resolveImage = fn; };

function atom(md, groups) {
  const [, code, mathD, math, term, time, image] = groups;
  if (code || mathD || math) return null;
  if (term) {
    const [shown] = term.slice(2, -2).split("|");
    return `<span class="term" data-md="${h(md)}" contenteditable="false">${h(shown.trim())}</span>`;
  }
  if (time) return `<span class="time-tag" data-md="${h(md)}" contenteditable="false">${h(md.slice(1, -1))}</span>`;
  const m = image.match(/^!\[([^\]]*)\]\(([^)\s]+)/);
  const href = safeHref(m[2], { image: true, resolveImage });
  if (!href) return null;
  return `<img class="rich-img" data-md="${h(md)}" src="${h(href)}" alt="${h(m[1])}" contenteditable="false">`;
}

// One line of Markdown as box HTML. Bold and italic follow the same rules as
// the page renderer (markdown.mjs), so the box looks like the saved page.
export function lineHtml(line) {
  const stash = [];
  let s = String(line).replace(TOKEN, (md, ...groups) => {
    // Code, formulas and unsafe images stay as written, untouched by bold and italic.
    const html = atom(md, [md, ...groups]) ?? h(md);
    return "\u0000" + (stash.push(html) - 1) + "\u0000";
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "\u0001$1\u0002")
    .replace(/(^|[^*])\*([^*\s](?:[^*]*?[^*\s])?)\*(?!\*)/g, "$1\u0003$2\u0004");
  s = h(s)
    .replace(/\u0001/g, "<b>").replace(/\u0002/g, "</b>")
    .replace(/\u0003/g, "<i>").replace(/\u0004/g, "</i>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
}

export function toHtml(md, oneLine) {
  if (oneLine) return lineHtml(String(md).replace(/\n/g, " "));
  return String(md).split("\n").map((l) => "<div>" + (lineHtml(l) || "<br>") + "</div>").join("");
}

/* ---------- box → Markdown ---------- */
const BLOCK = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|TABLE|TR)$/;
const isBold = (el) => /^(B|STRONG)$/.test(el.tagName) || +el.style?.fontWeight >= 600 || el.style?.fontWeight === "bold";
const isItalic = (el) => /^(I|EM)$/.test(el.tagName) || el.style?.fontStyle === "italic";

// Walks the box and returns its Markdown plus where each node starts and ends
// in it (to turn a selection in the box into a position in the text and back).
export function serialize(root) {
  let md = "";
  const at = new Map(); // node → [start, end]
  let started = false, lineStart = true, needBreak = false;
  let bold = 0, italic = 0;
  const content = (text) => {
    if (needBreak) { md += "\n"; needBreak = false; }
    started = true;
    lineStart = false;
    md += text;
  };
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (needBreak && child.data) content("");
        at.set(child, [md.length, md.length + child.data.length]);
        if (child.data) content(child.data.replace(/ /g, " "));
        continue;
      }
      if (child.nodeType !== 1) continue;
      if (child.dataset.md != null) {
        content("");
        const start = md.length;
        content(child.dataset.md);
        at.set(child, [start, md.length]);
        continue;
      }
      if (child.tagName === "BR") {
        const start = md.length;
        // A <br> at the end of a line only keeps an empty line open.
        if (child !== node.lastChild || !(node === root || BLOCK.test(node.tagName))) {
          if (needBreak) { md += "\n"; needBreak = false; }
          md += "\n";
          started = true;
          lineStart = true;
        }
        at.set(child, [start, md.length]);
        continue;
      }
      if (/^(IMG|SCRIPT|STYLE)$/.test(child.tagName)) continue;
      if (BLOCK.test(child.tagName)) {
        if (started && !lineStart) md += "\n";
        needBreak = false;
        started = true;
        lineStart = true;
        const start = md.length;
        walk(child);
        at.set(child, [start, md.length]);
        lineStart = false;
        needBreak = true;
        continue;
      }
      const b = isBold(child) && !bold, i = !b && isItalic(child) && !italic;
      const inner = child.textContent.trim() !== "" || child.querySelector("[data-md]");
      if ((b || i) && inner) {
        content(b ? "**" : "*");
        b ? bold++ : italic++;
      }
      const start = md.length;
      walk(child);
      at.set(child, [start, md.length]);
      if ((b || i) && inner) {
        content(b ? "**" : "*");
        b ? bold-- : italic--;
      }
    }
  };
  walk(root);
  return { md, at };
}

export const toMarkdown = (root) => serialize(root).md;

// A point in the box (node, offset) → a position in the Markdown text.
function offsetOf(root, map, node, offset) {
  if (!root.contains(node)) return null;
  if (node.nodeType === 3) {
    const [s] = map.get(node) || [0];
    return s + Math.min(offset, node.data.length);
  }
  for (let n = node; n && n !== root; n = n.parentNode) {
    if (n.dataset?.md != null) return map.get(n)?.[1] ?? 0;
  }
  const kids = node.childNodes;
  if (offset < kids.length) {
    const kid = kids[offset];
    return map.get(kid)?.[0] ?? 0;
  }
  return node === root ? serializeLength(map, root) : map.get(node)?.[1] ?? 0;
}
const serializeLength = (map, root) => {
  let end = 0;
  for (const [n, [, e]] of map) if (root.contains(n)) end = Math.max(end, e);
  return end;
};

// A position in the Markdown text → a point in the box.
function pointAt(root, map, pos) {
  let best = null;
  for (const [node, [s, e]] of map) {
    if (node.nodeType === 3 && pos >= s && pos <= e) {
      // Prefer the text node where the position is inside, not at the edge of a line.
      if (!best || (pos < e && best.atEnd)) best = { node, offset: pos - s, atEnd: pos === e };
    }
  }
  if (best) return best;
  // After an atom or on an empty line.
  let after = null;
  for (const [node, [s, e]] of map) {
    if (node.nodeType === 1 && node.dataset.md != null && e === pos) after = node;
  }
  if (after) return { node: after.parentNode, offset: [...after.parentNode.childNodes].indexOf(after) + 1 };
  for (const [node, [s]] of map) {
    if (node.nodeType === 1 && node.tagName === "DIV" && s === pos && !node.textContent) return { node, offset: 0 };
  }
  return { node: root, offset: root.childNodes.length };
}

/* ---------- the box ---------- */
// (Guarded so the Markdown → HTML part can be tested outside a browser.)
const valueDesc = globalThis.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
const boxes = new WeakMap(); // textarea → box

export const boxOf = (textarea) => boxes.get(textarea);
// The textarea behind an element inside a rich box (or the element itself).
export const fieldOf = (el) => el?.closest?.(".rich")?.richField || el;

export function attachRich(ta, { oneLine = ta.classList.contains("grow") } = {}) {
  if (boxes.has(ta) || !ta.isConnected) return boxes.get(ta);
  const box = document.createElement("div");
  box.className = [...ta.classList].filter((c) => c !== "rich-src").join(" ") + " rich";
  box.contentEditable = "true";
  box.spellcheck = ta.spellcheck;
  box.setAttribute("role", "textbox");
  if (!oneLine) box.setAttribute("aria-multiline", "true");
  for (const a of ["aria-label", "enterkeyhint"]) if (ta.hasAttribute(a)) box.setAttribute(a, ta.getAttribute(a));
  if (ta.id) box.dataset.for = ta.id;
  box.richField = ta;
  const rows = +ta.getAttribute("rows") || 1;
  if (!oneLine && rows > 2) box.style.minHeight = `calc(${rows} * 1.6em + 20px)`;
  ta.classList.add("rich-src");
  ta.tabIndex = -1;
  ta.after(box);

  const raw = () => valueDesc.get.call(ta);
  let sel = { start: raw().length, end: raw().length };
  let last = null; // the Markdown the box was last rendered from or read as

  const placeholder = () => { box.dataset.placeholder = ta.getAttribute("placeholder") || ""; };
  const paintEmpty = () => box.classList.toggle("is-empty", !raw());
  const render = () => {
    box.innerHTML = toHtml(raw(), oneLine);
    last = raw();
    paintEmpty();
  };
  const place = () => {
    if (document.activeElement !== box) return;
    const { at } = serialize(box);
    const a = pointAt(box, at, sel.start);
    const b = sel.end === sel.start ? a : pointAt(box, at, sel.end);
    const range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch { return; }
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(range);
  };
  // Box → textarea, after typing.
  const pull = () => {
    let md = toMarkdown(box);
    if (oneLine && /\n/.test(md)) {
      md = md.replace(/\s*\n+\s*/g, " ");
      valueDesc.set.call(ta, md);
      render();
    } else valueDesc.set.call(ta, md);
    last = md;
    paintEmpty();
    readSelection();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const readSelection = () => {
    const s = getSelection();
    if (!s.rangeCount || !box.contains(s.anchorNode)) return;
    const { at } = serialize(box);
    const r = s.getRangeAt(0);
    const a = offsetOf(box, at, r.startContainer, r.startOffset);
    const b = offsetOf(box, at, r.endContainer, r.endOffset);
    if (a != null && b != null) sel = { start: Math.min(a, b), end: Math.max(a, b) };
  };

  // The textarea's editing API, passed through to the box.
  Object.defineProperties(ta, {
    value: {
      configurable: true,
      get: raw,
      set(v) {
        valueDesc.set.call(ta, v);
        if (raw() !== last) render();
        sel = { start: Math.min(sel.start, raw().length), end: Math.min(sel.end, raw().length) };
        if (v === "") sel = { start: 0, end: 0 };
      },
    },
    selectionStart: { configurable: true, get: () => sel.start, set: (v) => { sel.start = v; } },
    selectionEnd: { configurable: true, get: () => sel.end, set: (v) => { sel.end = v; } },
  });
  ta.setSelectionRange = (s, e = s) => { sel = { start: s, end: e }; place(); };
  ta.select = () => { sel = { start: 0, end: raw().length }; place(); };
  ta.setRangeText = (text, s = sel.start, e = sel.end, mode = "preserve") => {
    const v = raw();
    valueDesc.set.call(ta, v.slice(0, s) + text + v.slice(e));
    render();
    const end = s + text.length;
    if (mode === "select") sel = { start: s, end };
    else if (mode === "start") sel = { start: s, end: s };
    else if (mode === "end") sel = { start: end, end };
    place();
  };
  ta.focus = () => { box.focus({ preventScroll: false }); place(); };
  ta.blur = () => box.blur();

  render();
  placeholder();
  new MutationObserver(placeholder).observe(ta, { attributes: true, attributeFilter: ["placeholder"] });

  box.addEventListener("input", (e) => {
    e.stopPropagation(); // the form hears it from the textarea instead
    pull();
  });
  let changedSinceFocus = false;
  ta.addEventListener("input", () => { changedSinceFocus = true; });
  box.addEventListener("focus", () => { changedSinceFocus = false; box.classList.add("focus"); });
  box.addEventListener("blur", () => {
    box.classList.remove("focus");
    if (changedSinceFocus) ta.dispatchEvent(new Event("change", { bubbles: true }));
  });
  box.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && /^[bi]$/i.test(e.key)) {
      e.preventDefault();
      document.execCommand(e.key.toLowerCase() === "b" ? "bold" : "italic");
      return;
    }
    if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
    if (oneLine) {
      // Enter in a one-line box means "add this entry": the page listens on the textarea.
      e.preventDefault();
      ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey }));
    } else if (e.metaKey || e.ctrlKey) {
      ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, metaKey: e.metaKey, ctrlKey: e.ctrlKey }));
    }
  });
  box.addEventListener("paste", (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    if ([...cd.items].some((i) => i.kind === "file")) {
      // Images are handled by the editor (enableImages) where it is set up.
      if (!box.closest("[data-images]")) e.preventDefault();
      return;
    }
    e.preventDefault();
    let text = cd.getData("text/plain");
    if (oneLine) text = text.replace(/\s*\r?\n+\s*/g, " ");
    document.execCommand("insertText", false, text.replace(/\r\n?/g, "\n"));
  });
  box.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) return;
    const text = e.dataTransfer?.getData("text/plain");
    if (text == null) return;
    e.preventDefault();
    const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (pos) { const s = getSelection(); s.removeAllRanges(); s.addRange(pos); }
    document.execCommand("insertText", false, oneLine ? text.replace(/\s*\n+\s*/g, " ") : text);
  });
  // Clicking a term or an image selects it whole, so it can be deleted or replaced.
  box.addEventListener("click", (e) => {
    const a = e.target.closest?.("[data-md]");
    if (!a || !box.contains(a)) return;
    e.preventDefault();
    e.stopPropagation();
    const r = document.createRange();
    r.selectNode(a);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, true);

  boxes.set(ta, { box, render, readSelection });
  return boxes.get(ta);
}

// Keeps each box's selection known while the user moves around in it, so
// toolbar buttons (bold, term, image) act where the cursor was.
globalThis.document?.addEventListener("selectionchange", () => {
  const s = getSelection();
  const n = s.rangeCount ? s.anchorNode : null;
  const box = (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.(".rich");
  if (box?.richField) boxes.get(box.richField)?.readSelection();
});
