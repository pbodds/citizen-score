// Citizen Score: draws the game guide (guide.js) for the panel and the
// pop-out. Each chapter folds; a search box narrows every chapter to the
// rows, tips and paragraphs that mention what you typed, opening the
// chapters that have any and marking the words found. A { play } part is
// drawn by playview.js for one class, with its own class and PvE/PvP picker.

// "abc" in text, as <mark>s; plain text when there's nothing to mark.
function marked(text, q) {
  const s = String(text);
  if (!q) return document.createTextNode(s);
  const frag = document.createDocumentFragment();
  const low = s.toLowerCase();
  let at = 0;
  for (let i = low.indexOf(q); i !== -1; i = low.indexOf(q, at)) {
    if (i > at) frag.append(s.slice(at, i));
    frag.append(el("mark", null, s.slice(i, i + q.length)));
    at = i + q.length;
  }
  if (at < s.length) frag.append(s.slice(at));
  return frag;
}
const hits = (text, q) => !q || String(text).toLowerCase().includes(q);

// A part, cut down to what matches `q` (null if nothing does). Headings are
// kept when anything under them is.
function partFor(part, q, headHit, pick) {
  if (!q || headHit) return part;
  if (part.play) return playText(part.play, pick.cls).includes(q) ? part : null;
  if (part.genus) return genusText().includes(q) ? part : null;
  if (part.table) {
    const [head, ...rows] = part.table;
    const keep = rows.filter((r) => r.some((c) => hits(c, q)));
    return keep.length ? { table: [head, ...keep] } : null;
  }
  for (const k of ["tips", "steps"]) {
    if (part[k]) {
      const keep = part[k].filter((t) => hits(t, q));
      return keep.length ? { [k]: keep } : null;
    }
  }
  const text = part.p ?? part.tip ?? part.warn;
  return text != null && hits(text, q) ? part : null;
}

// Genus Insight (guide.js GENUS_BOARDS / GENUS_SLOTS): one card per board,
// its 9 slots top to bottom with the upgrade priority and the line to roll.
function genusSlot(board, n) {
  const g = GENUS_SLOTS[n];
  const lines = n === 4 || n === 7 ? board[n] : [g.best, ...(g.alt || [])];
  return { ...g, best: lines[0], alt: lines.slice(1), only: n === 4 && board.only4 };
}
function genusText() {
  return GENUS_BOARDS.map((b) => [b.name, b.note, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => {
    const g = genusSlot(b, n);
    return [g.best, ...g.alt, g.why || "", g.cond || ""];
  })].join(" ")).join(" ").toLowerCase();
}
function drawGenus() {
  const grid = el("div", "genus");
  for (const board of GENUS_BOARDS) {
    const card = el("div", `gnBoard${board.first ? " first" : ""}`);
    const head = el("div", "gnHead");
    head.append(el("span", "gnName", board.name));
    if (board.first) head.append(el("span", "gnFirst", "level first"));
    card.append(head);
    if (board.note) card.append(el("div", "gnNote", board.note));
    const ol = el("ol", "gnSlots");
    for (let n = 1; n <= 9; n++) {
      const g = genusSlot(board, n);
      const li = el("li", g.skip ? "skip" : n === 4 ? "key" : "");
      li.append(el("span", "gnN", String(n)));
      li.append(el("span", `gnRank${g.rank === 1 ? " top" : ""}`, g.rank ? `#${g.rank}` : "w/ 6"));
      const body = el("span", "gnBody");
      const best = el("span", `pill ${g.skip ? "skip" : "want"}`, g.best);
      body.append(best);
      for (const a of g.alt) body.append(el("span", "gnGt", ">"), el("span", "pill fine", a));
      if (g.only) body.append(el("span", "gnGrade", "only this: roll until you get it"));
      if (g.grade) body.append(el("span", "gnGrade", g.grade));
      if (g.cond) body.append(el("span", "gnGrade", g.cond));
      if (g.why && !g.only) li.title = g.why;
      if (g.skip) body.append(el("span", "gnGrade", "usually skip"));
      li.append(body);
      ol.append(li);
    }
    card.append(ol);
    grid.append(card);
  }
  const key = el("p", "note", "Slots 1–9 top to bottom as in the game. #1 = upgrade first. Green = the line to roll, amber = fallbacks in order. Hover a slot for why.");
  const box = el("div");
  box.append(key, grid);
  return box;
}

function drawPart(part, q, pick, onPick) {
  if (part.genus) return drawGenus();
  if (part.h) return el("div", "subHead", part.h);
  if (part.play) return playPart(part.play, pick, onPick);
  if (part.p != null) {
    const p = el("p", "gP");
    p.append(marked(part.p, q));
    return p;
  }
  if (part.tip != null || part.warn != null) {
    const box = el("p", part.warn != null ? "gWarn" : "gTip");
    box.append(marked(part.warn ?? part.tip, q));
    return box;
  }
  if (part.tips || part.steps) {
    const list = el(part.steps ? "ol" : "ul", "gList");
    for (const t of part.tips || part.steps) {
      const li = el("li");
      li.append(marked(t, q));
      list.append(li);
    }
    return list;
  }
  if (part.table) {
    const wrap = el("div", "gTableWrap");
    const t = el("table", "gTable");
    const [head, ...rows] = part.table;
    const hr = el("tr");
    for (const h of head) hr.append(el("th", null, h));
    t.append(hr);
    for (const r of rows) {
      const tr = el("tr");
      r.forEach((c, i) => {
        const td = el(i ? "td" : "th");
        td.append(marked(c, q));
        tr.append(td);
      });
      t.append(tr);
    }
    wrap.append(t);
    return wrap;
  }
  return null;
}

