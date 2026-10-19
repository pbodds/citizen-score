// Pet Souls+ (A2Tools Plus): the Areas view, where to farm next.
//
// Each zone where pet souls drop, ranked by how many of your pets still short
// of level 3 drop there and how many souls they still need, with the expected
// kills (souls left ÷ drop chance, the best monster per pet), the monsters'
// levels and the nearest Kibelisk. Click an area for its pets and monsters.
//
// The map you are on (a2.on("zone"), meter permission events:zone) lists its
// areas first, marked 📍. The game names maps by number: the two home maps
// are known, and any other is learned the first time a soul is picked up
// there for a pet whose souls drop on one map only.
//
// Plain globals from plugin.js are used as they are: state, prefs, key,
// language, render, text, petName, hiddenRegions, regionOf, sideOf, listOf,
// NEEDED, TO_MAX, MAX_LEVEL, PET_SOURCES, PET_GENUS.

const MAP_SEED = { 1010: "String_STR_Map_World_L_A_body", 1110: "String_STR_Map_World_D_A_body" };
let zoneMap = null;
let learnedMaps = {};
let openArea = null;
const areaEls = {
  tabs: [...document.querySelectorAll(".viewTab")],
  list: document.querySelector(".areaList"),
  note: document.querySelector(".areaNote"),
};
const mapKeyOf = (map) => (map == null ? null : learnedMaps[map] || MAP_SEED[map] || null);

const chanceOf = (s) => {
  const n = parseFloat(String(s || "").replace("%", ""));
  return n > 0 ? n / 100 : 0;
};

// Every pet still short of level 3 and the souls it needs. Before the first
// login sync nothing is known: every pet counts as needing all 105.
function needs() {
  const synced = Object.keys(state.levels).length || Object.keys(state.points).length;
  const ids = synced ? new Set([...Object.keys(state.levels), ...Object.keys(state.points)]) : new Set(Object.keys(PET_SOURCES));
  const out = new Map();
  for (const id of ids) {
    if (PET_GENUS[id] === "special" || PET_SOURCES[id]?.unreleased) continue;
    const level = state.levels[id] || 0;
    if (level >= MAX_LEVEL) continue;
    const left = Math.max(0, TO_MAX[level] - (state.points[id] || 0));
    if (left > 0) out.set(String(id), left);
  }
  return out;
}

function areas() {
  const hidden = new Set(hiddenRegions());
  const want = needs();
  const byKey = new Map();
  for (const [pet, left] of want) {
    for (const d of PET_SOURCES[pet]?.drops || []) {
      if (hidden.has(regionOf(d))) continue;
      const zone = (d.zones || [])[0] || "";
      const k = `${d.map}|${zone}`;
      let a = byKey.get(k);
      if (!a) byKey.set(k, (a = { key: k, map: d.map, zone, region: regionOf(d), pets: new Map(), kib: null, lo: Infinity, hi: 0 }));
      const kib = d.bySide?.[sideOf(key)] || d.kibelisk;
      if (kib && (!a.kib || kib.m < a.kib.m)) a.kib = kib;
      if (d.level) { a.lo = Math.min(a.lo, d.level); a.hi = Math.max(a.hi, d.level); }
      const p = a.pets.get(pet) || { pet, left, drops: [] };
      p.drops.push(d);
      a.pets.set(pet, p);
    }
  }
  const here = mapKeyOf(zoneMap);
  return [...byKey.values()]
    .map((a) => {
      let souls = 0, kills = 0;
      for (const p of a.pets.values()) {
        souls += p.left;
        const best = Math.max(...p.drops.map((d) => chanceOf(d.chance)));
        if (best > 0) kills += p.left / best;
      }
      return { ...a, souls, kills: Math.round(kills), here: !!here && a.map === here };
    })
    .sort((x, y) => y.here - x.here || y.pets.size - x.pets.size || y.souls - x.souls || x.kills - y.kills);
}

