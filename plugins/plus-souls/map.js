// Citizen Score: the Map view, where every pet you still need sits on the map.
//
// A heatmap over the game's world map: each spawn of a monster that drops a
// soul you still need adds its drop chance, summed over your pets, so the hot
// spots are where one kill moves the most pets along. "Show on map" in a pet's
// sources narrows it to that pet. Kibelisks (teleport crystals) are drawn as
// landmarks with the number the in-game map lists them by.
//
// The positions come from mapdata.js (MAP_DATA, built by
// tools/citizen-map/build_map.py). A map it has no image for, or a missing
// mapdata.js, falls back to a schematic: each area as a blob by its nearest
// Kibelisk, sized by what you still need there. It says so, as it isn't to
// scale.
//
// The search above it finds a pet, a monster, a map, an area or a Kibelisk by
// name, in English or the meter's language, and takes the map there.
//
// Plain globals from plugin.js and areas.js are used as they are: state,
// prefs, savePrefs, key, language, text, petName, render, whereOf,
// hiddenRegions, regionOf, sideOf, PET_SOURCES, needs, mapKeyOf, zoneMap,
// showView.

const MAP = typeof MAP_DATA === "object" ? MAP_DATA : { world: 8192, maps: {}, spawns: {}, kibelisks: {} };
const mapIdOf = (key) => /^String_STR_Map_(.+)_body$/.exec(key || "")?.[1] || null;
const HEAT_RAMP = [
  [0.0, [255, 170, 60, 0]],
  [0.25, [255, 150, 50, 110]],
  [0.55, [255, 120, 40, 175]],
  [0.8, [255, 196, 110, 215]],
  [1.0, [255, 245, 220, 240]],
];
const mapEls = {
  section: document.querySelector(".mapView"),
  maps: document.querySelector(".mapPick"),
  focus: document.querySelector(".mapFocus"),
  kibToggle: document.querySelector(".mapKibToggle"),
  stage: document.querySelector(".mapStage"),
  canvas: document.querySelector(".mapCanvas"),
  tip: document.querySelector(".mapTip"),
  note: document.querySelector(".mapNote"),
  todo: document.querySelector(".mapTodo"),
  find: document.querySelector(".mapFind"),
  hits: document.querySelector(".mapHits"),
};
const mapState = {
  map: null, // map id shown
  focus: null, // pet id, or null for every pet still needing souls
  npc: null, // monster key: only its spawns, for every pet it drops
  flash: null, // a Kibelisk the search picked, drawn lit
  view: null, // { x, y, scale }: map pixel at the stage's top left, CSS px per map pixel
  images: new Map(),
  heat: null, // { canvas, points } for the map and focus drawn
  heatKey: "",
  hover: null,
};

// The pets the map is about: the one in focus, every pet a focused monster
// drops, or every pet still needing souls.
const focused = () => !!(mapState.focus || mapState.npc);
function focusIds() {
  if (mapState.focus) return [mapState.focus];
  if (mapState.npc) return Object.keys(PET_SOURCES).filter((pet) => PET_SOURCES[pet].drops?.some((d) => d.npc === mapState.npc));
  return [...needs().keys()];
}
const ofNpc = (npc) => !mapState.npc || npc === mapState.npc;

// Every spawn point that counts, with its weight and who it is for.
function heatPoints(mapId) {
  const hidden = new Set(hiddenRegions());
  const points = [];
  for (const pet of focusIds()) {
    const src = PET_SOURCES[pet];
    for (const [mid, npc, dots] of MAP.spawns[pet] || []) {
      if (mid !== mapId || !ofNpc(npc)) continue;
      const drop = src?.drops.find((d) => d.npc === npc && mapIdOf(d.map) === mid);
      if (drop && hidden.has(regionOf(drop)) && !focused()) continue;
      const chance = parseFloat(String(drop?.chance || "100").replace("%", "")) / 100 || 0.01;
      for (const [x, y] of dots) points.push({ x, y, w: focused() ? 1 : chance, pet, npc, drop });
    }
  }
  return points;
}

// The maps worth listing: those with an image, then any other where a pet you
// need drops (schematic), the busiest first.
function mapChoices() {
  const count = new Map();
  for (const pet of focusIds()) {
    for (const d of PET_SOURCES[pet]?.drops || []) {
      if (!ofNpc(d.npc)) continue;
      const mid = mapIdOf(d.map);
      if (mid) count.set(mid, (count.get(mid) || 0) + 1);
    }
  }
  for (const mid of Object.keys(MAP.maps)) if (!count.has(mid)) count.set(mid, 0);
  return [...count.entries()]
    .sort((a, b) => !!MAP.maps[b[0]] - !!MAP.maps[a[0]] || b[1] - a[1])
    .map(([mid, n]) => ({ mid, n }));
}

