// Citizen Score: the Builds data, one PvE and one PvP build per class.
//
// Compiled 2026-10-27 from:
// - aion2-meta.com class guides (updated 2026-10-26): pick rates from the top
//   Korean players (AION2CAL, KR data 2026-10-25; PvE and PvP counted apart)
//   and the top global players (NCSOFT's character data). Stigma, skill,
//   passive and Arcana rates, the Daevanion node order and points spent.
// - MetaBot's class builds guide (updated 2026-10-15): stat priority,
//   Theostones, the Daevanion key nodes and its PvP stigma swaps.
// - The Daevanion board rules and Ariel advice the Guide tab already uses
//   (aion2builds, GamesFuze, Game8, AION2 Vault).
//
// Global equips 4 stigmas (Korea 5), so each build's `stigmas` are 4: for PvE
// aion2-meta's global first four; for PvP the four the PvP sample runs most,
// weighed against the global rate, with what to swap in under `swaps`.
// Percentages: share of that sample using it; null = not on the source page.
// They change with patches: re-check the sources after a big one.

const BUILD_UPDATED = "2026-10-27";

// Boards Nezekan to Triniel share one pool of points (570 fills all four);
// Ariel and Azphel have their own. Layouts and orders are in boards.js.
const BOARD_INFO = {
  Nezekan: { opens: 12, total: 134, orange: "Combat Speed, Cooldown Reduction" },
  Zikel: { opens: 20, total: 134, orange: "Damage Boost, Damage Tolerance" },
  Vaizel: { opens: 30, total: 134, orange: "Critical Damage Boost / Tolerance" },
  Triniel: { opens: 40, total: 168, orange: "Multi-Hit Chance / Resist" },
  Ariel: { opens: 45, total: 232, orange: "PvE Damage Boost +1.5%, Boss Damage Boost +1%" },
  Azphel: { opens: 45, total: 232, orange: "PvP Damage Boost / Tolerance" },
};
const SHARED_POOL = 570;

// The PvP board (planner.js draws it from boards.js).
const AZPHEL = {
  note: "PvP only, from Abyss shop points. Status Effect Resist and PvP Damage Boost are the nodes worth heading for; the stat nodes between are the cheapest path to them.",
};

const ARIEL_ADVICE = {
  melee: "Head for the two nearest PvE Damage Boost corners (26 points), or one corner plus the nearest Boss Damage Boost (24).",
  caster: "Head for the two nearest PvE Damage Boost corners (26 points), or one corner plus the nearest Boss Damage Boost (24).",
  healer: "Boss Damage Tolerance (6 to 10 points), then PvE Damage Tolerance.",
  tank: "Boss Damage Tolerance (6 to 10 points), then PvE Damage Tolerance (14 to 20).",
  support: "A PvE Damage Boost corner, then Boss Damage Tolerance.",
};
const ARIEL_NOTE = "Ariel points come from Ariel Fragments (Krao Cave or Draupnir on Hard, item level 2,600; 60 to 90 a boss): 100 fragments make one point by Substance Morph. The board holds 232; top players had spent about 40 to 50 by late October. Plan the route before you spend: refunds cost Kinah.";

const DAEVANION_RULES = [
  "Node costs: grey stat 1, green passive 2, blue skill 3, orange special 4.",
  "Take the cheapest path to each blue or green node you want; don't press Acquire All.",
  "Each active skill has one blue node on each of Nezekan, Zikel, Vaizel and Triniel: skill points take it to 10, the four blues to 14.",
  "Refunding a node costs 500 Kinah, so a PvP respec is cheap: swap passive nodes, not the whole board.",
];

// Arcana rows: [slot, card, god stat]; each class has [PvE %, PvP %] per row.
const ARCANA_ROWS = [
  ["Bell", "Bell of Magic", "Destruction [Zikel]"],
  ["Bell", "Bell of Vigor", "Justice [Nezekan]"],
  ["Chalice", "Chalice of Magic", "Space [Israphel]"],
  ["Chalice", "Chalice of Vigor", "Time [Siel]"],
  ["Compass", "Compass of Magic", "Death [Triniel]"],
  ["Compass", "Compass of Vigor", "Freedom [Vaizel]"],
  ["Mirror", "Mirror of Magic", "Wisdom [Lumiel]"],
  ["Mirror", "Mirror of Vigor", "Illusion [Kaisinel]"],
  ["Parchment", "Parchment of Magic", "Destiny [Marchutan]"],
  ["Parchment", "Parchment of Vigor", "Life [Yustiel]"],
];

