// Players: who is around you, and whoever you are fighting.
//
// - The meter names the players it sees spawn near you (allies and enemies
//   alike), and which of them you hit or were hit by (a2.on("players"),
//   permission events:players). Only names: never where they are.
// - Party members come with the game's own level, gear score and combat
//   power (the party roster). Anyone else is looked up on NCSOFT's character
//   site, by name and, when the meter knows it, home server — only when you
//   open a name or fight someone, and remembered for 10 minutes.
// - Clicking a name opens its card in the list: combat power, item level,
//   a gear summary, every piece (click one for its Manastones, Theostone and
//   stat lines), Arcana with their skill lines and set bonus, pet and wings,
//   stigma and skill levels.
// - "Fight card": the player you are fighting, the same card over the game.
//   The game sends nothing when you merely Tab-target or mouse over someone,
//   so the card follows hits (yours on them, or theirs on you).

const AROUND_MAX = 30;
const LOOKUP_TTL = 10 * 60_000;
const LOOKUP_FAIL_TTL = 60_000;
const HOVER_MS = 250;
const FIGHT_RECENT_MS = 20_000; // a hit within this long = still fighting
const FIGHT_LINGER_MS = 45_000; // the card stays this long after the last hit
const FIGHT_SIZE = { width: 290, height: 400 };
const STALE_MS = 3 * 60_000; // not seen this long: probably gone (faded)

// Server ids: 1xxx Elyos, 2xxx Asmodian (both sides share a server's number).
const factionOf = (serverId) => (serverId >= 2000 ? "Asmodian" : serverId >= 1000 ? "Elyos" : "");
// "ally" / "enemy" next to you, when both factions are known.
function sideOf(p) {
  const theirs = factionOf(p.serverId || known(p)?.ref?.serverId || 0);
  const mine = factionOf(me?.serverId || 0);
  return theirs && mine ? (theirs === mine ? "ally" : "enemy") : "";
}
const CLASS_SHORT = { Gladiator: "GLA", Templar: "TEM", Assassin: "ASN", Ranger: "RNG", Sorcerer: "SOR", Spiritmaster: "SPM", Cleric: "CLR", Chanter: "CHN" };
const classOf = (p) => known(p)?.info?.profile?.className || CLASS_BY_KO[p.class] || "";

let openId = null; // the row whose card is open in the list
let openSlot = null; // the piece of gear whose details show in that card
const FILTERS = [["all", "All"], ["enemy", "Enemies"], ["ally", "Allies"], ["party", "Party"]];

let around = []; // from a2.on("players")
const lookups = new Map(); // "name|server|region" → { at, failed, promise, result }
const lookupKey = (p) => `${p.name}|${p.serverId || 0}|${prefs.region}`;
// What a lookup already found, without asking again.
const known = (p) => lookups.get(lookupKey(p))?.result || null;

const ago = (ms) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};

// One player's character on the site: { ref, info, eq, sure } or { choices }.
function lookup(p) {
  const key = lookupKey(p);
  const hit = lookups.get(key);
  if (hit && Date.now() - hit.at < (hit.failed ? LOOKUP_FAIL_TTL : LOOKUP_TTL)) return hit.promise;
  const entry = { at: Date.now(), failed: false, promise: null };
  entry.promise = (async () => {
    const res = await a2.players.search({ keyword: p.name, region: prefs.region, size: 50 });
    const exact = (res?.list || []).filter((c) => plain(c.name) === p.name);
    let pick = null;
    let sure = true;
    if (p.serverId) pick = exact.find((c) => c.serverId === p.serverId) || null;
    else if (exact.length === 1) pick = exact[0];
    else if (exact.length > 1 && me?.serverId) {
      // Most players around you are on your own server.
      pick = exact.find((c) => c.serverId === me.serverId) || null;
      sure = false;
    }
    if (!pick) return { choices: exact };
    const ref = { serverId: pick.serverId, characterId: pick.characterId, region: pick.region || prefs.region };
    const [info, eq] = await Promise.all([a2.players.info(ref), a2.players.equipment(ref)]);
    return { ref, info, eq, sure };
  })().then((result) => {
    entry.result = result;
    return result;
  }, (e) => {
    entry.failed = true;
    throw e;
  });
  lookups.set(key, entry);
  if (lookups.size > 200) lookups.delete(lookups.keys().next().value);
  return entry.promise;
}

