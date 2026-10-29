// Citizen Score: the pet radar. The meter hands over the monsters in view and
// where you are (a2.on("radar"), permission events:radar); this lists the
// ones that drop souls you still need, nearest first, with how far and which
// way, in a widget over the game. Pinned pets (☆) come first. Spawn points
// from the map data fill in for monsters not in view.
//
// Like a game's radar it also shows everything else in view, each kind a
// layer the widget's legend turns on and off (prefs.radarLayers): the other
// monsters, bosses (by name), and NPCs and objects, the things the game sends
// that it has no monster name for. Other players aren't shown: an enemy's
// position past what the game shows you is a wallhack, and reads hidden ones.
//
// World units are centimetres, and a map pixel is a metre: a point at world
// (x, y) is at map pixel (4096 + x/100, 4096 + y/100), with north up (fitted
// to 68 monsters' live spawns against their map pins, 2026-10-26, to within
// the pins' own spread). So bearings are true compass bearings, east = +x.
//
// The monsters in view are the ones within about 65 m of you (they come into
// view at ~55 m and leave it at ~65 m). Where you are is only known exactly
// when you cast a buff, so between buffs it is the middle (median) of the
// monsters in view, with the last buff's position trusted less each second.
// Checked against 3,000 buff positions in the saved fights (2026-10-26):
// half within 15 m, nine in ten within 48 m (the old guess: 35 m and 114 m).

const RADAR_WIDGET = "radar";
// Its size at scale 1: the window grows to fit if its card reports more.
// The corner grip scales the whole card (prefs.radarScale), window and all.
const RADAR_SIZE = { width: 280, height: 560 };
const RADAR_SCALE = { min: 0.6, max: 2 };
const RADAR_RANGE_M = 300; // spawn points this close are listed
const RADAR_ROWS = 6;
const RADAR_DOTS = 240;
const RADAR_LAYERS = { mobs: true, bosses: true, npcs: false };
// What each dot is, for the widget: [..., kind].
const DOT = { pet: 0, mob: 1, boss: 2, npc: 3 };
const FIX_SURE_MS = 2500; // a buff's position this fresh is where you are
const FIX_FADE_S = 6; // after that it counts for less, e-folding in this long
const FIX_DRIFT_M = 45; // and is never more than this from the monsters' middle
const UNITS_PER_M = 100;
const MAP_HALF = 4096;

const radar = { last: null, sent: "", fit: 0 };
const radarScale = () => Math.min(RADAR_SCALE.max, Math.max(RADAR_SCALE.min, Number(prefs.radarScale) || 1));
function radarSize() {
  const s = radarScale();
  return { width: Math.round(RADAR_SIZE.width * s), height: Math.round(Math.max(RADAR_SIZE.height, radar.fit) * s) };
}
const radarBtn = document.querySelector(".radarBtn");
const radarLock = document.querySelector(".radarLock");

function showLock(locked) {
  if (!radarLock) return;
  radarLock.hidden = !prefs.radar;
  radarLock.setAttribute("aria-pressed", String(!!locked));
  radarLock.textContent = locked ? "🔒" : "🔓";
  radarLock.title = locked ? "Unlock the radar to move it or pin from it" : "Lock the radar: clicks go through it to the game";
}
radarLock?.addEventListener("click", async () => {
  const locked = radarLock.getAttribute("aria-pressed") !== "true";
  await a2.widgets.lock(locked).catch(() => {});
  showLock(locked);
});

// Each soul-dropping monster's drops, by its name key in sources.js.
const DROPS_BY_NPC = (() => {
  const out = new Map();
  for (const [pet, src] of Object.entries(PET_SOURCES)) {
    for (const d of src.drops || []) {
      if (!d.npc) continue;
      if (!out.has(d.npc)) out.set(d.npc, []);
      out.get(d.npc).push({ pet, chance: d.chance, map: d.map });
    }
  }
  return out;
})();
const NPC_KEYS = typeof NPC_SOURCES === "object" ? NPC_SOURCES : {};
const BOSSES = typeof NPC_BOSSES === "object" ? NPC_BOSSES : {};
const KNOWN_RUNS = typeof NPC_KNOWN_RUNS === "object" ? NPC_KNOWN_RUNS : [];

