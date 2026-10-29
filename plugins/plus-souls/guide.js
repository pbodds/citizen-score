// Citizen Score: the Guide view.
//
// Two parts (class builds, gear and leveling are in the Builds panel):
// - Farming route: which Kibelisks to farm from, in what order, for the pets
//   you still need. Stops are picked greedily (each next stop is the one where
//   a kill does the most for the pets no earlier stop covers: the sum of their
//   best drop chances there), then walked nearest-first from the best one.
//   It can be drawn on the Map.
// - Genus: what each genus gives per pet, what yours give now, and the souls
//   still left in each, ordered by what your class wants.
//
// Plain globals from plugin.js, areas.js and map.js are used as they are:
// state, prefs, savePrefs, key, language, text, petName, render, areas,
// needs, chanceOf, sideOf, showView, PET_GENUS, MAP, mapIdOf, mapState,
// mapEls, drawMap, goTo, fitView, renderMap.

const GENUS_BONUS = {
  // Per pet, at levels 1, 2 and 3 (its "owned" effect, kept unequipped).
  cogni: [{ HP: 10 }, { HP: 20, "Critical Hit": 1 }, { HP: 30, "Critical Hit": 2, Might: 1 }],
  fera: [{ "Mount speed": 1 }, { "Mount speed": 2, Accuracy: 1 }, { "Mount speed": 3, Accuracy: 2, Dexterity: 1 }],
  natura: [{ Stamina: 3 }, { Stamina: 6, "Crit Resist": 1 }, { Stamina: 9, "Crit Resist": 2, Precision: 1 }],
  varian: [{ "Sprint cost −%": 0.1 }, { "Sprint cost −%": 0.2, Evasion: 1 }, { "Sprint cost −%": 0.3, Evasion: 2, Constitution: 1 }],
};
const GENUS_WHAT = {
  cogni: "Damage: Critical Hit and Might (Attack), plus HP.",
  fera: "Accuracy and Dexterity, and the only ground mount speed: farm some early for travel.",
  natura: "Survival: Critical Hit Resist and Precision (Accuracy + Critical Hit), plus Stamina.",
  varian: "Defence: Evasion and Constitution, and cheaper mount sprint.",
};

// Each class's stat priority and genus order, from MetaBot's class guide
// (2026-10-15) and aion2-meta (2026-10-23).
const CLASSES = {
  gladiator: { name: "Gladiator", ko: "검성", stats: "Attack > Critical Hit > Accuracy > HP > Block", genus: ["cogni", "fera", "natura", "varian"] },
  templar: { name: "Templar", ko: "수호성", stats: "Block > Defence > HP > Crit Resist > Attack", genus: ["natura", "varian", "cogni", "fera"] },
  assassin: { name: "Assassin", ko: "살성", stats: "Attack > Critical Hit > Back Attack damage > Accuracy > Evasion", genus: ["cogni", "fera", "varian", "natura"] },
  ranger: { name: "Ranger", ko: "궁성", stats: "Attack > Critical Hit > Accuracy > Evasion > HP", genus: ["cogni", "fera", "varian", "natura"] },
  sorcerer: { name: "Sorcerer", ko: "마도성", stats: "Attack > Critical Hit > MP > Accuracy > HP", genus: ["cogni", "fera", "natura", "varian"] },
  spiritmaster: { name: "Spiritmaster", ko: "정령성", stats: "Attack > Critical Hit > Accuracy > HP > MP", genus: ["cogni", "fera", "natura", "varian"] },
  cleric: { name: "Cleric", ko: "치유성", stats: "HP > Defence > MP > Crit Resist > Attack", genus: ["cogni", "natura", "varian", "fera"] },
  chanter: { name: "Chanter", ko: "호법성", stats: "HP > Attack > Defence > Critical Hit > Accuracy", genus: ["cogni", "natura", "fera", "varian"] },
};
const CLASS_BY_KO = Object.fromEntries(Object.entries(CLASSES).map(([id, c]) => [c.ko, id]));

