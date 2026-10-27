// Pages for mind maps (思维导图): a list of maps, and one page per map with a
// browse mode (drag to pan, zoom, fold, click to jump) and an edit mode.
import * as MM from "./mindmap.mjs";
import * as M from "./model.mjs";

const PAD = 60;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;

export function createMaps(ctx) {
  const { state, $, $$, h, toast, dialog, confirmDialog, copyText, store } = ctx;
  const main = $("#main");
  state.maps = MM.emptyIndex();
  state.mapCache = new Map();
  const listFilter = { query: "", sort: store.get("pc-sort-maps") || "updated" };

  /* ---------- data ---------- */
  async function loadMaps() {
    state.maps = MM.normalizeIndex(await ctx.readData(MM.MAPS_INDEX_PATH).catch(() => null));
    // Maps this device just saved may not be on the static site yet.
    const recent = (store.get("pc-recent-maps") || []).filter((r) => Date.now() - r.at < 15 * 60 * 1000);
    for (const r of recent) {
      const known = state.maps.maps.find((x) => x.id === r.summary.id);
      state.maps.maps = state.maps.maps.filter((x) => x.id !== r.summary.id);
      if (!r.removed) state.maps.maps.push(known && (known.updatedAt || "") >= (r.summary.updatedAt || "") ? known : r.summary);
    }
    state.maps = MM.normalizeIndex(state.maps);
    store.set("pc-recent-maps", recent);
  }

  function rememberRecent(summary, removed = false) {
    const recent = (store.get("pc-recent-maps") || []).filter((r) => r.summary.id !== summary.id);
    recent.push({ at: Date.now(), summary, removed });
    store.set("pc-recent-maps", recent);
  }

  async function getMap(id) {
    if (state.mapCache.has(id)) return state.mapCache.get(id);
    const raw = await ctx.readData(MM.MAP_DIR + id + ".json");
    const map = raw ? MM.normalizeMap(raw) : null;
    if (map) state.mapCache.set(id, map);
    return map;
  }

  async function saveMap(map, message) {
    const now = new Date().toISOString();
    const saved = { ...map, updatedAt: now, createdAt: map.createdAt || now };
    await state.gh.commitLatest(async (head) => {
      const index = MM.normalizeIndex(await state.gh.readJSON(MM.MAPS_INDEX_PATH, head));
      return {
        message,
        files: [
          { path: MM.MAP_DIR + map.id + ".json", text: JSON.stringify(saved, null, 1) + "\n" },
          { path: MM.MAPS_INDEX_PATH, text: JSON.stringify(MM.upsertIndex(index, saved, now), null, 1) + "\n" },
        ],
      };
    });
    state.mapCache.set(saved.id, structuredClone(saved));
    state.maps = MM.upsertIndex(state.maps, saved, now);
    rememberRecent(MM.summarize(saved));
    return saved;
  }

  // What a linked branch shows: the live title of its card or log.
  const cardOf = (id) => state.index.cards.find((x) => x.id === id);
  const logOf = (id) => state.logs.logs.find((x) => x.id === id);
  const courseOf = (id) => (state.courses?.courses || []).find((x) => x.id === id);
  const STATUS = { learning: "在学", done: "学完", paused: "暂停" };
  // Where each branch kind picks from, and what it shows under the title.
  const SOURCE = {
    card: { all: () => state.index.cards, of: (id) => cardOf(id), sub: (x) => x.oneLine, done: (x) => x.status === "done" },
    log: { all: () => state.logs.logs, of: (id) => logOf(id), sub: (x) => x.conclusion, done: (x) => x.status === "done" },
    course: { all: () => state.courses?.courses || [], of: (id) => courseOf(id), sub: (x) => x.goal || x.teacher, done: (x) => x.status === "done" },
  };
  function linked(node) {
    if (node.kind === "card") {
      const c = cardOf(node.ref);
      return c ? { title: c.title || node.text, tip: c.oneLine, status: c.status === "done" ? "读完" : "在读", href: "#/c/" + c.id } : null;
    }
    if (node.kind === "log") {
      const l = logOf(node.ref);
      return l ? { title: l.title || node.text, tip: l.conclusion, status: l.status === "done" ? "完成" : "进行中", href: "#/lab/e/" + l.id } : null;
    }
    if (node.kind === "course") {
      const c = courseOf(node.ref);
      return c ? { title: c.title || node.text, tip: c.goal, status: STATUS[c.status] || "在学", href: "#/course/" + c.id } : null;
    }
    return null;
  }
  const titleOf = (kind, ref) => SOURCE[kind]?.of(ref)?.title || "";

  /* ---------- list ---------- */
  async function list() {
    const maps = state.maps.maps;
    main.innerHTML = `
      <div class="sheet">
        <h1 class="site-title">思维导图</h1>
        <p class="site-sub">把读过的论文、做过的实操串成一张图。</p>
        <div class="home-actions"><p class="due-none">${maps.length ? `共 ${maps.length} 张导图。` : "新建一张导图，从中心主题开始加分支；分支可以是文字，也可以是论文卡片或实操记录。"}</p>
          <button class="btn primary" id="newMap">新建导图</button></div>
      </div>
      ${maps.length ? `<div class="filters">
        <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span class="visually-hidden">搜索导图</span><input type="search" id="mq" placeholder="搜索导图名字和分支…" value="${h(listFilter.query)}"></label>
        ${ctx.sortSelect("msort", MM.MAP_SORTS, listFilter.sort)}
      </div>` : ""}
      <section class="map-grid" id="mapGrid" aria-label="全部导图"></section>`;
    $("#newMap").onclick = createMap;
    $("#mq")?.addEventListener("input", (e) => { listFilter.query = e.target.value; renderMaps(); });
    $("#msort")?.addEventListener("change", (e) => { listFilter.sort = e.target.value; store.set("pc-sort-maps", e.target.value); renderMaps(); });
    renderMaps();
  }

  function renderMaps() {
    const all = state.maps.maps;
    const maps = MM.sortMaps(MM.searchMaps(all, listFilter.query), listFilter.sort);
    $("#mapGrid").innerHTML = all.length && !maps.length
      ? `<p class="empty">没有找到匹配的导图。</p>`
      : maps.map((x) => `
        <a class="pcard map-tile" href="#/map/${h(x.id)}">
          <p class="pcard-one">${h(x.title || "未命名导图")}</p>
          ${x.branches.length ? `<div class="chips">${x.branches.map((b) => `<span class="chip">${h(b)}</span>`).join("")}</div>` : ""}
          <div class="pcard-foot"><span>${x.nodes} 个分支${x.cards ? ` · 论文 ${x.cards}` : ""}${x.logs ? ` · 实操 ${x.logs}` : ""}${x.courses ? ` · 课程 ${x.courses}` : ""}</span><span class="prog">${h((x.updatedAt || "").slice(0, 10))}</span></div>
        </a>`).join("");
  }

  async function createMap() {
    const title = await dialog(
      `<form method="dialog" id="mapForm"><h2>新建导图</h2><p>导图的名字也是中心主题，之后可以改。</p>
        <label class="field"><span>名字</span><input name="t" maxlength="120" required autofocus placeholder="导图的主题"></label>
        <div class="dialog-actions"><button type="button" class="btn" data-c>取消</button><button class="btn primary">创建</button></div></form>`,
      (el, close) => {
        $("[data-c]", el).onclick = () => close(null);
        $("#mapForm", el).onsubmit = (e) => { e.preventDefault(); close(e.target.t.value.trim()); };
      },
    );
    if (!title) return;
    const map = MM.emptyMap(MM.newMapId(title), title);
    store.set("pc-mapdraft-" + map.id, { map, savedAt: new Date().toISOString(), isNew: true });
    location.hash = "#/map/" + map.id + "/edit";
  }

  /* ---------- one map ---------- */
  async function view(id, startMode = "browse") {
    if (!M.validId(id)) return list();
    main.innerHTML = `<p class="loading">正在打开导图…</p>`;
    const draftKey = "pc-mapdraft-" + id;
    const viewKey = "pc-mapview-" + id;
    const saved = await getMap(id).catch(() => null);
    const draft = store.get(draftKey);
    let map;
    let restored = false;
    if (draft && (!saved || (draft.savedAt || "") > (saved.updatedAt || ""))) {
      try { map = MM.normalizeMap(draft.map); restored = !draft.isNew || !!saved; } catch { map = null; }
    }
    if (!map && saved) map = structuredClone(saved);
    if (!map) {
      main.innerHTML = `<div class="sheet"><h1>找不到这张导图</h1><p>它可能刚保存、网站还没更新，或者已经删除了。</p><div class="btn-row"><a class="btn" href="#/map">回到全部导图</a></div></div>`;
      return;
    }
    let isNew = !saved;
    let dirty = isNew || restored;
    let mode = startMode;
    let selected = "root";
    const viewState = store.get(viewKey) || {};
    const collapsed = new Set(viewState.collapsed || []);
    let cam = viewState.cam || null; // { x, y, z }
    const undo = [];
    const redo = [];
    // Find-in-map: matching branches are highlighted; Enter jumps to the next one.
    let hits = [];
    let hitAt = -1;

    main.innerHTML = `
      <div class="map-page" id="mapPage">
        <div class="map-bar">
          <a class="btn quiet" href="#/map">← 全部导图</a>
          <h1 class="map-title" id="mapTitle"></h1>
          <div class="map-find"><input type="search" class="input" id="mapFind" placeholder="在图中查找…" aria-label="在图中查找" autocomplete="off"><span class="muted small" id="findCount" aria-live="polite"></span></div>
          <div class="seg map-mode" role="group" aria-label="模式"><button type="button" data-mode="browse">浏览</button><button type="button" data-mode="edit">编辑</button></div>
          <div class="btn-row map-actions">
            <button class="btn quiet small" id="undoBtn" title="撤销（⌘/Ctrl + Z）" data-edit>撤销</button>
            <button class="btn quiet small" id="redoBtn" title="重做（⌘/Ctrl + Shift + Z）" data-edit>重做</button>
            <button class="btn quiet small" id="copyOutline" data-browse>复制大纲</button>
            <button class="btn quiet small danger" id="deleteMap" data-edit>删除导图</button>
            <button class="btn primary small" id="saveMap">保存</button>
          </div>
        </div>
        ${restored ? `<div class="banner warn"><span>已恢复这台设备上还没保存的修改。</span><button class="btn quiet" id="discardDraft">放弃修改</button></div>` : ""}
        <div class="map-main">
          <div class="map-canvas" id="canvas" tabindex="0" aria-label="导图画布">
            <div class="map-world" id="world"><svg class="map-edges" id="edges" aria-hidden="true"></svg><div class="map-nodes" id="nodes"></div></div>
            <div class="map-zoom"><button type="button" data-zoom="out" aria-label="缩小">−</button><span id="zoomPct">100%</span><button type="button" data-zoom="in" aria-label="放大">＋</button><button type="button" data-zoom="fit">适应</button><button type="button" data-fold-all="open" data-browse>全部展开</button><button type="button" data-fold-all="close" data-browse>只看主干</button></div>
            <div class="map-legend" aria-hidden="true"><span class="lg lg-text">文字</span><span class="lg lg-card">论文</span><span class="lg lg-log">实操</span><span class="lg lg-course">课程</span></div>
            <p class="map-tip" id="mapTip"></p>
          </div>
          <aside class="map-panel" id="panel" data-edit></aside>
        </div>
      </div>`;
    const page = $("#mapPage");
    const canvas = $("#canvas");
    const world = $("#world");
    const nodesEl = $("#nodes");
    const edgesEl = $("#edges");
    let lastLayout = null;

    /* ----- drafts, saving, history ----- */
    let draftTimer;
    const saveDraft = () => store.set(draftKey, { map, savedAt: new Date().toISOString(), isNew });
    const saveView = () => store.set(viewKey, { collapsed: [...collapsed], cam });
    function changed() {
      dirty = true;
      ctx.setDirty(true);
      paintBar();
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => page.isConnected && saveDraft(), 500);
    }
    ctx.setLeave(async () => { clearTimeout(draftTimer); if (dirty) saveDraft(); saveView(); return true; });
    window.onbeforeunload = () => { if (dirty) saveDraft(); saveView(); };
    if (dirty) ctx.setDirty(true);

    const snapshot = () => JSON.stringify(map);
    function remember() {
      undo.push(snapshot());
      if (undo.length > 100) undo.shift();
      redo.length = 0;
    }
    function restore(from, to) {
      if (!from.length) return;
      to.push(snapshot());
      map = MM.normalizeMap(JSON.parse(from.pop()));
      if (!MM.find(map.root, selected)) selected = "root";
      changed();
      render();
      paintPanel(); // the panel must edit the restored copy, not the old one
    }

    /* ----- top bar ----- */
    function paintBar() {
      $("#mapTitle").textContent = map.title || map.root.text || "未命名导图";
      page.dataset.mode = mode;
      $$(".map-mode [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
      $("#saveMap").hidden = !dirty;
      $("#undoBtn").disabled = !undo.length;
      $("#redoBtn").disabled = !redo.length;
      $("#mapTip").textContent = mode === "browse"
        ? "拖动空白处移动画布，滚轮或双指缩放；点论文、实操分支可以打开。"
        : "点分支选中；Tab 加子分支，Enter 加同级，Delete 删除；把分支拖到另一个分支上可以移动。";
    }
    $$(".map-mode [data-mode]").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
    function setMode(next) {
      mode = next;
      history.replaceState(null, "", "#/map/" + id + (mode === "edit" ? "/edit" : ""));
      paintBar();
      render();
      if (mode === "edit") paintPanel();
    }

    /* ----- drawing ----- */
    function nodeHtml(n, depth, color) {
      const link = linked(n);
      const missing = n.kind !== "text" && !link;
      const label = link ? link.title : n.text || (depth === 0 ? "中心主题" : "（空）");
      const tip = [link?.tip, n.note].filter(Boolean).join("\n\n");
      const hidden = collapsed.has(n.id) ? countHidden(n) : 0;
      return `<div class="mnode k-${n.kind} d${Math.min(depth, 3)} c-${color || "root"}${hits.includes(n.id) ? " hit" : ""}${hits[hitAt] === n.id ? " hit-now" : ""}${n.id === selected && mode === "edit" ? " selected" : ""}${missing ? " missing" : ""}${link ? " linked" : ""}" data-id="${n.id}"${tip ? ` title="${h(tip)}"` : ""}>
        ${n.kind !== "text" ? `<span class="mkind">${MM.KINDS[n.kind]}${link ? " · " + link.status : missing ? " · 已删除" : ""}</span>` : ""}
        <span class="mtext">${h(label)}</span>${n.note ? `<span class="mnote" aria-label="有备注">✎</span>` : ""}
        ${n.children.length ? `<button type="button" class="mfold" data-fold="${n.id}" aria-label="${hidden ? "展开" : "折叠"}">${hidden ? "+" + hidden : "−"}</button>` : ""}
      </div>`;
    }
    const countHidden = (n) => MM.countNodes(n) - 1;

    // Lays the map out, keeping the node at `anchor` where it was on screen.
    function render(anchor = selected) {
      const colors = MM.branchColors(map.root);
      const rows = [];
      const visit = (n, depth) => {
        rows.push(nodeHtml(n, depth, colors.get(n.id)));
        if (!collapsed.has(n.id)) n.children.forEach((c) => visit(c, depth + 1));
      };
      visit(map.root, 0);
      const before = lastLayout && screenPos(anchor);
      nodesEl.innerHTML = rows.join("");
      const sizes = new Map($$(".mnode", nodesEl).map((el) => [el.dataset.id, { w: el.offsetWidth, h: el.offsetHeight }]));
      const L = MM.layout(map.root, (nid) => sizes.get(nid) || { w: 0, h: 0 }, collapsed);
      const ox = PAD - L.bounds.minX;
      const oy = PAD - L.bounds.minY;
      for (const el of $$(".mnode", nodesEl)) {
        const b = L.boxes.get(el.dataset.id);
        el.style.transform = `translate(${b.x + ox}px, ${b.y + oy}px)`;
        el.classList.add("side-" + b.side);
      }
      const W = L.bounds.width + PAD * 2;
      const H = L.bounds.height + PAD * 2;
      world.style.width = W + "px";
      world.style.height = H + "px";
      edgesEl.setAttribute("width", W);
      edgesEl.setAttribute("height", H);
      edgesEl.innerHTML = L.edges.map((e) => {
        const p = L.boxes.get(e.from);
        const c = L.boxes.get(e.to);
        const x1 = (e.side === "right" ? p.x + p.w : p.x) + ox;
        const x2 = (e.side === "right" ? c.x : c.x + c.w) + ox;
        const y1 = p.y + p.h / 2 + oy;
        const y2 = c.y + c.h / 2 + oy;
        const dx = (x2 - x1) / 2;
        return `<path class="edge c-${colors.get(e.to)}${p.depth === 0 ? " main" : ""}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}"/>`;
      }).join("");
      lastLayout = { L, ox, oy };
      if (!cam) fit();
      else if (before) {
        const after = worldPos(anchor);
        if (after) { cam.x = before.x - after.x * cam.z; cam.y = before.y - after.y * cam.z; }
      }
      applyCam();
    }
    const worldPos = (nid) => {
      const b = lastLayout?.L.boxes.get(nid);
      return b ? { x: b.x + lastLayout.ox + b.w / 2, y: b.y + lastLayout.oy + b.h / 2 } : null;
    };
    const screenPos = (nid) => {
      const p = worldPos(nid);
      return p && cam ? { x: cam.x + p.x * cam.z, y: cam.y + p.y * cam.z } : null;
    };

    /* ----- camera: drag to pan, wheel / pinch to zoom ----- */
    function applyCam() {
      world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
      $("#zoomPct").textContent = Math.round(cam.z * 100) + "%";
    }
    function fit() {
      const W = parseFloat(world.style.width) || 1;
      const H = parseFloat(world.style.height) || 1;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const z = Math.max(ZOOM_MIN, Math.min(1.1, cw / W, ch / H));
      // On a phone a wide map would shrink to unreadable; keep it legible and centre the main topic.
      if (cw < 600 && z < 0.55) {
        cam = { x: 0, y: 0, z: 0.55 };
        center("root");
        return;
      }
      cam = { x: (cw - W * z) / 2, y: (ch - H * z) / 2, z };
      applyCam();
    }
    function zoomAt(factor, cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2) {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.z * factor));
      cam = { x: cx - ((cx - cam.x) * z) / cam.z, y: cy - ((cy - cam.y) * z) / cam.z, z };
      applyCam();
    }
    function center(nid) {
      const p = worldPos(nid);
      if (!p) return;
      cam.x = canvas.clientWidth / 2 - p.x * cam.z;
      cam.y = canvas.clientHeight / 2 - p.y * cam.z;
      applyCam();
    }
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      // Pinch on a trackpad arrives as ctrl + small wheel steps; a mouse wheel step is ~100.
      if (e.ctrlKey || e.metaKey) zoomAt(Math.min(1.25, Math.max(0.8, Math.exp(-e.deltaY * 0.0025))), e.clientX - r.left, e.clientY - r.top);
      else { cam.x -= e.deltaX; cam.y -= e.deltaY; applyCam(); }
    }, { passive: false });
    $$(".map-zoom [data-zoom]").forEach((b) => (b.onclick = () => (b.dataset.zoom === "fit" ? fit() : zoomAt(b.dataset.zoom === "in" ? 1.25 : 0.8))));
    $$(".map-zoom [data-fold-all]").forEach((b) => (b.onclick = () => {
      collapsed.clear();
      if (b.dataset.foldAll === "close") map.root.children.forEach((c) => c.children.length && collapsed.add(c.id));
      cam = null;
      render("root");
      saveView();
    }));

    // One handler for clicks, panning, pinching and (in edit mode) dragging branches.
    const pointers = new Map();
    let gesture = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (e.target.closest(".map-zoom, .map-legend")) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        gesture = { type: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z };
        return;
      }
      const nodeEl = e.target.closest(".mnode");
      gesture = { type: "press", x: e.clientX, y: e.clientY, cam: { ...cam }, nodeId: nodeEl?.dataset.id, fold: e.target.closest("[data-fold]")?.dataset.fold };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId) || !gesture) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesture.type === "pinch" && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const r = canvas.getBoundingClientRect();
        const factor = (gesture.z * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.dist)) / cam.z;
        zoomAt(factor, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        return;
      }
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      if (gesture.type === "press" && Math.hypot(dx, dy) > 5) {
        const canDrag = mode === "edit" && gesture.nodeId && gesture.nodeId !== "root" && !gesture.fold;
        gesture.type = canDrag ? "drag" : "pan";
        if (canDrag) startDrag(gesture, e);
        else canvas.classList.add("panning");
      }
      if (gesture.type === "pan") { cam.x = gesture.cam.x + dx; cam.y = gesture.cam.y + dy; applyCam(); }
      if (gesture.type === "drag") moveDrag(gesture, e);
    });
    const endPointer = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      const g = gesture;
      if (pointers.size) return;
      gesture = null;
      canvas.classList.remove("panning");
      if (!g || e.type === "pointercancel") { if (g?.type === "drag") endDrag(g, null); return; }
      if (g.type === "drag") return endDrag(g, e);
      if (g.type === "pan" || g.type === "pinch") return saveView();
      // A plain click.
      if (g.fold) return toggleFold(g.fold);
      if (!g.nodeId) return;
      const node = MM.find(map.root, g.nodeId)?.node;
      if (mode === "edit") { select(g.nodeId); return; }
      const link = node && linked(node);
      if (link) { saveView(); location.hash = link.href; }
      else if (node?.children.length) toggleFold(node.id);
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("dblclick", (e) => {
      if (mode !== "edit" || !e.target.closest(".mnode")) return;
      $("#nText")?.focus();
      $("#nText")?.select();
    });

    function toggleFold(nid) {
      if (collapsed.has(nid)) collapsed.delete(nid);
      else collapsed.add(nid);
      render(nid);
      saveView();
    }

    // Dragging a branch onto another branch moves it there (edit mode).
    function startDrag(g, e) {
      const el = nodesEl.querySelector(`[data-id="${g.nodeId}"]`);
      g.ghost = el.cloneNode(true);
      g.ghost.classList.add("ghost");
      g.ghost.style.transform = "";
      document.body.append(g.ghost);
      el.classList.add("dragging");
      moveDrag(g, e);
    }
    function moveDrag(g, e) {
      g.ghost.style.left = e.clientX + 8 + "px";
      g.ghost.style.top = e.clientY + 8 + "px";
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".mnode:not(.dragging)");
      const target = over && MM.find(map.root, g.nodeId) && !MM.find(MM.find(map.root, g.nodeId).node, over.dataset.id) ? over.dataset.id : null;
      $$(".mnode.drop", nodesEl).forEach((n) => n.classList.remove("drop"));
      if (target) nodesEl.querySelector(`[data-id="${target}"]`).classList.add("drop");
      g.target = target;
    }
    function endDrag(g, e) {
      g.ghost?.remove();
      $$(".mnode.dragging, .mnode.drop", nodesEl).forEach((n) => n.classList.remove("dragging", "drop"));
      if (!e || !g.target) return;
      const snap = snapshot();
      if (MM.moveNode(map.root, g.nodeId, g.target)) {
        undo.push(snap);
        redo.length = 0;
        collapsed.delete(g.target);
        selected = g.nodeId;
        changed();
        render(g.target);
        paintPanel();
      }
    }

    /* ----- edit panel ----- */
    let addKind = "text";
    let onlyFinished = true;
    function select(nid) {
      selected = nid;
      $$(".mnode.selected", nodesEl).forEach((n) => n.classList.remove("selected"));
      nodesEl.querySelector(`[data-id="${nid}"]`)?.classList.add("selected");
      paintPanel();
    }
    function paintPanel() {
      const panel = $("#panel");
      if (mode !== "edit") return;
      const hit = MM.find(map.root, selected) || MM.find(map.root, "root");
      const n = hit.node;
      const link = linked(n);
      const isRoot = n.id === "root";
      const targetName = (link?.title || n.text || "中心主题").slice(0, 16);
      panel.innerHTML = `
        <section class="panel-sec"><h3>${isRoot ? "中心主题" : "当前分支"}</h3>
          ${n.kind === "text"
            ? `<label class="field"><span>文字</span><input class="input" id="nText" maxlength="300" placeholder="分支的文字" value="${h(n.text)}"></label>`
            : `<div class="nlink k-${n.kind}"><span class="mkind">${MM.KINDS[n.kind]}</span><b>${h(link?.title || n.text || "（已删除）")}</b>
                ${link ? `<a class="small" href="${h(link.href)}">打开</a>` : `<span class="muted small">原${{ card: "卡片", log: "记录", course: "课程" }[n.kind]}已删除</span>`}
                <button type="button" class="btn quiet small" id="unlinkNode">改成文字</button></div>`}
          ${isRoot ? "" : `<div class="field"><span class="label">颜色</span><div class="swatches">${MM.COLORS.map((c) => `<button type="button" class="swatch c-${c || "auto"}" data-color="${c}" aria-pressed="${n.color === c}" title="${MM.COLOR_LABELS[c]}"></button>`).join("")}</div></div>`}
          <label class="field"><span>备注（浏览时悬停可见）</span><textarea class="textarea short" id="nNote" rows="2" maxlength="2000" placeholder="可以留空">${h(n.note)}</textarea></label>
          <div class="btn-row panel-btns">
            <button type="button" class="btn small" data-act="child">＋ 子分支</button>
            ${isRoot ? "" : `<button type="button" class="btn small" data-act="sibling">＋ 同级</button>
            <button type="button" class="btn quiet small" data-act="up" title="Alt + ↑">上移</button><button type="button" class="btn quiet small" data-act="down" title="Alt + ↓">下移</button>
            <button type="button" class="btn quiet small danger" data-act="delete">删除</button>`}
          </div>
        </section>
        <section class="panel-sec"><h3>给「${h(targetName)}」加分支</h3>
          <div class="seg add-kind" role="group" aria-label="分支类型">${Object.entries(MM.KINDS).map(([k, label]) => `<button type="button" data-kind="${k}" aria-pressed="${addKind === k}">${label}</button>`).join("")}</div>
          ${addKind === "text"
            ? `<input class="input" id="addText" maxlength="300" placeholder="输入文字，回车添加" style="margin-top:8px">`
            : `<input class="input" id="pickQuery" placeholder="搜索${{ card: "论文标题、作者", log: "记录标题", course: "课程名称" }[addKind]}…" style="margin-top:8px">
               <label class="check-row small" style="margin-top:6px"><input type="checkbox" id="onlyDone"${onlyFinished ? " checked" : ""}> 只显示${{ card: "读完的论文", log: "完成的记录", course: "学完的课程" }[addKind]}</label>
               <div class="pick-list" id="pickList"></div>`}
        </section>
        <p class="hint small">Tab 子分支 · Enter 同级 · Delete 删除 · ⌘Z 撤销 · 把分支拖到另一个分支上可以移动</p>`;
      bindPanel(n, isRoot);
      if (addKind !== "text") paintPicks();
    }

    function bindPanel(n, isRoot) {
      const text = $("#nText");
      // One undo step per editing session: taken on the first keystroke.
      let textTouched = false;
      if (text) {
        text.addEventListener("input", () => {
          if (!textTouched) { remember(); textTouched = true; }
          n.text = text.value;
          if (isRoot) map.title = text.value.trim();
          changed();
          render(n.id);
        });
        text.addEventListener("keydown", (e) => {
          if (ctx.plainEnter(e)) { e.preventDefault(); add(isRoot ? "child" : "sibling", { focus: true }); }
          else if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); add("child", { focus: true }); }
          else if (e.key === "Escape") { text.blur(); canvas.focus(); }
        });
      }
      $("#unlinkNode")?.addEventListener("click", () => {
        remember();
        n.text = linked(n)?.title || n.text;
        n.kind = "text";
        n.ref = "";
        changed();
        render(n.id);
        paintPanel();
      });
      $$("[data-color]").forEach((b) => (b.onclick = () => { remember(); n.color = b.dataset.color; changed(); render(n.id); paintPanel(); }));
      const note = $("#nNote");
      let noteTouched = false;
      note.addEventListener("input", () => {
        if (!noteTouched) { remember(); noteTouched = true; }
        n.note = note.value;
        changed();
        render(n.id);
      });
      $$("[data-act]").forEach((b) => (b.onclick = () => act(b.dataset.act)));
      $$(".add-kind [data-kind]").forEach((b) => (b.onclick = () => { addKind = b.dataset.kind; paintPanel(); (addKind === "text" ? $("#addText") : $("#pickQuery"))?.focus(); }));
      $("#addText")?.addEventListener("keydown", (e) => {
        if (!ctx.plainEnter(e)) return;
        e.preventDefault();
        const value = e.target.value.trim();
        if (!value) return;
        add("child", { fields: { text: value }, keepSelection: true });
        e.target.value = "";
      });
      $("#pickQuery")?.addEventListener("input", paintPicks);
      $("#onlyDone")?.addEventListener("change", (e) => { onlyFinished = e.target.checked; paintPicks(); });
    }

    // Picker for paper cards / practice logs; clicking one adds it as a child branch.
    function paintPicks() {
      const box = $("#pickList");
      if (!box) return;
      const q = ($("#pickQuery")?.value || "").trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const refs = MM.linkedRefs(map.root)[addKind];
      const src = SOURCE[addKind];
      const items = src.all()
        .filter((x) => !onlyFinished || src.done(x))
        .filter((x) => terms.every((t) => [x.title, x.authors, x.teacher, x.oneLine, x.conclusion, x.goal, (x.tags || []).join(" ")].join(" ").toLowerCase().includes(t)))
        .slice(0, 40);
      box.innerHTML = items.length
        ? items.map((x) => `<button type="button" class="pick k-${addKind}${refs.has(x.id) ? " used" : ""}" data-pick="${h(x.id)}">
            <b>${h(x.title || x.id)}</b><span>${h(src.sub(x) || "")}</span>
            ${refs.has(x.id) ? `<em>已在图中</em>` : ""}</button>`).join("")
        : `<p class="muted small">${src.all().length ? "没有符合条件的" + { card: "论文", log: "记录", course: "课程" }[addKind] + "。" + (onlyFinished ? "试试取消「只显示…」。" : "") : "还没有" + { card: "论文卡片", log: "实操记录", course: "课程" }[addKind] + "。"}</p>`;
      $$("[data-pick]", box).forEach((b) => (b.onclick = () => {
        const item = src.of(b.dataset.pick);
        add("child", { fields: { kind: addKind, ref: b.dataset.pick, text: item?.title || "" }, keepSelection: true });
        toast("已添加「" + (item?.title || "").slice(0, 20) + "」。");
      }));
    }

    function add(where, { fields = {}, focus = false, keepSelection = false } = {}) {
      remember();
      const node = MM.newNode(fields);
      try {
        if (where === "child") { MM.addChild(map.root, selected, node); collapsed.delete(selected); }
        else MM.addSibling(map.root, selected, node);
      } catch (error) {
        undo.pop();
        return toast(error.message, "error");
      }
      const anchor = selected;
      if (!keepSelection) selected = node.id;
      changed();
      render(anchor);
      paintPanel();
      if (focus) { $("#nText")?.focus(); }
      if (keepSelection) (addKind === "text" ? $("#addText") : $("#pickQuery"))?.focus();
    }

    async function act(what) {
      if (what === "child" || what === "sibling") return add(what, { focus: true });
      if (selected === "root") return;
      if (what === "up" || what === "down") {
        remember();
        if (MM.moveAmongSiblings(map.root, selected, what === "up" ? -1 : 1)) { changed(); render(); } else undo.pop();
        return;
      }
      if (what === "delete") {
        const hit = MM.find(map.root, selected);
        const n = MM.countNodes(hit.node);
        if (n > 3 && !(await confirmDialog("删除这个分支？", `它下面还有 ${n - 1} 个分支，会一起删除。可以用「撤销」找回。`, "删除", true))) return;
        remember();
        MM.removeNode(map.root, selected);
        selected = hit.parent.children[Math.min(hit.index, hit.parent.children.length - 1)]?.id || hit.parent.id;
        changed();
        render(hit.parent.id);
        paintPanel();
      }
    }

    // Keyboard shortcuts while the map page is open (not while typing).
    const onKey = (e) => {
      if (!page.isConnected) return document.removeEventListener("keydown", onKey);
      if (mode !== "edit" || document.querySelector("dialog[open]")) return;
      const typing = e.target.matches("input, textarea, select");
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); return e.shiftKey ? restore(redo, undo) : restore(undo, redo); }
      if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); return restore(redo, undo); }
      if (typing) return;
      const hit = MM.find(map.root, selected);
      if (!hit) return;
      if (e.key === "Tab") { e.preventDefault(); add("child", { focus: true }); }
      else if (e.key === "Enter") { e.preventDefault(); add(selected === "root" ? "child" : "sibling", { focus: true }); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); act("delete"); }
      else if (e.key === "F2" || e.key === " ") { e.preventDefault(); $("#nText")?.focus(); $("#nText")?.select(); }
      else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); act(e.key === "ArrowUp" ? "up" : "down"); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const side = lastLayout?.L.boxes.get(selected)?.side;
        const kids = collapsed.has(selected) ? [] : hit.node.children;
        let next = null;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") next = hit.parent?.children[hit.index + (e.key === "ArrowUp" ? -1 : 1)];
        else if ((e.key === "ArrowRight") === (side !== "left")) next = kids[0];
        else next = hit.parent;
        if (next) { select(next.id); center(next.id); }
      }
    };
    document.addEventListener("keydown", onKey);

    const findBox = $("#mapFind");
    const paintFind = () => {
      $("#findCount").textContent = findBox.value.trim() ? (hits.length ? (hitAt >= 0 ? `${hitAt + 1} / ${hits.length}` : `${hits.length} 个`) : "没有找到") : "";
    };
    const runFind = () => {
      hits = MM.findNodes(map.root, findBox.value, titleOf);
      hitAt = -1;
      paintFind();
      render();
    };
    const jump = (step) => {
      if (!hits.length) return;
      hitAt = (hitAt + step + hits.length) % hits.length;
      const id = hits[hitAt];
      MM.ancestors(map.root, id).forEach((a) => collapsed.delete(a)); // unfold the way there
      if (mode === "edit") selected = id;
      render(id);
      center(id);
      if (mode === "edit") paintPanel();
      paintFind();
    };
    findBox.addEventListener("input", runFind);
    findBox.addEventListener("keydown", (e) => {
      if (ctx.plainEnter(e)) { e.preventDefault(); jump(e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { findBox.value = ""; runFind(); canvas.focus(); }
    });

    $("#undoBtn").onclick = () => restore(undo, redo);
    $("#redoBtn").onclick = () => restore(redo, undo);
    $("#copyOutline").onclick = () => copyText(MM.mapToMarkdown(map, titleOf));
    $("#discardDraft")?.addEventListener("click", async () => {
      if (!(await confirmDialog("放弃修改？", "这台设备上还没保存的修改会被删除。", "放弃修改", true))) return;
      store.del(draftKey);
      dirty = false;
      ctx.setDirty(false);
      if (!isNew) ctx.route();
      else location.hash = "#/map";
    });

    $("#saveMap").onclick = async () => {
      if (!(await ctx.ensureUnlocked())) return;
      const btn = $("#saveMap");
      btn.disabled = true;
      btn.textContent = "正在保存…";
      try {
        map.title = map.title || map.root.text.trim() || "未命名导图";
        const out = await saveMap(map, (isNew ? "新建思维导图：" : "更新思维导图：") + map.title.slice(0, 60));
        map.createdAt = out.createdAt;
        map.updatedAt = out.updatedAt;
        isNew = false;
        clearTimeout(draftTimer);
        store.del(draftKey);
        dirty = false;
        ctx.setDirty(false);
        paintBar();
        toast("已保存。网站大约 1 分钟后对所有人更新。");
      } catch (error) {
        console.error(error);
        if (error.status === 401) ctx.lock(true);
        toast("保存失败：" + error.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "保存";
      }
    };

    $("#deleteMap").onclick = async () => {
      if (isNew) {
        if (!(await confirmDialog("丢掉这张导图？", "它还没保存过，丢掉后就没有了。", "丢掉", true))) return;
        store.del(draftKey);
        dirty = false;
        ctx.setDirty(false);
        location.hash = "#/map";
        return;
      }
      if (!(await confirmDialog("删除这张导图？", "删除后网站上不再显示。需要时仍可以从 GitHub 的历史记录里找回。导图里关联的论文和实操记录不受影响。", "删除", true))) return;
      if (!(await ctx.ensureUnlocked())) return;
      try {
        await state.gh.commitLatest(async (head) => {
          const index = MM.normalizeIndex(await state.gh.readJSON(MM.MAPS_INDEX_PATH, head));
          return {
            message: "删除思维导图：" + (map.title || id).slice(0, 60),
            files: [
              { path: MM.MAP_DIR + id + ".json", remove: true },
              { path: MM.MAPS_INDEX_PATH, text: JSON.stringify(MM.removeFromIndex(index, id), null, 1) + "\n" },
            ],
          };
        });
        state.mapCache.delete(id);
        state.maps = MM.removeFromIndex(state.maps, id);
        rememberRecent({ id }, true);
        store.del(draftKey);
        store.del(viewKey);
        dirty = false;
        ctx.setDirty(false);
        toast("已删除。");
        location.hash = "#/map";
      } catch (error) {
        toast("删除失败：" + error.message, "error");
      }
    };

    // Keep the picture in view when the window size changes.
    const onResize = () => { if (!page.isConnected) return removeEventListener("resize", onResize); applyCam(); };
    addEventListener("resize", onResize);

    paintBar();
    render("root");
    if (mode === "edit") paintPanel();
  }

  async function loadAll() {
    return (await Promise.all(state.maps.maps.map((x) => getMap(x.id).catch(() => null)))).filter(Boolean);
  }

  return { loadMaps, list, view, loadAll, clearCache: () => state.mapCache.clear() };
}
