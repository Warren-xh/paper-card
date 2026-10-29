// Minimal GitHub client. Every save is ONE commit made through the Git Data
// API, so an entry, the index and any images always land together.


export function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToUtf8(text) {
  const bytes = Uint8Array.from(atob(text.replace(/\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const MESSAGES = {
  401: "GitHub 令牌已失效或被撤销，请到设置页更换令牌。",
  403: "GitHub 拒绝了请求：请确认令牌对这个仓库有 Contents 读写权限，或稍后再试。",
  404: "找不到仓库或文件，请确认令牌授权了这个仓库。",
  409: "仓库暂时冲突，请重试。",
  422: "GitHub 没有接受这次保存。",
};

export class GitHubClient {
  #token = "";
  #fetch;
  constructor(repo, branch = "main", fetcher = globalThis.fetch, apiBase = "https://api.github.com") {
    this.repo = repo;
    this.apiBase = apiBase;
    this.branch = branch;
    this.#fetch = fetcher.bind(globalThis);
  }
  get unlocked() {
    return !!this.#token;
  }
  setToken(token) {
    this.#token = token || "";
  }

  async api(path, { method = "GET", body, auth = true, timeout = 30000 } = {}) {
    const headers = { Accept: "application/vnd.github+json" };
    if (auth && this.#token) {
      headers.Authorization = "Bearer " + this.#token;
      headers["X-GitHub-Api-Version"] = "2022-11-28";
    }
    if (body) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await this.#fetch(this.apiBase + path, {
        method,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeout),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw new GitHubError(
        error?.name === "TimeoutError"
          ? "连接 GitHub 超时，草稿仍保存在本机。"
          : "无法连接 GitHub，草稿仍保存在本机。",
        0,
      );
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new GitHubError(
        MESSAGES[response.status] ||
          "GitHub 请求失败（" + response.status + "）。",
        response.status,
      );
    return data;
  }

  repoPath(rest) {
    return "/repos/" + this.repo + rest;
  }

  // Confirms the token can write to this repository.
  async checkAccess() {
    const info = await this.api(this.repoPath(""));
    if (!info?.permissions?.push)
      throw new GitHubError("这个令牌没有写入权限。", 403);
    return info;
  }

  // Reads another repository from GitHub itself (also in the local preview):
  // with the token when it has access, without it otherwise (public repos).
  async publicApi(path) {
    const call = async (auth) => {
      const headers = { Accept: "application/vnd.github+json" };
      if (auth) {
        headers.Authorization = "Bearer " + this.#token;
        headers["X-GitHub-Api-Version"] = "2022-11-28";
      }
      try {
        return await this.#fetch("https://api.github.com" + path, { headers, cache: "no-store", signal: AbortSignal.timeout(20000) });
      } catch {
        throw new GitHubError("无法连接 GitHub。", 0);
      }
    };
    let res = this.#token ? await call(true) : null;
    if (!res || [401, 403, 404].includes(res.status)) res = await call(false);
    const data = await res.json().catch(() => null);
    if (!res.ok)
      throw new GitHubError(
        res.status === 404 ? "找不到：仓库可能是私有的，或者地址写错了。"
          : res.status === 403 || res.status === 429 ? "GitHub 暂时不让读取（每小时的次数用完了），稍后再试。"
          : "GitHub 请求失败（" + res.status + "）。",
        res.status,
      );
    return data;
  }

  // When each save was made since `since` (newest first), for the activity calendar.
  async commitDates(since, maxPages = 10) {
    const dates = [];
    for (let page = 1; page <= maxPages; page++) {
      const list = await this.api(
        this.repoPath("/commits?sha=" + encodeURIComponent(this.branch) + "&since=" + encodeURIComponent(since) + "&per_page=100&page=" + page),
        { timeout: 15000 },
      );
      if (!Array.isArray(list)) break;
      for (const c of list) {
        const date = c?.commit?.author?.date || c?.commit?.committer?.date;
        if (date) dates.push(date);
      }
      if (list.length < 100) break;
    }
    return dates;
  }

  async headSha() {
    const ref = await this.api(
      this.repoPath("/git/ref/heads/" + encodeURIComponent(this.branch)),
    );
    return ref.object.sha;
  }

  // Reads a text file at a given commit (or the branch head). Returns null
  // when the file does not exist.
  async readText(path, ref, { auth = true } = {}) {
    try {
      const file = await this.api(
        this.repoPath(
          "/contents/" +
            path.split("/").map(encodeURIComponent).join("/") +
            "?ref=" +
            encodeURIComponent(ref || this.branch),
        ),
        { auth },
      );
      if (Array.isArray(file) || file.type !== "file") return null;
      if (file.content) return base64ToUtf8(file.content);
      // Files over 1 MB come back without inline content.
      const blob = await this.api(this.repoPath("/git/blobs/" + file.sha), {
        auth,
      });
      return base64ToUtf8(blob.content);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async readJSON(path, ref, options) {
    const text = await this.readText(path, ref, options);
    return text == null ? null : JSON.parse(text);
  }

  // files: [{ path, text } | { path, base64 } | { path, remove: true }]
  async commit(files, message, parent) {
    const base = parent || (await this.headSha());
    const baseCommit = await this.api(this.repoPath("/git/commits/" + base));
    const tree = [];
    for (const file of files) {
      if (file.remove) {
        tree.push({ path: file.path, mode: "100644", type: "blob", sha: null });
      } else if (file.base64 != null) {
        // Large files (paper PDFs) get more time to upload.
        const blob = await this.api(this.repoPath("/git/blobs"), {
          method: "POST",
          body: { content: file.base64, encoding: "base64" },
          timeout: 30000 + Math.ceil(file.base64.length / 20),
        });
        tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
      } else {
        tree.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.text,
        });
      }
    }
    const newTree = await this.api(this.repoPath("/git/trees"), {
      method: "POST",
      body: { base_tree: baseCommit.tree.sha, tree },
    });
    const commit = await this.api(this.repoPath("/git/commits"), {
      method: "POST",
      body: { message, tree: newTree.sha, parents: [base] },
    });
    await this.api(
      this.repoPath("/git/refs/heads/" + encodeURIComponent(this.branch)),
      { method: "PATCH", body: { sha: commit.sha, force: false } },
    );
    return commit.sha;
  }

  // Runs build(headSha) → { files, message } and commits on top of the latest
  // head. If another device saved in between, it rebuilds and retries.
  async commitLatest(build, attempts = 4) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      const head = await this.headSha();
      const { files, message } = await build(head);
      try {
        return await this.commit(files, message, head);
      } catch (error) {
        lastError = error;
        if (error.status !== 422 && error.status !== 409) throw error;
      }
    }
    throw lastError || new GitHubError("保存失败，请重试。", 0);
  }
}