const guideEls = {
  section: document.querySelector(".guideView"),
  route: document.querySelector(".guideRoute"),
  genus: document.querySelector(".guideGenus"),
  routeToggle: document.querySelector(".mapRouteToggle"),
};
let detectedClass = null;

const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const classId = () => (CLASSES[prefs.guideClass] ? prefs.guideClass : detectedClass || "gladiator");

// ---- the route ----------------------------------------------------------------

function kibOnMap(mid, name) {
  return (MAP.kibelisks[mid] || []).find((k) => k.n === name) || null;
}

// Every Kibelisk with something to farm near it, per map: the pets there and
// each one's best chance.
function routeStopsByMap() {
  const byMap = new Map();
  for (const a of areas()) {
    const mid = mapIdOf(a.map);
    if (!mid || !a.kib) continue;
    const stops = byMap.get(mid) || new Map();
    const s = stops.get(a.kib.name) || { mid, kib: a.kib, at: kibOnMap(mid, a.kib.name), zones: new Set(), pets: new Map() };
    s.zones.add(a.zone);
    for (const p of a.pets.values()) {
      for (const d of p.drops) {
        const c = chanceOf(d.chance);
        const have = s.pets.get(p.pet);
        if (!have || c > have.chance) s.pets.set(p.pet, { pet: p.pet, left: p.left, chance: c, drop: d });
      }
    }
    stops.set(a.kib.name, s);
    byMap.set(mid, stops);
  }
  return byMap;
}

// Greedy cover, then nearest-first. At most 8 stops: past that the gain per
// stop is small and you'd be better off on another map.
function planRoute(stops) {
  const covered = new Set();
  const picked = [];
  const pool = [...stops.values()];
  while (picked.length < 8) {
    let best = null;
    for (const s of pool) {
      if (picked.includes(s)) continue;
      let gain = 0, souls = 0;
      for (const p of s.pets.values()) if (!covered.has(p.pet)) { gain += p.chance; souls += p.left; }
      if (gain > 0 && (!best || gain > best.gain || (gain === best.gain && souls > best.souls))) best = { s, gain, souls };
    }
    if (!best) break;
    best.s.farm = [...best.s.pets.values()].filter((p) => !covered.has(p.pet)).sort((a, b) => b.chance - a.chance);
    best.s.gain = best.gain;
    for (const p of best.s.farm) covered.add(p.pet);
    picked.push(best.s);
  }
  // Walk: start at the best stop, then always the nearest placed one.
  const order = picked.length ? [picked[0]] : [];
  const rest = picked.slice(1);
  while (rest.length) {
    const from = order[order.length - 1].at;
    let j = 0;
    if (from) {
      let bestD = Infinity;
      rest.forEach((s, i) => {
        const d = s.at ? Math.hypot(s.at.x - from.x, s.at.y - from.y) : Infinity;
        if (d < bestD) { bestD = d; j = i; }
      });
    }
    order.push(rest.splice(j, 1)[0]);
  }
  return order;
}

function routeMapChoice(byMap) {
  const total = (mid) => planRoute(byMap.get(mid)).reduce((n, s) => n + s.gain, 0);
  const mids = [...byMap.keys()].sort((a, b) => total(b) - total(a));
  const here = mapIdOf(mapKeyOf(zoneMap));
  if (prefs.routeMap && byMap.has(prefs.routeMap)) return { mid: prefs.routeMap, mids };
  if (here && byMap.has(here)) return { mid: here, mids };
  return { mid: mids[0] || null, mids };
}

let lastRoute = null; // { mid, stops } as last planned, for the map overlay
function currentRoute() {
  const byMap = routeStopsByMap();
  const { mid, mids } = routeMapChoice(byMap);
  lastRoute = mid ? { mid, stops: planRoute(byMap.get(mid)) } : null;
  return { mids, route: lastRoute };
}

// ---- stars ---------------------------------------------------------------------
// The Guide stars (pins) a set of pets in one click: the route's, a stop's, a
// genus's. Pinned pets lead the list and the radar. Stars it adds are kept in
// prefs.guidePinned and go again by themselves once that pet is at level 3;
// stars set by hand on the list are never touched.

const starSets = new Map(); // "route:0" etc. -> pet ids, for the click