// One piece's details (Manastones, Theostone, stat and skill lines), asked
// once per character and kept with its lookup.
function itemDetail(found, it) {
  found.items = found.items || {};
  if (!found.items[it.slotPosName]) {
    found.items[it.slotPosName] = a2.players.item({ ...found.ref, id: it.id, enchantLevel: it.enchantLevel || 0, slotPos: it.slotPos })
      .catch((e) => ({ error: String(e?.message || e) }))
      .then((d) => (found.items[`${it.slotPosName}:done`] = d));
  }
  return found.items[it.slotPosName];
}
// Every Arcana's details at once (5 small asks), for their skill lines.
function arcanaDetails(found) {
  const list = (found?.eq?.equipment?.equipmentList || []).filter((x) => x.slotPosName.startsWith("Arcana"));
  return Promise.all(list.map((it) => itemDetail(found, it).then((d) => [it.slotPosName, d])));
}

// The gear a card lists: the main slots, best first in slot order.
function cardGear(eq) {
  const list = eq?.equipment?.equipmentList || [];
  const bySlot = new Map(list.map((x) => [x.slotPosName, x]));
  return SLOT_ORDER.filter((s) => bySlot.has(s)).map((s) => {
    const it = bySlot.get(s);
    return {
      slot: SLOT_NAMES[s] || s,
      name: it.name,
      grade: (it.grade || "").toLowerCase(),
      lvl: [it.enchantLevel ? `+${it.enchantLevel}` : "", it.exceedLevel ? `★${it.exceedLevel}` : ""].filter(Boolean).join(" "),
    };
  });
}

// What a card shows, from the meter's word and the site's.
function cardData(p, found) {
  const prof = found?.info?.profile;
  const stats = found?.info?.stat?.statList || [];
  const il = stats.find((s) => s.type === "ItemLevel")?.value;
  const cls = prof?.className || CLASS_BY_KO[p.class] || "";
  return {
    name: p.name,
    sub: [cls, prof?.characterLevel ? `Lv ${prof.characterLevel}` : p.party?.level ? `Lv ${p.party.level}` : "",
      prof?.serverName, prof ? RACES[prof.raceId] : ""].filter(Boolean).join(" · "),
    cp: prof?.combatPower || p.party?.combatPower || 0,
    il: il || p.party?.gearScore || 0,
    party: !!p.party,
    sure: found ? found.sure !== false : true,
    gear: found?.eq ? cardGear(found.eq) : [],
    ref: found?.ref || null,
    title: prof?.titleName || "",
    side: sideOf(p),
    summary: found?.eq ? gearSummary(found.eq) : [],
    arcana: found?.eq ? arcanaList(found) : [],
    stigmas: found?.eq ? skillList(found.eq, "Dp") : [],
    skills: found?.eq ? skillList(found.eq, "Active").slice(0, 8) : [],
    extras: found?.eq ? petWings(found.eq) : "",
  };
}

// "+14.6 avg", "★ 18/20", "Weapon +15 ★5": the gear at a glance.
function gearSummary(eq) {
  const list = (eq?.equipment?.equipmentList || []).filter((x) => SLOT_ORDER.includes(x.slotPosName));
  if (!list.length) return [];
  const avg = list.reduce((t, x) => t + (x.enchantLevel || 0), 0) / list.length;
  const out = [`Enchant avg +${avg.toFixed(1)}`];
  const ex = list.filter((x) => x.exceedLevel).length;
  if (ex) out.push(`Exceeded ${ex}/${list.length}`);
  const grades = {};
  for (const x of list) grades[x.grade] = (grades[x.grade] || 0) + 1;
  const top = Object.entries(grades).sort((a, b) => b[1] - a[1])[0];
  if (top) out.push(`${top[1]}/${list.length} ${GRADE_NAME[top[0]] || top[0]}`);
  return out;
}
// The site's grade ids, as the game names them.
const GRADE_NAME = { Legend: "Epic", Unique: "Unique", Rare: "Rare", Common: "Common", Epic: "Mythic", Special: "Special" };

function arcanaList(found) {
  const list = (found.eq?.equipment?.equipmentList || []).filter((x) => x.slotPosName.startsWith("Arcana"));
  return list.sort((a, b) => a.slotPosName.localeCompare(b.slotPosName)).map((it) => {
    const d = found.items?.[`${it.slotPosName}:done`];
    return {
      name: it.name, grade: (it.grade || "").toLowerCase(), lvl: it.enchantLevel ? `+${it.enchantLevel}` : "",
      lines: d?.subSkills ? d.subSkills.map((x) => `${x.name} +${x.level}`) : null,
      set: d?.set || null,
    };
  });
}