function pickDefaultMap() {
  const here = mapIdOf(mapKeyOf(zoneMap));
  const choices = mapChoices();
  if (here && choices.some((c) => c.mid === here)) return here;
  if (prefs.mapId && choices.some((c) => c.mid === prefs.mapId)) return prefs.mapId;
  return choices.find((c) => c.n > 0)?.mid || choices[0]?.mid || null;
}

function renderMapControls() {
  const here = mapIdOf(mapKeyOf(zoneMap));
  const chips = mapChoices().filter((c) => c.n > 0 || c.mid === mapState.map).slice(0, 8).map(({ mid, n }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.map = mid;
    b.setAttribute("aria-pressed", String(mid === mapState.map));
    b.textContent = `${mid === here ? "📍 " : ""}${text(`String_STR_Map_${mid}_body`)}${n ? ` · ${n}` : ""}`;
    b.title = MAP.maps[mid] ? "" : "No map image: shown as a schematic";
    return b;
  });
  mapEls.maps.replaceChildren(...chips);
  if (focused()) {
    mapEls.focus.hidden = false;
    mapEls.focus.querySelector(".mapFocusName").textContent = mapState.focus ? petName(mapState.focus) : text(mapState.npc);
  } else {
    mapEls.focus.hidden = true;
  }
  mapEls.kibToggle.checked = prefs.mapKibelisks !== false;
  renderMapTodo();
}

// ---- what the map data still lacks ----------------------------------------

// Per map: no image (so a schematic), monsters with no spawn points, and the
// Kibelisks drops name that aren't placed. English names, as manual.json
// matches them.
function mapGaps() {
  const en = (k) => SOURCE_TEXT[k]?.en ?? String(k ?? "");
  const placed = new Set();
  for (const rows of Object.values(MAP.spawns)) for (const [mid, npc] of rows) placed.add(`${mid}|${npc}`);
  const gaps = new Map();
  const gap = (mid) => {
    if (!gaps.has(mid)) gaps.set(mid, { mid, name: en(`String_STR_Map_${mid}_body`), image: !!MAP.maps[mid], monsters: new Set(), kibelisks: new Set(), pets: new Set() });
    return gaps.get(mid);
  };
  for (const [pet, src] of Object.entries(PET_SOURCES)) {
    for (const d of src.drops || []) {
      const mid = mapIdOf(d.map);
      if (!mid) continue;
      if (!MAP.maps[mid] || !placed.has(`${mid}|${d.npc}`)) {
        gap(mid).monsters.add(en(d.npc));
        gap(mid).pets.add(pet);
      }
      const kibs = MAP.kibelisks[mid] || [];
      for (const k of [d.kibelisk, ...Object.values(d.bySide || {})]) {
        if (k && !kibs.some((p) => p.n === k.name)) gap(mid).kibelisks.add(en(k.name));
      }
    }
  }
  return [...gaps.values()].sort((a, b) => a.image - b.image || b.monsters.size - a.monsters.size);
}

// A manual.json skeleton for every gap, points left at 0 for you to fill.
function manualTemplate(gaps) {
  const out = {};
  for (const g of gaps) {
    const m = {};
    if (!g.image) m.image = `~/Pictures/Citizen Score/${g.mid}.png`;
    if (g.monsters.size) m.spawns = Object.fromEntries([...g.monsters].map((n) => [n, [[0, 0]]]));
    if (g.kibelisks.size) m.kibelisks = [...g.kibelisks].map((name) => ({ name, x: 0, y: 0 }));
    out[g.mid] = m;
  }
  return JSON.stringify(out, null, 2).replace(/\[\n\s*(-?\d+),\n\s*(-?\d+)\n\s*\]/g, "[$1, $2]");
}

