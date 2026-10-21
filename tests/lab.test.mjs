import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/lab.mjs";

const ID = "20261021-pytorch-ab12";
const log = (extra = {}) => L.normalizeLog({ id: ID, ...extra });

test("practice log ids and cleaning", () => {
  assert.match(L.newLogId("2026-10-21", "PyTorch DDP 多卡训练"), /^20261021-pytorch-[a-z0-9]{4}$/);
  assert.match(L.newLogId("2026-10-21", "复现实验"), /^20261021-log-[a-z0-9]{4}$/);
  const l = log({
    title: "  跑通 DDP ",
    date: "2026-10-21",
    status: "weird",
    hours: "2.25",
    tags: "PyTorch, 训练",
    link: "javascript:alert(1)",
    steps: [
      { type: "▶", time: "14:05", text: " torchrun --nproc 2 " },
      { type: "bogus", time: "25:99", text: "x" },
      { type: "✗", text: "" },
    ],
    papers: [ID, "20261019-bert-demo", "bad id"],
  });
  assert.equal(l.title, "跑通 DDP");
  assert.equal(l.status, "doing");
  assert.equal(l.hours, 2.3);
  assert.deepEqual(l.tags, ["PyTorch", "训练"]);
  assert.equal(l.link, "");
  assert.deepEqual(l.steps, [
    { type: "▶", time: "14:05", text: "torchrun --nproc 2", solve: false, answer: "" },
    { type: "✎", time: "", text: "x", solve: false, answer: "" },
  ]);
  assert.deepEqual(l.papers, [ID, "20261019-bert-demo"]);
  assert.throws(() => L.normalizeLog({ id: "nope" }));
  assert.match(L.nowTime(new Date(2026, 9, 21, 9, 5)), /^09:05$/);
});

test("open steps, index, search and stats", () => {
  const a = log({
    id: "20261020-ddp-aaaa", title: "DDP", date: "2026-10-20", status: "done", hours: 2, project: "毕设", tags: ["PyTorch"],
    conclusion: "两卡加速 1.8 倍", papers: ["20261019-bert-demo"],
    steps: [
      { type: "✗", text: "NCCL timeout", solve: true, answer: "设 NCCL_P2P_DISABLE=1" },
      { type: "✗", text: "显存不够", solve: true },
      { type: "✓", text: "跑通" },
    ],
  });
  const b = log({ id: "20261021-lora-bbbb", title: "LoRA 微调", date: "2026-10-21", hours: 1.5 });
  assert.deepEqual(L.openSteps(a).map((s) => s.text), ["显存不够"]);
  let idx = L.emptyIndex();
  idx = L.upsertIndex(idx, a);
  idx = L.upsertIndex(idx, b);
  idx = L.upsertIndex(idx, { ...b, title: "LoRA 微调 v2" });
  assert.deepEqual(idx.logs.map((x) => x.title), ["LoRA 微调 v2", "DDP"]);
  const s0 = idx.logs[1];
  assert.equal(s0.errors, 2);
  assert.equal(s0.open, 1);
  assert.equal(L.search(idx.logs, { query: "nccl" }).length, 1);
  assert.equal(L.search(idx.logs, { query: "p2p_disable" }).length, 1);
  assert.equal(L.search(idx.logs, { status: "open" }).length, 1);
  assert.equal(L.search(idx.logs, { status: "doing" })[0].id, "20261021-lora-bbbb");
  assert.equal(L.search(idx.logs, { tag: "pytorch", project: "毕设" }).length, 1);
  assert.deepEqual(L.logsForPaper(idx.logs, "20261019-bert-demo").map((x) => x.id), ["20261020-ddp-aaaa"]);
  const st = L.stats(idx.logs, "2026-10-21");
  assert.deepEqual([st.total, st.doing, st.thisMonth, st.hours, st.open], [2, 1, 2, 3.5, 1]);
  assert.equal(L.removeFromIndex(idx, "20261020-ddp-aaaa").logs.length, 1);
  assert.deepEqual(L.normalizeIndex({ version: 1, logs: [{ id: "bad" }, { id: ID }] }).logs.map((x) => x.id), [ID]);
  assert.deepEqual(L.normalizeIndex(null), L.emptyIndex());
});

test("practice log markdown export", () => {
  const l = log({
    title: "DDP", date: "2026-10-20", status: "done", hours: 2, env: "PyTorch 2.4 / 2×A100", goal: "两卡跑通",
    conclusion: "加速 1.8 倍",
    steps: [{ type: "✗", time: "14:05", text: "NCCL timeout", solve: true, answer: "关掉 P2P" }, { type: "✓", time: "14:30", text: "跑通" }],
    code: "torchrun --nproc_per_node 2 train.py", papers: ["20261019-bert-demo"],
  });
  const md = L.logToMarkdown(l, new Map([["20261019-bert-demo", "BERT"]]));
  assert.match(md, /^# 2026-10-20 · DDP\n\n状态：完成 ｜ 用时：2 小时 ｜ 环境：PyTorch 2.4 \/ 2×A100/);
  assert.match(md, /> \*\*结论\*\*：加速 1.8 倍/);
  assert.match(md, /## 过程\n- 14:05 ✗ NCCL timeout\n {2}→ 关掉 P2P\n- 14:30 ✓ 跑通/);
  assert.match(md, /## 关键代码 \/ 命令\ntorchrun/);
  assert.match(md, /## 相关论文\n- BERT/);
});
