// Citizen Score: "Your character" at the top of the Guide. Reads the
// character the meter sees you play from NCSOFT's character site (the same
// lookup as the Players tab: a2.players, permission "net:players"), compares
// it with the guide and with what the top players of its class run, and lists
// what to change, most worth doing first.
//
// What it reads: profile, stats and item level; every equipped piece (item
// level, enhancement and its caps, Manastones, Theostone); Arcana; titles;
// wings; Stigmas and skill levels; each Daevanion board node by node. Odyle
// Energy comes live from the meter (events:counters).
//
// The site shows a character as of its last save, which can lag the game.

const ADV_REGIONS = ["nae", "naw", "eu", "as", "la"];
const ADV_REGION_NAMES = { nae: "NA East", naw: "NA West", eu: "Europe", as: "Asia", la: "Latin America" };
// Total item level → what it opens (Dungeons and Item Level chapters).
const IL_GATES = [
  [700, "Krao Cave and Draupnir Conquest (IL 54 gear)"],
  [1000, "the Abyss, Ascension Trial and Subjugation on Easy"],
  [1400, "Urugugu Canyon and Vakron Sky Island Conquest (IL 70)"],
  [1500, "Ascension Trial and Subjugation on Normal"],
  [1600, "Transcendence stage 1 (Arcana)"],
  [1900, "Transcendence stage 2 (Epic Arcana)"],
  [2000, "Ascension Trial and Subjugation on Hard"],
  [2100, "Fire Temple and Ferocious Horn Den Conquest (IL 86)"],
  [2200, "Transcendence stage 3 (Unique Arcana)"],
  [2500, "Transcendence stage 4 (Unique Chalice), Trial Challenge"],
  [2600, "Krao Cave and Draupnir Hard (Ariel Fragments)"],
  [2800, "the Ludra raid (IL 102), Dying Dramata's Nest, Cradle of Nihility"],
  [3000, "Hall of Illusion, Azure Breath Island, Trial Insane"],
  [3500, "Corroded Decontamination Facility, Trial Hell"],
  [3800, "Citadel of the Fallen Daeva, Abyssal Horn Den"],
  [4300, "Chalice of Muspel"],
];
const GRADE_RANK = { Common: 1, Rare: 2, Legend: 3, Epic: 3, Unique: 4, Special: 4 };
const GRADE_NAME = { Legend: "Epic" };
const gradeName = (g) => GRADE_NAME[g] || g || "";
const ARMOR_SLOTS = ["Helmet", "Shoulder", "Torso", "Pants", "Gloves", "Boots", "Cape"];
const WEAPON_SIDE = ["MainHand", "Necklace", "Earring1", "Earring2", "Ring1", "Ring2"];
const ARMOR_SIDE = ["SubHand", ...ARMOR_SLOTS];
const MAIN_SLOTS = [...WEAPON_SIDE, ...ARMOR_SIDE, "Bracelet1", "Bracelet2"];
const SLOT_LABEL = { MainHand: "weapon", SubHand: "guard", Helmet: "helm", Shoulder: "pauldrons", Torso: "breastplate", Pants: "greaves",
  Gloves: "gloves", Boots: "boots", Cape: "cloak", Necklace: "necklace", Earring1: "earring", Earring2: "earring", Ring1: "ring",
  Ring2: "ring", Bracelet1: "bracelet", Bracelet2: "bracelet", Belt: "belt", Amulet: "amulet", Rune1: "rune", Rune2: "rune" };