function renderMapTodo() {
  const gaps = mapGaps();
  const el = mapEls.todo;
  el.hidden = !gaps.length;
  if (!gaps.length) return;
  const h = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  el.querySelector(".mapTodoBtn").textContent = `ⓘ To add · ${gaps.length}`;
  const box = el.querySelector(".mapTodoBox");
  const rows = gaps.map((g) => {
    const row = h("div", "mapTodoMap");
    const head = h("div", "mapTodoHead");
    head.append(h("code", null, g.mid), ` ${g.name}`);
    head.append(h("span", "mapTodoTag", g.image ? `${g.pets.size} pet${g.pets.size === 1 ? "" : "s"}` : `no image · ${g.pets.size} pet${g.pets.size === 1 ? "" : "s"}`));
    row.append(head);
    if (g.monsters.size) row.append(h("div", "mapTodoList", `Spawns: ${[...g.monsters].join(", ")}`));
    if (g.kibelisks.size) row.append(h("div", "mapTodoList", `Kibelisks: ${[...g.kibelisks].join(", ")}`));
    return row;
  });
  const how = h("ol", "mapTodoHow");
  for (const step of [
    "Open the in-game map (M) on that area and screenshot it. Maps with an image here can use plugins/plus-souls/maps/<key in lower case>.webp instead.",
    "Copy tools/citizen-map/manual.example.json to manual.json, or paste the template below into it.",
    "Open the image in any viewer that shows pixel positions and replace each [0, 0] with where that monster stands, one [x, y] per spawn; the same for each Kibelisk. Leave out \"image\" for maps that already have one: their pixels are those of the .webp, 2048 across.",
    "Run  python3 -I tools/citizen-map/build_map.py --offline  in ~/Work/citizen-score, then reopen the Pet Map.",
  ]) how.append(h("li", null, step));
  const pre = h("pre", "mapTodoTemplate", manualTemplate(gaps));
  pre.title = "Click to select";
  pre.addEventListener("click", () => getSelection().selectAllChildren(pre));
  box.replaceChildren(h("strong", null, "Map data still to add"), ...rows, h("strong", null, "How to add it"), how, h("div", "mapTodoSub", "manual.json template (click to select):"), pre);
}

// ---- drawing --------------------------------------------------------------

function image(mid) {
  const info = MAP.maps[mid];
  if (!info) return null;
  let img = mapState.images.get(mid);
  if (!img) {
    // The page's own copy first (see index.html), then a load of our own.
    img = [...document.querySelectorAll(".mapImages img")].find((i) => i.dataset.image === info.image);
    if (img) {
      if (!img.complete) img.addEventListener("load", () => drawMap(), { once: true });
      mapState.images.set(mid, img);
      return img.complete && img.naturalWidth ? img : null;
    }
    img = new Image();
    img.onload = () => drawMap();
    img.src = info.image;
    mapState.images.set(mid, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// The heat as an image of the whole map at 1/16 (512 px): each spawn adds its
// weight to a density grid through a soft round kernel, and the sums are
// coloured through the ramp on a square-root scale against the 99th
// percentile, so a few dense camps don't wash the rest out. Rebuilt when the
// map, the focus or what you need changes, not on every pan.
const HEAT_RES = 16;
const HEAT_R = 7; // kernel radius in cells (~110 map px)
const KERNEL = (() => {
  const k = [];
  for (let dy = -HEAT_R; dy <= HEAT_R; dy++) {
    for (let dx = -HEAT_R; dx <= HEAT_R; dx++) {
      const d = Math.hypot(dx, dy) / HEAT_R;
      if (d < 1) k.push([dx, dy, (1 - d * d) ** 2]);
    }
  }
  return k;
})();
function heatLayer(mid, points) {
  const k = `${mid}|${mapState.focus}|${mapState.npc}|${points.length}|${points.reduce((n, p) => n + p.w, 0).toFixed(3)}`;
  if (mapState.heat && mapState.heatKey === k) return mapState.heat;
  const size = MAP.world / HEAT_RES;
  const grid = new Float32Array(size * size);
  for (const p of points) {
    const cx = Math.round(p.x / HEAT_RES), cy = Math.round(p.y / HEAT_RES);
    for (const [dx, dy, f] of KERNEL) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) grid[y * size + x] += p.w * f;
    }
  }
  const lit = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] > 0) lit.push(grid[i]);
  lit.sort((a, b) => a - b);
  const top = Math.sqrt(lit[Math.floor(lit.length * 0.99)] || 1);
  const lut = new Uint8ClampedArray(256 * 4);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let j = 1;
    while (j < HEAT_RAMP.length - 1 && HEAT_RAMP[j][0] < t) j++;
    const [t0, c0] = HEAT_RAMP[j - 1], [t1, c1] = HEAT_RAMP[j];
    const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    for (let ch = 0; ch < 4; ch++) lut[v * 4 + ch] = c0[ch] + (c1[ch] - c0[ch]) * f;
  }
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  const px = img.data;
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue;
    const v = Math.min(255, Math.round((Math.sqrt(grid[i]) / top) * 255));
    px.set(lut.subarray(v * 4, v * 4 + 4), i * 4);
  }
  g.putImageData(img, 0, 0);
  mapState.heat = { canvas: c, points };
  mapState.heatKey = k;
  return mapState.heat;
}