// Is this NPC id one the game names (a monster)? The runs are sorted.
function npcKnown(id) {
  let lo = 0, hi = KNOWN_RUNS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [first, n] = KNOWN_RUNS[mid];
    if (id < first) hi = mid - 1;
    else if (id >= first + n) lo = mid + 1;
    else return true;
  }
  return false;
}
const npcKind = (id) => (id in BOSSES ? DOT.boss : npcKnown(id) ? DOT.mob : DOT.npc);
const radarLayers = () => ({ ...RADAR_LAYERS, ...(prefs.radarLayers || {}) });

const hereMapKey = () => mapKeyOf(zoneMap);

const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  const h = v.length >> 1;
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
};

// Where you are, and about how far off that may be (m). See the top.
function radarMe(r) {
  const now = r.now || Date.now();
  const mobs = r.mobs || [];
  const fix = r.me ? { x: r.me.pos[0], y: r.me.pos[1], age: Math.max(0, now - r.me.at) } : null;
  if (fix && fix.age < FIX_SURE_MS) return { x: fix.x, y: fix.y, approx: false, err: 5 };
  if (mobs.length >= 3) {
    const mid = { x: median(mobs.map((m) => m.pos[0])), y: median(mobs.map((m) => m.pos[1])) };
    if (!fix) return { ...mid, approx: true, err: 25 };
    const w = Math.exp(-(fix.age - FIX_SURE_MS) / 1000 / FIX_FADE_S);
    let x = w * fix.x + (1 - w) * mid.x, y = w * fix.y + (1 - w) * mid.y;
    const d = Math.hypot(x - mid.x, y - mid.y), max = FIX_DRIFT_M * UNITS_PER_M;
    if (d > max) {
      x = mid.x + ((x - mid.x) * max) / d;
      y = mid.y + ((y - mid.y) * max) / d;
    }
    return { x, y, approx: true, err: w > 0.5 ? 10 : 20 };
  }
  // Too few monsters around to say: the last buff, as it gets older.
  if (fix) return { x: fix.x, y: fix.y, approx: true, err: Math.min(200, 5 + Math.round(fix.age / 1000) * 3) };
  if (mobs.length) return { x: median(mobs.map((m) => m.pos[0])), y: median(mobs.map((m) => m.pos[1])), approx: true, err: 40 };
  return null;
}

// The pets a monster gives that you still need, on this map when known.
function petsOf(npcKey, want, mapKey) {
  const out = new Map(); // one entry a pet: a monster has a drop per zone
  for (const d of DROPS_BY_NPC.get(npcKey) || []) {
    if (want.has(d.pet) && (!mapKey || d.map === mapKey) && !out.has(d.pet)) {
      out.set(d.pet, { pet: d.pet, left: want.get(d.pet), chance: d.chance });
    }
  }
  return [...out.values()];
}

const bearingOf = (dx, dy) => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];

function radarTargets() {
  const r = radar.last;
  if (!r) return { me: null, targets: [], dots: [], others: [] };
  const me = radarMe(r);
  if (!me) return { me: null, targets: [], dots: [], others: [] };
  const want = needs();
  const mapKey = hereMapKey();
  const pinned = (prefs.pinned || []).map(String);
  const byNpc = new Map();
  const dots = [];
  const consider = (npcKey, x, y, live) => {
    const pets = petsOf(npcKey, want, mapKey);
    if (!pets.length) return;
    const dx = (x - me.x) / UNITS_PER_M, dy = (y - me.y) / UNITS_PER_M;
    const dist = Math.hypot(dx, dy);
    dots.push({ npcKey, dx, dy, dist, live, pinned: pets.some((p) => pinned.includes(p.pet)) });
    const had = byNpc.get(npcKey);
    // A monster in view beats a spawn point; then the nearer.
    if (had && (had.live && !live || had.live === live && had.dist <= dist)) return;
    byNpc.set(npcKey, { npcKey, pets, dist, dx, dy, bearing: bearingOf(dx, dy), live });
  };
  // Everything else in view, for the layers.
  const others = [];
  for (const m of r.mobs || []) {
    const before = dots.length;
    for (const k of NPC_KEYS[m.npc] || []) consider(k, m.pos[0], m.pos[1], true);
    if (dots.length > before) continue;
    const dx = (m.pos[0] - me.x) / UNITS_PER_M, dy = (m.pos[1] - me.y) / UNITS_PER_M;
    others.push({ npc: m.npc, kind: npcKind(m.npc), dx, dy, dist: Math.hypot(dx, dy) });
  }
  others.sort((a, b) => (a.kind === DOT.boss) - (b.kind === DOT.boss) || b.dist - a.dist);
  // Spawn points of monsters not in view, on this map.
  const mid = mapIdOf(mapKey);
  if (mid) {
    const mx = MAP_HALF + me.x / UNITS_PER_M, my = MAP_HALF + me.y / UNITS_PER_M;
    for (const pet of want.keys()) {
      for (const [m, npcKey, pts] of MAP.spawns[pet] || []) {
        if (m !== mid || byNpc.get(npcKey)?.live) continue;
        for (const [px, py] of pts) {
          if (Math.hypot(px - mx, py - my) > RADAR_RANGE_M) continue;
          consider(npcKey, (px - MAP_HALF) * UNITS_PER_M, (py - MAP_HALF) * UNITS_PER_M, false);
        }
      }
    }
  }
  const rank = (t) => (t.pets.some((p) => pinned.includes(p.pet)) ? 0 : 1);
  const targets = [...byNpc.values()].sort((a, b) => rank(a) - rank(b) || b.live - a.live || a.dist - b.dist);
  // Spawn points of a kind already in view aren't where to go.
  const shown = dots.filter((d) => d.live || !byNpc.get(d.npcKey)?.live);
  shown.sort((a, b) => b.live - a.live || a.dist - b.dist);
  return { me, targets, dots: shown, others };
}