// The chapter's parts that match, with the headings above them.
function chapterParts(ch, q, pick) {
  if (!q || hits(ch.title, q) || hits(ch.sum, q)) return ch.parts;
  const out = [];
  let head = null;
  let headHit = false;
  for (const part of ch.parts) {
    if (part.h) {
      head = part;
      headHit = hits(part.h, q);
      if (headHit) out.push(part);
      continue;
    }
    const kept = partFor(part, q, headHit, pick);
    if (!kept) continue;
    if (head && !headHit && !out.includes(head)) out.push(head);
    out.push(kept);
  }
  return out;
}

// root: where to draw. open: { chapterId: bool } as the player left them.
// onToggle(id, open). query/onQuery: the search box. deep: the pop-out.
// cls/mode: the class the play parts show; onPick(cls, mode) when changed there.
function renderGuide(root, { deep = false, open = {}, onToggle = null, query = "", onQuery = null, cls = "gladiator", mode = "pve", onPick = null } = {}) {
  root.replaceChildren();
  const pick = { cls: BUILDS[cls] ? cls : "gladiator", mode: mode === "pvp" ? "pvp" : "pve" };
  // Redraw only the play parts, so the scroll and the open chapters stay.
  const drawPlay = () => {
    for (const node of root.querySelectorAll(".playPart")) {
      node.replaceWith(playPart(node.dataset.kind, pick, choose));
    }
  };
  const choose = (c, m) => {
    if (c === pick.cls && m === pick.mode) return;
    pick.cls = c;
    pick.mode = m;
    drawPlay();
    if (onPick) onPick(c, m);
  };
  const top = el("div", "gTop");
  const box = el("input", "gSearch");
  Object.assign(box, { type: "search", placeholder: `Search ${GUIDE.length} chapters…`, value: query });
  box.setAttribute("aria-label", "Search the guide");
  const count = el("span", "gCount");
  top.append(box, count);
  // "Your character" (advisor.js) goes here, in the panel.
  const me = el("div", "sec aCard");
  me.hidden = true;
  const toc = el("div", "gToc");
  const body = el("div", "gBody");
  root.append(me, top, toc, body);

  const draw = () => {
    const q = box.value.trim().toLowerCase();
    body.replaceChildren();
    toc.replaceChildren();
    let found = 0;
    for (const ch of GUIDE) {
      const parts = chapterParts(ch, q, pick);
      if (q && !parts.length) continue;
      found++;
      const chip = el("button", ch.fresh ? "fresh" : null, ch.title);
      chip.type = "button";
      chip.title = ch.sum;
      chip.addEventListener("click", () => {
        sec.open = true;
        sec.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      toc.append(chip);

      const sec = el("details", "sec gCh");
      sec.id = `g-${ch.id}`;
      // A chapter the player never folded starts as the guide says (ch.open).
      sec.open = q ? true : ch.id in open ? !!open[ch.id] : !!ch.open;
      if (ch.fresh) sec.classList.add("fresh");
      const sum = el("summary");
      const title = el("span", "gTitle", ch.title);
      if (ch.fresh) title.append(el("span", "newTag", "NEW"));
      sum.append(title, el("span", "gSum", ch.sum));
      const inner = el("div", "secBody");
      for (const part of parts) {
        const node = drawPart(part, q, pick, choose);
        if (node) inner.append(node);
      }
      if (ch.src?.length) {
        const src = el("p", "note gSrc");
        src.append("Sources: ");
        ch.src.forEach(([label, url], i) => {
          const a = el("a", "src", label);
          a.href = url;
          a.dataset.url = url;
          src.append(i ? ", " : "", a);
        });
        inner.append(src);
      }
      sec.append(sum, inner);
      if (!q && onToggle) sec.addEventListener("toggle", () => onToggle(ch.id, sec.open));
      body.append(sec);
    }
    count.textContent = q ? `${found} of ${GUIDE.length} chapters` : "";
    if (q && !found) body.append(el("p", "note", "Nothing in the guide mentions that. Try a shorter word."));
  };
  let timer = 0;
  box.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      draw();
      if (onQuery) onQuery(box.value);
    }, 150);
  });
  draw();
  if (deep) root.classList.add("gDeep");
  return {
    focus: () => box.focus(),
    me,
    // Show another class (or mode) in the play parts, from the tabs outside.
    setPick(c, m) {
      if (!BUILDS[c] || ((m === "pvp" ? "pvp" : "pve") === pick.mode && c === pick.cls)) return;
      pick.cls = c;
      pick.mode = m === "pvp" ? "pvp" : "pve";
      drawPlay();
    },
    // Open a chapter and bring it into view (clearing a search that hides it).
    open(id) {
      if (box.value) {
        box.value = "";
        draw();
        if (onQuery) onQuery("");
      }
      const sec = body.querySelector(`#g-${id}`);
      if (!sec) return;
      sec.open = true;
      if (onToggle) onToggle(id, true);
      sec.scrollIntoView({ block: "start", behavior: "smooth" });
    },
  };
}

// Every link the guide may open (the pop-out asks the panel to open them).
const GUIDE_URLS = new Set(GUIDE.flatMap((c) => (c.src || []).map(([, u]) => u)));
