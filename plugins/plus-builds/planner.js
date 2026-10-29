// Citizen Score: the Daevanion planner. Draws each board (boards.js) and, for
// a number of points, which nodes to have bought by then.
//
// - Within a board, nodes go in aion2-meta's suggested order (Ariel: the order
//   built from top players' boards, ariel.js).
// - Across Nezekan–Triniel (one shared pool), points are spread the way the
//   top players spread theirs: each board is kept at the same share of its
//   top-player total, so a short budget trims every board's least-agreed tail
//   rather than skipping a board. Past those totals, the rest fills evenly.
// - Ariel and Azphel have their own points and simply follow their order.
const SHARED_BOARDS = ["Nezekan", "Zikel", "Vaizel", "Triniel"];
// The boards with points of their own, and the key their points go by.
const OWN_BOARDS = [["Ariel", "ar"], ["Azphel", "az"]].filter(([b]) => DAEV_LAYOUT[b]);
const CELL = 48;

// A board's nodes in unlock order: [{ i, n, cost, pct }].
function boardSeq(cls, board) {
  const lay = DAEV_LAYOUT[board].nodes;
  return DAEV_ORDER[cls][board].o
    .map(([n, pct], i) => ({ i, n, pct, cost: lay[i][3] }))
    .filter((x) => x.n)
    .sort((a, b) => a.n - b.n);
}

// The shared pool's buying order: [{ board, i, n, cost, sum }].
const mergedCache = {};
function mergedOrder(cls) {
  if (mergedCache[cls]) return mergedCache[cls];
  const st = SHARED_BOARDS.map((board) => {
    const seq = boardSeq(cls, board);
    return { board, seq, k: 0, got: 0, target: DAEV_ORDER[cls][board].spent, total: seq.reduce((s, x) => s + x.cost, 0) };
  });
  const out = [];
  let sum = 0;
  for (;;) {
    const open = st.filter((b) => b.k < b.seq.length);
    if (!open.length) break;
    const short = open.filter((b) => b.got < b.target);
    const pool = short.length ? short : open;
    const share = (b) => (short.length ? b.got / b.target : (b.got - b.target) / Math.max(1, b.total - b.target));
    const b = pool.reduce((x, y) => (share(y) < share(x) ? y : x));
    const node = b.seq[b.k++];
    b.got += node.cost;
    sum += node.cost;
    out.push({ board: b.board, ...node, sum });
  }
  return (mergedCache[cls] = out);
}

// For `pts` shared points and `own` ({ ar, az }: Ariel and Azphel points):
// per board, the node indexes bought and the points used; the next nodes to buy.
function daevPlan(cls, pts, own = {}) {
  const boards = {};
  for (const board of [...SHARED_BOARDS, ...OWN_BOARDS.map(([b]) => b)]) boards[board] = { have: new Set(), used: 0, next: [] };
  const order = mergedOrder(cls);
  let k = 0;
  for (; k < order.length && order[k].sum <= pts; k++) {
    const b = boards[order[k].board];
    b.have.add(order[k].i);
    b.used += order[k].cost;
  }
  const next = order.slice(k, k + 8);
  for (const x of next) boards[x.board].next.push(x.i);
  const used = k ? order[k - 1].sum : 0;
  const ownNext = {};
  for (const [board, key] of OWN_BOARDS) {
    const seq = boardSeq(cls, board);
    const b = boards[board];
    let j = 0;
    for (; j < seq.length && b.used + seq[j].cost <= (own[key] ?? 0); j++) {
      b.have.add(seq[j].i);
      b.used += seq[j].cost;
    }
    ownNext[board] = seq.slice(j, j + 6).map((x) => ({ board, ...x }));
    for (const x of ownNext[board]) b.next.push(x.i);
  }
  return { boards, used, left: pts - used, next, ownNext };
}

const defaultPts = (cls) => SHARED_BOARDS.reduce((s, b) => s + DAEV_ORDER[cls][b].spent, 0);
const defaultOwn = (cls, board) => DAEV_ORDER[cls][board]?.spent ?? 0;
const boardTotal = (board) => DAEV_LAYOUT[board].nodes.reduce((s, n) => s + n[3], 0);

function nodeInfo(cls, board, i) {
  const n = DAEV_LAYOUT[board].nodes[i];
  const own = DAEV_ORDER[cls][board].skills[i];
  return { col: n[0], row: n[1], kind: n[2], cost: n[3], name: own ? own[0] : n[4], tip: own ? own[1] : n[5] };
}

// --- Drawing -----------------------------------------------------------------
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
const NODE_R = { start: 9, stat: 8, passive: 11, skill: 12, special: 14 };