function skillList(eq, kind) {
  return (eq?.skill?.skillList || [])
    .filter((x) => x.category === kind && x.equip && x.skillLevel > 0)
    .sort((a, b) => b.skillLevel - a.skillLevel)
    .map((x) => [x.name, x.skillLevel]);
}

function petWings(eq) {
  const pw = eq?.petwing || {};
  return [pw.pet ? `Pet: ${pw.pet.name}${pw.pet.level ? ` Lv ${pw.pet.level}` : ""}` : "", pw.wing ? `Wings: ${pw.wing.name}${pw.wing.enchantLevel ? ` +${pw.wing.enchantLevel}` : ""}` : ""]
    .filter(Boolean).join(" · ");
}

// --- The card -------------------------------------------------------------------
// `d` from cardData; `found` (the lookup) makes the gear clickable for its
// details, `state` is a line of status ("Looking them up…", "!error").
function drawCard(box, d, state, found) {
  box.replaceChildren();
  // In the list the row above already names them.
  if (!found) {
    const head = el("div", "cardHead");
    head.append(el("strong", null, d.name));
    if (d.party) head.append(el("span", "tag", "party"));
    if (d.side) head.append(el("span", `tag side ${d.side}`, d.side));
    box.append(head);
  }
  if (d.sub) box.append(el("div", "hitSub", d.sub));
  if (d.title) box.append(el("div", "charTitle", d.title));
  const nums = el("div", "bigNums");
  for (const [label, v] of [["Combat Power", d.cp], ["Item Level", d.il]]) {
    const b = el("div", "bigNum");
    b.append(el("strong", null, v ? num(v) : "–"), el("span", null, label));
    nums.append(b);
  }
  box.append(nums);
  if (!d.sure) box.append(el("p", "note", "Several characters have this name; this is the one on your server."));
  if (state) box.append(el("p", state.startsWith("!") ? "err" : "note", state.replace(/^!/, "")));
  if (d.summary?.length) {
    const sm = el("div", "chips");
    for (const t of d.summary) sm.append(el("span", "chip", t));
    box.append(sm);
  }
  const list = found?.eq?.equipment?.equipmentList || [];
  const bySlot = new Map(list.map((x) => [x.slotPosName, x]));
  if (d.gear.length) {
    box.append(el("div", "cardSub", found ? "Gear · click a piece for its stones and stats" : "Gear"));
    const g = el("div", "cardGear");
    let detailAfter = null;
    for (const s of SLOT_ORDER) {
      const it = bySlot.get(s);
      if (!it) continue;
      const r = el(found ? "button" : "div", `cg g-${(it.grade || "").toLowerCase()}${openSlot === s ? " on" : ""}`);
      if (found) r.type = "button";
      r.append(img(it.icon, "cgIcon"));
      const t = el("span", "cgMain");
      t.append(el("span", "cgName", it.name), el("span", "cgSlot", SLOT_NAMES[s] || s));
      r.append(t);
      const lv = el("span", "cgLvl");
      if (it.enchantLevel) lv.append(el("b", null, `+${it.enchantLevel}`));
      if (it.exceedLevel) lv.append(el("span", "cgEx", `★${it.exceedLevel}`));
      r.append(lv);
      r.title = `${GRADE_NAME[it.grade] || it.grade || ""} ${it.name}`.trim();
      if (found) {
        r.addEventListener("click", (e) => {
          e.stopPropagation();
          openSlot = openSlot === s ? null : s;
          drawCard(box, d, state, found);
        });
      }
      g.append(r);
      if (openSlot === s) detailAfter = r;
    }
    box.append(g);
    if (detailAfter && found) {
      const it = bySlot.get(openSlot);
      const det = el("div", "itemDetail");
      det.append(el("p", "note", "Loading…"));
      // Spans both columns, right under the grid row of the piece clicked.
      const idx = [...g.children].indexOf(detailAfter);
      const rowEnd = idx % 2 === 0 && detailAfter.nextElementSibling ? detailAfter.nextElementSibling : detailAfter;
      rowEnd.after(det);
      itemDetail(found, it).then((x) => drawItemDetail(det, it, x));
    }
  }
  if (d.arcana?.length) {
    box.append(el("div", "cardSub", "Arcana"));
    const a = el("div", "arcana");
    for (const c of d.arcana) {
      const r = el("div", `arc g-${c.grade}`);
      const h = el("div", "arcHead");
      h.append(el("span", "cgName", c.name), el("b", null, c.lvl));
      r.append(h);
      r.append(el("div", "arcLines", c.lines ? (c.lines.join(" · ") || "no skill lines") : "…"));
      a.append(r);
    }
    box.append(a);
    const set = d.arcana.find((c) => c.set)?.set;
    if (set) {
      const on = (set.bonuses || []).filter((b) => b.degree <= (set.equippedCount || 0));
      if (on.length) box.append(el("p", "note setNote", `Set (${set.equippedCount}): ${on.map((b) => `${b.degree}: ${b.descriptions.join(", ")}`).join(" · ")}`));
    }
  }
  if (d.stigmas?.length || d.skills?.length) {
    box.append(el("div", "cardSub", "Skills"));
    for (const [label, rows] of [["Stigmas", d.stigmas], ["Top skills", d.skills]]) {
      if (!rows?.length) continue;
      const line = el("div", "skLine");
      line.append(el("span", "skLabel", label));
      const chips = el("span", "chips");
      for (const [n, lv] of rows) {
        const c = el("span", "chip");
        c.append(document.createTextNode(n + " "), el("b", null, String(lv)));
        chips.append(c);
      }
      line.append(chips);
      box.append(line);
    }
  }
  if (d.extras) box.append(el("p", "note", d.extras));
  if (d.ref) {
    const full = el("button", "fullBtn", "Full profile: stats, Daevanion, titles ›");
    full.type = "button";
    full.addEventListener("click", (e) => {
      e.stopPropagation();
      openChar(d.ref);
    });
    box.append(full);
  }
}

