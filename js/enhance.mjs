// Site-wide touches that every page shares: an image viewer, code colouring,
// Ctrl+S to save in any editor, and a back-to-top button.
import { escapeHtml as h } from "./markdown.mjs";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- image viewer ---------- */
// Images in notes and lesson materials open large; ← → move between them.
const VIEWABLE = ".md img, .material-images img, .step-view img, .solve-view img, .mark-view img";
let viewer;
function openViewer(images, index) {
  viewer ||= Object.assign(document.createElement("div"), { className: "viewer", hidden: true });
  if (!viewer.isConnected) document.body.append(viewer);
  let i = index;
  const paint = () => {
    const img = images[i];
    const caption = img.alt || img.closest("figure")?.querySelector("figcaption")?.textContent || "";
    viewer.innerHTML = `
      <div class="viewer-top"><span>${images.length > 1 ? `${i + 1} / ${images.length}` : ""}</span>
        <a class="viewer-btn" href="${h(img.src)}" target="_blank" rel="noopener" title="在新标签页打开原图">原图</a>
        <button type="button" class="viewer-btn" data-close aria-label="关闭">×</button></div>
      ${images.length > 1 ? `<button type="button" class="viewer-nav prev" data-step="-1" aria-label="上一张">‹</button><button type="button" class="viewer-nav next" data-step="1" aria-label="下一张">›</button>` : ""}
      <figure><img src="${h(img.currentSrc || img.src)}" alt="${h(caption)}">${caption ? `<figcaption>${h(caption)}</figcaption>` : ""}</figure>`;
  };
  const close = () => { viewer.hidden = true; document.removeEventListener("keydown", onKey, true); document.body.classList.remove("viewing"); };
  const step = (d) => { i = (i + d + images.length) % images.length; paint(); };
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft" && images.length > 1) step(-1);
    else if (e.key === "ArrowRight" && images.length > 1) step(1);
  }
  addEventListener("hashchange", close, { once: true });
  viewer.onclick = (e) => {
    const s = e.target.closest("[data-step]");
    if (s) return step(+s.dataset.step);
    if (e.target.closest("[data-close]") || e.target === viewer || e.target.tagName === "FIGURE") close();
  };
  paint();
  viewer.hidden = false;
  document.body.classList.add("viewing");
  document.addEventListener("keydown", onKey, true);
}

/* ---------- code colouring (highlight.js, loaded only when a page has code) ---------- */
let hljsLoading;
function loadHighlighter() {
  hljsLoading ||= new Promise((resolve, reject) => {
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
    js.onload = resolve;
    js.onerror = reject;
    document.head.append(js);
  });
  return hljsLoading;
}
export async function highlightCode(root = document) {
  const blocks = $$("pre code", root).filter((c) => !c.classList.contains("hljs") && c.textContent.length < 120000 && c.textContent.trim());
  if (!blocks.length) return;
  try {
    await loadHighlighter();
    for (const code of blocks) {
      try { window.hljs.highlightElement(code); } catch {}
    }
  } catch {
    /* code stays readable without colours */
  }
}

/* ---------- set-up ---------- */
export function startEnhancements() {
  document.addEventListener("click", (e) => {
    const img = e.target.closest?.(VIEWABLE);
    if (!img || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const all = $$(VIEWABLE, $("#main")).filter((x) => x.naturalWidth || x.complete);
    openViewer(all.length ? all : [img], Math.max(0, all.indexOf(img)));
  });

  // "预览" shows a PDF inside the page, under its row.
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-preview]");
    if (!b) return;
    const box = b.closest("li, .pdf-block")?.querySelector(".pdf-preview");
    if (!box) return;
    const open = box.hidden;
    box.hidden = !open;
    b.setAttribute("aria-expanded", String(open));
    b.textContent = open ? "收起预览" : "预览";
    if (open && !box.firstChild) box.innerHTML = `<iframe class="pdf-frame" src="${h(b.dataset.preview)}" title="PDF 预览"></iframe>`;
  });

  // Ctrl+S / ⌘S saves whichever editor is open.
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "s") return;
    const save = $("#publish") || $("#saveMap");
    if (!save) return;
    e.preventDefault();
    if (!save.disabled && save.offsetParent) save.click();
  });

  const top = Object.assign(document.createElement("button"), { type: "button", className: "to-top", title: "回到顶部", hidden: true });
  top.setAttribute("aria-label", "回到顶部");
  top.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  top.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  document.body.append(top);
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      top.hidden = scrollY < 900 || !!$(".editor-bar") || document.body.classList.contains("wide");
      ticking = false;
    });
  }, { passive: true });
}