function kibelisksOf(mid) {
  const list = MAP.kibelisks[mid] || [];
  return list;
}

// Fit the view to the heat (or the whole map), once per map and focus.
function fitView(points) {
  const { clientWidth: w, clientHeight: h } = mapEls.stage;
  let minX = 0, minY = 0, maxX = MAP.world, maxY = MAP.world;
  if (points.length) {
    const xs = points.map((p) => p.x).sort((a, b) => a - b);
    const ys = points.map((p) => p.y).sort((a, b) => a - b);
    const q = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))];
    minX = q(xs, 0.02) - 300; maxX = q(xs, 0.98) + 300;
    minY = q(ys, 0.02) - 300; maxY = q(ys, 0.98) + 300;
  }
  const scale = Math.min(w / (maxX - minX), h / (maxY - minY), 1.2);
  mapState.view = { scale, x: (minX + maxX) / 2 - w / 2 / scale, y: (minY + maxY) / 2 - h / 2 / scale };
}

// The page's zoom (Text size, plugin.js) on top of the screen's: the stage
// is laid out w x h page px but shown `k` times that, so the canvas is drawn
// at the size it is shown, and pointer positions (shown px) are divided by
// k. Without it the map was blurry and hover, drag and zoom landed off by
// the zoom (2026-10-27).
function stageZoom() {
  const w = mapEls.stage.clientWidth;
  const r = mapEls.stage.getBoundingClientRect();
  return w && r.width ? r.width / w : 1;
}
mapState.px = window.devicePixelRatio || 1;