// A genus's pets still needing souls, cheapest to finish first.
function genusNeeds(g) {
  const want = needs();
  return [...want.entries()].filter(([id]) => PET_GENUS[id] === g).sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

function starButton(ids, kind, i, label) {
  const set = [...new Set(ids.map(String))];
  const key = `${kind}:${i}`;
  starSets.set(key, set);
  const pinned = new Set((prefs.pinned || []).map(String));
  const all = set.length > 0 && set.every((id) => pinned.has(id));
  const b = el("button", `starSet${kind === "stop" ? " starStop" : ""}`, all ? (kind === "stop" ? "★" : "☆ Unstar") : label);
  b.type = "button";
  b.dataset.star = key;
  b.setAttribute("aria-pressed", String(all));
  b.title = all ? `Unstar these ${set.length} pets` : `Star these ${set.length} pets: they go to the top of the list and the radar`;
  return b;
}

// Star the set, or unstar it if every one is starred already.
function starClick(e) {
  const b = e.target.closest("[data-star]");
  if (!b) return false;
  e.stopPropagation();
  const set = starSets.get(b.dataset.star) || [];
  const pinned = (prefs.pinned || []).map(String);
  const mine = new Set((prefs.guidePinned || []).map(String));
  if (set.length && set.every((id) => pinned.includes(id))) {
    prefs.pinned = pinned.filter((id) => !set.includes(id));
    for (const id of set) mine.delete(id);
  } else {
    const add = set.filter((id) => !pinned.includes(id));
    prefs.pinned = [...pinned, ...add];
    for (const id of add) mine.add(id);
  }
  prefs.guidePinned = [...mine];
  savePrefs();
  render();
  return true;
}

// The Guide's stars on pets now done come off.
function dropDoneStars() {
  const mine = (prefs.guidePinned || []).map(String);
  if (!mine.length || !(Object.keys(state.levels).length || Object.keys(state.points).length)) return;
  const want = needs();
  const done = mine.filter((id) => !want.has(id));
  if (!done.length) return;
  prefs.pinned = (prefs.pinned || []).map(String).filter((id) => !done.includes(id));
  prefs.guidePinned = mine.filter((id) => !done.includes(id));
  savePrefs();
}

function renderRoute() {
  const box = guideEls.route;
  const { mids, route } = currentRoute();
  const head = el("p", "guideNote");
  if (!route) {
    box.replaceChildren(el("p", "guideNote", "Nothing left to farm in the regions turned on. 🎉"));
    return;
  }
  head.textContent = "Teleport to each Kibelisk in turn and farm the pets listed there. Each stop only lists pets no earlier stop covers; kills are expected kills to finish that pet.";
  const chips = el("div", "chips guideMaps");
  const here = mapIdOf(mapKeyOf(zoneMap));
  for (const m of mids) {
    const b = el("button", null, `${m === here ? "📍 " : ""}${text(`String_STR_Map_${m}_body`)}`);
    b.type = "button";
    b.dataset.map = m;
    b.setAttribute("aria-pressed", String(m === route.mid));
    chips.append(b);
  }
  const ol = el("ol", "routeList");
  let kills = 0;
  route.stops.forEach((s, i) => {
    const li = el("li", "routeStop");
    li.dataset.i = i;
    const title = el("div", "routeTitle");
    title.append(el("span", "routeN", String(i + 1)), `${s.kib.teleport ? `#${s.kib.teleport} ` : ""}${text(s.kib.name)}`);
    title.append(starButton(s.farm.map((p) => p.pet), "stop", i, "★"));
    const stopKills = s.farm.reduce((n, p) => n + (p.chance ? p.left / p.chance : 0), 0);
    kills += stopKills;
    const sub = el("div", "routeSub", `${s.farm.length} pet${s.farm.length === 1 ? "" : "s"} · ${[...s.zones].map(text).filter(Boolean).join(", ")}`);
    li.append(title, sub);
    for (const p of s.farm) {
      const d = p.drop;
      const row = el("div", "routePet");
      row.append(el("strong", null, petName(p.pet)), ` ${text(d.npc)}${d.level ? ` Lv ${d.level}` : ""} · ${d.chance}${p.chance ? ` · ~${Math.ceil(p.left / p.chance).toLocaleString(language)} kills` : ""}`);
      li.append(row);
    }
    ol.append(li);
  });
  const foot = el("div", "guideRow");
  const show = el("button", "showOnMap", "Show route on map");
  show.type = "button";
  show.dataset.act = "route-map";
  foot.append(show, starButton(route.stops.flatMap((s) => s.farm.map((p) => p.pet)), "route", 0, "★ Star route pets"), el("span", "guideNote", ` ${route.stops.length} stops · ${route.stops.reduce((n, s) => n + s.farm.length, 0)} pets · ~${Math.round(kills).toLocaleString(language)} kills`));
  box.replaceChildren(head, chips, ol, foot);
}

guideEls.route?.addEventListener("click", (e) => {
  if (starClick(e)) return;
  const chip = e.target.closest(".guideMaps button[data-map]");
  if (chip) {
    prefs.routeMap = chip.dataset.map;
    savePrefs();
    renderGuide();
    return;
  }
  if (e.target.closest('[data-act="route-map"]')) return showRouteOnMap();
  const li = e.target.closest(".routeStop");
  const s = li && lastRoute?.stops[Number(li.dataset.i)];
  if (s?.at) {
    prefs.mapRoute = true;
    goTo(s.mid, null, s.at);
  }
});

function showRouteOnMap() {
  if (!lastRoute) return;
  prefs.mapRoute = true;
  mapState.focus = mapState.npc = null;
  mapState.map = lastRoute.mid;
  mapState.flash = null;
  prefs.mapId = lastRoute.mid;
  showView("map");
  savePrefs();
  renderMap();
  const pts = lastRoute.stops.filter((s) => s.at).map((s) => ({ x: s.at.x, y: s.at.y }));
  mapState.view = null;
  if (pts.length) fitView(pts);
  drawMap();
}

// The route over the map: numbered stops joined in order.
function drawRoute() {
  if (prefs.view !== "map" || !prefs.mapRoute || !mapState.view) return;
  if (!lastRoute || lastRoute.mid !== mapState.map) currentRouteFor(mapState.map);
  if (!lastRoute || lastRoute.mid !== mapState.map) return;
  const pts = lastRoute.stops.map((s, i) => s.at && { i, x: s.at.x, y: s.at.y }).filter(Boolean);
  if (!pts.length) return;
  const cv = mapEls.canvas, v = mapState.view;
  const dpr = mapState.px || window.devicePixelRatio || 1; // drawMap's scale
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const at = (p) => [(p.x - v.x) * v.scale, (p.y - v.y) * v.scale];
  g.lineWidth = 2;
  g.strokeStyle = "rgba(143, 194, 255, 0.85)";
  g.setLineDash([6, 4]);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(...at(p)) : g.moveTo(...at(p))));
  g.stroke();
  g.setLineDash([]);
  g.font = "700 11px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const p of pts) {
    const [x, y] = at(p);
    g.beginPath();
    g.arc(x, y - 16, 9, 0, Math.PI * 2);
    g.fillStyle = "#8fc2ff";
    g.fill();
    g.fillStyle = "#0a0e16";
    g.fillText(String(p.i + 1), x, y - 16);
  }
  g.textAlign = "start";
}

