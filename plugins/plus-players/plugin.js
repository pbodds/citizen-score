// Players: look up an AION 2 character on the Global servers, the way
// NCSOFT's own character page does (a2.players, permission "net:players").
//
// - Search by name in one region, optionally one faction; "Me" looks up the
//   character the meter sees you playing.
// - A character shows its combat power and item level, stats, gear (Arcana,
//   pet and wings apart), skills with their levels, equipped titles and the
//   Daevanion boards, each board drawable node by node.
// - The last characters opened are kept, to open again in one click.

// Search gives a pcId (class × race × gender), four per class in this order.
const PC_CLASSES = ["Gladiator", "Templar", "Ranger", "Assassin", "Spiritmaster", "Sorcerer", "Cleric", "Chanter"];
const pcClass = (pcId) => PC_CLASSES[Math.floor((pcId - 5) / 4)] || "";
const RACES = { 1: "Elyos", 2: "Asmodian" };
const REGION_NAMES = { nae: "NA East", naw: "NA West", eu: "Europe", la: "Latin America", as: "Asia" };
// What the meter's class names (Korean) are on the site.
const CLASS_BY_KO = { 검성: "Gladiator", 수호성: "Templar", 살성: "Assassin", 궁성: "Ranger", 마도성: "Sorcerer", 정령성: "Spiritmaster", 치유성: "Cleric", 호법성: "Chanter" };
const SLOT_ORDER = ["MainHand", "SubHand", "Helmet", "Shoulder", "Torso", "Pants", "Gloves", "Boots", "Cape", "Belt",
  "Necklace", "Earring1", "Earring2", "Ring1", "Ring2", "Bracelet1", "Bracelet2", "Amulet", "Rune1", "Rune2"];
const SLOT_NAMES = { MainHand: "Weapon", SubHand: "Off-hand", Torso: "Chest", Pants: "Legs", Earring1: "Earring", Earring2: "Earring",
  Ring1: "Ring", Ring2: "Ring", Bracelet1: "Bracelet", Bracelet2: "Bracelet", Rune1: "Rune", Rune2: "Rune" };
const SKILL_KINDS = [["Active", "Active skills"], ["Dp", "Stigmas"], ["Passive", "Passives"]];
const RECENT_MAX = 10;

const els = {
  form: document.querySelector(".search"),
  q: document.querySelector(".q"),
  me: document.querySelector(".meBtn"),
  region: document.querySelector(".region"),
  race: document.querySelector(".race"),
  out: document.querySelector(".out"),
};

let prefs = { region: "nae", race: "", recent: [], open: {} };
let me = null; // { name, serverId } from the meter
let token = 0; // the latest request; older answers are dropped
const save = () => a2.storage.set("prefs", prefs).catch(() => {});

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const plain = (html) => String(html || "").replace(/<[^>]*>/g, "");
const num = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : "–");

// Icons and portraits come through the meter (the page itself has no network).
const images = new Map();
function img(url, cls, alt = "") {
  const i = el("img", cls);
  i.alt = alt;
  i.loading = "lazy";
  if (!url) return i;
  const full = url.startsWith("/") ? `https://profileimg.plaync.com${url}` : url;
  if (!images.has(full)) images.set(full, a2.players.image(full).catch(() => ""));
  images.get(full).then((src) => {
    if (src) i.src = src;
    else i.classList.add("noImg");
  });
  return i;
}

function section(title, build, openByDefault = true) {
  const d = el("details", "sec");
  d.open = prefs.open[title] ?? openByDefault;
  d.append(el("summary", null, title));
  const body = el("div", "secBody");
  d.append(body);
  build(body);
  d.addEventListener("toggle", () => {
    prefs.open[title] = d.open;
    save();
  });
  return d;
}

function status(text, cls = "note") {
  els.out.replaceChildren(el("p", cls, text));
}

// --- Search -------------------------------------------------------------------
async function search(keyword, page = 1) {
  keyword = keyword.trim();
  if (!keyword) return showHome();
  const mine = ++token;
  status("Searching…");
  try {
    const args = { keyword, region: prefs.region, page, size: 20 };
    if (prefs.race) args.race = Number(prefs.race);
    const res = await a2.players.search(args);
    if (mine !== token) return;
    renderResults(keyword, res, page);
  } catch (e) {
    if (mine === token) status(`Search failed: ${e.message || e}`, "err");
  }
}