// Where each tier drops: weapons and accessories / armour and guard.
const TIER_SOURCE = {
  54: ["Krao Cave Conquest", "Draupnir"],
  70: ["Urugugu Canyon Conquest", "Vakron Sky Island"],
  86: ["Fire Temple Conquest", "Ferocious Horn Den"],
};
// Manastone stats each role keeps (Manastones chapter, by role).
const ROLE_STATS = {
  melee: ["Attack", "Critical Hit", "Accuracy"],
  caster: ["Attack", "Critical Hit", "Accuracy"],
  tank: ["Block", "Defense", "HP"],
  healer: ["HP", "Defense", "Attack", "Critical Hit", "MP"],
  support: ["Attack", "HP", "Critical Hit", "Defense"],
};
// Theostones (Manastones and Theostones chapter): PvE pick, and effects that fit.
const ROLE_THEO = {
  melee: ["Yustiel's Compassion or Tiamat's Counterstrike", /AoE|up to 4|targets/i],
  caster: ["Yustiel's Compassion or Tiamat's Counterstrike", /AoE|up to 4|targets/i],
  tank: ["Lumiel's Interference (−50% Combat Speed)", /Combat Speed/i],
  healer: ["Beritra's Selfishness", /Wind|AoE|up to 4/i],
  support: ["Yustiel's Compassion", /AoE|up to 4|targets/i],
};
const CLASS_THEO = { assassin: ["Tiamat's Rage", /Fire damage|single/i], spiritmaster: ["Zikel's Arrogance (Poison)", /Poison/i] };
const GOOD_TITLES = {
  Defense: [/^Saint of (Verteron|Altgard)$/, /Dominator of Dimensions/, /Rule All Creation/],
  Attack: [/^Guardian of (Verteron|Altgard)$/, /Unbound by Genus/, /Treading on (Black|White) Wings/],
  Etc: [/Through Hell and Back/, /Encountering (Kaisinel|Zikel)'s Core/, /Empty Closet/],
};
const TITLE_TIP = {
  Defense: "Saint of Verteron/Altgard (Monolith level 30): Defence +300, Damage Tolerance +3%, Block +100",
  Attack: "Guardian of Verteron/Altgard (Monolith level 20): PvE Damage Boost +3%, Penetration +210",
  Etc: "Through Hell and Back (clear Ruins of the Ancient City of Roah) or Encountering Kaisinel's/Zikel's Core (Episode 6)",
};
const ROLE_WINGS = {
  melee: "Nightmare Wings (Nightmare shop) or Dark Veil Wings (Ferocious Horn Den)",
  caster: "Nightmare Wings (Nightmare shop) or Talisra Wings (Season shop)",
  tank: "Forest Spirit Wings (Vakron Sky Island)",
  healer: "Talisra Wings (Season shop, Cooldown Reduction +4%)",
  support: "Talisra Wings (Season shop) or Nightmare Wings",
};

// --- Reading the character ---------------------------------------------------
async function advFind(me, prefer) {
  const order = [prefer, ...ADV_REGIONS.filter((r) => r !== prefer)].filter(Boolean);
  for (const region of order) {
    const res = await a2.players.search({ keyword: me.name, region, size: 50 });
    const hit = (res?.list || []).find((c) => c.name.replace(/<[^>]*>/g, "") === me.name && (!me.serverId || c.serverId === me.serverId));
    if (hit) return { region, serverId: hit.serverId, characterId: hit.characterId, name: me.name };
  }
  return null;
}

// Everything the advice needs, in one object (saved, so the panel opens on it).
async function advLoad(ref, progress) {
  const q = { region: ref.region, serverId: ref.serverId, characterId: ref.characterId };
  progress("profile");
  const [info, eq] = await Promise.all([a2.players.info(q), a2.players.equipment(q)]);
  if (!info?.profile?.characterName) throw new Error("NCSOFT's site doesn't have this character yet");
  const list = eq?.equipment?.equipmentList || [];
  const items = {};
  let n = 0;
  // A few at a time: the meter keeps answers 5 minutes, so a refresh is cheap.
  const queue = list.slice();
  const worker = async () => {
    for (let it; (it = queue.shift());) {
      try {
        items[it.slotPosName] = await a2.players.item({ ...q, id: it.id, enchantLevel: it.enchantLevel, slotPos: it.slotPos });
      } catch {}
      progress(`gear ${++n}/${list.length}`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const boards = {};
  for (const b of info.daevanion?.boardList || []) {
    if (!b.open) continue;
    progress(`Daevanion: ${b.name}`);
    try {
      const d = await a2.players.daevanion({ ...q, boardId: b.id });
      boards[b.name] = (d?.nodeList || []).filter((x) => x.type !== "None");
    } catch {}
  }
  return { at: Date.now(), ref, info, eq, items, boards };
}

// --- Advice ------------------------------------------------------------------
// One piece of advice: pri 1 do now (free or guaranteed), 2 this week, 3 longer
// term; ch: the guide chapter that explains it.
const adv = (pri, area, text, ch, detail) => ({ pri, area, text, ch, detail });

function classOf(info) {
  const name = String(info.profile.className || "").toLowerCase();
  return BUILDS[name] ? name : null;
}

// The node indexes of a board as the planner draws it (boards.js / ariel.js),
// from the site's node list (same grid, offset by its empty border).
function boardOwned(board, nodes) {
  const lay = DAEV_LAYOUT[board];
  if (!lay || !nodes.length) return null;
  const c0 = Math.min(...nodes.map((n) => n.col));
  const r0 = Math.min(...nodes.map((n) => n.row));
  const at = new Map(lay.nodes.map((x, i) => [`${x[0]},${x[1]}`, i]));
  const owned = new Set();
  for (const n of nodes) {
    if (!n.open) continue;
    const i = at.get(`${n.col - c0},${n.row - r0}`);
    if (i !== undefined) owned.add(i);
  }
  return owned;
}

function advise(data, odyle) {
  const out = [];
  const { info, eq, items, boards } = data;
  const cls = classOf(info);
  const b = cls ? BUILDS[cls] : null;
  const role = b?.board || "melee";
  const stats = info.stat?.statList || [];
  const il = stats.find((s) => s.type === "ItemLevel")?.value || 0;
  const list = eq?.equipment?.equipmentList || [];
  const bySlot = new Map(list.map((x) => [x.slotPosName, x]));
  const level = (slot) => items[slot]?.level ?? null;

  // Odyle, live from the meter.
  if (odyle && typeof odyle.basic === "number") {
    if (odyle.basic >= 480) out.push(adv(1, "Odyle", `Odyle Energy is ${odyle.basic}: spend it before it caps (it stops refilling at 560). That's ${Math.floor(odyle.basic / 40)} Conquest or Transcendence cubes.`, "routine"));
  }

  // Empty slots.
  const missing = [...MAIN_SLOTS, "Belt", "Amulet", "Rune1", "Rune2"].filter((s) => !bySlot.has(s));
  if (missing.length) out.push(adv(1, "Gear", `Empty slot${missing.length > 1 ? "s" : ""}: ${missing.map((s) => SLOT_LABEL[s]).join(", ")}. Anything you can wear adds its item level.`, "gear"));

  // Arcana.
  const arcana = list.filter((x) => x.slotPosName.startsWith("Arcana"));
  if (arcana.length < 5) out.push(adv(1, "Arcana", `${5 - arcana.length} Arcana slot${arcana.length === 4 ? " is" : "s are"} empty: even a Common card is +20 item level.`, "arcana"));
  const bestGrade = il >= 2200 ? 4 : il >= 1900 ? 3 : il >= 1600 ? 2 : 1;
  const low = arcana.filter((x) => (GRADE_RANK[x.grade] || 0) < bestGrade && !(x.name.startsWith("Chalice") && il < 2500 && (GRADE_RANK[x.grade] || 0) >= bestGrade - 1));
  if (low.length) out.push(adv(2, "Arcana", `Your item level opens ${gradeName(["", "Common", "Rare", "Legend", "Unique"][bestGrade])} Arcana in Transcendence: upgrade ${low.map((x) => `${x.name} (${gradeName(x.grade)})`).join(", ")}. Each grade step is +20 item level.`, "arcana"));
  const arcMax = { 1: 2, 2: 3, 3: 4, 4: 5 };
  const under = arcana.filter((x) => x.enchantLevel < (items[x.slotPosName]?.maxEnchantLevel ?? arcMax[GRADE_RANK[x.grade]] ?? 0));
  if (under.length) {
    const lv = under.reduce((s, x) => s + (items[x.slotPosName]?.maxEnchantLevel ?? arcMax[GRADE_RANK[x.grade]]) - x.enchantLevel, 0);
    out.push(adv(2, "Arcana", `Feed Training Arcana to ${under.map((x) => `${x.name} +${x.enchantLevel}`).join(", ")}: ${lv} level${lv > 1 ? "s" : ""} left, +1 item level each.`, "arcana"));
  }
  if (b) {
    const picks = arcanaPick(b, "pve");
    const wrong = [];
    for (const [slot, cards] of picks) {
      const mine = arcana.find((x) => x.name.startsWith(slot));
      if (mine && !cards.some((c) => c.card === mine.name)) wrong.push(`${slot}: ${cards[0].card} (${Math.round(cards[0].v)}% of top ${b.name}s), yours is ${mine.name.replace(/^\w+ of /, "of ")}`);
    }
    if (wrong.length) out.push(adv(3, "Arcana", `Top ${b.name}s pick a different card in ${wrong.length} slot${wrong.length > 1 ? "s" : ""}. ${wrong.join("; ")}.`, "arcana"));
  }

  // Gear grade and tier.
  const gear = MAIN_SLOTS.filter((s) => bySlot.has(s)).map((s) => ({ s, x: bySlot.get(s), lv: level(s) }));
  const weak = gear.filter(({ x }) => (GRADE_RANK[x.grade] || 0) < 3);
  if (weak.length) out.push(adv(1, "Gear", `Replace the ${weak.map(({ s, x }) => `${gradeName(x.grade)} ${SLOT_LABEL[s]}`).join(", ")}: Common and Rare pieces cap at +5 and have fewer Manastone slots.`, "gear"));
  const target = il >= 2100 ? 86 : il >= 1400 ? 70 : il >= 700 ? 54 : null;
  if (target) {
    const behind = (slots) => gear.filter(({ s, lv }) => slots.includes(s) && lv !== null && lv < target).map(({ s, lv }) => `${SLOT_LABEL[s]} (IL ${lv})`);
    const w = behind(WEAPON_SIDE);
    const a = behind(ARMOR_SIDE);
    if (w.length) out.push(adv(2, "Gear", `Below the IL ${target} tier your item level opens: ${w.join(", ")}. ${TIER_SOURCE[target][0]} drops IL ${target} weapons and accessories.`, "dungeons"));
    if (a.length) out.push(adv(2, "Gear", `Below the IL ${target} tier: ${a.join(", ")}. ${TIER_SOURCE[target][1]} drops IL ${target} armour and guards (Gear Change Vouchers fill a missing one).`, "dungeons"));
  }
  if (il >= 2800 && (level("MainHand") ?? 0) < 102) out.push(adv(2, "Gear", "You can enter the Ludra raid: it drops IL 102 weapons (book the 4 weekly attempts with your Legion).", "dungeons"));

  // Enhancement.
  const safe = gear.filter(({ x }) => (GRADE_RANK[x.grade] || 0) >= 3 && x.enchantLevel < 10);
  if (safe.length) {
    const sum = safe.reduce((s, { x }) => s + 10 - x.enchantLevel, 0);
    out.push(adv(1, "Enhance", `Take ${safe.map(({ s, x }) => `${SLOT_LABEL[s]} +${x.enchantLevel}`).join(", ")} to +10: +${sum} item level, and up to +10 never fails.`, "enhance"));
  }
  const wpn = bySlot.get("MainHand");
  const wpnMax = items.MainHand?.maxEnchantLevel ?? 15;
  if (wpn && wpn.enchantLevel >= 10 && wpn.enchantLevel < wpnMax && (level("MainHand") ?? 0) >= 70) {
    out.push(adv(2, "Enhance", `Push the weapon (${wpn.name}) from +${wpn.enchantLevel} toward +${wpnMax} before armour: it carries your Attack and Theostone. Have about 12 attempts of Kinah and stones ready; pity adds +5% a failure.`, "enhance"));
  }
  const amp = gear.filter(({ s, x }) => x.enchantLevel >= (items[s]?.maxEnchantLevel ?? 99) && (items[s]?.maxExceedEnchantLevel ?? 0) > (x.exceedLevel || 0));
  if (amp.length) out.push(adv(3, "Enhance", `Amplified Enhancement open on ${amp.map(({ s, x }) => `${SLOT_LABEL[s]} (${x.exceedLevel || 0}/${items[s].maxExceedEnchantLevel})`).join(", ")}: +5 item level a level, Amplify Stones from Conquest, Transcendence and Ludra.`, "enhance"));

  // Manastones.
  let empty = 0;
  const off = [];
  let commons = 0;
  // The role's stats, plus any the class build's Manastone notes name.
  const wants = [...(ROLE_STATS[role] || ROLE_STATS.melee)];
  for (const w of ["Attack", "Critical Hit", "Accuracy", "Evasion", "Block", "Defense", "HP", "MP"]) {
    const said = w === "Defense" ? /Defen[cs]e/ : new RegExp(w);
    if (b && said.test(b.manastones) && !wants.includes(w)) wants.push(w);
  }
  for (const { s } of gear) {
    const d = items[s];
    if (!d?.magicStoneSlotCount) continue;
    const stones = d.magicStoneStat || [];
    empty += Math.max(0, d.magicStoneSlotCount - stones.length);
    for (const st of stones) {
      if (!wants.some((w) => st.name.includes(w))) off.push(`${st.name} on the ${SLOT_LABEL[s]}`);
      if ((d.level || 0) >= 70 && st.grade === "Common") commons++;
    }
  }
  if (empty) out.push(adv(1, "Stones", `${empty} Manastone/Soulstone slot${empty > 1 ? "s are" : " is"} empty: engrave them (+1 to +4 item level each, a few thousand Kinah).`, "stones"));
  if (off.length >= 3) out.push(adv(3, "Stones", `${off.length} engraved rolls are stats a ${b?.name || "character"} doesn't chase (${off.slice(0, 3).join(", ")}${off.length > 3 ? "…" : ""}). Reroll those slots with Superior stones; keep ${wants.slice(0, 3).join(", ")}.`, "stones"));
  if (commons >= 4) out.push(adv(3, "Stones", `${commons} Manastones on IL 70+ gear rolled the lowest tier: Superior stones roll better (Alchemy: an Intermediate craft has a 20% chance to make a Superior).`, "stones"));

  // Theostone.
  const theoPick = CLASS_THEO[cls] || ROLE_THEO[role] || ROLE_THEO.melee;
  for (const s of ["MainHand", "SubHand"]) {
    const d = items[s];
    if (!d?.godStoneSlotCount) continue;
    const have = d.godStoneStat || [];
    if (!have.length) out.push(adv(1, "Stones", `Your ${SLOT_LABEL[s]} has an empty Theostone slot. For a ${b?.name || "character"} in PvE: ${theoPick[0]}; a Rare Theostone Selection Chest is 35,000 Abyss Points, and the three level-45 Regional quests each give a chest.`, "stones"));
    else if (s === "MainHand" && !theoPick[1].test(`${have[0].name} ${have[0].desc || ""}`)) out.push(adv(3, "Stones", `${have[0].name.replace("Theostone: ", "")} is on your weapon; for PvE the guide suggests ${theoPick[0]} (keep a control stone for PvP).`, "stones"));
  }

  // Belt, amulet, runes.
  for (const s of ["Belt", "Amulet"]) {
    const x = bySlot.get(s);
    if (!x) continue;
    if (x.enchantLevel < 10) out.push(adv(2, "Gear", `${x.name} is +${x.enchantLevel}: ${s === "Belt" ? "Noble Belt Enhance Scrolls come from Strongholds (campfire icons; clear the enemy's too)" : "amulet scrolls come from Monolith levels (collect Empyrean Traces)"}; +10 always succeeds.`, "itemlevel"));
    else if ((GRADE_RANK[x.grade] || 0) < 4) out.push(adv(2, "Gear", `${x.name} is at +10: Substance Morph it to the next grade (${gradeName(x.grade)} → ${x.grade === "Rare" ? "Epic" : "Unique"}).`, "itemlevel"));
  }
  const runes = list.filter((x) => x.slotPosName.startsWith("Rune"));
  const flat = runes.filter((x) => x.enchantLevel < 1);
  if (flat.length) out.push(adv(1, "Gear", `Clash Rune at +0: the first level never fails.`, "enhance"));

  // Daevanion.
  if (cls) {
    const totals = {};
    for (const board of ["Nezekan", "Zikel", "Vaizel", "Triniel", "Ariel", "Azphel"]) {
      const nodes = boards[board];
      if (!nodes || !DAEV_ORDER[cls][board]) continue;
      const owned = boardOwned(board, nodes);
      if (!owned) continue;
      const lay = DAEV_LAYOUT[board].nodes;
      totals[board] = [...owned].reduce((s, i) => s + lay[i][3], 0);
      if (board === "Azphel") continue;
      const seq = boardSeq(cls, board);
      const want = seq.filter((x) => !owned.has(x.i) && x.pct >= 60 && lay[x.i][2] !== "stat").slice(0, 3);
      if (want.length) {
        const names = want.map((x) => { const n = nodeInfo(cls, board, x.i); return `${n.kind === "special" ? n.tip : n.name} (${x.pct}%)`; });
        out.push(adv(2, "Daevanion", `${board}: top ${b.name}s take ${names.join(", ")}; you don't have ${want.length > 1 ? "them" : "it"} yet.`, "daevanion"));
      }
    }
    data.spent = totals;
    const shared = ["Nezekan", "Zikel", "Vaizel", "Triniel"].reduce((s, k) => s + (totals[k] || 0), 0);
    const top = defaultPts(cls);
    if (shared && shared < top - 40) out.push(adv(2, "Daevanion", `${shared} shared Daevanion points spent; top ${b.name}s are at ${top}. Sealed Dungeons (2 crystals each) and Regional quests (1 each) are the big sources, and every point is +1 item level.`, "daevanion"));
    if (!boards.Ariel && il >= 2600) out.push(adv(2, "Daevanion", "You can farm Ariel now: Krao Cave and Draupnir Hard bosses drop Ariel Fragments (100 make a point). Top players head for a PvE Damage Boost corner first (about 15 points).", "daevanion"));
    else if (boards.Ariel && (totals.Ariel || 0) < defaultOwn(cls, "Ariel") - 10) out.push(adv(3, "Daevanion", `Ariel: ${totals.Ariel || 0} points, top ${b.name}s about ${defaultOwn(cls, "Ariel")}. Keep running Krao Cave and Draupnir Hard.`, "daevanion"));
  }

  // Stigmas and skills.
  const skills = eq?.skill?.skillList || [];
  if (b) {
    const slotted = skills.filter((s) => s.category === "Dp" && s.equip && s.skillLevel > 0);
    const names = new Set(slotted.map((s) => s.name));
    const missingStig = b.pve.stigmas.filter((n) => !names.has(n));
    if (slotted.length && missingStig.length) {
      const rate = (n) => Math.round(b.stigmaRates.find((r) => r[0] === n)?.[1] ?? 0);
      out.push(adv(2, "Stigmas", `Top ${b.name}s run ${missingStig.map((n) => `${n} (${rate(n)}%)`).join(", ")} in PvE; you don't have ${missingStig.length > 1 ? "them" : "it"} slotted.`, "stigma"));
    }
    const lowStig = slotted.filter((s) => b.pve.stigmas.includes(s.name) && s.skillLevel < 20);
    if (lowStig.length) out.push(adv(3, "Stigmas", `Level ${lowStig.map((s) => `${s.name} (${s.skillLevel})`).join(", ")} toward 20 with Stigma Shards (Abyss, Nightmare and Shugo Festival shops; use the Special Growth Voucher early).`, "stigma"));
    const order = b.pve.levelOrder.filter((n) => !n.startsWith("then"));
    const lv = (n) => skills.find((s) => s.name === n)?.skillLevel;
    const actives = skills.filter((s) => s.category === "Active" && s.acquired);
    const maxLv = Math.max(0, ...actives.map((s) => s.skillLevel));
    const behindSk = order.filter((n) => lv(n) !== undefined && lv(n) < maxLv - 2);
    if (behindSk.length) out.push(adv(3, "Skills", `Top ${b.name}s level ${order.join(", ")} first; yours: ${order.map((n) => `${n} ${lv(n) ?? "–"}`).join(", ")} while your highest skill is ${maxLv}.`, "daevanion"));
  }

  // Titles and wings.
  const titles = info.title?.titleList || [];
  for (const cat of ["Attack", "Defense", "Etc"]) {
    const t = titles.find((x) => x.equipCategory === cat);
    if (!t) out.push(adv(1, "Titles", `No ${cat === "Etc" ? "Other" : cat} title equipped: ${TITLE_TIP[cat]}.`, "collections"));
    else if (!GOOD_TITLES[cat].some((re) => re.test(t.name)) && (GRADE_RANK[t.grade] || 0) < 4) out.push(adv(2, "Titles", `${cat === "Etc" ? "Other" : cat} title is ${t.name} (${gradeName(t.grade)}). Most top players wear ${TITLE_TIP[cat]}.`, "collections"));
  }
  const owned = info.title?.ownedCount || 0;
  if (owned && owned < 127) out.push(adv(3, "Titles", `${owned} titles owned (the median level-45 player has ~127, the top fifth ~190): every title adds a permanent stat. Easy ones: first clears of each party dungeon, Spacetime Rift uses, Shugo Festival games, Hero Episodes.`, "collections"));
  const wing = eq?.petwing?.wing;
  if (!wing) out.push(adv(1, "Wings", `No wings equipped. ${ROLE_WINGS[role]}.`, "collections"));
  else if ((GRADE_RANK[wing.grade] || 0) < 4) out.push(adv(2, "Wings", `${wing.name} are ${gradeName(wing.grade)}: Unique wings start with Kromede Wings (Fire Temple, unseal with 10 Radiant Odyle). For you: ${ROLE_WINGS[role]}.`, "collections"));

  out.sort((x, y) => x.pri - y.pri);
  return { cls, il, out };
}

// --- Drawing -----------------------------------------------------------------
const PRI_NAME = { 1: "Do now", 2: "This week", 3: "Longer term" };

// root: the card's box. ctx: { state, me, odyle, busy, error, onRefresh,
// onLookup(name, region), onChapter(id), onUsePoints(spent), region }.
function renderAdvisor(root, ctx) {
  root.replaceChildren();
  const head = el("div", "aHead");
  const data = ctx.state;
  if (!data) {
    head.append(el("strong", null, "Your character"));
    root.append(head);
    const p = el("p", "note", ctx.busy ? `Reading ${ctx.me?.name || "your character"} from NCSOFT's site… ${ctx.busy}` : ctx.error || (ctx.me ? "" : "Log in with the meter running to get advice for your character, or look one up:"));
    root.append(p);
    if (!ctx.busy) root.append(lookupForm(ctx));
    return;
  }
  const p = data.info.profile;
  const { cls, il, out } = advise(data, ctx.odyle);
  const who = el("div", "aWho");
  who.append(el("strong", null, p.characterName), el("span", null, ` ${p.className} · Lv ${p.characterLevel} · ${p.serverName} (${ADV_REGION_NAMES[data.ref.region] || data.ref.region})`));
  const nums = el("div", "aNums");
  nums.append(el("span", null, `CP ${Number(p.combatPower || 0).toLocaleString("en-US")}`), el("span", null, `Item level ${il.toLocaleString("en-US")}`));
  const refresh = el("button", "aBtn", ctx.busy ? `Reading… ${ctx.busy}` : "Refresh");
  refresh.type = "button";
  refresh.disabled = !!ctx.busy;
  refresh.title = "Read the character again (the site can lag the game until you log out or switch)";
  refresh.addEventListener("click", () => ctx.onRefresh());
  head.append(who, refresh);
  root.append(head, nums);

  // Where the item level stands.
  const open = IL_GATES.filter(([g]) => il >= g).pop();
  const next = IL_GATES.find(([g]) => il < g);
  const gate = el("p", "aGate");
  gate.append(open ? `Open: ${open[1]}. ` : "", next ? `Next at ${next[0].toLocaleString("en-US")} (+${(next[0] - il).toLocaleString("en-US")}): ${next[1]}.` : "Every item level gate in Season 1 is open.");
  root.append(gate);

  if (data.spent && cls && ctx.onUsePoints) {
    const use = el("button", "aBtn aSmall", "Set the Daevanion planner to my points");
    use.type = "button";
    use.addEventListener("click", () => ctx.onUsePoints(data.spent));
    root.append(use);
  }

  if (!out.length) root.append(el("p", "note", "Nothing obvious to change: you're ahead of every check this panel makes. The class build below has the fine-tuning."));
  for (const pri of [1, 2, 3]) {
    const group = out.filter((a) => a.pri === pri);
    if (!group.length) continue;
    root.append(el("div", `subHead aPri p${pri}`, `${PRI_NAME[pri]} (${group.length})`));
    const ul = el("ul", "aList");
    for (const a of group) {
      const li = el("li");
      li.append(el("span", "aArea", a.area), el("span", "aText", a.text));
      if (a.ch && ctx.onChapter) {
        const go = el("button", "aGo", "→");
        go.type = "button";
        go.title = `Open “${GUIDE.find((c) => c.id === a.ch)?.title || a.ch}”`;
        go.addEventListener("click", () => ctx.onChapter(a.ch));
        li.append(go);
      }
      ul.append(li);
    }
    root.append(ul);
  }
  const age = Math.round((Date.now() - data.at) / 60000);
  root.append(el("p", "note", `Read from NCSOFT's character site ${age < 1 ? "just now" : `${age} min ago`}; it shows your character as of its last save. Percentages are shares of top players; item level gates and sources are from the guide below.`));
  if (!ctx.me || ctx.me.name !== p.characterName) root.append(lookupForm(ctx));
}

function lookupForm(ctx) {
  const f = el("form", "aLookup");
  const name = el("input");
  Object.assign(name, { type: "search", placeholder: "Character name", maxLength: 32, value: ctx.me?.name || "" });
  const reg = el("select");
  for (const [k, v] of Object.entries(ADV_REGION_NAMES)) {
    const o = el("option", null, v);
    o.value = k;
    o.selected = k === (ctx.region || "nae");
    reg.append(o);
  }
  const go = el("button", "aBtn", "Look up");
  go.type = "submit";
  f.append(name, reg, go);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (name.value.trim()) ctx.onLookup(name.value.trim(), reg.value);
  });
  return f;
}