// Distances only as exact as where you are: to 5 m when that's a guess.
const roundDist = (m, approx) => (approx && m >= 10 ? Math.round(m / 5) * 5 : Math.round(m));

function radarPayload() {
  const { me, targets, dots, others } = radarTargets();
  const pinned = (prefs.pinned || []).map(String);
  const layers = radarLayers();
  const on = (kind) => (kind === DOT.boss ? layers.bosses : kind === DOT.mob ? layers.mobs : layers.npcs);
  // The nearest boss, named, under the header; the rest are counted.
  const boss = others.filter((o) => o.kind === DOT.boss).sort((a, b) => a.dist - b.dist)[0];
  const petDots = dots.slice(0, RADAR_DOTS);
  const rows = targets.slice(0, RADAR_ROWS);
  const nth = new Map(rows.map((t, i) => [t.npcKey, i + 1]));
  return {
    scale: radarScale(),
    me: me ? { approx: me.approx, err: me.err } : null,
    mapKnown: !!mapIdOf(hereMapKey()),
    // [east m, south m, in view, pinned, row number or 0, kind]: a row's
    // own monster carries its number, so the scope and the list match. The
    // other layers go first, far to near and bosses last, so they draw
    // under what you are after.
    dots: [
      ...others.filter((o) => on(o.kind)).slice(-Math.max(1, RADAR_DOTS - petDots.length)).map((o) => [Math.round(o.dx), Math.round(o.dy), 1, 0, 0, o.kind]),
      ...petDots.map((d) => {
        const row = rows.find((t) => t.npcKey === d.npcKey);
        const own = row && row.dx === d.dx && row.dy === d.dy;
        return [Math.round(d.dx), Math.round(d.dy), d.live ? 1 : 0, d.pinned ? 1 : 0, own ? nth.get(d.npcKey) : 0, DOT.pet];
      }),
    ],
    layers,
    counts: {
      mobs: (radar.last?.mobs || []).length - others.filter((o) => o.kind !== DOT.mob).length,
      bosses: others.filter((o) => o.kind === DOT.boss).length,
      npcs: others.filter((o) => o.kind === DOT.npc).length,
    },
    boss: boss ? {
      name: BOSSES[boss.npc] || "Boss",
      dist: roundDist(boss.dist, !!me?.approx),
      bearing: Math.round(bearingOf(boss.dx, boss.dy)),
      dir: compass(bearingOf(boss.dx, boss.dy)),
    } : null,
    rows: rows.map((t) => ({
      n: nth.get(t.npcKey),
      name: text(t.npcKey),
      pets: t.pets.map((p) => `${pinned.includes(p.pet) ? "★ " : ""}${petName(p.pet)} ×${p.left}`).join(" · "),
      pet: t.pets[0].pet,
      dist: roundDist(t.dist, !!me?.approx),
      bearing: Math.round(t.bearing),
      dir: compass(t.bearing),
      live: t.live,
      pinned: t.pets.some((p) => pinned.includes(p.pet)),
    })),
  };
}

