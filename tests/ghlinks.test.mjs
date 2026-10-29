import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/ghlinks.mjs";
import * as L from "../js/lab.mjs";

test("GitHub links of every kind are recognised", () => {
  const c = G.parseGitHubLink("https://github.com/Warren-xh/paper-card/commit/BF8D1FFA2FD9723EC6E93B79D7D989968676AE18?diff=split");
  assert.deepEqual([c.kind, c.owner, c.repo, c.sha], ["commit", "Warren-xh", "paper-card", "bf8d1ffa2fd9723ec6e93b79d7d989968676ae18"]);
  assert.equal(c.url, "https://github.com/Warren-xh/paper-card/commit/bf8d1ffa2fd9723ec6e93b79d7d989968676ae18");
  assert.equal(G.linkLabel(c), "Warren-xh/paper-card@bf8d1ff");
  assert.equal(G.parseGitHubLink("github.com/a/b/commit/abc1234/file.py").sha, "abc1234");
  const p = G.parseGitHubLink("https://github.com/huggingface/transformers/pull/123/files");
  assert.deepEqual([p.kind, p.number, p.url], ["pull", 123, "https://github.com/huggingface/transformers/pull/123"]);
  const cmp = G.parseGitHubLink("https://github.com/a/b/compare/v1.0..main");
  assert.deepEqual([cmp.kind, cmp.base, cmp.head, cmp.url], ["compare", "v1.0", "main", "https://github.com/a/b/compare/v1.0...main"]);
  const r = G.parseGitHubLink("https://github.com/a/b.git");
  assert.deepEqual([r.kind, r.repo, r.url], ["repo", "b", "https://github.com/a/b"]);
  assert.equal(G.parseGitHubLink("github.com/a/b/tree/main/src").kind, "repo");
  assert.equal(G.parseGitHubLink("a/b@abcdef1").url, "https://github.com/a/b/commit/abcdef1");
  assert.equal(G.parseGitHubLink("a/b#7").url, "https://github.com/a/b/pull/7");
  for (const bad of ["", "https://gitlab.com/a/b", "https://github.com/a", "github.com/a/b/commit/xyz", "hello"]) assert.equal(G.parseGitHubLink(bad), null, bad);
  assert.deepEqual(G.normalizeLinks(["a/b@abcdef1", "https://github.com/a/b/commit/abcdef1", "nope", null]), ["https://github.com/a/b/commit/abcdef1"]);
});

test("API answers become what the log page shows", () => {
  const c = G.parseGitHubLink("a/b@abcdef1");
  assert.deepEqual(G.apiPaths(c), ["/repos/a/b/commits/abcdef1"]);
  const s = G.summarize(c, [{
    commit: { message: "修复：数据加载\n\n更快地读文件", author: { name: "Warren", date: "2026-10-28T10:00:00Z" } },
    stats: { additions: 5, deletions: 2 },
    files: [{ filename: "load.py", status: "modified", additions: 5, deletions: 2, patch: "@@ -1,2 +1,5 @@\n-old\n+new\n ctx\n" }, { filename: "data.bin", status: "added" }],
  }]);
  assert.deepEqual([s.title, s.body, s.who, s.additions, s.deletions, s.files.length], ["修复：数据加载", "更快地读文件", "Warren", 5, 2, 2]);
  assert.equal(s.files[1].patch, null);

  const p = G.parseGitHubLink("a/b#3");
  assert.equal(G.apiPaths(p).length, 2);
  const ps = G.summarize(p, [{ title: "Add tests", user: { login: "w" }, merged_at: "2026-10-01T00:00:00Z", additions: 9, deletions: 1 }, [{ filename: "t.py", additions: 9, deletions: 1, patch: "+x" }]]);
  assert.deepEqual([ps.title, ps.state, ps.files[0].name], ["Add tests", "merged", "t.py"]);

  const r = G.parseGitHubLink("github.com/a/b");
  const rs = G.summarize(r, [{ full_name: "a/b", description: "研究代码", stargazers_count: 3, language: "Python", pushed_at: "2026-10-02" }, [{ sha: "abc1234ffff", commit: { message: "first\nmore", author: { date: "2026-10-01" } } }]]);
  assert.deepEqual([rs.title, rs.body, rs.stars, rs.language, rs.commits[0].title], ["a/b", "研究代码", 3, "Python", "first"]);

  const cmp = G.summarize(G.parseGitHubLink("github.com/a/b/compare/x...y"), [{ commits: [{ sha: "1", commit: { message: "m1" } }], files: [{ filename: "f", additions: 1, deletions: 3 }] }]);
  assert.deepEqual([cmp.title, cmp.additions, cmp.deletions, cmp.commits[0].title], ["x → y", 1, 3, "m1"]);
});

test("patches become coloured lines, long ones are cut", () => {
  const d = G.diffLines("@@ -1 +1 @@\n-a\n+b\n c\n\\ No newline at end of file\n");
  assert.deepEqual(d.lines.map((l) => l.type), ["hunk", "del", "add", "ctx", "note"]);
  assert.equal(d.more, 0);
  const big = G.diffLines(Array.from({ length: 10 }, (_, i) => "+" + i).join("\n"), 4);
  assert.deepEqual([big.lines.length, big.more], [4, 6]);
  assert.deepEqual(G.changeBar(8, 2), ["add", "add", "add", "add", "del"]);
  assert.deepEqual(G.changeBar(0, 0), ["none", "none", "none", "none", "none"]);
});

test("logs keep their GitHub links", () => {
  const l = L.normalizeLog({ id: "20261028-log-ab12", github: ["a/b@abcdef1", "bad", "https://github.com/a/b/pull/2"] });
  assert.deepEqual(l.github, ["https://github.com/a/b/commit/abcdef1", "https://github.com/a/b/pull/2"]);
  assert.deepEqual(L.normalizeLog({ id: "20261028-log-ab12" }).github, []);
  assert.match(L.logToMarkdown({ ...l, title: "T" }, new Map()), /## GitHub 提交\n- https:\/\/github\.com\/a\/b\/commit\/abcdef1/);
});

test("the same commit with a short and a full hash is kept once", () => {
  const full = "bf8d1ffa2fd9723ec6e93b79d7d989968676ae18";
  assert.deepEqual(G.normalizeLinks(["a/b@bf8d1ff", "github.com/a/b/commit/" + full, "github.com/A/B/commit/bf8d1ff"]), ["https://github.com/a/b/commit/" + full]);
});

test("compare links with slashes or escapes in branch names", () => {
  const a = G.parseGitHubLink("https://github.com/a/b/compare/main...feature/login");
  assert.deepEqual([a.base, a.head, a.url], ["main", "feature/login", "https://github.com/a/b/compare/main...feature/login"]);
  const b = G.parseGitHubLink("https://github.com/a/b/compare/main...feature%2Flogin");
  assert.equal(b.url, a.url);
  assert.deepEqual(G.normalizeLinks([b.url]), [a.url]);
  assert.equal(G.apiPaths(a)[0], "/repos/a/b/compare/main...feature/login");
  const c = G.parseGitHubLink("https://github.com/a/b/compare/v1%25...main");
  assert.equal(c.base, "v1%");
  assert.deepEqual(G.normalizeLinks([c.url]), [c.url]);
  assert.equal(G.parseGitHubLink("https://github.com/a/b/compare/v1%E0...main").base, "v1%E0");
});
