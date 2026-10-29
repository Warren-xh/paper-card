// GitHub links in practice logs: a commit, a pull request, a comparison of two
// commits or a whole repository. The log page shows what each one changed.

const NAME = String.raw`[A-Za-z0-9_.-]+`;
const SHA = String.raw`[0-9a-f]{7,40}`;

// Any of: github.com/o/r/commit/sha, …/pull/12, …/compare/a...b, github.com/o/r,
// or the short forms o/r@sha and o/r#12. Returns null for anything else.
export function parseGitHubLink(input) {
  const s = String(input || "").trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, (m) => (/^#\d+$/.test(m) ? m : ""));
  let m;
  if ((m = s.match(new RegExp(`^github\\.com/(${NAME})/(${NAME})/commit/(${SHA})(?:[/.].*)?$`, "i"))))
    return make("commit", m[1], m[2], { sha: m[3].toLowerCase() });
  if ((m = s.match(new RegExp(`^github\\.com/(${NAME})/(${NAME})/pull/(\\d+)(?:/.*)?$`, "i")))) return make("pull", m[1], m[2], { number: +m[3] });
  // Branch names may contain "/" (main...feature/login).
  if ((m = s.match(new RegExp(`^github\\.com/(${NAME})/(${NAME})/compare/(.+?)(\\.{2,3})(.+?)/?$`, "i"))))
    return make("compare", m[1], m[2], { base: decodeRef(m[3]), head: decodeRef(m[5]) });
  if ((m = s.match(new RegExp(`^github\\.com/(${NAME})/(${NAME})(?:\\.git)?(?:/(?:tree|blob|commits)/.*)?/?$`, "i")))) return make("repo", m[1], m[2], {});
  if ((m = s.match(new RegExp(`^(${NAME})/(${NAME})@(${SHA})$`, "i")))) return make("commit", m[1], m[2], { sha: m[3].toLowerCase() });
  if ((m = s.match(new RegExp(`^(${NAME})/(${NAME})#(\\d+)$`, "i")))) return make("pull", m[1], m[2], { number: +m[3] });
  return null;
}

// A branch or tag as written in an address ("%2F" and the like decoded when possible).
const decodeRef = (ref) => { try { return decodeURIComponent(ref); } catch { return ref; } };
// …and back into an address, keeping "/" readable.
const encodeRef = (ref) => ref.split("/").map(encodeURIComponent).join("/");

function make(kind, owner, repo, rest) {
  repo = repo.replace(/\.git$/i, "");
  const base = `https://github.com/${owner}/${repo}`;
  const url = kind === "commit" ? `${base}/commit/${rest.sha}` : kind === "pull" ? `${base}/pull/${rest.number}` : kind === "compare" ? `${base}/compare/${encodeRef(rest.base)}...${encodeRef(rest.head)}` : base;
  return { kind, owner, repo, ...rest, url };
}

export const shortSha = (sha) => String(sha || "").slice(0, 7);

// A short label: "owner/repo@abc1234", "owner/repo#12", "owner/repo a…b", "owner/repo".
export function linkLabel(g) {
  const r = g.owner + "/" + g.repo;
  return g.kind === "commit" ? r + "@" + shortSha(g.sha) : g.kind === "pull" ? r + "#" + g.number : g.kind === "compare" ? `${r} ${g.base}…${g.head}` : r;
}

// The GitHub API calls that describe a link (the first one is the main one).
export function apiPaths(g) {
  const r = `/repos/${g.owner}/${g.repo}`;
  if (g.kind === "commit") return [`${r}/commits/${g.sha}`];
  if (g.kind === "pull") return [`${r}/pulls/${g.number}`, `${r}/pulls/${g.number}/files?per_page=100`];
  if (g.kind === "compare") return [`${r}/compare/${encodeRef(g.base)}...${encodeRef(g.head)}`];
  return [r, `${r}/commits?per_page=6`];
}

const files = (list) =>
  (Array.isArray(list) ? list : []).map((f) => ({
    name: String(f.filename || ""),
    previous: f.previous_filename ? String(f.previous_filename) : "",
    status: String(f.status || "modified"),
    additions: f.additions | 0,
    deletions: f.deletions | 0,
    patch: typeof f.patch === "string" ? f.patch : null,
  }));
const firstLine = (s) => String(s || "").split("\n")[0].trim();
const sum = (fs, k) => fs.reduce((t, f) => t + f[k], 0);

// The API answers for a link, reduced to what the page shows.
export function summarize(g, [main, extra]) {
  if (g.kind === "commit") {
    const fs = files(main.files);
    return {
      title: firstLine(main.commit?.message) || shortSha(g.sha),
      body: String(main.commit?.message || "").split("\n").slice(1).join("\n").trim(),
      who: main.commit?.author?.name || main.author?.login || "",
      when: main.commit?.author?.date || "",
      additions: main.stats?.additions ?? sum(fs, "additions"),
      deletions: main.stats?.deletions ?? sum(fs, "deletions"),
      files: fs,
    };
  }
  if (g.kind === "pull") {
    const fs = files(extra);
    return {
      title: String(main.title || "#" + g.number),
      body: "",
      who: main.user?.login || "",
      when: main.merged_at || main.created_at || "",
      state: main.merged_at ? "merged" : main.state || "",
      additions: main.additions ?? sum(fs, "additions"),
      deletions: main.deletions ?? sum(fs, "deletions"),
      files: fs,
    };
  }
  if (g.kind === "compare") {
    const fs = files(main.files);
    return {
      title: `${g.base} → ${g.head}`,
      body: "",
      who: "",
      when: main.commits?.at?.(-1)?.commit?.author?.date || "",
      commits: (main.commits || []).map((c) => ({ sha: c.sha, title: firstLine(c.commit?.message) })),
      additions: sum(fs, "additions"),
      deletions: sum(fs, "deletions"),
      files: fs,
    };
  }
  return {
    title: main.full_name || g.owner + "/" + g.repo,
    body: String(main.description || ""),
    who: "",
    when: main.pushed_at || "",
    stars: main.stargazers_count ?? null,
    language: main.language || "",
    commits: (Array.isArray(extra) ? extra : []).map((c) => ({ sha: c.sha, title: firstLine(c.commit?.message), when: c.commit?.author?.date || "" })),
    additions: 0,
    deletions: 0,
    files: [],
  };
}

// A patch as lines to colour: "hunk" (@@ … @@), "add", "del", "ctx" or "note".
export function diffLines(patch, max = 400) {
  const all = String(patch || "").split("\n");
  if (all.at(-1) === "") all.pop();
  const lines = all.slice(0, max).map((text) => ({
    type: text.startsWith("@@") ? "hunk" : text.startsWith("+") ? "add" : text.startsWith("-") ? "del" : text.startsWith("\\") ? "note" : "ctx",
    text,
  }));
  return { lines, more: Math.max(0, all.length - max) };
}

// Five little squares like GitHub's: how much was added versus removed.
export function changeBar(additions, deletions) {
  const total = additions + deletions;
  if (!total) return ["none", "none", "none", "none", "none"];
  const add = Math.round((additions / total) * 5);
  return Array.from({ length: 5 }, (_, i) => (i < add ? "add" : "del"));
}

// Cleans the stored list of links: valid ones only, each once, at most 30.
// A commit written with a short and a full hash counts once (the full one is kept).
export function normalizeLinks(raw) {
  const out = new Map();
  for (const u of Array.isArray(raw) ? raw : []) {
    const g = parseGitHubLink(u);
    if (!g) continue;
    const key = g.kind === "commit" ? `${g.owner}/${g.repo}@${g.sha.slice(0, 7)}`.toLowerCase() : g.url.toLowerCase();
    const had = out.get(key);
    if (!had || (g.kind === "commit" && g.sha.length > had.sha.length)) out.set(key, g);
  }
  return [...out.values()].map((g) => g.url).slice(0, 30);
}
