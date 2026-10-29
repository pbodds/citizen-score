// Citizen Score: draws a build (builds.js) for the docked panel and the
// pop-out. The panel stacks the parts as folding sections; the pop-out
// (`deep`) lays them out as cards with every pick rate charted, and can put
// PvE and PvP side by side ("compare").

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v)}%`);
const MODE_NAME = { pve: "PvE", pvp: "PvP" };

// One horizontal bar per sample: [label, value, class].
function bars(rows) {
  const box = el("div", "bars");
  for (const [label, value, cls] of rows) {
    const row = el("div", `barRow ${cls || ""}`);
    row.append(el("span", "barLabel", label));
    const track = el("span", "barTrack");
    const fill = el("span", "barFill");
    fill.style.width = `${Math.max(0, Math.min(100, value ?? 0))}%`;
    if (value === null || value === undefined) track.classList.add("none");
    track.append(fill);
    row.append(track, el("span", "barVal", pct(value)));
    box.append(row);
  }
  return box;
}

function section(title, deep, open, wide) {
  if (deep) {
    const card = el("section", `card${wide ? " wide" : ""}`);
    card.append(el("h2", "cardHead", title));
    return { root: card, body: card };
  }
  const d = el("details", "sec");
  d.open = !!open;
  d.dataset.sec = title;
  d.append(el("summary", null, title));
  const body = el("div", "secBody");
  d.append(body);
  return { root: d, body };
}

// --- Stigmas -----------------------------------------------------------------
function stigmaRate(b, name) {
  return b.stigmaRates.find((r) => r[0] === name) || [name, null, null, null];
}

function stigmaSlots(b, mode) {
  const build = b[mode];
  const box = el("div", "slots");
  build.stigmas.forEach((name, i) => {
    const r = stigmaRate(b, name);
    const tile = el("div", "slot");
    tile.append(el("span", "slotN", String(i + 1)), el("span", "slotName", name));
    tile.append(el("span", "slotRate", `${pct(mode === "pve" ? r[1] : r[2])} KR · ${pct(r[3])} global`));
    box.append(tile);
  });
  return box;
}

function swapList(b, mode) {
  const ul = el("ul", "swaps");
  for (const [name, why] of b[mode].swaps) {
    const li = el("li");
    li.append(el("strong", null, name), document.createTextNode(` — ${why}`));
    ul.append(li);
  }
  return ul;
}

function stigmaTable(b, mode) {
  const picks = new Set(mode === "compare" ? [...b.pve.stigmas, ...b.pvp.stigmas] : b[mode].stigmas);
  const col = mode === "pvp" ? 2 : 1;
  const rows = [...b.stigmaRates].sort((x, y) => (y[col] ?? 0) - (x[col] ?? 0));
  const t = el("table", "rates");
  const head = el("tr");
  for (const h of ["Stigma", "PvE", "PvP", "Global", "PvP lift"]) head.append(el("th", null, h));
  t.append(head);
  for (const [name, pve, pvp, global] of rows) {
    const tr = el("tr", picks.has(name) ? "pick" : "");
    const tags = [];
    if (b.pve.stigmas.includes(name)) tags.push("PvE");
    if (b.pvp.stigmas.includes(name)) tags.push("PvP");
    const nameTd = el("td", "rName", name);
    for (const tag of tags) nameTd.append(el("span", `tag ${tag.toLowerCase()}`, tag));
    tr.append(nameTd);
    for (const [v, cls] of [[pve, "pve"], [pvp, "pvp"], [global, "global"]]) {
      const td = el("td", "rBar");
      const track = el("span", `miniTrack ${cls}`);
      const fill = el("span", "miniFill");
      fill.style.width = `${v ?? 0}%`;
      track.append(fill);
      td.append(track, el("span", "miniVal", pct(v)));
      tr.append(td);
    }
    const lift = pve !== null && pvp !== null ? pvp - pve : null;
    const liftTd = el("td", `rLift ${lift >= 15 ? "up" : lift <= -5 ? "down" : ""}`, lift === null ? "–" : `${lift > 0 ? "+" : ""}${Math.round(lift)}`);
    tr.append(liftTd);
    t.append(tr);
  }
  return t;
}

// --- Daevanion ---------------------------------------------------------------
function daevanion(id, mode, deep, plan) {
  const b = BUILDS[id];
  const frag = el("div", "daev");
  const sum = el("div", "poolLine");
  sum.append(el("strong", null, `${defaultPts(id)} / ${SHARED_POOL}`), document.createTextNode(" shared points (Nezekan–Triniel) in the top players' boards"));
  frag.append(sum);
  frag.append(el("p", "keyNodes", b.keyNodes));
  // Passives the PvP sample raises far more than PvE: where PvP points go.
  if (mode !== "pve") {
    const tilt = b.passiveRates.filter(([, pve, pvp]) => pvp !== null && (pve === null || pvp - pve >= 15));
    if (tilt.length) {
      frag.append(el("p", "pvpTilt", `PvP: move green nodes to ${tilt.map(([n, pve, pvp]) => `${n} (${pct(pvp)} PvP vs ${pct(pve)} PvE)`).join(", ")}; drop the PvE damage passives.`));
    }
  }
  // The boards, and a slider for how many points you have.
  const planner = daevPlanner(id, { deep, pts: plan.pts, ar: plan.ar, az: plan.az, onChange: plan.onChange });
  plan.planner = planner;
  frag.append(planner.root);
  if (mode !== "pvp") {
    const ariel = el("p", "ariel");
    ariel.append(el("strong", null, "Ariel (PvE, own points): "), document.createTextNode(ARIEL_ADVICE[b.board]));
    const n = typeof ARIEL_SAMPLE === "object" ? ARIEL_SAMPLE[id] : 0;
    const spent = DAEV_ORDER[id].Ariel?.spent;
    if (spent) ariel.append(document.createTextNode(` The Ariel tab follows ${n >= 15 ? `${n} top ${b.name}s'` : "top players'"} boards (median ${spent} points so far).`));
    frag.append(ariel);
    if (deep) frag.append(el("p", "note", ARIEL_NOTE));
  }
  frag.append(el("p", "note", `Azphel: ${AZPHEL.note}`));
  const legend = el("div", "legend");
  for (const [k, label] of [["stat", "stat 1"], ["passive", "passive 2"], ["skill", "skill 3"], ["special", "special 4"], ["next", "buy next"]]) {
    legend.append(el("span", `lg ${k}`, label));
  }
  frag.append(legend);
  if (deep) {
    const ul = el("ul", "rules");
    for (const r of DAEVANION_RULES) ul.append(el("li", null, r));
    frag.append(ul);
  }
  return frag;
}

// --- Skills and passives -----------------------------------------------------
function skillsPart(b, mode, deep) {
  const frag = el("div");
  const order = el("ol", "order");
  for (const s of b[mode].levelOrder) order.append(el("li", null, s));
  frag.append(el("div", "subHead", `Level order (${MODE_NAME[mode]})`), order);
  const specs = el("dl", "specs");
  for (const [skill, text] of b[mode].specs) specs.append(el("dt", null, skill), el("dd", null, text));
  frag.append(el("div", "subHead", "Specialties (skill level · pick)"), specs);
  frag.append(el("p", "note", b[mode].skip));
  if (deep) {
    frag.append(el("div", "subHead", "Share at Lv 20+ (PvE · PvP)"));
    const col = mode === "pvp" ? 2 : 1;
    for (const [name, pve, pvp] of [...b.skillRates].sort((x, y) => y[col] - x[col])) {
      const box = el("div", "pair");
      box.append(el("div", "pairName", name), bars([["PvE", pve, "pve"], ["PvP", pvp, "pvp"]]));
      frag.append(box);
    }
  }
  return frag;
}

function passivesPart(id, mode, deep) {
  const b = BUILDS[id];
  const col = mode === "pvp" ? 2 : 1;
  const rows = [...b.passiveRates].sort((x, y) => (y[col] ?? -1) - (x[col] ?? -1));
  const frag = el("div");
  frag.append(el("p", "note", "Share of top players' gear raising each passive: hunt these on gear, on Bell and Mirror Arcana, and the green Daevanion nodes for them."));
  frag.append(playPassives(id, mode));
  if (deep) {
    frag.append(el("div", "subHead", "Share of top gear (PvE · PvP)"));
    for (const [name, pve, pvp] of rows) {
      const box = el("div", "pair");
      box.append(el("div", "pairName", name), bars([["PvE", pve, "pve"], ["PvP", pvp, "pvp"]]));
      frag.append(box);
    }
  }
  return frag;
}

// --- Arcana, gear ------------------------------------------------------------
function arcanaPick(b, mode) {
  const i = mode === "pvp" ? 1 : 0;
  const bySlot = new Map();
  ARCANA_ROWS.forEach(([slot, card, stat], n) => {
    const v = b.arcana[n][i];
    if (v === null) return;
    const list = bySlot.get(slot) || [];
    list.push({ card, stat, v });
    bySlot.set(slot, list);
  });
  const out = [];
  for (const [slot, list] of bySlot) {
    list.sort((x, y) => y.v - x.v);
    // Both cards when both are common (the slot holds more than one).
    const take = list.filter((c, k) => k === 0 || c.v >= 50);
    out.push([slot, take]);
  }
  return out;
}

function arcanaPart(id, mode, deep) {
  const b = BUILDS[id];
  const frag = el("div");
  const modes = mode === "compare" ? ["pve", "pvp"] : [mode];
  for (const m of modes) {
    if (modes.length > 1) frag.append(el("div", "subHead", MODE_NAME[m]));
    frag.append(playArcana(id, m));
  }
  if (deep) {
    const t = el("table", "rates");
    const head = el("tr");
    for (const h of ["Card", "Stat", "PvE", "PvP"]) head.append(el("th", null, h));
    t.append(head);
    ARCANA_ROWS.forEach(([, card, stat], n) => {
      const [pve, pvp] = b.arcana[n];
      const tr = el("tr");
      tr.append(el("td", "rName", card), el("td", "rStat", stat));
      for (const [v, cls] of [[pve, "pve"], [pvp, "pvp"]]) {
        const td = el("td", "rBar");
        const track = el("span", `miniTrack ${cls}`);
        const fill = el("span", "miniFill");
        fill.style.width = `${v ?? 0}%`;
        track.append(fill);
        td.append(track, el("span", "miniVal", pct(v)));
        tr.append(td);
      }
      t.append(tr);
    });
    frag.append(t);
  }
  return frag;
}

function gearPart(b, mode) {
  const dl = el("dl", "facts");
  const modes = mode === "compare" ? ["pve", "pvp"] : [mode];
  const add = (k, v) => dl.append(el("dt", null, k), el("dd", null, v));
  add("Stats", b.stats);
  add("Manastones", b.manastones);
  for (const m of modes) add(`Theostone${modes.length > 1 ? ` ${MODE_NAME[m]}` : ""}`, b[m].theostone);
  for (const m of modes) add(`Wings${modes.length > 1 ? ` ${MODE_NAME[m]}` : ""}`, b[m].wings);
  add("Gear", b.gear);
  return dl;
}

// PvE: the in-game macro (play.js); PvP: the combos.
function rotationPart(id, mode) {
  return mode === "pvp" ? playCombos(id) : playMacro(id);
}

// --- The whole build ---------------------------------------------------------
// `open`: the panel's folded sections the player left open, by title.
// `pts`/`ar`/`az`: the Daevanion planner's shared, Ariel and Azphel points
// (null: the top players'); onPts({ pts, ar, az }) when the player moves them. Returns { setPts } to move
// them from elsewhere without a redraw.
function renderBuild(root, id, mode, { deep = false, open = null, onToggle = null, pts = null, ar = null, az = null, onPts = null } = {}) {
  const b = BUILDS[id];
  root.replaceChildren();
  const plan = { pts, ar, az, onChange: onPts, planner: null };
  const out = { setPts: (v) => plan.planner?.set(v) };
  if (!b) return out;
  const isOpen = (title, dflt) => (open && title in open ? open[title] : dflt);
  const add = (title, fill, dflt, wide) => {
    const s = section(title, deep, isOpen(title, dflt), wide);
    fill(s.body);
    if (!deep && onToggle) s.root.addEventListener("toggle", () => onToggle(title, s.root.open));
    root.append(s.root);
  };

  const head = el("div", "classHead");
  head.append(el("span", "className", b.name), el("span", "classRole", `${b.role} · ${b.weapon}`));
  head.append(el("span", "classSample", `data: ${b.sample} players`));
  root.append(head);

  const modes = mode === "compare" ? ["pve", "pvp"] : [mode];
  add("Stigmas", (body) => {
    if (modes.length > 1) {
      const cols = el("div", "cols");
      for (const m of modes) {
        const c = el("div", `col ${m}`);
        c.append(el("div", "subHead", MODE_NAME[m]), stigmaSlots(b, m), swapList(b, m));
        cols.append(c);
      }
      body.append(cols);
    } else {
      body.append(stigmaSlots(b, mode), el("div", "subHead", "Swap in"), swapList(b, mode));
    }
    if (deep) {
      body.append(el("div", "subHead", "Every stigma: share of top KR players (PvE · PvP) and global"));
      body.append(stigmaTable(b, mode));
    }
  }, true, deep);

  if (modes.length > 1) {
    add("Macro and rotation", (body) => {
      const cols = el("div", "cols");
      for (const m of modes) {
        const c = el("div", `col ${m}`);
        c.append(el("div", "subHead", MODE_NAME[m]), rotationPart(id, m));
        cols.append(c);
      }
      body.append(cols);
    }, true, true);
  } else {
    add("Macro and rotation", (body) => body.append(rotationPart(id, mode)), true);
  }
  add("Daevanion", (body) => body.append(daevanion(id, mode, deep, plan)), true, deep);

  if (modes.length > 1) {
    add("Skills", (body) => {
      const cols = el("div", "cols");
      for (const m of modes) {
        const c = el("div", `col ${m}`);
        c.append(skillsPart(b, m, false));
        cols.append(c);
      }
      body.append(cols);
    }, false, true);
  } else {
    add("Skills", (body) => body.append(skillsPart(b, mode, deep)), false);
  }
  add("Passives", (body) => body.append(passivesPart(id, mode === "compare" ? "pve" : mode, deep)), false);
  add("Stats, gear, Theostone", (body) => body.append(gearPart(b, mode)), false);
  add("Arcana", (body) => body.append(arcanaPart(id, mode, deep)), true);
  add("Sources", (body) => {
    body.append(el("p", "note", `Compiled ${BUILD_UPDATED}. Pick rates are what top players run, not a simulation: they move with patches.`));
    const ul = el("ul", "sources");
    for (const [label, url] of BUILD_SOURCES) {
      const li = el("li");
      const a = el("a", "src", label);
      a.href = url;
      a.dataset.url = url;
      li.append(a);
      ul.append(li);
    }
    body.append(ul);
  }, false);
  return out;
}
