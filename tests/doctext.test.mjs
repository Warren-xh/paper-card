import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import * as D from "../js/doctext.mjs";

const terms = [
  { term: "CoH", zh: "后见之链", en: "Chain of Hindsight", def: "" },
  { term: "AD", zh: "算法蒸馏", en: "Algorithm Distillation", def: "" },
  { term: "ReAct", zh: "", en: "", def: "" },
];

test("which files hold text", () => {
  assert.equal(D.fileKind("papers/a.pdf"), "pdf");
  assert.equal(D.fileKind("materials/c/l/课件.PPTX"), "pptx");
  assert.equal(D.fileKind("x/讲义.docx"), "docx");
  assert.equal(D.fileKind("code/x/main.py"), "plain");
  assert.equal(D.fileKind("materials/c/l/图.png"), "");
  assert.equal(D.needsSavedText("code/x/main.py"), false);
  assert.equal(D.textPath("code/x/课件.pdf"), "data/texts/code/x/课件.pdf.json");
});

test("text from PDFs is tidied: Chinese lines joined, spaces collapsed", () => {
  assert.equal(D.normalizeText("后见\n之链  is a   method\r\n\n\n\nnext-\nline"), "后见之链 is a method\n\nnextline");
});

test("terms are found by name, Chinese or English, as whole words", () => {
  const text = "We use Chain of\nHindsight (CoH) and ReAct agents. 后见之链很有用。Loading made AD better; AD again.";
  const found = D.termsInText(D.normalizeText(text), terms);
  assert.deepEqual(found.map((f) => [f.entry.term, f.count]), [["CoH", 3], ["AD", 2], ["ReAct", 1]]);
  assert.match(found.find((f) => f.entry.term === "ReAct").context, /【ReAct】 agents/);
  assert.deepEqual(D.termsInText("", terms), []);
  assert.deepEqual(D.termsInText("nothing here", []), []);
});

// A small .zip like a PowerPoint file: one stored and one deflated entry.
function zip(entries) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text, deflate] of entries) {
    const raw = enc.encode(text);
    const data = deflate ? deflateRawSync(raw) : raw;
    const n = enc.encode(name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(deflate ? 8 : 0, 8);
    head.writeUInt32LE(data.length, 18); head.writeUInt32LE(raw.length, 22); head.writeUInt16LE(n.length, 26);
    locals.push(head, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(deflate ? 8 : 0, 10);
    c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

test("text from PowerPoint and Word files", async () => {
  const pptx = zip([
    ["ppt/slides/slide2.xml", "<p:sld><a:p><a:r><a:t>第二页 ReAct</a:t></a:r></a:p></p:sld>", true],
    ["ppt/slides/slide1.xml", "<p:sld><a:p><a:r><a:t>Chain of </a:t></a:r><a:r><a:t>Hindsight &amp; more</a:t></a:r></a:p></p:sld>", false],
    ["ppt/media/image1.png", "not text", false],
  ]);
  assert.equal(await D.extractText(pptx, "materials/c/l/课件.pptx"), "Chain of Hindsight & more\n\n第二页 ReAct");
  const docx = zip([["word/document.xml", '<w:body><w:p><w:r><w:t xml:space="preserve">后见之链 </w:t></w:r><w:r><w:t>CoH</w:t></w:r></w:p></w:body>', true]]);
  assert.equal(await D.extractText(docx, "x/讲义.docx"), "后见之链 CoH");
  assert.equal(await D.extractText(new TextEncoder().encode("# ReAct\nprint(1)"), "code/a.py"), "# ReAct\nprint(1)");
  assert.equal(await D.extractText(new Uint8Array([1, 2]), "a.png"), "");
});