function sendRadar() {
  if (!prefs.radar) return;
  const data = radarPayload();
  const key = JSON.stringify(data);
  if (key === radar.sent) return;
  radar.sent = key;
  a2.widgets.send(RADAR_WIDGET, data).catch(() => {});
}

function setRadar(on) {
  prefs.radar = !!on;
  radarBtn?.setAttribute("aria-pressed", String(prefs.radar));
  radar.sent = "";
  a2.widgets.locked().then(showLock).catch(() => showLock(false));
  if (prefs.radar) {
    a2.widgets.open(RADAR_WIDGET, radarSize()).then(sendRadar).catch((e) => a2.notify(`Radar: ${e.message || e}`).catch(() => {}));
  } else {
    a2.widgets.close(RADAR_WIDGET).catch(() => {});
  }
}

radarBtn?.addEventListener("click", () => {
  setRadar(!prefs.radar);
  savePrefs();
});

a2.on("radar", (r) => {
  radar.last = r;
  sendRadar();
  if (prefs.view === "map") drawMap();
});

// The widget: it asks for the data once it has loaded, and a click on a row
// pins (or unpins) that row's first pet.
a2.on("widget-message", ({ name, data }) => {
  if (name !== RADAR_WIDGET) return;
  if (data?.ready) {
    radar.sent = "";
    sendRadar();
  }
  // The grip let go at a new scale, or the card needs more room than the
  // window has: the window takes the new size.
  if (data?.scale != null || data?.fit > radar.fit) {
    if (data.scale != null) {
      prefs.radarScale = Math.round(Math.min(RADAR_SCALE.max, Math.max(RADAR_SCALE.min, Number(data.scale) || 1)) * 100) / 100;
      savePrefs();
    }
    if (data.fit > radar.fit) radar.fit = Math.min(1200, Math.ceil(data.fit));
    if (prefs.radar) a2.widgets.open(RADAR_WIDGET, radarSize()).catch(() => {});
    radar.sent = "";
    sendRadar();
  }
  if (data?.layer && data.layer in RADAR_LAYERS) {
    const layers = radarLayers();
    layers[data.layer] = !layers[data.layer];
    prefs.radarLayers = layers;
    savePrefs();
    radar.sent = "";
    sendRadar();
  }
  if (data?.pin) {
    const id = String(data.pin);
    const pinned = (prefs.pinned || []).map(String);
    prefs.pinned = pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id];
    savePrefs();
    render();
    radar.sent = "";
    sendRadar();
  }
});

// The list changes what is wanted (a soul, a pin, a sync): send again.
{
  const before = render;
  render = function () {
    before();
    sendRadar();
  };
}

// On the Map tab: you, and the monsters in view that drop what you need.
{
  const before = drawMap;
  drawMap = function () {
    before();
    if (prefs.view !== "map" || !mapState.map || !MAP.maps[mapState.map] || !mapState.view) return;
    if (mapIdOf(hereMapKey()) !== mapState.map || !radar.last) return;
    const { me, dots } = radarTargets();
    if (!me) return;
    const g = mapEls.canvas.getContext("2d");
    const px = mapState.px || window.devicePixelRatio || 1; // drawMap's scale
    g.setTransform(px, 0, 0, px, 0, 0);
    const v = mapState.view;
    const at = (x, y) => [(MAP_HALF + x / UNITS_PER_M - v.x) * v.scale, (MAP_HALF + y / UNITS_PER_M - v.y) * v.scale];
    for (const d of dots) {
      if (!d.live) continue;
      const [x, y] = at(me.x + d.dx * UNITS_PER_M, me.y + d.dy * UNITS_PER_M);
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fillStyle = d.pinned ? "#ffd54a" : "#ff7a59";
      g.fill();
    }
    const [x, y] = at(me.x, me.y);
    if (me.approx) {
      // How far off you may be.
      g.beginPath();
      g.arc(x, y, Math.max(6, me.err * v.scale), 0, Math.PI * 2);
      g.fillStyle = "rgba(143, 194, 255, 0.12)";
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = "rgba(143, 194, 255, 0.5)";
      g.stroke();
    }
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fillStyle = me.approx ? "rgba(143, 194, 255, 0.5)" : "#8fc2ff";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = "#0a0e16";
    g.stroke();
  };
}

// Back as it was left, once plugin.js has the saved prefs.
function restoreRadar() {
  radarBtn?.setAttribute("aria-pressed", String(!!prefs.radar));
  if (prefs.radar) setRadar(true);
}
