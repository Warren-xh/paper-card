// Local preview server.
//   node scripts/serve.mjs          → static preview at http://127.0.0.1:4180
//   node scripts/serve.mjs --mock   → also simulates the GitHub API in memory,
//     so publishing can be tried end to end at http://127.0.0.1:4180/?mock
//     Nothing is sent to GitHub; all mock commits vanish when the server stops.
import http from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 4180;
const mock = process.argv.includes("--mock");
const types = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".md": "text/markdown" };

/* ---------- in-memory git used by --mock ---------- */
const objects = new Map(); // sha → { type, ... }
const sha = (text) => createHash("sha1").update(text).digest("hex");
const putBlob = (buf) => { const id = sha("blob" + buf.toString("base64")); objects.set(id, { type: "blob", buf }); return id; };
const putTree = (files) => { const id = sha("tree" + JSON.stringify([...files].sort())); objects.set(id, { type: "tree", files: new Map(files) }); return id; };
let head;

async function seed() {
  const files = new Map();
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const full = join(dir, name);
      if ((await stat(full)).isDirectory()) await walk(full);
      else files.set(relative(root, full), putBlob(await readFile(full)));
    }
  }
  await walk(root);
  const tree = putTree(files);
  head = sha("commit-root");
  objects.set(head, { type: "commit", tree, parents: [], message: "seed" });
}

const body = (req) => new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d ? JSON.parse(d) : {})); });
const json = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify(data)); };

async function mockApi(req, res, path) {
  const auth = req.headers.authorization || "";
  const authed = /^Bearer github_pat_/.test(auth);
  const m = path.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!m) return json(res, 404, { message: "Not Found" });
  const rest = m[3] || "";
  const method = req.method;
  if (method !== "GET" && !authed) return json(res, 401, { message: "Bad credentials" });
  if (rest === "") return authed ? json(res, 200, { full_name: m[1] + "/" + m[2], permissions: { push: true } }) : json(res, 200, { full_name: m[1] + "/" + m[2] });
  if (rest.startsWith("/git/ref/heads/")) return json(res, 200, { object: { sha: head } });
  if (rest.startsWith("/git/refs/heads/") && method === "PATCH") {
    const b = await body(req);
    const commit = objects.get(b.sha);
    if (!commit || commit.parents[0] !== head) return json(res, 422, { message: "Update is not a fast forward" });
    head = b.sha;
    console.log("  mock commit:", commit.message);
    return json(res, 200, { object: { sha: head } });
  }
  if (rest.startsWith("/git/commits/") && method === "GET") {
    const c = objects.get(rest.slice(13));
    return c ? json(res, 200, { sha: rest.slice(13), tree: { sha: c.tree } }) : json(res, 404, {});
  }
  if (rest === "/git/blobs" && method === "POST") {
    const b = await body(req);
    return json(res, 201, { sha: putBlob(Buffer.from(b.content, b.encoding === "base64" ? "base64" : "utf8")) });
  }
  if (rest.startsWith("/git/blobs/")) {
    const blob = objects.get(rest.slice(11));
    return blob ? json(res, 200, { content: blob.buf.toString("base64"), encoding: "base64" }) : json(res, 404, {});
  }
  if (rest === "/git/trees" && method === "POST") {
    const b = await body(req);
    const files = new Map(objects.get(b.base_tree).files);
    for (const t of b.tree) {
      if (t.sha === null) files.delete(t.path);
      else files.set(t.path, t.content != null ? putBlob(Buffer.from(t.content)) : t.sha);
    }
    return json(res, 201, { sha: putTree(files) });
  }
  if (rest === "/git/commits" && method === "POST") {
    const b = await body(req);
    const id = sha("commit" + b.tree + b.parents.join() + Date.now() + Math.random());
    objects.set(id, { type: "commit", tree: b.tree, parents: b.parents, message: b.message });
    return json(res, 201, { sha: id });
  }
  if (rest.startsWith("/contents/") && method === "GET") {
    const url = new URL("http://x" + rest);
    const file = decodeURIComponent(url.pathname.slice(10));
    const ref = url.searchParams.get("ref");
    const commit = objects.get(ref && objects.has(ref) ? ref : head);
    const blobSha = objects.get(commit.tree).files.get(file);
    if (!blobSha) return json(res, 404, { message: "Not Found" });
    return json(res, 200, { type: "file", sha: blobSha, content: objects.get(blobSha).buf.toString("base64") });
  }
  return json(res, 404, { message: "Not Found" });
}

// In mock mode, static data files are served from the mock repository so the
// public view reflects mock commits, like GitHub Pages would after a rebuild.
function mockStatic(path) {
  const files = objects.get(objects.get(head).tree).files;
  const id = files.get(path);
  return id ? objects.get(id).buf : null;
}

if (mock) await seed();

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (mock && path.startsWith("/__mock_github")) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH" });
        return res.end();
      }
      return mockApi(req, res, path.slice("/__mock_github".length));
    }
    if (path.endsWith("/")) path += "index.html";
    const rel = normalize(path).replace(/^\/+/, "");
    if (rel.startsWith("..")) { res.writeHead(403); return res.end(); }
    try {
      const data = (mock && (rel.startsWith("data/") || rel.startsWith("uploads/")) && mockStatic(rel)) || (await readFile(join(root, rel)));
      res.writeHead(200, { "Content-Type": (types[extname(rel)] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`文献卡片预览：http://127.0.0.1:${port}/${mock ? "?mock（模拟 GitHub，不会真的发布）" : ""}`));