function drawMap() {
  if (prefs.view !== "map" || !mapState.map) return;
  const cv = mapEls.canvas;
  const w = mapEls.stage.clientWidth, h = mapEls.stage.clientHeight;
  if (!w || !h) return;
  const dpr = (window.devicePixelRatio || 1) * stageZoom();
  mapState.px = dpr;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const mid = mapState.map;
  if (!MAP.maps[mid]) return drawSchematic(g, w, h);
  const points = heatPoints(mid);
  if (!mapState.view) fitView(points);
  const v = mapState.view;
  const img = image(mid);
  g.save();
  g.translate(-v.x * v.scale, -v.y * v.scale);
  g.scale(v.scale, v.scale);
  g.fillStyle = "#06080c";
  g.fillRect(0, 0, MAP.world, MAP.world);
  if (img) {
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, MAP.world, MAP.world);
  }
  // Dimmed, so the heat and the crystals carry the colour (canvas filters
  // aren't in WebKit).
  g.fillStyle = "rgba(6, 8, 12, 0.42)";
  g.fillRect(0, 0, MAP.world, MAP.world);
  if (points.length) {
    const heat = heatLayer(mid, points);
    g.imageSmoothingEnabled = true;
    g.drawImage(heat.canvas, 0, 0, MAP.world, MAP.world);
  }
  g.restore();

  // Spawns as fine dots once zoomed in far enough to tell them apart.
  if (v.scale > 0.35) {
    g.fillStyle = "rgba(255, 236, 205, 0.85)";
    for (const p of points) {
      const x = (p.x - v.x) * v.scale, y = (p.y - v.y) * v.scale;
      if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  drawKibelisks(g, mid, v, w, h);
  mapEls.note.textContent = points.length
    ? `${points.length.toLocaleString(language)} spawns${mapState.focus ? "" : ` · ${new Set(points.map((p) => p.pet)).size} pets`}`
    : focused() ? `${mapState.focus ? petName(mapState.focus) : text(mapState.npc)} has no spawns on this map.` : "Nothing left to farm on this map. 🎉";
}

function crystal(g, x, y, s, fill, stroke) {
  g.beginPath();
  g.moveTo(x, y - s * 1.35);
  g.lineTo(x + s * 0.8, y);
  g.lineTo(x, y + s * 1.35);
  g.lineTo(x - s * 0.8, y);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = stroke;
  g.stroke();
}

// All of them while the toggle is on; one the search found always, ringed.
function drawKibelisks(g, mid, v, w, h) {
  const label = v.scale > 0.12;
  const all = prefs.mapKibelisks !== false;
  g.font = "600 10px system-ui, sans-serif";
  g.textBaseline = "middle";
  for (const k of kibelisksOf(mid)) {
    const flash = mapState.flash === k;
    if (!all && !flash) continue;
    const x = (k.x - v.x) * v.scale, y = (k.y - v.y) * v.scale;
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    const hot = flash || mapState.hover?.kib === k;
    if (flash) {
      g.beginPath();
      g.arc(x, y, 13, 0, Math.PI * 2);
      g.lineWidth = 2;
      g.strokeStyle = "rgba(191, 244, 255, 0.8)";
      g.stroke();
    }
    crystal(g, x, y, hot ? 6 : 5, hot ? "#bff4ff" : "#4fd6f0", "rgba(6, 8, 12, 0.9)");
    if (label && k.t) {
      const t = `#${k.t}`;
      const tw = g.measureText(t).width;
      g.fillStyle = "rgba(6, 8, 12, 0.72)";
      g.fillRect(x + 7, y - 7, tw + 6, 14);
      g.fillStyle = "#bff4ff";
      g.fillText(t, x + 10, y);
    }
  }
}

// Not to scale: areas around their Kibelisks, on a circle by teleport number.
function drawSchematic(g, w, h) {
  const mid = mapState.map;
  const hidden = new Set(hiddenRegions());
  const byKib = new Map();
  for (const pet of focusIds()) {
    for (const d of PET_SOURCES[pet]?.drops || []) {
      if (mapIdOf(d.map) !== mid || !ofNpc(d.npc) || (!focused() && hidden.has(regionOf(d)))) continue;
      const k = d.bySide?.[sideOf(key)] || d.kibelisk || { name: "?", m: 0 };
      const e = byKib.get(k.name) || { k, zones: new Map() };
      const zone = (d.zones || [])[0] || d.map;
      const z = e.zones.get(zone) || { zone, m: k.m || 0, w: 0, pets: new Set() };
      z.w += parseFloat(String(d.chance || "100")) / 100 || 0.01;
      z.pets.add(pet);
      e.zones.set(zone, z);
      byKib.set(k.name, e);
    }
  }
  const groups = [...byKib.values()].sort((a, b) => (a.k.teleport || 999) - (b.k.teleport || 999));
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
  const maxW = Math.max(0.0001, ...groups.flatMap((e) => [...e.zones.values()].map((z) => z.w)));
  const maxM = Math.max(1, ...groups.flatMap((e) => [...e.zones.values()].map((z) => z.m)));
  g.font = "600 10px system-ui, sans-serif";
  g.textBaseline = "middle";
  groups.forEach((e, i) => {
    const a = (i / Math.max(1, groups.length)) * Math.PI * 2 - Math.PI / 2;
    const kx = cx + Math.cos(a) * (groups.length > 1 ? R : 0), ky = cy + Math.sin(a) * (groups.length > 1 ? R : 0);
    [...e.zones.values()].forEach((z, j, all) => {
      const b = a + (j - (all.length - 1) / 2) * 0.5;
      const d = 14 + (z.m / maxM) * R * 0.45;
      const zx = kx + Math.cos(b) * d, zy = ky + Math.sin(b) * d;
      const r = 14 + 26 * Math.sqrt(z.w / maxW);
      const grad = g.createRadialGradient(zx, zy, 0, zx, zy, r);
      grad.addColorStop(0, "rgba(255, 196, 110, 0.85)");
      grad.addColorStop(1, "rgba(255, 150, 50, 0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(zx, zy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255, 245, 230, 0.9)";
      g.fillText(text(z.zone), zx + 4, zy);
    });
    crystal(g, kx, ky, 5, "#4fd6f0", "rgba(6, 8, 12, 0.9)");
    if (e.k.teleport) {
      g.fillStyle = "#bff4ff";
      g.fillText(`#${e.k.teleport}`, kx + 8, ky);
    }
  });
  mapEls.note.textContent = groups.length
    ? "Schematic: not to scale. Areas sit by their nearest Kibelisk; bigger glows need more souls."
    : "Nothing left to farm on this map. 🎉";
}

// ---- hover, pan and zoom ----------------------------------------------------

function toMap(e) {
  const r = mapEls.stage.getBoundingClientRect();
  const v = mapState.view;
  const k = stageZoom();
  const sx = (e.clientX - r.left) / k, sy = (e.clientY - r.top) / k;
  return { sx, sy, x: v.x + sx / v.scale, y: v.y + sy / v.scale };
}

function hoverAt(e) {
  if (!mapState.view || !MAP.maps[mapState.map]) return;
  const at = toMap(e);
  const v = mapState.view;
  let kib = null;
  if (prefs.mapKibelisks !== false) {
    for (const k of kibelisksOf(mapState.map)) {
      if (Math.hypot((k.x - at.x) * v.scale, (k.y - at.y) * v.scale) < 9) kib = k;
    }
  }
  const radius = 14 / v.scale;
  const near = (mapState.heat?.points || []).filter((p) => Math.hypot(p.x - at.x, p.y - at.y) < radius);
  const prev = mapState.hover;
  mapState.hover = { kib };
  if (prev?.kib !== kib) drawMap();
  const tip = mapEls.tip;
  if (!kib && !near.length) {
    tip.hidden = true;
    return;
  }
  const lines = [];
  if (kib) lines.push([`Kibelisk${kib.t ? ` #${kib.t}` : ""}`, text(kib.n)]);
  const byPet = new Map();
  for (const p of near) {
    const e = byPet.get(p.pet) || { pet: p.pet, npcs: new Set(), chance: p.drop?.chance };
    e.npcs.add(text(p.npc));
    byPet.set(p.pet, e);
  }
  const want = needs();
  for (const e of [...byPet.values()].slice(0, 6)) {
    lines.push([petName(e.pet), `${[...e.npcs].join(", ")}${e.chance ? ` · ${e.chance}` : ""}${want.get(e.pet) ? ` · ${want.get(e.pet)} to Lv 3` : ""}`]);
  }
  if (byPet.size > 6) lines.push(["", `+${byPet.size - 6} more`]);
  tip.replaceChildren(...lines.map(([a, b]) => {
    const div = document.createElement("div");
    if (a) {
      const s = document.createElement("strong");
      s.textContent = a;
      div.append(s, " ");
    }
    div.append(b);
    return div;
  }));
  tip.hidden = false;
  const sw = mapEls.stage.clientWidth;
  tip.style.left = `${Math.min(at.sx + 12, sw - tip.offsetWidth - 4)}px`;
  tip.style.top = `${at.sy + 14}px`;
}

{
  let drag = null;
  const stage = mapEls.stage;
  stage?.addEventListener("pointerdown", (e) => {
    if (!mapState.view) return;
    drag = { x: e.clientX, y: e.clientY, vx: mapState.view.x, vy: mapState.view.y, k: stageZoom() };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
  });
  stage?.addEventListener("pointermove", (e) => {
    if (drag) {
      const v = mapState.view;
      v.x = drag.vx - (e.clientX - drag.x) / drag.k / v.scale;
      v.y = drag.vy - (e.clientY - drag.y) / drag.k / v.scale;
      mapEls.tip.hidden = true;
      drawMap();
    } else hoverAt(e);
  });
  const end = () => {
    drag = null;
    stage?.classList.remove("dragging");
  };
  stage?.addEventListener("pointerup", end);
  stage?.addEventListener("pointercancel", end);
  stage?.addEventListener("pointerleave", () => {
    mapEls.tip.hidden = true;
  });
  stage?.addEventListener("wheel", (e) => {
    if (!mapState.view || !MAP.maps[mapState.map]) return;
    e.preventDefault();
    const at = toMap(e);
    const v = mapState.view;
    const next = Math.max(0.03, Math.min(2.5, v.scale * Math.exp(-e.deltaY * 0.0015)));
    v.x = at.x - at.sx / next;
    v.y = at.y - at.sy / next;
    v.scale = next;
    drawMap();
  }, { passive: false });
  stage?.addEventListener("dblclick", () => {
    mapState.view = null;
    drawMap();
  });
  new ResizeObserver(() => drawMap()).observe(stage);
}

mapEls.maps?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-map]");
  if (!b) return;
  mapState.map = b.dataset.map;
  mapState.view = null;
  mapState.flash = null;
  prefs.mapId = mapState.map;
  savePrefs();
  renderMap();
});
mapEls.focus?.querySelector(".mapFocusClear")?.addEventListener("click", () => {
  mapState.focus = null;
  mapState.npc = null;
  mapState.view = null;
  renderMap();
});
mapEls.kibToggle?.addEventListener("change", () => {
  prefs.mapKibelisks = mapEls.kibToggle.checked;
  savePrefs();
  drawMap();
});

function renderMap() {
  if (!mapEls.section) return;
  if (!mapState.map || !mapChoices().some((c) => c.mid === mapState.map)) {
    mapState.map = pickDefaultMap();
    mapState.view = null;
  }
  renderMapControls();
  drawMap();
}

// Opens the map on one pet: the map where it has the most spawns.
function showPetOnMap(pet) {
  mapState.focus = String(pet);
  mapState.npc = null;
  showFocusOnMap();
}

// Opens the map on one monster, for every pet it drops.
function showNpcOnMap(npc) {
  mapState.focus = null;
  mapState.npc = npc;
  showFocusOnMap();
}

// The map with the most spawns of what is in focus, drawn from the top.
function showFocusOnMap() {
  const counts = new Map();
  for (const pet of focusIds()) {
    for (const [mid, npc, dots] of MAP.spawns[pet] || []) if (ofNpc(npc)) counts.set(mid, (counts.get(mid) || 0) + dots.length);
    for (const d of PET_SOURCES[pet]?.drops || []) {
      const mid = mapIdOf(d.map);
      if (mid && ofNpc(d.npc) && !counts.has(mid)) counts.set(mid, 0);
    }
  }
  mapState.map = [...counts.entries()].sort((a, b) => !!MAP.maps[b[0]] - !!MAP.maps[a[0]] || b[1] - a[1])[0]?.[0] || mapState.map;
  mapState.view = null;
  mapState.flash = null;
  showView("map");
  savePrefs();
  renderAll();
}

// ---- search ------------------------------------------------------------------

// Everything the search can find, built once per language: each with the
// lowercase names it matches (English and the meter's) and what picking it does.
let findIndex = null;
function findEntries() {
  if (findIndex?.language === language) return findIndex.entries;
  const en = (k) => SOURCE_TEXT[k]?.en;
  const names = (...keys) => [...new Set(keys.flatMap((k) => [text(k), en(k)]).filter(Boolean).map((t) => t.toLocaleLowerCase()))];
  const mapName = (mid) => text(MAP.maps[mid]?.key || `String_STR_Map_${mid}_body`);
  const entries = [];
  const npcs = new Map(), zones = new Map(), maps = new Set(Object.keys(MAP.maps));
  for (const [pet, src] of Object.entries(PET_SOURCES)) {
    if (PET_GENUS[pet] === "special" || src.unreleased || !src.drops?.length) continue;
    entries.push({
      kind: "Pet", pet, label: petName(pet),
      words: [petName(pet), PET_NAMES[pet]?.en, pet].filter(Boolean).map((t) => t.toLocaleLowerCase()),
      pick: () => showPetOnMap(pet),
    });
    for (const d of src.drops) {
      const mid = mapIdOf(d.map);
      if (!mid) continue;
      maps.add(mid);
      const n = npcs.get(d.npc) || { maps: new Set(), pets: new Set() };
      n.maps.add(mid);
      n.pets.add(pet);
      npcs.set(d.npc, n);
      for (const zone of d.zones || []) {
        const z = zones.get(`${mid}|${zone}`) || { mid, zone, npcs: new Set() };
        z.npcs.add(d.npc);
        zones.set(`${mid}|${zone}`, z);
      }
    }
  }
  for (const [npc, n] of npcs) {
    entries.push({
      kind: "Monster", label: text(npc), sub: `${[...n.maps].map(mapName).join(", ")} · ${n.pets.size} pet${n.pets.size === 1 ? "" : "s"}`,
      words: names(npc), pick: () => showNpcOnMap(npc),
    });
  }
  for (const mid of maps) {
    entries.push({
      kind: "Map", label: mapName(mid), sub: MAP.maps[mid] ? "" : "schematic",
      words: [...names(MAP.maps[mid]?.key || `String_STR_Map_${mid}_body`), mid.toLowerCase()], pick: () => goTo(mid),
    });
  }
  for (const z of zones.values()) {
    entries.push({
      kind: "Area", label: text(z.zone), sub: mapName(z.mid), words: names(z.zone),
      pick: () => goTo(z.mid, (mid, npc) => mid === z.mid && z.npcs.has(npc)),
    });
  }
  for (const [mid, list] of Object.entries(MAP.kibelisks)) {
    for (const k of list) {
      entries.push({
        kind: "Kibelisk", label: text(k.n), sub: `${k.t ? `#${k.t} · ` : ""}${mapName(mid)}`,
        words: [...names(k.n), ...(k.t ? [`#${k.t}`] : []), "kibelisk"], pick: () => goTo(mid, null, k),
      });
    }
  }
  findIndex = { language, entries };
  return entries;
}

// To a map, framed on the spawns `which` picks (an area) or on one Kibelisk.
// A focus with nothing on that map is let go.
function goTo(mid, which, kib) {
  mapState.map = mid;
  mapState.flash = kib || null;
  if (!mapChoices().some((c) => c.mid === mid && c.n)) mapState.focus = mapState.npc = null;
  prefs.mapId = mid;
  showView("map");
  savePrefs();
  renderMap();
  mapState.view = null;
  if (kib) {
    const { clientWidth: w, clientHeight: h } = mapEls.stage;
    const scale = 0.6;
    mapState.view = { scale, x: kib.x - w / 2 / scale, y: kib.y - h / 2 / scale };
  } else if (which) {
    const dots = [];
    for (const rows of Object.values(MAP.spawns)) {
      for (const [m, npc, list] of rows) if (which(m, npc)) for (const [x, y] of list) dots.push({ x, y });
    }
    if (dots.length) fitView(dots);
  }
  drawMap();
}

// Best first: names that start with what you typed, then words that do, then
// any match; pets before monsters before places.
const FIND_ORDER = ["Pet", "Monster", "Map", "Area", "Kibelisk"];
const find = { hits: [], at: 0 };
function findHits(query) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const scored = [];
  for (const e of findEntries()) {
    const score = e.label.toLocaleLowerCase().startsWith(q) ? 0 : e.words.some((w) => w.startsWith(q)) ? 1 : e.words.some((w) => w.includes(q)) ? 2 : -1;
    if (score >= 0) scored.push([score, e]);
  }
  return scored
    .sort((a, b) => a[0] - b[0] || FIND_ORDER.indexOf(a[1].kind) - FIND_ORDER.indexOf(b[1].kind) || a[1].label.localeCompare(b[1].label))
    .slice(0, 12)
    .map(([, e]) => e);
}