function charRow(c) {
  const row = el("button", "hit");
  row.type = "button";
  row.append(img(c.profileImageUrl, "face"));
  const main = el("span", "hitMain");
  main.append(el("strong", null, plain(c.name)));
  const cls = c.className || pcClass(c.pcId);
  main.append(el("span", "hitSub", [cls, c.level ? `Lv ${c.level}` : "", c.serverName, RACES[c.race]].filter(Boolean).join(" · ")));
  row.append(main);
  if (c.combatPower) row.append(el("span", "hitCp", num(c.combatPower)));
  row.addEventListener("click", () => openChar({ serverId: c.serverId, characterId: c.characterId, region: c.region || prefs.region }));
  return row;
}

function renderResults(keyword, res, page) {
  const list = res?.list || [];
  const total = res?.pagination?.total ?? list.length;
  const end = res?.pagination?.endPage ?? 1;
  const head = el("div", "listHead", `${num(total)} named "${keyword}" in ${REGION_NAMES[prefs.region]}`);
  const box = el("div", "hits");
  for (const c of list) box.append(charRow(c));
  if (!list.length) box.append(el("p", "note", "Nobody by that name here. Try another region or fewer letters."));
  const nav = el("div", "pager");
  if (end > 1) {
    const prev = el("button", null, "‹ Prev");
    prev.type = "button";
    prev.disabled = page <= 1;
    prev.addEventListener("click", () => search(keyword, page - 1));
    const next = el("button", null, "Next ›");
    next.type = "button";
    next.disabled = page >= end;
    next.addEventListener("click", () => search(keyword, page + 1));
    nav.append(prev, el("span", null, `${page} / ${end}`), next);
  }
  els.out.replaceChildren(head, box, nav);
}

function showHome() {
  token++;
  const parts = [];
  if (prefs.recent.length) {
    parts.push(el("div", "listHead", "Recently opened"));
    const box = el("div", "hits");
    for (const c of prefs.recent) box.append(charRow(c));
    parts.push(box);
  } else {
    parts.push(el("p", "note", "Search a character name to see their gear, stats, skills and Daevanion."));
  }
  els.out.replaceChildren(...parts);
}

// --- A character ----------------------------------------------------------------
async function openChar(ref) {
  const mine = ++token;
  status("Loading…");
  try {
    const [info, eq] = await Promise.all([a2.players.info(ref), a2.players.equipment(ref)]);
    if (mine !== token) return;
    const p = info?.profile;
    if (!p?.characterName) return status("NCSOFT's site doesn't know that character (renamed, or not logged in since the site started).", "err");
    remember(ref, p);
    renderChar(ref, info, eq);
  } catch (e) {
    if (mine === token) status(`Couldn't load the character: ${e.message || e}`, "err");
  }
}

function remember(ref, p) {
  const entry = {
    serverId: ref.serverId, characterId: ref.characterId, region: ref.region,
    name: p.characterName, className: p.className, level: p.characterLevel,
    serverName: p.serverName, race: p.raceId, combatPower: p.combatPower, profileImageUrl: p.profileImage,
  };
  prefs.recent = [entry, ...prefs.recent.filter((r) => r.characterId !== ref.characterId)].slice(0, RECENT_MAX);
  save();
}

function renderChar(ref, info, eq) {
  const p = info.profile;
  const stats = info.stat?.statList || [];
  const il = stats.find((s) => s.type === "ItemLevel")?.value;

  const back = el("button", "back", "‹ Back");
  back.type = "button";
  back.addEventListener("click", () => (els.q.value.trim() ? search(els.q.value) : showHome()));

  const head = el("div", "charHead");
  head.append(img(p.profileImage, "portrait", p.characterName));
  const who = el("div", "who");
  who.append(el("div", "charName", p.characterName));
  who.append(el("div", "charSub", `${p.className} · Lv ${p.characterLevel} · ${p.serverName} (${REGION_NAMES[ref.region] || ref.region}) · ${RACES[p.raceId] || p.raceName}`));
  if (p.titleName) who.append(el("div", "charTitle", p.titleName));
  head.append(who);
  const nums = el("div", "bigNums");
  for (const [label, v] of [["Combat Power", p.combatPower], ["Item Level", il]]) {
    const b = el("div", "bigNum");
    b.append(el("strong", null, num(v)), el("span", null, label));
    nums.append(b);
  }

  const parts = [back, head, nums];
  parts.push(section("Gear", (body) => gear(body, eq)));
  parts.push(section("Stats", (body) => statBlock(body, stats)));
  parts.push(section("Skills", (body) => skills(body, eq?.skill?.skillList || []), false));
  parts.push(section("Daevanion", (body) => daevanion(body, ref, info.daevanion?.boardList || [])));
  parts.push(section("Titles", (body) => titles(body, info.title), false));
  els.out.replaceChildren(...parts);
  els.out.scrollTop = 0;
  window.scrollTo(0, 0);
}