// The route for a map picked on the Map tab rather than the Guide.
function currentRouteFor(mid) {
  const stops = routeStopsByMap().get(mid);
  lastRoute = stops ? { mid, stops: planRoute(stops) } : null;
}

{
  const plainDraw = drawMap;
  drawMap = function () {
    plainDraw();
    drawRoute();
  };
}
if (guideEls.routeToggle) {
  guideEls.routeToggle.checked = !!prefs.mapRoute;
  guideEls.routeToggle.addEventListener("change", () => {
    prefs.mapRoute = guideEls.routeToggle.checked;
    savePrefs();
    drawMap();
  });
}

// ---- genus --------------------------------------------------------------------

function genusProgress() {
  const out = {};
  for (const g of Object.keys(GENUS_BONUS)) out[g] = { total: 0, max: 0, left: 0, stats: {} };
  const want = needs();
  for (const id of Object.keys(PET_GENUS)) {
    const g = PET_GENUS[id];
    if (!out[g] || PET_SOURCES[id]?.unreleased) continue;
    const o = out[g];
    o.total++;
    const level = state.levels[id] || 0;
    if (level >= 3) o.max++;
    o.left += want.get(String(id)) || 0;
    const bonus = GENUS_BONUS[g][Math.min(level, 3) - 1];
    if (bonus) for (const [stat, n] of Object.entries(bonus)) o.stats[stat] = (o.stats[stat] || 0) + n;
  }
  return out;
}