function renderAreas() {
  if (!areaEls.list) return;
  const list = areas();
  const synced = Object.keys(state.levels).length > 0;
  const where = mapKeyOf(zoneMap);
  areaEls.note.textContent = [
    synced ? "" : "Not synced yet: counting every pet as needing all its souls. Log in (or relog) to read yours.",
    where ? `📍 You're in ${text(where)}: its areas come first.` : zoneMap != null ? "This map isn't known yet: pick up a soul here and it will be." : "",
  ].filter(Boolean).join(" ");
  const items = list.slice(0, 60).map((a) => {
    const li = document.createElement("li");
    li.className = "area" + (a.here ? " here" : "") + (openArea === a.key ? " open" : "");
    li.dataset.area = a.key;
    const title = document.createElement("div");
    title.className = "areaTitle";
    title.textContent = `${a.here ? "📍 " : ""}${text(a.zone) || "?"} · ${text(a.map)}`;
    const stats = document.createElement("div");
    stats.className = "areaStats";
    const lv = a.hi ? (a.lo === a.hi ? `Lv ${a.lo}` : `Lv ${a.lo}–${a.hi}`) : "";
    const kib = a.kib ? (a.kib.teleport ? `Kibelisk #${a.kib.teleport} (${a.kib.m.toLocaleString(language)} m)` : `${text(a.kib.name)} (${a.kib.m.toLocaleString(language)} m)`) : "";
    stats.textContent = [`${a.pets.size} pet${a.pets.size === 1 ? "" : "s"}`, `${a.souls} souls`, a.kills ? `~${a.kills.toLocaleString(language)} kills` : "", lv, kib]
      .filter(Boolean).join(" · ");
    li.append(title, stats);
    if (openArea === a.key) {
      const box = document.createElement("div");
      box.className = "where";
      const pets = [...a.pets.values()].sort((x, y) => y.left - x.left);
      for (const p of pets) {
        const who = document.createElement("div");
        who.className = "who";
        who.textContent = `${petName(p.pet)} · ${p.left} to Lv 3`;
        const at = document.createElement("div");
        at.className = "at";
        at.textContent = listOf(p.drops.map((d) => [text(d.npc), d.level && `Lv ${d.level}`, d.chance, d.spawns && `${d.spawns} spawns`].filter(Boolean).join(" ")));
        box.append(who, at);
      }
      li.append(box);
    }
    return li;
  });
  areaEls.list.replaceChildren(...items);
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "areaNone";
    li.textContent = "Nothing left to farm in the regions turned on. 🎉";
    areaEls.list.append(li);
  }
}

function showView(view) {
  prefs.view = view === "areas" ? "areas" : "pets";
  document.body.classList.toggle("viewAreas", prefs.view === "areas");
  for (const t of areaEls.tabs) t.setAttribute("aria-selected", String(t.dataset.view === prefs.view));
}

for (const t of areaEls.tabs) {
  t.addEventListener("click", () => {
    showView(t.dataset.view);
    savePrefs();
    renderAreas();
  });
}
areaEls.list?.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-area]");
  if (!li) return;
  openArea = openArea === li.dataset.area ? null : li.dataset.area;
  renderAreas();
});

// Areas follow every change the pet list sees (a sync, a soul, a region chip).
{
  const petsRender = render;
  render = function () {
    petsRender();
    showView(prefs.view);
    renderAreas();
  };
}

a2.on("zone", (z) => {
  zoneMap = z?.map ?? null;
  renderAreas();
});

// A soul picked up on a map not known yet, for a pet whose souls drop on one
// map only: that is this map.
a2.on("decoded:soul-gained", ({ pet }) => {
  if (zoneMap == null || mapKeyOf(zoneMap)) return;
  const maps = new Set((PET_SOURCES[pet]?.drops || []).map((d) => d.map));
  if (maps.size !== 1) return;
  learnedMaps[zoneMap] = [...maps][0];
  a2.storage.set("maps", learnedMaps).catch(() => {});
  renderAreas();
});

(async () => {
  learnedMaps = (await a2.storage.get("maps").catch(() => null)) || {};
  try {
    zoneMap = (await a2.localWorld())?.map ?? null;
  } catch {}
  showView(prefs.view);
  renderAreas();
})();