// One board as SVG: the links, then every node with its order number.
// Returns { svg, nodes: Map(index → <g>) } for the planner to colour.
function boardSvg(cls, board) {
  const lay = DAEV_LAYOUT[board];
  const side = lay.size * CELL;
  const svg = svgEl("svg", { viewBox: `0 0 ${side} ${side}`, class: "dvBoard", role: "img", "aria-label": `${board} board` });
  svg.append(svgEl("path", { class: "dvLinks", d: lay.links }));
  const nodes = new Map();
  const o = DAEV_ORDER[cls][board].o;
  lay.nodes.forEach((_, i) => {
    const n = nodeInfo(cls, board, i);
    const g = svgEl("g", { class: `dvN ${n.kind}`, transform: `translate(${n.col * CELL + 24} ${n.row * CELL + 24})` });
    const r = NODE_R[n.kind];
    if (n.kind === "special") g.append(svgEl("rect", { x: -r, y: -r, width: r * 2, height: r * 2, rx: 3, transform: "rotate(45)" }));
    else if (n.kind === "start") g.append(svgEl("rect", { x: -r, y: -r, width: r * 2, height: r * 2, rx: 2 }));
    else g.append(svgEl("circle", { r }));
    const [num, pct] = o[i];
    if (num) {
      const t = svgEl("text", { dy: ".35em" });
      t.textContent = String(num);
      g.append(t);
    }
    const title = svgEl("title", {});
    title.textContent = n.kind === "start"
      ? `${board}: the board opens outwards from here`
      : `#${num} · ${n.name}\n${n.tip}\n${n.cost} pt${n.cost > 1 ? "s" : ""} · ${pct}% of top KR players`;
    g.append(title);
    svg.append(g);
    nodes.set(i, g);
  });
  return { svg, nodes };
}