function drawItemDetail(box, it, x) {
  box.replaceChildren();
  if (!x || x.error) return box.append(el("p", "err", `Couldn't load it${x?.error ? `: ${x.error}` : ""}.`));
  const head = el("div", "idHead");
  head.append(el("strong", `g-${(it.grade || "").toLowerCase()}`, x.name || it.name));
  head.append(el("span", "hitSub", [x.gradeName || GRADE_NAME[it.grade], x.categoryName, x.level ? `IL ${x.level}` : "",
    it.enchantLevel ? `+${it.enchantLevel}${x.maxEnchantLevel ? `/${x.maxEnchantLevel}` : ""}` : "",
    it.exceedLevel ? `★${it.exceedLevel}${x.maxExceedEnchantLevel ? `/${x.maxExceedEnchantLevel}` : ""}` : ""].filter(Boolean).join(" · ")));
  box.append(head);
  const rows = (label, list) => {
    if (!list?.length) return;
    const t = el("div", "idRows");
    t.append(el("span", "skLabel", label));
    const v = el("span", "idVals");
    for (const r of list) v.append(r);
    t.append(v);
    box.append(t);
  };
  const line = (text, cls) => el("span", `idVal ${cls || ""}`, text);
  rows("Stats", (x.mainStats || []).map((m) => line(`${m.name} ${m.value}${m.extra && m.extra !== "0" ? ` (+${m.extra})` : ""}`)));
  rows("Random", (x.subStats || []).map((m) => line(`${m.name} ${m.value}`)));
  if (x.magicStoneSlotCount) {
    const st = x.magicStoneStat || [];
    const list = st.map((m) => line(`${m.name} ${m.value}`, `g-${(m.grade || "").toLowerCase()}`));
    for (let i = st.length; i < x.magicStoneSlotCount; i++) list.push(line("empty", "dim"));
    rows(`Manastones ${st.length}/${x.magicStoneSlotCount}`, list);
  }
  if (x.godStoneSlotCount) {
    const gs = x.godStoneStat || [];
    rows("Theostone", gs.length ? gs.map((g) => {
      const v = line(g.name.replace(/^Theostone: /, ""), `g-${(g.grade || "").toLowerCase()}`);
      v.title = g.desc || "";
      return v;
    }) : [line("empty", "dim")]);
  }
  rows("Skill lines", (x.subSkills || []).map((k) => line(`${k.name} +${k.level}`)));
}