function itemRow(slotName, it) {
  const row = el("div", `item g-${(it.grade || "").toLowerCase()}`);
  row.append(img(it.icon, "icon"));
  const t = el("span", "itemMain");
  t.append(el("span", "itemName", it.name), el("span", "itemSlot", slotName));
  row.append(t);
  const lvl = [it.enchantLevel ? `+${it.enchantLevel}` : "", it.exceedLevel ? `★${it.exceedLevel}` : ""].filter(Boolean).join(" ");
  if (lvl) row.append(el("span", "itemLvl", lvl));
  row.title = `${it.grade || ""} ${it.name}`.trim();
  return row;
}

function gear(body, eq) {
  const list = eq?.equipment?.equipmentList || [];
  if (!list.length) return body.append(el("p", "note", "Nothing equipped (or the site hasn't seen this character's gear)."));
  const bySlot = new Map(list.map((x) => [x.slotPosName, x]));
  const grid = el("div", "items");
  for (const s of SLOT_ORDER) if (bySlot.has(s)) grid.append(itemRow(SLOT_NAMES[s] || s, bySlot.get(s)));
  // Anything new the site adds still shows.
  for (const x of list) if (!SLOT_ORDER.includes(x.slotPosName) && !x.slotPosName.startsWith("Arcana")) grid.append(itemRow(x.slotPosName, x));
  body.append(grid);
  const arcana = list.filter((x) => x.slotPosName.startsWith("Arcana"));
  if (arcana.length) {
    body.append(el("div", "subHead", "Arcana"));
    const a = el("div", "items");
    for (const x of arcana) a.append(itemRow(`Arcana ${x.slotPosName.slice(6)}`, x));
    body.append(a);
  }
  const pw = eq?.petwing || {};
  const extra = [["Pet", pw.pet, pw.pet ? `Lv ${pw.pet.level}` : ""], ["Wings", pw.wing], ["Wing look", pw.wingSkin]].filter(([, x]) => x);
  if (extra.length) {
    body.append(el("div", "subHead", "Pet and wings"));
    const a = el("div", "items");
    for (const [label, x, lv] of extra) {
      const r = itemRow(label, x);
      if (lv) r.append(el("span", "itemLvl", lv));
      a.append(r);
    }
    body.append(a);
  }
}

function statBlock(body, stats) {
  const base = stats.filter((s) => ["STR", "DEX", "INT", "CON", "AGI", "WIS"].includes(s.type));
  const gods = stats.filter((s) => s.name?.includes("[") && s.type !== "ItemLevel");
  const table = (rows) => {
    const t = el("table", "stats");
    for (const s of rows) {
      const tr = el("tr");
      tr.append(el("th", null, s.name), el("td", "statVal", num(s.value)), el("td", "statFx", (s.statSecondList || []).join(", ")));
      if (!s.value) tr.classList.add("zero");
      t.append(tr);
    }
    return t;
  };
  body.append(table(base));
  if (gods.length) {
    body.append(el("div", "subHead", "Daevanion stats"));
    body.append(table([...gods].sort((a, b) => b.value - a.value)));
  }
}

function skills(body, list) {
  const got = list.filter((s) => s.acquired);
  if (!got.length) return body.append(el("p", "note", "No skills listed."));
  for (const [cat, title] of SKILL_KINDS) {
    const rows = got.filter((s) => s.category === cat).sort((a, b) => b.skillLevel - a.skillLevel);
    if (!rows.length) continue;
    body.append(el("div", "subHead", title));
    const box = el("div", "skills");
    for (const s of rows) {
      const r = el("div", `skill${s.equip ? " on" : ""}`);
      r.append(img(s.icon, "icon"), el("span", "skillName", s.name), el("span", "skillLvl", `Lv ${s.skillLevel}`));
      r.title = s.equip ? `${s.name}: equipped` : s.name;
      box.append(r);
    }
    body.append(box);
  }
  const other = got.filter((s) => !SKILL_KINDS.some(([c]) => c === s.category));
  if (other.length) body.append(el("p", "note", `Also: ${other.map((s) => `${s.name} ${s.skillLevel}`).join(", ")}`));
}

function titles(body, t) {
  const list = t?.titleList || [];
  body.append(el("p", "note", `${num(t?.ownedCount)} titles owned. Equipped:`));
  for (const x of list) {
    const r = el("div", `titleRow g-${(x.grade || "").toLowerCase()}`);
    r.append(el("strong", null, x.name), el("span", "titleCat", x.equipCategory));
    const fx = [...(x.equipStatList || []), ...(x.statList || [])].map((s) => s.desc).join(", ");
    r.append(el("div", "titleFx", fx));
    body.append(r);
  }
}