function renderHits() {
  const list = mapEls.hits;
  list.hidden = !mapEls.find.value.trim() || document.activeElement !== mapEls.find;
  if (list.hidden) return;
  const want = needs();
  list.replaceChildren(...(find.hits.length ? find.hits : [null]).map((e, i) => {
    const li = document.createElement("li");
    if (!e) {
      li.className = "mapHitNone";
      li.textContent = "Nothing by that name.";
      return li;
    }
    li.role = "option";
    li.dataset.i = i;
    li.setAttribute("aria-selected", String(i === find.at));
    const kind = document.createElement("span");
    kind.className = `mapHitKind kind${e.kind}`;
    kind.textContent = e.kind;
    const label = document.createElement("span");
    label.className = "mapHitLabel";
    label.textContent = e.label;
    li.append(kind, label);
    const sub = e.pet ? (want.get(e.pet) ? `${want.get(e.pet)} to Lv 3` : "") : e.sub;
    if (sub) {
      const s = document.createElement("span");
      s.className = "mapHitSub";
      s.textContent = sub;
      li.append(s);
    }
    return li;
  }));
}

function pickHit(i) {
  const e = find.hits[i];
  if (!e) return;
  mapEls.find.value = e.label;
  mapEls.find.blur();
  e.pick();
}