// --- The list, on the home view --------------------------------------------------
function groupOf(p, now) {
  if (p.fought && now - p.fought < FIGHT_RECENT_MS) return 0;
  if (p.party) return 1;
  return 2;
}
const GROUP_NAMES = ["Fighting now", "Your party", "Nearby"];

function aroundSection() {
  const wrap = el("div", "around");
  const head = el("div", "listHead aroundHead");
  head.append(el("span", null, `Around you${around.length ? ` · ${around.length}` : ""}`));
  const pop = el("button", "popBtn", popOpen || prefs.aroundPop ? "Close pop-out" : "Pop out");
  pop.type = "button";
  pop.title = "The list in its own window over the game";
  pop.addEventListener("click", () => {
    openPop(!(popOpen || prefs.aroundPop)).then(() => {
      pop.textContent = prefs.aroundPop ? "Close pop-out" : "Pop out";
    });
  });
  head.append(pop);
  wrap.append(head);
  const now = Date.now();
  if (!around.length) {
    wrap.append(el("p", "note", "Players the meter sees near you show here (allies and enemies), with your party's combat power and gear score. Click a name for their gear, Arcana and skills."));
    return wrap;
  }
  const filter = FILTERS.some(([k]) => k === prefs.aroundFilter) ? prefs.aroundFilter : "all";
  const bar = el("div", "seg");
  for (const [k, label] of FILTERS) {
    const n = k === "all" ? around.length : around.filter((p) => (k === "party" ? p.party : sideOf(p) === k)).length;
    const b = el("button", null, `${label} ${n}`);
    b.type = "button";
    b.setAttribute("aria-pressed", String(k === filter));
    b.addEventListener("click", () => {
      prefs.aroundFilter = k;
      save();
      wrap.replaceWith(aroundSection());
    });
    bar.append(b);
  }
  wrap.append(bar);
  const shown = around.filter((p) => filter === "all" || (filter === "party" ? p.party : sideOf(p) === filter));
  // Fighting first (latest hit first), then party, then everyone else by name,
  // so rows don't jump about every time someone moves.
  const sorted = [...shown].sort((a, b) => groupOf(a, now) - groupOf(b, now)
    || (groupOf(a, now) === 0 ? b.fought - a.fought : a.name.localeCompare(b.name)));
  const box = el("div", "hits");
  let group = -1;
  for (const p of sorted.slice(0, AROUND_MAX)) {
    const gr = groupOf(p, now);
    if (gr !== group) {
      group = gr;
      box.append(el("div", "groupHead", GROUP_NAMES[gr]));
    }
    box.append(...aroundRow(p, now));
  }
  if (!sorted.length) box.append(el("p", "note", "Nobody here with this filter."));
  if (sorted.length > AROUND_MAX) box.append(el("p", "note", `and ${sorted.length - AROUND_MAX} more`));
  wrap.append(box);
  return wrap;
}

function aroundRow(p, now) {
  const found = known(p);
  const d = cardData(p, found);
  const row = el("button", "hit aroundRow");
  row.type = "button";
  const cls = classOf(p);
  const badge = el("span", `clsBadge c-${(cls || "none").toLowerCase()}`, CLASS_SHORT[cls] || "?");
  badge.title = cls || "Class not seen yet";
  row.append(badge);
  const main = el("span", "hitMain");
  const nameLine = el("span", "nameLine");
  nameLine.append(el("strong", null, p.name));
  if (p.party) nameLine.append(el("span", "tag", "party"));
  if (d.side) nameLine.append(el("span", `tag side ${d.side}`, d.side));
  main.append(nameLine);
  const prof = found?.info?.profile;
  const when = p.fought && now - p.fought < FIGHT_RECENT_MS ? `hit ${ago(p.fought)} ago` : p.fought ? `fought ${ago(p.fought)} ago` : `seen ${ago(p.seen)} ago`;
  main.append(el("span", "hitSub", [prof?.serverName, when].filter(Boolean).join(" · ")));
  row.append(main);
  const nums = el("span", "rowNums");
  if (d.cp) nums.append(el("span", "hitCp", num(d.cp)));
  if (d.il) nums.append(el("span", "rowIl", `IL ${num(d.il)}`));
  if (!d.cp && !d.il) nums.append(el("span", "rowIl dim", "gear ›"));
  row.append(nums);
  if (groupOf(p, now) === 0) row.classList.add("fighting");
  if (now - Math.max(p.seen, p.fought) > STALE_MS) row.classList.add("stale");
  const open = openId === p.id;
  if (open) row.classList.add("open");
  row.addEventListener("click", () => {
    openId = open ? null : p.id;
    openSlot = null;
    const home = els.out.querySelector(".around");
    if (home) home.replaceWith(aroundSection());
  });
  if (!open) return [row];
  const card = el("div", "inlineCard");
  card.addEventListener("click", (e) => e.stopPropagation());
  fillInline(card, p);
  return [row, card];
}