const BUILDS = {
  gladiator: {
    name: "Gladiator", ko: "검성", role: "Melee bruiser", board: "melee", weapon: "Greatsword",
    sample: "8,510 KR · 494 global",
    // [stigma, PvE %, PvP %, global %]
    stigmaRates: [
      ["Lunge Stance", 99, 99.6, 98], ["Rage Burst", 96.9, 99.7, 95], ["Zikel's Blessing", 98.8, 99.3, 91.1],
      ["Focused Block", 94.7, 99.3, 38.6], ["Lifestealing Blade", 93.8, 96.8, 16.8], ["Tenaciousness", 77.2, 98.5, 15.8],
      ["Wave Armor", 75.4, 85.7, 32.7], ["Armor of Balance", 61.4, 91.1, 1], ["Wrath Wave", 44.6, 60.3, 5],
      ["Blade Toss", 43.5, 64.7, 8.9], ["Fracturing Rush", 25, 32.4, 1], ["Forced Restraint", 24.2, 38.5, 1],
    ],
    // [skill, Lv 20+ PvE %, Lv 20+ PvP %]
    skillRates: [
      ["Overhead Slam", 91.3, 95.9], ["Rending Blow", 80.5, 26.8], ["Ruinous Blow", 72.7, 80.7], ["Crushing Wave", 39, 40.7],
      ["Leaping Slam", 8.3, 39.6], ["Rush Strike", 7.1, 66.4], ["Keen Strike", 6.1, 1.7], ["Ankle Slice", 1.8, 21.9],
      ["Defiance", 0.6, 39.4], ["Mocking Blade", 1.3, 6.2],
    ],
    // [passive, % of PvE gear raising it, % of PvP gear]
    passiveRates: [
      ["Experienced Counterstrike", 74, 14], ["Murderous Burst", 69, 7], ["Impact Hit", 61, 45], ["Attack Preparation", 60, 15],
      ["Identify Weakness", 21, 3], ["Survival Stance", 2, 40], ["Survival Willpower", 0, 24],
    ],
    keyNodes: "Nezekan Attack Preparation and Survival Stance pairs, then Zikel's Murderous Burst pair; route through Ruinous Blow and Rending Blow.",
    arcana: [[97.1, 92.8], [7, 67.6], [2.1, 1.7], [97.8, 98.1], [82.9, 19.2], [17.1, 80.5], [94.1, 44.6], [5.7, 55.2], [93.6, 34.1], [86.8, 91.5]],
    stats: "Attack > Critical Hit > Accuracy > HP > Block",
    manastones: "Weapon and armour: Attack, Front Attack Damage Boost, HP. Jewellery: Attack, HP, MP (rings: Critical Hit).",
    gear: "Splendent Ebony Dragon Lord greatsword (62% of the global top) and set; Noble Belt, Revelation Amulet, Clash Runes.",
    pve: {
      stigmas: ["Lunge Stance", "Rage Burst", "Zikel's Blessing", "Focused Block"],
      swaps: [["Lifestealing Blade", "sustain while learning a fight (MetaBot's 3rd pick)"], ["Wave Armor", "heavy-hitting bosses"]],
      levelOrder: ["Overhead Slam", "Rending Blow", "Ruinous Blow", "Crushing Wave or Mocking Blade"],
      specs: [
        ["Overhead Slam", "12 Critical Hit on hit · 16 Remove cooldown · 20 Upward Strike chain"],
        ["Ruinous Blow", "12 extra damage · 16 ignores Block/Evasion · 20 +20% Skill Speed"],
        ["Rending Blow", "8 mobile · 16 +50 MP on crit · 20 up to +12% on fewer targets"],
        ["Crushing Wave", "12 crit resets cooldown · 16 50% pull · 20 2% HP or 50 MP"],
      ],
      skip: "Sword Aura Rampage: not worth skill points.",
      theostone: "AoE elemental: most hits reach 4 targets.",
      wings: "Talisra (Nightmare 2nd)",
      rotation: [
        "Buff button: Zikel's Blessing + Lunge Stance at the start of each burst window (keep them out of the macro).",
        "Open with Ruinous Blow (+20% PvE damage for 20 s), and recast it whenever it's up.",
        "Macro 1: Rending Blow above Sword Aura Rampage (Rampage only hits during Stagger).",
        "Macro 2: Rage Burst above Overhead Slam. Overhead Slam needs a knocked-down target; Rage Burst opens it on bosses for 10 s.",
        "Keen Strike held as the basic attack. Survival: Lifestealing Blade (90 s), Tenaciousness (150 s), Blood Absorption heals at half HP.",
      ],
    },
    pvp: {
      stigmas: ["Rage Burst", "Lunge Stance", "Zikel's Blessing", "Tenaciousness"],
      swaps: [["Focused Block", "99% of KR PvP: the 5th slot there; take it over Zikel's Blessing into burst classes"], ["Armor of Balance", "+30 points over PvE: into stun-heavy teams"], ["Blade Toss", "−50% healing received: into healers"], ["Wrath Wave", "MetaBot's PvP swap"]],
      levelOrder: ["Ruinous Blow", "Crushing Wave", "Overhead Slam"],
      specs: [
        ["Ruinous Blow", "8 +12.5 m range · 16 ignores Block/Evasion · 20 +30% Skill Crit or extra damage"],
        ["Defiance", "8 restores 20% HP · 16 +25% PvP Damage Tolerance during Tenacity"],
        ["Overhead Slam", "16 Remove cooldown: repeat it while the target is down"],
      ],
      skip: "Rending Blow drops to 27% of PvP players: Rush Strike (66%) and Defiance (39%) take its points.",
      theostone: "AoE in the Abyss; Critical Hit for solo Arena.",
      wings: "Talisra (Brawler 2nd)",
      rotation: [
        "Kill combo: Mocking Blade into Overhead Slam, repeated while they're down (Remove cooldown).",
        "Close with Rush Strike or Leaping Slam (20 m).",
        "Blade Toss on whoever is being healed (−30% Defence, −50% healing received, 10 s).",
        "Defiance (60 s) breaks stuns; Tenaciousness right after an Assassin's opener.",
      ],
    },
  },

  templar: {
    name: "Templar", ko: "수호성", role: "Tank", board: "tank", weapon: "Longsword + shield",
    sample: "6,457 KR · 494 global",
    stigmaRates: [
      ["Battlefield Banner", 94.9, 90.8, 87], ["Doom Shield", 92.2, 98.9, 87], ["Noble Armor", 66.8, 78.8, 78.3],
      ["Taunt", 96.1, 95.9, 47.8], ["Shield of Protection", 96.7, 99.4, 17.4], ["Empyrean Lord's Punishment", 90.7, 85.2, 30.4],
      ["Nezekan's Shield", 66.4, 62.3, 17.4], ["Comrade in Arms", 66.9, 88.2, 0], ["Second Skin", 63.6, 79.5, 4.3],
      ["Grapple", 63.2, 79.3, 13], ["Armor of Balance", 39.5, 73.1, 0], ["Executing Blade", 36.1, 54.2, 17.4],
    ],
    skillRates: [
      ["Judgment", 89.3, 94.3], ["Vicious Strike", 82.7, 54.6], ["Pummel", 81.3, 54.9], ["Punishment", 51, 24.3],
      ["Warding Strike", 29.8, 12.2], ["Shield Rush", 4.4, 55.4], ["Defiance", 1.3, 45.3], ["Poach", 2.2, 18.5],
      ["Annihilate", 2.6, 1.4], ["Shield Smite", 2.7, 4.6],
    ],
    passiveRates: [
      ["Fury", 79, 11], ["Impact Hit", 71, 27], ["Insulting Roar", 69, 6], ["Ironclad Defense", 6, 45],
      ["Punishing Benediction", 6, null], ["Enhance Health", 3, 29], ["Survival Willpower", 0, 27],
    ],
    keyNodes: "Nezekan Enhance Health, Ironclad Defense and Guarding Seal pairs, then Zikel Fury (party damage) and Insulting Roar (+100% Enmity).",
    arcana: [[97.5, 91.7], [null, 57.9], [null, null], [97.6, 93.2], [74.1, null], [null, 80.5], [93.4, 50.3], [null, 49.6], [95.4, 88.5], [72.9, 66.3]],
    stats: "Block > Defence > HP > Crit Resist > Attack",
    manastones: "Weapon, shield and armour: Attack, Front Attack Damage Boost, HP. Jewellery: Attack, Accuracy Bonus, HP.",
    gear: "Splendent Ebony Dragon Lord longsword (74%) and guard (65%); armour Ebony with Nuakum second.",
    pve: {
      stigmas: ["Battlefield Banner", "Doom Shield", "Noble Armor", "Taunt"],
      swaps: [["Shield of Protection", "97% of KR PvE: press every 20 s or on heavy hits"], ["Empyrean Lord's Punishment", "MetaBot's pick; third in the opener"]],
      levelOrder: ["Judgment", "Vicious Strike", "Pummel", "Punishment", "Warding Strike"],
      specs: [
        ["Judgment", "8 extra damage · 12 Critical Hit · 20 Remove cooldown"],
        ["Vicious Strike", "8 +50% Multi-Hit · 12 −2 s Warding Strike · 20 Threatening Blow chain"],
        ["Pummel", "8 absorbs 3% HP · 12 up to +12% fewer targets · 20 −1 s Punishment"],
        ["Punishment", "8 +30% Skill Speed · 16 ignores Block/Evasion, crits · 20 DoT"],
        ["Warding Strike", "8 −5 s · 16 +10% PvE Damage Tolerance to the party"],
      ],
      skip: "Flash Rampage: only to 16 (Multi-Hit, −1 s all cooldowns).",
      theostone: "Combat Speed reduction: the only proc that slows enemy attacks.",
      wings: "Talisra (Nightmare 2nd)",
      rotation: [
        "Noble Armor before the pull (120 s).",
        "Opener: Battlefield Banner, then fully charged Punishment (Executor: +200 Accuracy, +20% PvE damage, 20 s).",
        "Macro 1: Judgment at the bottom, Warding Strike, Shield Smite, Doom Shield above it.",
        "Macro 2: Annihilate, held with Vicious Strike as basic attack. Keep Pummel out of macros (its follow-up delays Judgment).",
        "Pulls: Grapple (up to 4, 90 s), Poach (single, 15 s). Defensives: Second Skin, Nezekan's Shield, Comrade in Arms.",
      ],
    },
    pvp: {
      stigmas: ["Shield of Protection", "Doom Shield", "Taunt", "Battlefield Banner"],
      swaps: [["Comrade in Arms", "88% of KR PvP: halves party damage for 6 s"], ["Noble Armor", "global's 3rd pick; MetaBot's PvP swap"], ["Grapple", "pull 4 out of position"], ["Armor of Balance", "+50% Impact Resist 10 s, into stuns"]],
      levelOrder: ["Judgment", "Pummel", "Punishment"],
      specs: [
        ["Judgment", "12 Critical Hit · 16 Remove cooldown · 20 extra damage"],
        ["Punishment", "8 +30% Skill Speed · 16 ignores Block/Evasion · 20 mobile"],
        ["Debilitating Smash", "8 30% Stun 3 s · 12 ignores Block/Evasion"],
        ["Poach", "8 −20% Status Effect Resist on hit · 12 reset on kill"],
        ["Vicious Strike", "raise to 16 only"],
      ],
      skip: "Annihilate and Flash Rampage: not worth points in PvP. Shield Rush (55%) and Defiance (45%) take them.",
      theostone: "Combat Speed reduction (or Stun).",
      wings: "Talisra or Brawler",
      rotation: [
        "Shield Smite (60% stun) → Annihilate on the stunned target; Doom Shield rushes 20 m with a 75% knockdown.",
        "Poach pulls a runner back; Taunt has a 50% chance to Taunt a player for 3 s.",
        "Judgment needs a shield attack in the last 2 s: don't press it without the window.",
        "Defiance (60 s) removes Stun, Knockdown, Airborne, Grab, Frost and Fear. Don't hold Shield of Protection too long.",
      ],
    },
  },

  assassin: {
    name: "Assassin", ko: "살성", role: "Burst melee DPS", board: "melee", weapon: "Dual daggers",
    sample: "7,001 KR · 66 global",
    stigmaRates: [
      ["Swift Contract", 98.1, 98.4, 98.5], ["Illusive Clone", 98.7, 99.4, 98.5], ["Triniel's Dagger", 94.6, 96.4, 83.3],
      ["Savage Fang", 86.6, 90.2, 77.3], ["Throw Shadowblade", 91.3, 96.2, 16.7], ["Evasion Stance", 86.5, 95, 13.6],
      ["Shadow Walk", 70.5, 94.3, 6.1], ["Spiral Slice", 49.6, 82.5, 0], ["Smoke Bomb", 49.6, 67.5, 1.5],
      ["Evasion Contract", 45.2, 65.8, 0], ["Shadowstep", 36.7, 57.9, 1.5], ["Assault Ambush", 23.3, 28.3, 0],
    ],
    skillRates: [
      ["Heart Gore", 85.9, 91.1], ["Quick Slice", 79.7, 84.8], ["Insignia Explosion", 73.9, 66.2], ["Savage Roar", 56.6, 25.1],
      ["Ambush", 9.5, 6.8], ["Storm Rampage", 3.6, 0.4], ["Shadowstrike", 2.3, 28.6], ["Whirlwind Slice", 1.4, 25.6],
      ["Defiance", 0.5, 40.5], ["Flash Slice", 1.1, 3.7],
    ],
    passiveRates: [
      ["Rear Smite", 76, 22], ["Assault Stance", 75, 17], ["Exploit Weakness", 68, 13], ["Impact Hit", 53, 20],
      ["Determination", 11, null], ["Ambush Stance", 10, null], ["Revitalization Contract", null, 22], ["Heightened Sixth Sense", null, 9],
    ],
    keyNodes: "Nezekan Assault Stance and Exploit Weakness pairs (Crit Damage, Crit Hit), then Zikel Defense Break.",
    arcana: [[96.5, 95.9], [8.5, 59], [3.5, 1.1], [96.4, 98.9], [85.6, 24.1], [14.2, 75.7], [84.8, 48.9], [15.1, 50.8], [93.2, 39.9], [89.3, 92.8]],
    stats: "Attack > Critical Hit > Back Attack Damage > Accuracy > Evasion",
    manastones: "Weapon and armour: Back Attack Damage Boost, Attack, HP. Jewellery: Attack first, then Back Attack Damage Boost.",
    gear: "Splendent Ebony Dragon Lord daggers (58%), guard and necklace; Noble Belt, Revelation Amulet, Clash Runes.",
    pve: {
      stigmas: ["Swift Contract", "Illusive Clone", "Triniel's Dagger", "Savage Fang"],
      swaps: [["Throw Shadowblade", "was a first pick until 2026-10-23"], ["Evasion Stance", "for bosses with big telegraphed hits"]],
      levelOrder: ["Heart Gore", "Insignia Explosion", "Quick Slice", "Savage Roar"],
      specs: [
        ["Heart Gore", "12 Multi-Hit · 16 crit resets cooldown · 20 +1 Insignia or 0.7% HP"],
        ["Quick Slice", "8 +50% Multi-Hit · 12 −1 s Insignia Explosion · 20 ignores Block/Evasion as crit"],
        ["Insignia Explosion", "8 +50% Multi-Hit · 16 −3 s · 20 keeps 2 Insignia stacks"],
        ["Ambush", "to 16: 8 absorbs 3% HP · 12 50% Whirlwind Slice"],
        ["Storm Rampage", "to 16: 12 Multi-Hit · 16 −1 s all cooldowns"],
      ],
      skip: "Whirlwind Slice only to 12.",
      theostone: "Low-chance, high-damage single target: fast hits rarely waste its 1 s cooldown.",
      wings: "Talisra (Nightmare 2nd)",
      rotation: [
        "Buffs: Swift Contract then Illusive Clone (shorter animation under Swift Contract).",
        "Triniel's Dagger from behind, then Savage Fang, so 5 Insignias land just before Insignia Explosion.",
        "Macro (bottom to top): Insignia Explosion, Ambush, Heart Gore, Savage Roar; Quick Slice held as basic attack.",
        "Storm Rampage on its own key in Stagger. Stay behind: Rear Smite, Ambush and Triniel's Dagger lose their bonus at the front or side.",
      ],
    },
    pvp: {
      stigmas: ["Illusive Clone", "Swift Contract", "Triniel's Dagger", "Shadow Walk"],
      swaps: [["Throw Shadowblade", "96% of KR PvP: 40% slow to stop runners"], ["Evasion Stance", "95%: vs other melee"], ["Savage Fang", "global keeps it; fast 5 Insignias"], ["Spiral Slice", "strips a defensive buff"]],
      levelOrder: ["Heart Gore", "Quick Slice", "Insignia Explosion"],
      specs: [
        ["Heart Gore", "8 +20% crit on fewer targets · 16 crit resets cooldown · 20 absorbs 0.7% HP"],
        ["Quick Slice", "8 +50% Multi-Hit · 16 ignores Block/Evasion · 20 absorbs 0.7% HP"],
        ["Insignia Explosion", "12 +50% Multi-Hit · 20 +1 s stun or keep 2 stacks"],
        ["Shadowstrike", "to 20: 8 +20% Crit Damage 10 s · 12 50% Seal 5 s"],
        ["Ambush", "to 20: 12 breaks Protective Shields · 20 +2 uses"],
      ],
      skip: "Storm Rampage and Savage Roar lose their points to Shadowstrike, Whirlwind Slice and Defiance (40%).",
      theostone: "High-damage single target.",
      wings: "Talisra (Brawler, Radiant Love)",
      rotation: [
        "Shadow Walk out of combat (20 s stealth).",
        "Shadowstrike: behind the target, 3 s stun.",
        "Triniel's Dagger from behind (+30% damage), Savage Fang, Insignia Explosion at 5 stacks (50% re-stun).",
        "Spiral Slice on a buffed target; Throw Shadowblade on runners; Smoke Bomb blinds 5 s.",
        "Escape: Evasion Stance, Evasion Contract (clears Slow and Root), Defiance.",
      ],
    },
  },

  ranger: {
    name: "Ranger", ko: "궁성", role: "Ranged crit DPS (~20 m)", board: "melee", weapon: "Bow",
    sample: "12,559 KR · 494 global",
    stigmaRates: [
      ["Vaizel's Authority", 98.8, 99.8, 97.8], ["Bow of Blessing", 98.6, 99.5, 95.6], ["Supporting Fire", 96.1, 97.9, 95.6],
      ["Griffon Arrow", 94.3, 97.3, 81.6], ["Explosive Arrow", 89.3, 93.1, 8.8], ["Mother Nature's Breath", 69.8, 92.9, 3.7],
      ["Ambush Kick", 58.4, 87.1, 3.7], ["Stealth", 51.6, 74.9, 1.5], ["Arrow Storm", 41.2, 40.9, 5.9],
      ["Illusory Arrow", 39.1, 58.7, 0], ["Sealing Arrow", 34.5, 61.5, 1.5], ["Ensnaring Trap", 32.4, 62.4, 0.7],
    ],
    skillRates: [
      ["Snipe", 75.5, 74.6], ["Deadshot", 72.8, 82.4], ["Tempest Shot", 70.6, 72.9], ["Drill Dart", 70, 80.6],
      ["Gale Arrow", 64.5, 55], ["Burst Arrow", 18.5, 8.4], ["Marking Shot", 3.6, 28.7], ["Defiance", 0.3, 22.1],
      ["Snare Shot", 2.7, 1.7],
    ],
    passiveRates: [
      ["Focused Eye", 75, 34], ["Hunter's Resolve", 73, 21], ["Hunter's Soul", 27, 5], ["Revitalization Contract", 0, 18],
    ],
    keyNodes: "Nezekan Hunter's Resolve and Focused Eye pairs, then Zikel Rooting Eye and Hunter's Soul.",
    arcana: [[95.8, 89.7], [9.5, 60], [null, null], [97, 98.9], [83.8, 29.3], [null, null], [91.2, 51.4], [null, null], [93, 42.5], [89.8, 94.5]],
    stats: "Attack > Critical Hit > Accuracy > Evasion > HP",
    manastones: "Weapon: Attack, Critical Hit, HP. Armour: Attack, Critical Hit, MP. Jewellery: Attack, Critical Hit, HP.",
    gear: "Splendent Ebony Dragon Lord bow (58%) and jewellery; armour Nuakum or Ebony.",
    pve: {
      stigmas: ["Vaizel's Authority", "Bow of Blessing", "Supporting Fire", "Griffon Arrow"],
      swaps: [["Explosive Arrow", "removed from the global macro; 89% in KR's 5th slot"], ["Arrow Storm", "big trash packs"]],
      levelOrder: ["Deadshot", "Gale Arrow", "Snare Shot", "Burst Arrow", "then max Snipe, Tempest Shot, Drill Dart"],
      specs: [
        ["Deadshot", "8 +30% Skill Speed · 16 extra damage · 20 ignores Block/Evasion as Multi-Hit (when you can stand still)"],
        ["Gale Arrow", "8 mobile · 12 Combat Speed + damage on few targets · 20 −10 s"],
        ["Snare Shot", "8 +20% Skill Speed · 12 Shackling Arrow chain · 20 mobile"],
        ["Burst Arrow", "8 mobile · 12 up to +20% few targets · 20 +50% Multi-Hit or 25% reset"],
        ["Snipe", "12 −1 s Deadshot · 16 Tempest Arrow chain"],
      ],
      skip: "Arrow Scattershot, Suppressing Arrow, Explosion Trap: leave low.",
      theostone: "AoE for packs.",
      wings: "Talisra (Nightmare 2nd)",
      rotation: [
        "Buff button: Vaizel's Authority, Bow of Blessing, Supporting Fire at the start of each burst.",
        "Macro, two entries at 10 ms: (1) Griffon Arrow, Arrow Scattershot, Tempest Shot; (2) Gale Arrow, Drill Dart, Burst Arrow, Snare Shot. Hold with Snipe.",
        "Deadshot on its own key. Marking Shot standing still every 12–13 s to keep Precision (refresh at ~2 s left).",
        "Burst Arrow needs Slow or Root: Snare Shot first.",
      ],
    },
    pvp: {
      stigmas: ["Vaizel's Authority", "Bow of Blessing", "Supporting Fire", "Griffon Arrow"],
      swaps: [["Mother Nature's Breath", "93% of KR PvP (+23 over PvE): defensive, swap for Griffon Arrow vs divers"], ["Ambush Kick", "+29 over PvE: peel melee"], ["Explosive Arrow", "93%: MetaBot's PvP swap"], ["Sealing Arrow", "75% Seal on casters"]],
      levelOrder: ["Deadshot", "Drill Dart", "Snipe", "Tempest Shot", "Gale Arrow"],
      specs: [
        ["Deadshot", "20: mobile instead of Multi-Hit, so you can kite"],
        ["Marking Shot", "PvP 29% raise it: 8 +5% Perfect Chance · 12 +5 s"],
        ["Drill Dart", "12 Multi-Hit · 16 +1 activation"],
      ],
      skip: "Burst Arrow and Snare Shot points move to Marking Shot and Defiance (22%).",
      theostone: "Move Speed reduction for kiting.",
      wings: "Talisra (Radiant Love)",
      rotation: [
        "Snare Shot slows; Sealing Arrow 75% Seal; Illusory Arrow blinds; Suppressing Arrow can stun with Precision.",
        "Ambush Kick and Ensnaring Trap for melee on you; Mother Nature's Breath and Defiance to survive.",
        "Most of your damage wants a slowed or rooted target: control first, then Deadshot.",
      ],
    },
  },

  sorcerer: {
    name: "Sorcerer", ko: "마도성", role: "Burst fire caster", board: "caster", weapon: "Spellbook",
    sample: "6,138 KR · 494 global",
    stigmaRates: [
      ["Element Enhancement", 98.9, 99.5, 100], ["Delayed Explosion", 97.3, 97.7, 70.8], ["Fire Wall", 96.7, 96.3, 70.8],
      ["Cold Storm", 91.7, 96.7, 64.6], ["Steel Barrier", 95.2, 98.5, 24.6], ["Arctic Armor", 75.6, 96.3, 21.5],
      ["Glacial Smite", 70.5, 92, 9.2], ["Hibernation", 68.2, 95.5, 18.5], ["Divine Burst", 53.7, 55.4, 9.2],
      ["Soul Freeze", 35, 71.2, 7.7], ["Assault Bombardment", 31.5, 41.3, 1.5], ["Curse: Tree", 27.4, 43.1, 1.5],
    ],
    skillRates: [
      ["Blaze", 80.3, 63.7], ["Wish of Concentration", 80.2, 69.9], ["Bittercold Wind", 77.7, 85.3], ["Hellfire", 77.4, 48.1],
      ["Flame Arrow", 61, 49], ["Firestorm", 45.9, 46.6], ["Winter's Shackles", 24, 41.5], ["Ice Chain", 14.7, 35.4],
      ["Defiance", 0.2, 21.8], ["Frost Burst", 1, 12],
    ],
    passiveRates: [
      ["Robe of Flame", 75, 37], ["Fire Mark", 17, 2], ["Robe of Cold", 16, 7], ["Vitality Evaporation", 12, 1],
      ["Grace of Enhancement", 11, 1], ["Revitalization Contract", 0, 23], ["Grace of Resistance", 0, 12], ["Absorb Essence", 1, 7],
    ],
    keyNodes: "Zikel first, for the doubled Grace of Enhancement nodes, then Nezekan Fire Mark and Robe of Earth.",
    arcana: [[97.6, 93.7], [6.4, 56.3], [2.2, 0.7], [97.6, 99.3], [89.4, 35.8], [10.4, 64.1], [76.8, 44], [23, 56], [93.8, 52.8], [91.9, 93.1]],
    stats: "Attack > Critical Hit > MP > Accuracy > HP",
    manastones: "Weapon: Attack, Weapon Damage Boost, MP. Armour: Attack, Critical Hit, HP. Jewellery: Attack, Critical Hit, HP.",
    gear: "Splendent Ebony Dragon Lord spellbook and jewellery; Talisra wings (82% of KR PvE).",
    pve: {
      stigmas: ["Element Enhancement", "Delayed Explosion", "Fire Wall", "Cold Storm"],
      swaps: [["Steel Barrier", "95% of KR PvE: for progression bosses"], ["Arctic Armor", "if carried, above Flame Scattershot"]],
      levelOrder: ["Blaze", "Wish of Concentration", "Bittercold Wind", "Hellfire", "Flame Arrow", "Firestorm", "Winter's Shackles"],
      specs: [
        ["Blaze", "8 delayed damage after 3 s · 16 −3 s Wish cooldown · 20 absorbs 3% HP"],
        ["Wish of Concentration", "12 +10% Combat Speed · 16 −10 s all cooldowns · 20 +10% Attack"],
        ["Hellfire", "8 fire DoT · 16 −15 s · 20 ignores Block/Evasion, Multi-Hit"],
        ["Firestorm", "12 −2 s Hellfire per fireball · 16 +15% per fireball (to +75%) · 20 +20% Skill Speed"],
        ["Winter's Shackles", "8 +20% PvE damage 5 s · 16 −15 s · 20 Winter's Illusion chain"],
      ],
      skip: "Ice Chain: not worth points. Flame Scattershot at 16 or below.",
      theostone: "AoE fire for packs.",
      wings: "Talisra",
      rotation: [
        "Buff button: Element Enhancement, Fire Wall, Cold Storm; press again with ~5 s left on Element Enhancement.",
        "Macro (left click): Flame Arrow, then Bittercold Wind / Blaze / Firestorm / Wish of Concentration stacked, Flame Scattershot only in Stagger.",
        "Held right click: Delayed Explosion, fully charged Hellfire, Winter's Shackles.",
        "Keep MP ≥ 25% or Grace of Enhancement's +20% switches off. Never Hellfire without Element Enhancement; no Fire Wall on a moving boss.",
      ],
    },
    pvp: {
      stigmas: ["Element Enhancement", "Steel Barrier", "Delayed Explosion", "Cold Storm"],
      swaps: [["Arctic Armor", "96% of KR PvP (+21 over PvE)"], ["Hibernation", "95% (+27): the panic button"], ["Soul Freeze", "Seal: shuts down a caster"], ["Curse: Tree", "MetaBot's PvP swap"]],
      levelOrder: ["Hellfire", "Bittercold Wind", "Firestorm", "Winter's Shackles"],
      specs: [
        ["Bittercold Wind", "8 pull · 12 ignores Block/Evasion, crit · 20 −1 s Frost"],
        ["Hellfire", "12 ignores Block/Evasion · 16 −15 s · 20 +30% Skill Speed or mobile"],
        ["Firestorm", "8 −60% incoming heal 5 s · 16 +15% per fireball · 20 −2 s Hellfire"],
        ["Wish of Concentration", "8 +10% Attack · 16 −10 s all · 20 +10% Combat Speed"],
        ["Winter's Shackles", "12 chain or mobile · 20 −15 s"],
      ],
      skip: "Ice Chain rises to 35% in PvP (root); Defiance 22%.",
      theostone: "Seal.",
      wings: "Talisra (Brawler)",
      rotation: [
        "Steel Barrier up before you engage, and again whenever it breaks.",
        "Frost / Bittercold Wind root, Winter's Shackles slow, then Hellfire + Delayed Explosion on a held target.",
        "Firestorm's −60% healing on whoever the healer is saving.",
        "Arctic Armor and Hibernation when dived; Soul Freeze or Curse: Tree on the diver.",
      ],
    },
  },

  spiritmaster: {
    name: "Spiritmaster", ko: "정령성", role: "Summoner / DoT", board: "caster", weapon: "Orb",
    sample: "3,624 KR · 32 global",
    stigmaRates: [
      ["Summon: Ancient Spirit", 98.1, 99.5, 100], ["Enhance: Spirit's Benediction", 97.9, 99.7, 96.9], ["Jointstrike: Corrode", 92.2, 93.5, 96.9],
      ["Flame Blessing", 93.8, 94.5, 81.3], ["Siphon", 81.8, 96.3, 9.4], ["Command: Proxy", 63.8, 97.1, 6.3],
      ["Jointstrike: Destructive Attack", 58.5, 71.8, 9.4], ["Seize Magic", 42.1, 92.2, 0], ["Kaisinel's Power", 36.8, 84.6, 0],
      ["Assault Terror", 31.8, 55.1, 0], ["Magic Block", 27, 54, 0], ["Cursed Cloud", 26.8, 49.3, 0],
    ],
    skillRates: [
      ["Combustion", 77, 93.7], ["Elemental Fusion", 66, 82.5], ["Cold Shock", 45.1, 56.9], ["Summon: Fire Spirit", 34.8, 5.5],
      ["Jointstrike: Curse", 23.2, 46], ["Dimensional Control", 14.2, 30], ["Summon: Water Spirit", 6, 1], ["Defiance", 0.8, 37.6],
      ["Summon: Earth Spirit", 0.8, 7], ["Soul's Cry", 2.5, 6.3],
    ],
    passiveRates: [
      ["Spirit Strike", 83, 30], ["Mental Focus", 79, 23], ["Element Unification", 65, 6], ["Spirit Revitalization", 35, 4],
      ["Corrode", 10, 3], ["Revitalization Contract", 0, 7], ["Spirit Protection", 3, 5],
    ],
    keyNodes: "Nezekan's Spirit Strike pair, then Zikel Consecutive Countercurrent and Element Unification.",
    arcana: [[95.2, 92.7], [12.3, 62], [4.4, 0.8], [95.4, 99], [80.2, 24.9], [19.6, 75.1], [88.2, 35.9], [11.6, 64.1], [91, 42.4], [87.9, 93.5]],
    stats: "Attack > Critical Hit > Accuracy > HP > MP",
    manastones: "Weapon: Attack, Critical Hit, HP. Armour: Attack, HP, Critical Hit. Jewellery: Attack, HP / MP, Critical Hit.",
    gear: "Splendent Ebony Dragon Lord orb (53% of the global top, 2026-10-26).",
    pve: {
      stigmas: ["Summon: Ancient Spirit", "Enhance: Spirit's Benediction", "Jointstrike: Corrode", "Flame Blessing"],
      swaps: [["Siphon", "82% of KR PvE: sustain"], ["Jointstrike: Destructive Attack", "more burst in the Ancient Spirit window"]],
      levelOrder: ["Combustion", "Elemental Fusion", "Cold Shock", "Summon: Fire Spirit", "Jointstrike: Curse"],
      specs: [
        ["Combustion", "8 fewer-targets damage · 12 +20% Skill Speed · 20 Ashy Call chain"],
        ["Elemental Fusion", "8 extra damage after 3 s · 12 +10 all Element Boost · 20 25% regain Four Elements"],
        ["Cold Shock", "8 +50% Multi-Hit · 12 +2% Attack per Earth Tremor (5 stacks)"],
        ["Summon: Fire Spirit", "8 +20% spirit crit damage · 16 +20% spirit stats"],
        ["Dimensional Control", "8 extra damage after 3 s · 12 +50% Multi-Hit"],
      ],
      skip: "Rapid Scattershot and Wind Spirit: leave low (Scattershot only in Stagger).",
      theostone: "Poison: keeps DoTs up for Consecutive Countercurrent.",
      wings: "Talisra",
      rotation: [
        "Ancient Spirit's 30 s is the burst: Flame Blessing + Spirit's Benediction, then Ancient Spirit at 5 Element Unification stacks, then Jointstrike: Corrode.",
        "Macro 1: Corrode, Curse, Dimensional Control, Combustion.",
        "Macro 2: spirits Water, Earth, Wind, Fire. Macro 3: Elemental Fusion held with Cold Shock (Four Elements only).",
        "Keep a DoT on every target and a spirit out at all times. Turn Skill Queue off if the basic attack stops and MP drains.",
      ],
    },
    pvp: {
      stigmas: ["Summon: Ancient Spirit", "Enhance: Spirit's Benediction", "Command: Proxy", "Siphon"],
      swaps: [["Seize Magic", "92% of KR PvP (+50 over PvE): the main pick in fights"], ["Kaisinel's Power", "the opener (+48)"], ["Flame Blessing", "global keeps it"], ["Cry of Terror", "MetaBot's PvP swap: fear"]],
      levelOrder: ["Combustion", "Elemental Fusion", "Cold Shock", "Jointstrike: Curse"],
      specs: [
        ["Combustion", "94% at Lv 20+ in PvP"],
        ["Jointstrike: Curse", "46% PvP (vs 23% PvE): the control"],
        ["Dimensional Control", "30% PvP"],
      ],
      skip: "Summon: Fire Spirit falls to 6% in PvP: its points go to Curse and Defiance (38%).",
      theostone: "Poison.",
      wings: "Talisra (Brawler)",
      rotation: [
        "Open with Kaisinel's Power; Seize Magic in every fight.",
        "Siphon and Command: Proxy by hand. Proxy is your answer to burst, but only within 25 m of the spirit.",
        "Keep the spirit between you and divers.",
      ],
    },
  },

  cleric: {
    name: "Cleric", ko: "치유성", role: "Healer", board: "healer", weapon: "Mace",
    sample: "10,358 KR · 31 global",
    stigmaRates: [
      ["Earth Punishment", 92.2, 96.2, 93.5], ["Light of Protection", 98.4, 99.7, 87.1], ["Prayer of Amplification", 85.7, 93, 80.6],
      ["Noble Aura", 93.7, 95.7, 67.7], ["Benevolence", 86.7, 95.7, 6.5], ["Absolution", 80.6, 95.2, 3.2],
      ["Summon Resurrection", 79.2, 93.9, 16.1], ["Salvation", 74.4, 97.9, 22.6], ["Yustiel's Power", 74.3, 96, 12.9],
      ["Voice of Doom", 57.2, 76.9, 3.2], ["Power Burst", 31.4, 39.4, 6.5], ["Root", 27.5, 43.1, 0],
    ],
    skillRates: [
      ["Radiant Recovery", 78.3, 88.4], ["Condemnation", 75.4, 62.3], ["Earth's Retribution", 58.5, 34.9], ["Healing Light", 56.5, 66.6],
      ["Bolt", 49.2, 17.5], ["Judgment Thunder", 45.4, 35.7], ["Light of Regeneration", 44.8, 55.3], ["Divine Aura", 44, 16.6],
      ["Defiance", 0.5, 39.6], ["Chain of Torment", 2.9, 4.9],
    ],
    passiveRates: [
      ["Empyrean Lord's Grace", 68, 14], ["Earth's Grace", 67, 15], ["Healing Enhancement", 18, 10], ["Immortal Veil", 17, 18],
      ["Warm Benediction", 10, 10], ["Survival Willpower", 1, 23], ["Radiant Benediction", 2, 1],
    ],
    keyNodes: "Nezekan Healing Enhancement and Warm Benediction pairs, then Zikel Radiant Benediction (party healing on attack).",
    arcana: [[96.2, 75.9], [10.8, 68.9], [5, 28.8], [94.9, 71.2], [83.2, 31.6], [16.7, 68.2], [85.8, 40.5], [14.1, 59.3], [93.4, 60.2], [85.8, 90.4]],
    stats: "HP > Defence > MP > Crit Resist > Attack",
    manastones: "Weapon: Attack, MP, HP. Armour: Attack, HP, Critical Hit / MP. Jewellery: Attack, HP, Accuracy Bonus.",
    gear: "Top KR Clerics still build Attack-heavy (Earth Punishment and Chain of Torment are party damage).",
    pve: {
      stigmas: ["Earth Punishment", "Light of Protection", "Prayer of Amplification", "Noble Aura"],
      swaps: [["Summon Resurrection", "MetaBot's 4th: progression wipes"], ["Benevolence", "87% of KR PvE"]],
      levelOrder: ["Condemnation", "Bolt", "Earth's Retribution", "Divine Aura", "then Radiant Recovery, Healing Light"],
      specs: [
        ["Condemnation", "12 crit resets cooldown · 16 Multi-Hit"],
        ["Bolt", "8 +30% Skill Speed · 12 up to +20% few targets"],
        ["Earth's Retribution", "8 +20% Discharge chance · 12 +50% Multi-Hit"],
        ["Divine Aura", "8 +50% attack speed · 12 +3 s · 20 −10 s"],
        ["Radiant Recovery", "8 −3 s · 16 +5% HP restored"],
        ["Healing Light", "12 +2% HP · 16 −2 s"],
      ],
      skip: "Chain of Torment, Debilitating Mark, Lightning Strike Scattershot: leave low.",
      theostone: "Any damage stone.",
      wings: "Talisra",
      rotation: [
        "Before the pull: Light of Protection, Divine Aura, Noble Aura.",
        "Macro (bottom first): Earth Punishment, Divine Aura, Condemnation, Chain of Torment, held with Earth's Retribution (restores MP per hit). Condemnation needs Chain of Torment on the target.",
        "By hand: full-charge Bolt; Healing Light for one or two; Radiant Recovery for the group; Light of Regeneration before damage lands.",
        "Chain of Torment doesn't stack with a Chanter's Earth's Promise; Light of Protection doesn't stack with Undefeated Mantra.",
      ],
    },
    pvp: {
      stigmas: ["Light of Protection", "Salvation", "Earth Punishment", "Yustiel's Power"],
      swaps: [["Absolution", "95% of KR PvP: cleanse"], ["Benevolence", "96%"], ["Noble Aura", "global keeps it"], ["Voice of Doom", "offence (+20 over PvE)"]],
      levelOrder: ["Radiant Recovery", "Healing Light", "Condemnation", "Light of Regeneration"],
      specs: [
        ["Radiant Recovery", "88% at Lv 20+ in PvP: group heal + debuff removal"],
        ["Light of Regeneration", "12 +5% move speed while healing · 16 +2.5% PvP Damage Tolerance"],
        ["Healing Light", "12 +2% HP · 16 −2 s"],
      ],
      skip: "Bolt and Divine Aura drop under 18% in PvP: their points go to heals and Defiance (40%).",
      theostone: "Stun or Seal.",
      wings: "Talisra (Brawler)",
      rotation: [
        "Survive: Salvation, Defiance, Yustiel's Power.",
        "Absolution and Radiant Recovery strip debuffs off the party.",
        "Offence when safe: Voice of Doom and Root.",
      ],
    },
  },

  chanter: {
    name: "Chanter", ko: "호법성", role: "Support / melee hybrid", board: "support", weapon: "Staff",
    sample: "7,347 KR · 40 global",
    stigmaRates: [
      ["Undefeated Mantra", 99.6, 99.7, 97.5], ["Power of the Storm", 97.1, 99.1, 87.5], ["Guardian Blessing", 54.3, 88.2, 80],
      ["Marchutan's Wrath", 88.7, 98.7, 70], ["Sprint Mantra", 97.6, 99.6, 47.5], ["Healing Touch", 80.6, 92.5, 2.5],
      ["Focused Defense", 75.8, 90.6, 10], ["Impeding Authority", 57, 72.2, 2.5], ["Barrier Spell", 55.6, 83.4, 15],
      ["Fracturing Blow", 43.2, 71, 2.5], ["Obliterate", 28.6, 32.4, 5], ["Ensnaring Mark", 22.2, 39.7, 5],
    ],
    skillRates: [
      ["Dark Crush", 85.1, 93.6], ["Onslaught", 74, 64.7], ["Recuperation", 67.6, 60.4], ["Spinning Strike", 34.9, 38.6],
      ["Incandescent Blow", 30.6, 29.3], ["Impactful Crush", 8.8, 19.1], ["Rushing Smash", 6.3, 18], ["Defiance", 1.1, 34.4],
      ["Heat Wave Blow", 1.5, 10.8], ["Wave Blow", 1.3, 1.1],
    ],
    passiveRates: [
      ["Attack Preparation", 76, 23], ["Impact Hit", 74, 31], ["Wind's Promise", 69, 11], ["Inspiring Spell", 37, 6],
      ["Earth's Promise", 17, 2], ["Blessing of Life", 5, 13], ["Survival Willpower", 0, 36],
    ],
    keyNodes: "Nezekan Attack Preparation and Protection Circle pairs, then Zikel Earth's Promise (lowers the target's PvE Damage Tolerance).",
    arcana: [[96.5, 91.7], [9.4, 63.8], [3.1, 8], [96.8, 91.7], [83.2, 27.1], [16.7, 72.7], [91.6, 55.5], [8.3, 44.5], [92.9, 49.7], [89.9, 92.5]],
    stats: "HP > Attack > Defence > Critical Hit > Accuracy",
    manastones: "Weapon: Attack, HP, Weapon Damage Boost. Armour: Attack, HP, MP. Jewellery: Attack, HP / MP, Accuracy Bonus.",
    gear: "Splendent Ebony Dragon Lord staff and set; Dark Veil wings most worn on global.",
    pve: {
      stigmas: ["Undefeated Mantra", "Power of the Storm", "Guardian Blessing", "Marchutan's Wrath"],
      swaps: [["Sprint Mantra", "98% of KR PvE: MetaBot's 2nd; take it if your group has no movement buff"], ["Healing Touch", "extra heals in a healer-light group"]],
      levelOrder: ["Dark Crush", "Onslaught", "Recuperation", "Spinning Strike", "Incandescent Blow"],
      specs: [
        ["Dark Crush", "12 Piercing Strike chain · 16 Remove cooldown · 20 crit on hit"],
        ["Onslaught", "8 absorbs 0.7% HP · 12 −1 s Spinning Strike · 20 Storm Chain"],
        ["Spinning Strike", "8 −5 s · 12 up to +20% few targets · 20 ignores Block/Evasion as crit"],
        ["Recuperation", "8 +1 use, HoT stacks 2 · 16 −3 s · 20 +5% HP"],
        ["Heat Wave Blow", "to 12: 8 +20% more targets · 12 Multi-Hit"],
      ],
      skip: "Gust Rampage, Wave Blow, Tremor Crush: leave low.",
      theostone: "AoE: most hits strike 4 targets.",
      wings: "Talisra (Nightmare 2nd)",
      rotation: [
        "Undefeated Mantra on its own key (doesn't stack with a Cleric's Light of Protection).",
        "Buff slot: Power of the Storm (+20% Combat Speed) with Guardian Blessing above it.",
        "Dark Crush only works for a moment after a ranged skill: Spinning Strike / Impactful Crush open it 2 s, Marchutan's Wrath / Ensnaring Mark 3 s.",
        "Macro (bottom first): Dark Crush, Spinning Strike, Impactful Crush, Incandescent Blow, held with Onslaught. Recuperation and Gust Rampage (Stagger) by hand.",
      ],
    },
    pvp: {
      stigmas: ["Undefeated Mantra", "Sprint Mantra", "Power of the Storm", "Marchutan's Wrath"],
      swaps: [["Guardian Blessing", "global's 3rd pick: a shield in fights"], ["Barrier Spell", "+28 over PvE"], ["Fracturing Blow", "+28 over PvE"], ["Obliterate", "MetaBot's PvP swap"]],
      levelOrder: ["Dark Crush", "Onslaught", "Recuperation", "Spinning Strike"],
      specs: [
        ["Dark Crush", "94% at Lv 20+ in PvP"],
        ["Impactful Crush", "19% PvP (vs 9%): 60% stun opens Wave Blow"],
      ],
      skip: "Incandescent Blow points move to Impactful Crush, Rushing Smash and Defiance (34%).",
      theostone: "Stun.",
      wings: "Talisra (Brawler)",
      rotation: [
        "Ensnaring Mark: 50% Seal on up to 4 for 5 s.",
        "Impactful Crush (60% stun) → Wave Blow (stunned targets only, 3 s knockdown) → Dark Crush.",
        "Survive with Barrier Spell, Guardian Blessing and Defiance; Sprint Mantra to engage or run.",
      ],
    },
  },
};
const BUILD_BY_KO = Object.fromEntries(Object.entries(BUILDS).map(([id, b]) => [b.ko, id]));

const BUILD_SOURCES = [
  ["aion2-meta: class guides (KR + global pick rates)", "https://aion2-meta.com/guides/gladiator/"],
  ["MetaBot: class builds", "https://metabot.gg/en/aion-2/guides/class-builds-guide"],
  ["aion2builds: Daevanion", "https://aion2builds.org/guides/daevanion/"],
  ["AION2 Vault: Ariel board", "https://aion2vault.com/builds/ariel-daevanion/"],
];