// The planner: a points slider over the boards. `deep` draws every board at
// once; the panel shows one at a time behind tabs. Ariel and Azphel have a
// slider each. onChange({ pts, ar, az }) when the player moves one.
let plannerTab = "Nezekan";
function daevPlanner(cls, { deep = false, pts = null, ar = null, az = null, onChange = null } = {}) {
  const root = el("div", "planner");
  const state = { pts: pts ?? defaultPts(cls), ar: ar ?? defaultOwn(cls, "Ariel"), az: az ?? defaultOwn(cls, "Azphel") };
  const boards = [...SHARED_BOARDS, ...OWN_BOARDS.map(([b]) => b)];
  if (!boards.includes(plannerTab)) plannerTab = "Nezekan";

  const slider = (label, max, value, median, key) => {
    const row = el("label", "pSlider");
    row.append(el("span", "pLabel", label));
    const input = el("input");
    Object.assign(input, { type: "range", min: 0, max, step: 1, value });
    input.style.setProperty("--med", `${(median / max) * 100}%`);
    const num = el("input", "pNum");
    Object.assign(num, { type: "number", min: 0, max, step: 1, value });
    const set = (v, fromNum) => {
      v = Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
      state[key] = v;
      input.value = v;
      if (!fromNum) num.value = v;
      paint();
      if (onChange) onChange({ ...state });
    };
    input.addEventListener("input", () => set(input.value));
    num.addEventListener("input", () => set(num.value, true));
    num.addEventListener("change", () => (num.value = state[key]));
    const reset = el("button", "pReset", "top players");
    reset.type = "button";
    reset.title = `Set to what the top Korean players have spent: ${median}`;
    reset.addEventListener("click", (e) => {
      e.preventDefault();
      set(median);
    });
    row.append(input, num, el("span", "pMax", `/ ${max}`), reset);
    return { row, input, num };
  };
  const shared = slider("Shared points", SHARED_POOL, state.pts, defaultPts(cls), "pts");
  root.append(shared.row);
  const sharedNote = el("div", "pNote");
  root.append(sharedNote);
  const ownSliders = {};
  for (const [board, key] of OWN_BOARDS) {
    ownSliders[key] = slider(`${board} points`, boardTotal(board), state[key], defaultOwn(cls, board), key);
    root.append(ownSliders[key].row);
  }

  // Per board: how many points go there (bar, top players' mark).
  const alloc = el("div", "pAlloc");
  const allocRows = {};
  for (const board of boards) {
    const total = boardTotal(board);
    const row = el("button", "pBoard");
    row.type = "button";
    row.dataset.board = board;
    row.append(el("span", "pbName", board));
    const track = el("span", "pbTrack");
    const fill = el("span", "pbFill");
    const med = el("span", "pbMed");
    med.style.left = `${(DAEV_ORDER[cls][board].spent / total) * 100}%`;
    med.title = `Top players: ${DAEV_ORDER[cls][board].spent}`;
    track.append(fill, med);
    const val = el("span", "pbVal");
    row.append(track, val);
    if (!deep) row.addEventListener("click", () => {
      plannerTab = board;
      paint();
    });
    allocRows[board] = { row, fill, val, total };
    alloc.append(row);
  }
  root.append(alloc);

  // The boards themselves.
  const wrap = el("div", "pBoards");
  const drawn = {};
  for (const board of boards) {
    const card = el("div", "pBoardCard");
    card.dataset.board = board;
    const head = el("div", "pbHead");
    head.append(el("strong", null, board), el("span", "boardOpens", `Lv ${BOARD_INFO[board].opens}`));
    const used = el("span", "boardPts");
    head.append(used);
    const { svg, nodes } = boardSvg(cls, board);
    card.append(head, svg);
    if (deep) card.append(el("div", "boardOrange", `Orange: ${BOARD_INFO[board].orange}`));
    drawn[board] = { card, nodes, used };
    wrap.append(card);
  }
  root.append(wrap);

  // What to buy next, across boards.
  const nextBox = el("div", "pNext");
  root.append(nextBox);
  const haveBox = deep ? el("div", "pHave") : null;
  if (haveBox) root.append(haveBox);

  const nextItem = (x, step) => {
    const n = nodeInfo(cls, x.board, x.i);
    const li = el("li", `pnItem ${n.kind}`);
    li.append(el("span", "pnBoard", x.board), el("span", "pnName", n.kind === "stat" ? n.tip : n.name));
    li.append(el("span", "pnCost", `${n.cost} pt${n.cost > 1 ? "s" : ""}${step ? ` · at ${step}` : ""}`));
    return li;
  };

  function paint() {
    const plan = daevPlan(cls, state.pts, state);
    for (const board of boards) {
      const p = plan.boards[board];
      const a = allocRows[board];
      a.fill.style.width = `${(p.used / a.total) * 100}%`;
      a.val.textContent = `${p.used}/${a.total}`;
      a.row.classList.toggle("on", !deep && board === plannerTab);
      const d = drawn[board];
      d.card.hidden = !deep && board !== plannerTab;
      d.used.textContent = `${p.used} / ${a.total} pts`;
      const nextSet = new Set(p.next);
      for (const [i, g] of d.nodes) {
        const kind = DAEV_LAYOUT[board].nodes[i][2];
        g.classList.toggle("have", kind === "start" || p.have.has(i));
        g.classList.toggle("next", nextSet.has(i));
      }
    }
    sharedNote.textContent = state.pts > plan.used
      ? `${plan.used} spent; ${plan.left} left until the next node (${plan.next[0]?.cost ?? 0} pts).`
      : state.pts >= SHARED_POOL ? "Every shared node bought." : `${plan.used} spent.`;
    if (state.pts < defaultPts(cls)) {
      sharedNote.textContent += ` Top players are at ${defaultPts(cls)}: the shaded nodes are what you are skipping for now.`;
    }
    nextBox.replaceChildren(el("div", "subHead", "Buy next"));
    const ol = el("ol", "pnList");
    for (const x of plan.next.slice(0, deep ? 8 : 5)) ol.append(nextItem(x, x.sum));
    if (!plan.next.length) ol.append(el("li", "note", "Nothing left on the shared boards."));
    nextBox.append(ol);
    for (const [board] of OWN_BOARDS) {
      const list = plan.ownNext[board];
      if (!list.length) continue;
      const ol = el("ol", "pnList");
      for (const x of list.slice(0, deep ? 6 : 3)) ol.append(nextItem(x));
      nextBox.append(el("div", "subHead", `${board} next`), ol);
    }
    if (haveBox) {
      // The big nodes bought by now, board by board.
      haveBox.replaceChildren(el("div", "subHead", "Bought by now: skills, passives and orange nodes"));
      const dl = el("dl", "pHaveList");
      for (const board of boards) {
        const counts = new Map();
        for (const i of plan.boards[board].have) {
          const n = nodeInfo(cls, board, i);
          if (n.kind === "stat" || n.kind === "start") continue;
          const key = n.kind === "special" ? n.tip : n.name;
          counts.set(key, { kind: n.kind, c: (counts.get(key)?.c || 0) + 1 });
        }
        const dd = el("dd");
        for (const [name, { kind, c }] of counts) dd.append(el("span", `hv ${kind}`, c > 1 ? `${name} ×${c}` : name));
        if (!counts.size) dd.append(el("span", "note", "–"));
        dl.append(el("dt", null, board), dd);
      }
      haveBox.append(dl);
    }
  }
  paint();

  return {
    root,
    // From the other window: move the sliders without re-drawing.
    set(v) {
      if (typeof v.pts === "number") {
        state.pts = v.pts;
        shared.input.value = v.pts;
        shared.num.value = v.pts;
      }
      for (const [, key] of OWN_BOARDS) {
        if (typeof v[key] !== "number") continue;
        state[key] = v[key];
        ownSliders[key].input.value = v[key];
        ownSliders[key].num.value = v[key];
      }
      paint();
    },
  };
}