// The open row's card: drawn from what's known at once, then looked up.
function fillInline(card, p) {
  const found = known(p);
  if (found?.ref) {
    drawCard(card, cardData(p, found), "", found);
    if (!arcanaDone(found)) arcanaDetails(found).then(() => redrawOpen(p));
    return;
  }
  drawCard(card, cardData(p, null), "Looking them up…");
  lookup(p).then((f) => {
    if (openId !== p.id) return;
    if (!f.ref) {
      drawCard(card, cardData(p, null), f.choices?.length
        ? `!${f.choices.length} characters have this name in ${REGION_NAMES[prefs.region]}; search it to pick one.`
        : `!Not found in ${REGION_NAMES[prefs.region]} (wrong region in the filter above, or a new character).`);
      return;
    }
    redrawOpen(p);
    arcanaDetails(f).then(() => redrawOpen(p));
  }).catch((e) => {
    if (openId === p.id) drawCard(card, cardData(p, null), `!Lookup failed: ${e.message || e}`);
  });
}
const arcanaDone = (found) => (found.eq?.equipment?.equipmentList || [])
  .filter((x) => x.slotPosName.startsWith("Arcana")).every((x) => found.items?.[`${x.slotPosName}:done`]);
function redrawOpen(p) {
  if (openId !== p.id) return;
  const home = els.out.querySelector(".around");
  if (home) home.replaceWith(aroundSection());
}

// --- Fight card over the game ----------------------------------------------------
let fightOpen = false;
let fightName = "";
let fightSent = "";
let fightCloseTimer = 0;

async function updateFight() {
  if (!prefs.fightCard) return closeFight();
  const now = Date.now();
  const p = around.filter((x) => x.fought && now - x.fought < FIGHT_RECENT_MS).sort((a, b) => b.fought - a.fought)[0];
  if (!p) {
    if (fightOpen && !fightCloseTimer) fightCloseTimer = setTimeout(closeFight, FIGHT_LINGER_MS);
    return;
  }
  clearTimeout(fightCloseTimer);
  fightCloseTimer = 0;
  if (!fightOpen) {
    fightOpen = true;
    fightSent = "";
    await a2.widgets.open("fight", FIGHT_SIZE).catch(() => { fightOpen = false; });
  }
  if (fightName === p.name && fightSent) return;
  fightName = p.name;
  sendFight(cardData(p, null), "Looking them up…");
  try {
    const found = await lookup(p);
    if (fightName !== p.name) return;
    sendFight(cardData(p, found), found.ref ? "" : "Not found on the character site.");
    if (found.ref && !arcanaDone(found)) {
      await arcanaDetails(found);
      if (fightName === p.name) sendFight(cardData(p, found), "");
    }
  } catch (e) {
    if (fightName === p.name) sendFight(cardData(p, null), "Lookup failed.");
  }
}
function sendFight(d, state) {
  const data = { ...d, state: state || "" };
  const key = JSON.stringify(data);
  if (key === fightSent) return;
  fightSent = key;
  a2.widgets.send("fight", data).catch(() => {});
}
function closeFight() {
  clearTimeout(fightCloseTimer);
  fightCloseTimer = 0;
  fightName = "";
  fightSent = "";
  if (!fightOpen) return;
  fightOpen = false;
  a2.widgets.close("fight").catch(() => {});
}

// --- The list in its own window over the game ("around") -----------------------
// The pop-out shows the list; the panel does the looking up (the widget has no
// network of its own) and sends it the card of the row it hovers.
const POP_SIZES = [{ width: 270, height: 380 }, { width: 310, height: 500 }, { width: 360, height: 640 }, { width: 420, height: 780 }];
let popOpen = false;
let popHover = null; // id of the row hovered in the pop-out
let popCard = null; // its card, once looked up
let popSent = "";