// "Sprint cost −%" reads as a cut: "Sprint cost −7.1%".
const statText = ([stat, n]) => {
  const v = Math.round(n * 10) / 10;
  return stat.endsWith(" −%") ? `${stat.slice(0, -3)} −${v}%` : `${stat} +${v}`;
};

function renderGenus() {
  const c = CLASSES[classId()];
  const prog = genusProgress();
  const rows = c.genus.map((g, i) => {
    const p = prog[g];
    const row = el("div", "genusRow");
    const head = el("div", "genusHead");
    head.append(el("span", "genusRank", String(i + 1)), el("strong", null, genusName(g)), el("span", "guideNote", ` ${p.max}/${p.total} at Lv 3 · ${p.left.toLocaleString(language)} souls left`));
    const needed = genusNeeds(g);
    if (needed.length) head.append(starButton(needed, "genus", i, `★ Star ${needed.length}`));
    const bar = el("div", "genusBar");
    const fill = el("i");
    fill.style.width = `${p.total ? (p.max / p.total) * 100 : 0}%`;
    bar.append(fill);
    const lv3 = Object.entries(GENUS_BONUS[g][2]).map(statText).join(", ");
    const have = Object.entries(p.stats).map(statText).join(", ");
    row.append(head, bar, el("div", "genusText", GENUS_WHAT[g]), el("div", "genusText", `Per pet at Lv 3: ${lv3}`), el("div", "genusText", `Yours now: ${have || "nothing yet"}`));
    row.dataset.genus = g;
    return row;
  });
  const pick = el("select", "guideClassPick");
  for (const [k, v] of Object.entries(CLASSES)) {
    const o = el("option", null, `${v.name}${k === detectedClass ? " (you)" : ""}`);
    o.value = k;
    o.selected = k === classId();
    pick.append(o);
  }
  const note = el("p", "guideNote", `Order for ${c.name} (${c.stats}). Every owned pet's effect counts, equipped or not, and all pets of a genus give the same, so the cheapest pets of your top genus come first: click a genus to list just those pets.`);
  guideEls.genus.replaceChildren(pick, note, ...rows);
}

guideEls.genus?.addEventListener("change", (e) => {
  if (!e.target.matches(".guideClassPick")) return;
  prefs.guideClass = e.target.value;
  savePrefs();
  renderGuide();
});
guideEls.genus?.addEventListener("click", (e) => {
  if (starClick(e)) return;
  const row = e.target.closest(".genusRow");
  if (!row) return;
  prefs.genus = row.dataset.genus;
  prefs.sort = "left";
  prefs.desc = false;
  showView("pets");
  savePrefs();
  render();
});

function renderGuide() {
  if (prefs.view === "guide" && guideEls.section) {
    renderRoute();
    renderGenus();
  }
}

// showView (areas.js) switches to the Guide too: it runs before this file
// loads, so it can't be wrapped here.
{
  const plainRender = render;
  render = function () {
    dropDoneStars();
    plainRender();
    renderGuide();
  };
}
for (const t of document.querySelectorAll(".viewTab")) {
  t.addEventListener("click", () => {
    renderGuide();
  });
}
a2.on("character", (c) => {
  const id = CLASS_BY_KO[c?.class];
  if (id && id !== detectedClass) {
    detectedClass = id;
    renderGuide();
  }
});
a2.on("zone", () => renderGuide());
setTimeout(renderGuide, 0);
