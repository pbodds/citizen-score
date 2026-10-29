// Citizen Score: leveling, gear and Item Level data for the guide's chapters
// (guide.js). Community guides, October 2026: thresholds and costs move with
// patches, so this is edited by hand.

const GEAR_STEPS = [
  ["IL 46", "Named elite sets (Lagta, Silent Dartan, Kashapa, Fallen Ancient God in Chaotic Lower Reshanta). Fill weak slots only; they go fast."],
  ["IL 54", "Krao Cave and Draupnir (Conquest; Draupnir drops the same in both modes)."],
  ["IL 62–70", "Craft a True Dragon Lord piece for a slot that won't drop, then Vakron Sky Island and Urugugu Canyon."],
  ["IL 86", "Fire Temple and Ferocious Horn Den. Spend Gear Change Vouchers on missing slots, guards first."],
  ["IL 102", "Abyssal Forge: Ludra raid (weapons, a guard) and Splendent Wise / Ebony Dragon Lord crafts (armour, accessories; the two lines have the same stats, so pick by look)."],
];
const GEAR_TIPS = [
  "Weapon first, then your weakest slots: don't perfect one piece.",
  "Don't put Enhance Stones or Superior Manastones on gear you'll replace; save them for IL 86 and 102.",
  "Crafting steps have a 25% Splendent chance, and upgrades keep enhancement, amplification and Soul Binding.",
  "Amulet and belt are never replaced: Rare → Epic (IL 36) → Unique (IL 65) by Substance Morph, each at +10 first.",
  "Gear Transfer moves power between Soul Bound Unique pieces (not down a grade).",
  "Abyss Points buy Potential on Unique gear.",
];
const LEVEL_ROUTE = {
  asmodian: [
    ["1–9", "Ishalgen"], ["10–14", "Altgard: Dredgion Crash Site, Calderon Canyon, Nameless Cemetery"],
    ["15–21", "Silent Hill, Sanctum Outpost, Tranein Highland, Moslan Forest"], ["22–28", "Uruthumheim, Purifying Forest (Abandoned Memorial Room)"],
    ["29–32", "Dranactus (Drana Depository)"], ["32–35", "Battlescar Mound, Basfelt Ruins"],
    ["35–40", "Fafnite Deposit, Gribade Highlands, Idun's Lake"], ["41–45", "Black Claw Village, Lagta Fortress, Impetusium Square"],
  ],
  elyos: [
    ["1–9", "Poeta"], ["10–13", "Cantas Valley"], ["14–18", "Ellun River Marsh, Spirit's Rest, Anguish Hill"],
    ["19–22", "Verteron Fortress Ruins, Destroyed Abyss Gate"], ["23–31", "Tolbas Forest, Pilgrim's Ridge, Forest of Exiles"],
    ["32–38", "Altamia Canyon, Rock Tomb Hill, Contaminated Sanctum"], ["39–42", "Kraka Footpath, Drana areas, Scarlet Forest"],
    ["43–45", "Nahid Brigade Fortress, Garden of the Illusion God"],
  ],
};
const LEVEL_TIPS = [
  "Episode (yellow) quests give ~99% of the EXP to 45: follow them in order. Regional quests are under 2%; save them for 45.",
  "Levels 30–39 are the gap (story covers ~70%): fill with sealed dungeons and Urugugu Canyon.",
  "Touch every Kibelisk as you pass, so Return Scrolls take you to the nearest.",
  "Stigmas open at 22 (slots 22/27/32/37); Daevanion boards at 12, 20, 30, 40, 45. Spend points right away.",
  "Don't invest in leveling gear: Epic stops at IL 45.",
];
// Skips and Odyle, from Odealo's 45-to-2800 route (updated 2026-10-07) and
// GameTruth's dungeon and Odyle guide (updated 2026-10-25). "Item Level" is
// the character's total (what guides call GS), not a piece's IL.
const IL_STEPS = [
  ["700", "Draupnir (IL 54 armour), Krao Cave", "Skip mostly: one piece only for a slot still in quest gear. Bank the rest of your Odyle for 1,400."],
  ["1,000", "Abyss, Ascension Trial (Easy)", "No Odyle: three Ascension Trial entries a week."],
  ["1,400", "Vakron Sky Island (IL 70 armour), Urugugu Canyon (IL 70 weapon, accessories)", "Where banked Odyle goes: Urugugu if your weapon or accessories lag, Vakron if you're missing armour."],
  ["1,600", "Transcendence 1: Arcana", "Fill all five slots (Common +20, Rare +40; the Chalice stops at Common), then stop running it."],
  ["1,900", "Transcendence 2", "Arcana up to Epic (+60; the Chalice to Rare). Upgrade the weakest cards, not a perfect set."],
  ["2,100", "Ferocious Horn Den (IL 86 armour), Fire Temple", "The next real gear jump: spend here from now on."],
  ["2,200 / 2,500", "Transcendence 3 / 4", "A Unique Chalice can drop at 2,500."],
];
const IL_SKIPS = [
  "Don't finish the IL 54 sets (Draupnir, Krao). Odyle spent there is Odyle not spent on IL 70 at 1,400.",
  "Don't claim an Exploration pick for a slot you've already filled. At Vakron, let a few pieces drop before choosing the guaranteed armour (3 claims).",
  "Don't keep running Transcendence 1 once all five Arcana slots are filled: go back to IL 70 gear, then upgrade the cards at 1,900.",
  "Don't push enhancement past +10 on gear you'll replace. Up to +10 never fails; +11 to +15 costs climb steeply.",
  "Don't craft every armour slot: Horn Den drops IL 86 armour at 2,100. Craft only a slot that won't drop.",
  "Titles, wings, pets, stigmas and Theostones raise Combat Power, not Item Level, so they don't unlock anything. Wing recipes can also cost Pure or Radiant Odyle.",
];
const IL_FREE = [
  ["Story", "Finish the level-45 story for the Spiritforged Weapon."],
  ["Daevanion Crystals", "+1 Item Level per crystal spent. From district quests, your own faction's sealed dungeons (the enemy's don't give them), the Nightmare shop and the Abyss Monolith. Spend them as you get them."],
  ["Clash Runes", "+40 Item Level each. Safe to +1; from +2 a failure can destroy the rune."],
  ["Amulet and belt", "+10 early (it can't fail). Strongholds give Noble Belt scrolls; Empyrean Traces give Revelation Amulet scrolls."],
  ["Manastones / Soulstones", "Cheap fills, +1 to +4 each by grade."],
  ["Crafting", "True Dragon Lord accessories (IL 62) bridge 1,000 to 1,400."],
  ["Every day / week", "Five Duty Missions a day; three Ascension Trials a week."],
];
const ODYLE_FACTS = [
  "Odyle Energy refills 15 every 3 hours (120 a day, offline too) up to 560 (840 with Quai Membership). At the cap it stops refilling, so spend before it's full. The Dailies panel shows yours.",
  "A reward cube costs 40: three a day. Guaranteed picks: 3 Exploration claims (120), 21 at Vakron or Urugugu Conquest (840), 28 at Horn Den (1,120).",
  "Transcendence and Conquest share 10 unclaimed clears a week per server; past that, entry waits for the weekly reset.",
  "Short? 25 Odyle + 5 Fine Odyle + 1 Pure Odyle + 50,000 Kina make 40 Energy.",
];