function popRows() {
  const now = Date.now();
  return around.slice(0, AROUND_MAX).map((p) => {
    const found = known(p);
    const prof = found?.info?.profile;
    return {
      id: p.id,
      name: p.name,
      sub: [prof?.className || CLASS_BY_KO[p.class] || "", p.party ? "party" : "",
        p.fought ? `fought ${ago(p.fought)} ago` : `seen ${ago(p.seen)} ago`].filter(Boolean).join(" · "),
      cp: prof?.combatPower || p.party?.combatPower || 0,
      fighting: !!(p.fought && now - p.fought < FIGHT_RECENT_MS),
      party: !!p.party,
      side: sideOf(p),
      cls: CLASS_SHORT[classOf(p)] || "",
      clsName: classOf(p).toLowerCase(),
      stale: now - Math.max(p.seen, p.fought) > STALE_MS,
    };
  });
}
function sendPop() {
  if (!popOpen) return;
  const data = { around: true, rows: popRows(), hover: popHover, card: popCard, size: prefs.aroundSize ?? 1 };
  const key = JSON.stringify(data);
  if (key === popSent) return;
  popSent = key;
  a2.widgets.send("around", data).catch(() => {});
}
async function openPop(on) {
  prefs.aroundPop = !!on;
  save();
  if (!on) {
    popOpen = false;
    popSent = "";
    a2.widgets.close("around").catch(() => {});
    return;
  }
  const size = POP_SIZES[Math.max(0, Math.min(POP_SIZES.length - 1, prefs.aroundSize ?? 1))];
  try {
    await a2.widgets.open("around", size);
    popOpen = true;
    popSent = "";
    sendPop();
  } catch (e) {
    popOpen = false;
  }
}
async function popHoverOn(id) {
  popHover = id;
  popCard = null;
  const p = around.find((x) => x.id === id);
  if (!p) return sendPop();
  popCard = { ...cardData(p, known(p)), state: known(p) ? "" : "Looking them up…" };
  sendPop();
  try {
    const found = await lookup(p);
    if (popHover !== id) return;
    popCard = { ...cardData(p, found), state: found.ref ? "" : found.choices?.length ? "Several characters have this name: click to pick one." : "Not found on the character site." };
    if (found.ref && !arcanaDone(found)) {
      sendPop();
      await arcanaDetails(found);
      if (popHover !== id) return;
      popCard = { ...cardData(p, found), state: "" };
    }
  } catch (e) {
    if (popHover !== id) return;
    popCard = { ...cardData(p, null), state: "Lookup failed." };
  }
  sendPop();
}

a2.on("players", (d) => {
  around = Array.isArray(d?.players) ? d.players : [];
  // Redraw the list only on the home view, and not while the pointer is on
  // an open card (it would jump under the reader).
  const home = els.out.querySelector(".around");
  if (home && !home.querySelector(".inlineCard:hover")) home.replaceWith(aroundSection());
  updateFight();
  sendPop();
});
a2.on("widget-message", ({ name, data }) => {
  if (name === "around") {
    if (data?.ready) {
      popSent = "";
      sendPop();
    }
    if (data?.close) openPop(false);
    if (data && "hover" in data) {
      if (data.hover === null) {
        popHover = null;
        popCard = null;
        sendPop();
      } else popHoverOn(data.hover);
    }
    if (data?.size) {
      prefs.aroundSize = Math.max(0, Math.min(POP_SIZES.length - 1, (prefs.aroundSize ?? 1) + Math.sign(data.size)));
      openPop(true);
    }
    if (data?.open !== undefined) {
      // A click: the full character in the panel.
      const p = around.find((x) => x.id === data.open);
      if (p) {
        a2.window?.show?.().catch?.(() => {});
        lookup(p).then((found) => (found.ref ? openChar(found.ref) : (els.q.value = p.name, search(p.name)))).catch(() => {});
      }
    }
    return;
  }
  if (name === "fight" && data?.ready) fightSent = "";
  if (name === "fight" && data?.close) {
    prefs.fightCard = false;
    save();
    syncFightOption();
    closeFight();
  }
});

const fightBox = document.querySelector(".fightCard");
function syncFightOption() {
  if (fightBox) fightBox.checked = !!prefs.fightCard;
  // The pop-out comes back as it was left.
  if (prefs.aroundPop && !popOpen) openPop(true);
}
fightBox?.addEventListener("change", () => {
  prefs.fightCard = fightBox.checked;
  save();
  if (prefs.fightCard) updateFight();
  else closeFight();
});