// The boards: a bar each; click one to draw its nodes.
function daevanion(body, ref, boards) {
  if (!boards.length) return body.append(el("p", "note", "No boards listed."));
  const bars = el("div", "boards");
  const draw = el("div", "boardDraw");
  for (const b of boards) {
    const row = el("button", `boardRow${b.open ? "" : " shut"}`);
    row.type = "button";
    row.append(el("span", "bName", b.name));
    const track = el("span", "bTrack");
    const fill = el("span", "bFill");
    fill.style.width = `${b.openPercent || 0}%`;
    track.append(fill);
    row.append(track, el("span", "bVal", b.open ? `${b.openNodeCount}/${b.totalNodeCount}` : "locked"));
    row.addEventListener("click", async () => {
      for (const r of bars.children) r.classList.toggle("on", r === row);
      draw.replaceChildren(el("p", "note", `Loading ${b.name}…`));
      try {
        const d = await a2.players.daevanion({ ...ref, boardId: b.id });
        draw.replaceChildren(boardGrid(b, d?.nodeList || []));
      } catch (e) {
        draw.replaceChildren(el("p", "err", `Couldn't load ${b.name}: ${e.message || e}`));
      }
    });
    bars.append(row);
  }
  body.append(bars, draw, el("p", "note", "Click a board to see which nodes are taken."));
}

function boardGrid(b, nodes) {
  const real = nodes.filter((n) => n.type !== "None");
  if (!real.length) return el("p", "note", "No nodes.");
  const cols = Math.max(...nodes.map((n) => n.col));
  const rows = Math.max(...nodes.map((n) => n.row));
  const wrap = el("div", "grid");
  wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  for (const n of real) {
    const c = el("span", `node g-${(n.grade || "").toLowerCase()}${n.open ? " open" : ""}`);
    c.style.gridColumn = String(n.col);
    c.style.gridRow = String(n.row);
    c.title = `${n.name}${n.open ? " (taken)" : ""}\n${(n.effectList || []).map((e) => e.desc).join("\n")}`;
    wrap.append(c);
  }
  const taken = real.filter((n) => n.open);
  const out = el("div");
  out.append(el("div", "subHead", `${b.name}: ${taken.length} of ${real.length} nodes`), wrap);
  // The big nodes taken, by name.
  const big = new Map();
  for (const n of taken) if (n.grade !== "Common") big.set(n.name, (big.get(n.name) || 0) + 1);
  if (big.size) {
    const list = el("div", "taken");
    for (const [name, k] of big) list.append(el("span", null, k > 1 ? `${name} ×${k}` : name));
    out.append(list);
  }
  out.style.setProperty("--rows", rows);
  return out;
}

// --- Wiring ---------------------------------------------------------------------
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  search(els.q.value);
});
els.q.addEventListener("input", () => {
  if (!els.q.value.trim()) showHome();
});
els.region.addEventListener("change", () => {
  prefs.region = els.region.value;
  save();
  if (els.q.value.trim()) search(els.q.value);
});
els.race.addEventListener("change", () => {
  prefs.race = els.race.value;
  save();
  if (els.q.value.trim()) search(els.q.value);
});
els.me.addEventListener("click", async () => {
  if (!me?.name) return;
  els.q.value = me.name;
  const mine = ++token;
  status("Finding you…");
  try {
    const res = await a2.players.search({ keyword: me.name, region: prefs.region, size: 50 });
    if (mine !== token) return;
    const hit = (res?.list || []).find((c) => plain(c.name) === me.name && (!me.serverId || c.serverId === me.serverId));
    if (hit) openChar({ serverId: hit.serverId, characterId: hit.characterId, region: hit.region || prefs.region });
    else renderResults(me.name, res, 1);
  } catch (e) {
    if (mine === token) status(`Search failed: ${e.message || e}`, "err");
  }
});

a2.on("character", (c) => {
  me = c?.name ? { name: c.name, serverId: c.serverId || null, cls: CLASS_BY_KO[c.class] || null } : null;
  els.me.hidden = !me;
  if (me) els.me.title = `Look up ${me.name}`;
});

(async () => {
  try {
    const saved = await a2.storage.get("prefs");
    if (saved) prefs = { ...prefs, ...saved, open: saved.open || {}, recent: saved.recent || [] };
  } catch {}
  els.region.value = prefs.region;
  els.race.value = prefs.race;
  showHome();
  a2.ready();
})();