mapEls.find?.addEventListener("input", () => {
  find.hits = findHits(mapEls.find.value);
  find.at = 0;
  renderHits();
});
mapEls.find?.addEventListener("focus", () => {
  mapEls.find.select();
  find.hits = findHits(mapEls.find.value);
  find.at = 0;
  renderHits();
});
mapEls.find?.addEventListener("blur", () => {
  mapEls.hits.hidden = true;
});
mapEls.find?.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!find.hits.length) return;
    find.at = (find.at + (e.key === "ArrowDown" ? 1 : -1) + find.hits.length) % find.hits.length;
    renderHits();
    mapEls.hits.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    pickHit(find.at);
  } else if (e.key === "Escape") {
    mapEls.find.value = "";
    find.hits = [];
    renderHits();
  }
});
// On mousedown, so the box keeps its focus until the pick.
mapEls.hits?.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const li = e.target.closest("li[data-i]");
  if (li) pickHit(Number(li.dataset.i));
});

// A pet's sources end with "Show on map".
{
  const plainWhere = whereOf;
  whereOf = function (id) {
    const box = plainWhere(id);
    if (PET_SOURCES[id]?.drops?.length) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "showOnMap";
      b.textContent = "Show on map";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        showPetOnMap(id);
      });
      box.append(b);
    }
    return box;
  };
}

// The map follows everything the lists do (a sync, a soul, a region chip).
function renderAll() {
  render();
}
{
  const listsRender = render;
  render = function () {
    listsRender();
    findIndex = null; // names follow renames and syncs
    if (prefs.view === "map") {
      mapState.heatKey = "";
      renderMap();
    }
  };
}
a2.on("zone", () => {
  if (prefs.view === "map" && !focused()) {
    const here = mapIdOf(mapKeyOf(zoneMap));
    if (here && here !== mapState.map && mapChoices().some((c) => c.mid === here)) {
      mapState.map = here;
      mapState.view = null;
    }
    renderMap();
  }
});

// The Map tab draws once it is shown (areas.js switches the view).
for (const t of document.querySelectorAll(".viewTab")) {
  t.addEventListener("click", () => {
    if (prefs.view === "map") renderMap();
  });
}
setTimeout(() => prefs.view === "map" && renderMap(), 0);
