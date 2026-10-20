// Small, safe Markdown renderer. All text is HTML-escaped before any markup is
// added, so user content can never inject tags or scripts.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// resolveImage lets the app map not-yet-published uploads to local previews.
export function safeHref(url, { image = false, resolveImage } = {}) {
  const u = String(url || "").trim();
  if (image && resolveImage) {
    const mapped = resolveImage(u);
    if (mapped) return mapped;
  }
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  if (image && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(u)) return u;
  if (/^(\.{0,2}\/)?[\w\-./%]+(#[\w-]*)?$/.test(u) && !/^\/\//.test(u)) return u;
  if (/^#/.test(u)) return u;
  return "";
}

function inline(text, opts) {
  const stash = [];
  const keep = (html) => "\u0000" + (stash.push(html) - 1) + "\u0000";
  let s = String(text);
  // Code spans and math first, so their contents are left untouched.
  s = s.replace(/`([^`\n]+)`/g, (_, code) => keep("<code>" + escapeHtml(code) + "</code>"));
  s = s.replace(/\$\$([^$]+)\$\$/g, (_, m) => keep('<span class="math display">' + escapeHtml(m) + "</span>"));
  s = s.replace(/(^|[^\\$])\$([^$\n]+?)\$(?!\d)/g, (_, pre, m) => pre + keep('<span class="math">' + escapeHtml(m) + "</span>"));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src, title) => {
    const href = safeHref(src, { image: true, resolveImage: opts.resolveImage });
    if (!href) return keep(escapeHtml(alt));
    return keep(
      '<figure class="md-img"><img src="' + escapeHtml(href) + '" alt="' + escapeHtml(alt) + '" loading="lazy">' +
        (alt || title ? "<figcaption>" + escapeHtml(title || alt) + "</figcaption>" : "") + "</figure>",
    );
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = safeHref(url);
    const body = inline(label, opts);
    if (!href) return keep(body);
    const ext = /^https?:/i.test(href);
    return keep('<a href="' + escapeHtml(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + body + "</a>");
  });
  s = s.replace(/(^|[\s(（])(https?:\/\/[^\s<>()（）]+[^\s<>()（）.,;:!?。，；：！？])/g, (_, pre, url) =>
    pre + keep('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + "</a>"),
  );
  s = escapeHtml(s);
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/==([^=]+)==/g, "<mark>$1</mark>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
}

const indentOf = (line) => line.match(/^ */)[0].length;
const LIST_RE = /^( *)([-*+]|\d+[.)])\s+(.*)$/;

function parseList(lines, start, opts) {
  const first = lines[start].match(LIST_RE);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m || m[1].length !== base || /\d/.test(m[2]) !== ordered) break;
    const body = [m[3]];
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        if (i + 1 < lines.length && indentOf(lines[i + 1]) > base && lines[i + 1].trim()) {
          body.push("");
          i++;
          continue;
        }
        break;
      }
      if (indentOf(line) > base) {
        body.push(line.slice(Math.min(indentOf(line), base + 2)));
        i++;
      } else if (!LIST_RE.test(line) && !/^(#{1,6}\s|>|```|\|)/.test(line.trim())) {
        body.push(line.trim()); // lazy continuation
        i++;
      } else break;
    }
    items.push(body);
  }
  const html = items
    .map((body) => {
      let text = body[0];
      let check = "";
      const task = text.match(/^\[( |x|X)\]\s+(.*)$/);
      if (task) {
        check = '<input type="checkbox" disabled' + (task[1] !== " " ? " checked" : "") + "> ";
        text = task[2];
      }
      const rest = body.slice(1);
      const nested = rest.some((l) => l.trim()) ? blocks(rest.join("\n"), opts) : "";
      return "<li" + (task ? ' class="task"' : "") + ">" + check + inline(text, opts) + nested + "</li>";
    })
    .join("");
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const tag = ordered ? "ol" : "ul";
  const attr = ordered && startNum !== 1 ? ' start="' + startNum + '"' : "";
  return { html: "<" + tag + attr + ">" + html + "</" + tag + ">", next: i };
}

const splitRow = (line) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

function blocks(src, opts) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    const fence = t.match(/^(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      i++;
      out.push('<pre><code' + (fence[2] ? ' class="lang-' + escapeHtml(fence[2]) + '"' : "") + ">" + escapeHtml(code.join("\n")) + "</code></pre>");
      continue;
    }
    if (t.startsWith("$$")) {
      const math = [t.slice(2)];
      let closed = t.length > 2 && t.endsWith("$$");
      if (closed) math[0] = t.slice(2, -2);
      i++;
      while (!closed && i < lines.length) {
        const l = lines[i++];
        if (l.trim().endsWith("$$")) {
          math.push(l.trim().slice(0, -2));
          closed = true;
        } else math.push(l);
      }
      out.push('<div class="math display">' + escapeHtml(math.join("\n")) + "</div>");
      continue;
    }
    const heading = t.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length + (opts.shiftHeadings || 0));
      out.push("<h" + level + ">" + inline(heading[2].replace(/\s+#+$/, ""), opts) + "</h" + level + ">");
      i++;
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(t)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (t.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) quote.push(lines[i++].trim().replace(/^>\s?/, ""));
      out.push("<blockquote>" + blocks(quote.join("\n"), opts) + "</blockquote>");
      continue;
    }
    if (LIST_RE.test(line)) {
      const list = parseList(lines, i, opts);
      out.push(list.html);
      i = list.next;
      continue;
    }
    if (t.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(t);
      const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, k) => "<" + tag + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : "") + ">" + inline(c, opts) + "</" + tag + ">";
      out.push(
        '<div class="table-wrap"><table><thead><tr>' + head.map((c, k) => cell("th", c, k)).join("") + "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + head.map((_, k) => cell("td", r[k] || "", k)).join("") + "</tr>").join("") +
          "</tbody></table></div>",
      );
      continue;
    }
    const para = [];
    while (i < lines.length) {
      const l = lines[i];
      const lt = l.trim();
      if (!lt || /^(#{1,6}\s|>|```|~~~|\$\$)/.test(lt) || LIST_RE.test(l) || /^([-*_])(\s*\1){2,}$/.test(lt)) break;
      if (lt.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) break;
      para.push(lt);
      i++;
    }
    out.push("<p>" + para.map((p) => inline(p, opts)).join("<br>") + "</p>");
  }
  return out.join("\n");
}

export function renderMarkdown(src, opts = {}) {
  return blocks(src, opts);
}

// One line of inline markup (bold, italic, code, math, links) without a wrapping <p>.
export function renderInline(src, opts = {}) {
  return inline(String(src || ""), opts);
}

export function hasMath(src) {
  return /\$[^$\n]+\$/.test(String(src || ""));
}
