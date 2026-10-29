// Citizen Score: how each class plays, for the Guide (playview.js draws it)
// and the Builds tab. Three tables:
//
// - ARCANA_POOLS: the skills each Arcana card can roll, per class. From
//   MetaBot's item pages (metabot.gg/en/aion-2/items/<card>), which read the
//   client's Arcana filter table, 2026-10-28. A card rolls one skill from its
//   slot's pool when it is soul-bound (up to +4 levels on a Unique). Vigor and
//   Magic cards of a slot share the pool; the Chalice rolls from all 22.
//   Stigmas are on no list.
// - MACROS: the in-game macro (PvE), from aion2-meta.com/guides/<class>/
//   (updated 2026-10-26, global's 4 stigmas). `key` is the macro's entries,
//   run top to bottom; each entry is one stacked hotbar slot, listed FROM THE
//   BOTTOM: the bottom skill fires first, the next one up if it isn't ready.
//   `hold` is held with it (the basic attack; for the Sorcerer a second
//   stacked slot). `buff`: one stacked slot of buffs on its own key. `hand`:
//   pressed by hand. `out`: keep out of the macro. `tags`: why a skill sits
//   where it does. `steps`: the opener and the rest, in order.
// - PASSIVE_FX: each passive's client tooltip (aion2-meta, cut where the
//   site cuts it).
//
// The in-game macro is the only allowed one: NCSOFT bans mouse and
// third-party macros.

const ARCANA_POOLS = {
  gladiator: {
    Parchment: ["Keen Strike", "Leaping Slam", "Overhead Slam", "Ankle Slice", "Aerial Snare", "Ruinous Blow"],
    Compass: ["Rending Blow", "Mocking Blade", "Rush Strike", "Crushing Wave", "Sword Aura Rampage", "Defiance"],
    Bell: ["Survival Stance", "Blood Absorption", "Attack Preparation", "Destructive Impulse", "Survival Willpower"],
    Mirror: ["Protection Armor", "Identify Weakness", "Impact Hit", "Experienced Counterstrike", "Murderous Burst"],
  },
  templar: {
    Parchment: ["Vicious Strike", "Poach", "Annihilate", "Judgment", "Debilitating Smash", "Punishment"],
    Compass: ["Pummel", "Shield Smite", "Shield Rush", "Warding Strike", "Flash Rampage", "Defiance"],
    Bell: ["Enhance Health", "Punishing Benediction", "Guarding Seal", "Insulting Roar", "Fury"],
    Mirror: ["Warding Shield", "Ironclad Defense", "Impact Hit", "Survival Willpower", "Block Pain"],
  },
  assassin: {
    Parchment: ["Quick Slice", "Shadowstrike", "Heart Gore", "Whirlwind Slice", "Shadow Fall", "Insignia Explosion"],
    Compass: ["Ambush", "Savage Roar", "Infiltrate", "Flash Slice", "Storm Rampage", "Defiance"],
    Bell: ["Heightened Sixth Sense", "Apply Poison", "Assault Stance", "Ambush Stance", "Revitalization Contract"],
    Mirror: ["Exploit Weakness", "Rear Smite", "Impact Hit", "Defense Break", "Determination"],
  },
  ranger: {
    Parchment: ["Snipe", "Snare Shot", "Drill Dart", "Burst Arrow", "Explosion Trap", "Tempest Shot"],
    Compass: ["Deadshot", "Marking Shot", "Suppressing Arrow", "Gale Arrow", "Arrow Scattershot", "Defiance"],
    Bell: ["Vigilant Eye", "Wind Vigor", "Hunter's Resolve", "Rooting Eye", "Revitalization Contract"],
    Mirror: ["Concentrated Fire", "Focused Eye", "Unyielding Resolve", "Melee Fire", "Hunter's Soul"],
  },
  sorcerer: {
    Parchment: ["Flame Arrow", "Firestorm", "Blaze", "Frost Burst", "Wish of Concentration", "Hellfire"],
    Compass: ["Ice Chain", "Bittercold Wind", "Frost", "Winter's Shackles", "Flame Scattershot", "Defiance"],
    Bell: ["Fire Mark", "Cold Snap", "Robe of Cold", "Grace of Resistance", "Revitalization Contract"],
    Mirror: ["Robe of Earth", "Robe of Flame", "Absorb Essence", "Grace of Enhancement", "Vitality Evaporation"],
  },
  spiritmaster: {
    Parchment: ["Cold Shock", "Summon: Fire Spirit", "Jointstrike: Curse", "Summon: Earth Spirit", "Dimensional Control", "Elemental Fusion"],
    Compass: ["Combustion", "Summon: Water Spirit", "Soul's Cry", "Summon: Wind Spirit", "Rapid Scattershot", "Defiance"],
    Bell: ["Spirit Strike", "Spirit's Descent", "Spirit Revitalization", "Spirit Communion", "Element Unification"],
    Mirror: ["Spirit Protection", "Corrode", "Mental Focus", "Consecutive Countercurrent", "Revitalization Contract"],
  },
  cleric: {
    Parchment: ["Earth's Retribution", "Debilitating Mark", "Chain of Torment", "Condemnation", "Radiant Recovery", "Bolt"],
    Compass: ["Judgment Thunder", "Divine Aura", "Light of Regeneration", "Healing Light", "Lightning Strike Scattershot", "Defiance"],
    Bell: ["Warm Benediction", "Empyrean Lord's Grace", "Immortal Veil", "Prayer of Concentration", "Survival Willpower"],
    Mirror: ["Empyrean Lords' Benediction", "Healing Enhancement", "Heal Block", "Radiant Benediction", "Earth's Grace"],
  },
  chanter: {
    Parchment: ["Onslaught", "Rushing Smash", "Wave Blow", "Heat Wave Blow", "Dark Crush", "Spinning Strike"],
    Compass: ["Incandescent Blow", "Impactful Crush", "Tremor Crush", "Recuperation", "Gust Rampage", "Defiance"],
    Bell: ["Blessing of Life", "Protection Circle", "Attack Preparation", "Raging Spell", "Survival Willpower"],
    Mirror: ["Crossguard", "Inspiring Spell", "Impact Hit", "Earth's Promise", "Wind's Promise"],
  },
};

const MACRO_HOW = [
  "Skill screen (K) → Macro builds it; bind its key in Settings → Key Settings → General → Gameplay → Macro (none by default).",
  "Each entry is a hotbar slot that stacks up to 4 skills. Holding the key runs the entries top to bottom at the delay shown; in each slot the bottom skill fires first, the next one up if it isn't ready.",
  "Hold your basic attack (left click) together with the macro: it restores MP and the two cut each other's animations short. That is intended, not a bug.",
  "Leave Skill Queue on (Settings → Combat → Controls); turn it off only if the basic attack stops coming out and MP drains.",
  "One macro per skill preset (Alt + Num4/5/6): keep a boss preset and a farming preset.",
];

const MACROS = {
  gladiator: {
    key: [["Sword Aura Rampage", "Rending Blow"], ["Rage Burst", "Overhead Slam"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Keen Strike"], holdOn: "left click",
    buff: ["Zikel's Blessing", "Lunge Stance"],
    hand: ["Ruinous Blow", "Focused Block", "Defiance", "Leaping Slam", "Rush Strike"],
    tags: {
      "Sword Aura Rampage": "only hits in Stagger, else Rending Blow goes",
      "Rending Blow": "cancels Overhead Slam's recovery",
      "Rage Burst": "opens Overhead Slam on bosses for 10 s",
      "Overhead Slam": "main damage; needs knockdown (7% per hit on bosses)",
      "Keen Strike": "fills gaps, restores MP",
    },
    steps: [
      "Buff key (Zikel's Blessing + Lunge Stance) at the start of each burst window, never just before the boss jumps or goes invulnerable.",
      "Ruinous Blow right after the buffs, and every time it's ready (+20% PvE damage for 20 s).",
      "Hold the macro + Keen Strike for everything else.",
      "Optional: Aerial Snare just below Overhead Slam: fewer Slams, about 5% more damage overall.",
      "Carrying them: Lifestealing Blade between Rage Burst and Overhead Slam; Wave Armor on the buff key.",
    ],
  },
  templar: {
    key: [["Judgment", "Warding Strike", "Shield Smite", "Doom Shield"], ["Annihilate"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Vicious Strike"], holdOn: "left click",
    hand: ["Noble Armor", "Battlefield Banner", "Punishment", "Taunt", "Flash Rampage", "Poach", "Shield Rush"],
    out: ["Pummel"],
    tags: {
      "Judgment": "main damage; only opens after a shield attack",
      "Warding Strike": "opens Judgment 2 s",
      "Shield Smite": "opens Judgment 2 s",
      "Doom Shield": "opens Judgment 3 s",
      "Annihilate": "usable by chance on bosses (5% per hit): the macro catches it",
      "Vicious Strike": "restores MP every swing",
      "Pummel": "its follow-up always comes out and delays Judgment",
    },
    steps: [
      "Noble Armor before the pull, and again every time it comes back (120 s).",
      "Opener: Battlefield Banner, then fully charged Punishment, then hold both keys.",
      "Taunt to win the boss back; Flash Rampage in Stagger; Poach and Shield Rush to engage.",
      "Carrying them: Empyrean Lord's Punishment right after Punishment in the opener; Shield of Protection every 20 s or for a heavy hit.",
    ],
  },
  assassin: {
    key: [["Insignia Explosion", "Ambush", "Heart Gore", "Savage Roar"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Quick Slice"], holdOn: "left click",
    buff: ["Swift Contract", "Illusive Clone"],
    hand: ["Triniel's Dagger", "Savage Fang", "Storm Rampage", "Shadowstrike"],
    tags: {
      "Heart Gore": "only on a Critical Hit, so it fires whenever it can",
      "Insignia Explosion": "spend the Insignia stacks",
      "Quick Slice": "MP; each hit takes 1 s off Insignia Explosion (specialty)",
    },
    steps: [
      "Buff key: Swift Contract first, then Illusive Clone (shorter animation under Swift Contract).",
      "Triniel's Dagger from behind, then Savage Fang, so its 5 Insignias land just before the next Insignia Explosion.",
      "Hold the macro + Quick Slice. Storm Rampage in Stagger, Shadowstrike by hand.",
      "Stay behind the boss: Rear Smite, Ambush and Triniel's Dagger lose their bonus from the front or side.",
    ],
  },
  ranger: {
    key: [["Griffon Arrow", "Arrow Scattershot", "Tempest Shot"], ["Gale Arrow", "Drill Dart", "Burst Arrow", "Snare Shot"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Snipe"], holdOn: "left click",
    buff: ["Vaizel's Authority", "Bow of Blessing", "Supporting Fire"],
    hand: ["Deadshot", "Marking Shot"],
    tags: {
      "Arrow Scattershot": "only hits in Stagger, else Tempest Shot goes",
      "Tempest Shot": "its own entry, so it cuts in between Snipes more often",
      "Burst Arrow": "needs Slow: when there's none, Snare Shot goes and applies it",
      "Snipe": "restores MP, shortens Deadshot",
    },
    steps: [
      "Buff key (all three) at the start of each burst.",
      "Deadshot on a key of its own: in the macro another skill can go first and delay it.",
      "Marking Shot standing still every 12–13 s so Precision never drops (refresh with ~2 s left).",
      "Hold the macro + Snipe for the rest.",
    ],
  },
  sorcerer: {
    key: [["Flame Arrow"], ["Bittercold Wind", "Blaze", "Firestorm", "Wish of Concentration"], ["Flame Scattershot"]],
    keyOn: "left click", delay: "10 ms",
    hold: ["Delayed Explosion", "Hellfire", "Winter's Shackles"], holdOn: "right click", holdStack: true,
    buff: ["Element Enhancement", "Fire Wall", "Cold Storm"],
    out: ["Ice Chain"],
    tags: {
      "Flame Arrow": "your basic attack, first entry",
      "Blaze": "only hits a Fire-Marked target: goes whenever it can",
      "Flame Scattershot": "only hits in Stagger",
      "Delayed Explosion": "goes out first",
      "Hellfire": "charges fully while you hold right click",
    },
    steps: [
      "Both mouse buttons held: the macro on left click, the Hellfire slot on right click (the key that lets Hellfire charge fully).",
      "Buff key a few times to open, then hold both buttons.",
      "Buff key again when Element Enhancement has ~5 s left (Fire Wall and Cold Storm end then too). They can't be cast on the move: wait for the boss to stand still.",
      "Keep MP at 25% or more, or Grace of Enhancement's +20% PvE damage switches off.",
      "Carrying them: Steel Barrier before the pull and whenever it breaks; Arctic Armor above Flame Scattershot.",
    ],
  },
  spiritmaster: {
    key: [["Jointstrike: Corrode", "Jointstrike: Curse", "Dimensional Control", "Combustion"], ["Summon: Water Spirit", "Summon: Earth Spirit", "Summon: Wind Spirit", "Summon: Fire Spirit"], ["Elemental Fusion"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Cold Shock"], holdOn: "left click",
    buff: ["Flame Blessing", "Enhance: Spirit's Benediction"],
    hand: ["Summon: Ancient Spirit", "Rapid Scattershot"],
    tags: {
      "Summon: Water Spirit": "ranged and melee spirits alternate, so none get skipped",
      "Elemental Fusion": "only in Four Elements: goes the moment it can",
      "Cold Shock": "restores MP",
    },
    steps: [
      "Hold the macro until all four spirits are out, then the buff key, and only then go for damage.",
      "Summon: Ancient Spirit once Element Unification has 5 stacks: its 30 s is the burst.",
      "Rapid Scattershot while the boss is in Stagger.",
      "Carrying them: Command: Proxy and Siphon by hand when needed.",
    ],
  },
  cleric: {
    key: [["Earth Punishment", "Divine Aura", "Condemnation", "Chain of Torment"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Earth's Retribution"], holdOn: "left click",
    hand: ["Bolt", "Healing Light", "Radiant Recovery", "Light of Regeneration", "Lightning Strike Scattershot", "Debilitating Mark", "Judgment Thunder"],
    tags: {
      "Condemnation": "main damage; needs Chain of Torment on the target",
      "Chain of Torment": "goes when Condemnation can't",
      "Earth's Retribution": "restores MP every hit",
    },
    steps: [
      "Before the pull: Light of Protection, Divine Aura, Noble Aura.",
      "Hold the macro + Earth's Retribution.",
      "Bolt by hand at full charge (in the macro its charge could hold back a heal).",
      "Heals by hand: Healing Light for one or two, Radiant Recovery for the group, Light of Regeneration before damage you can see coming.",
      "Only when needed: Debilitating Mark when the party takes heavy damage, Judgment Thunder for packs, Lightning Strike Scattershot in Stagger.",
    ],
  },
  chanter: {
    key: [["Dark Crush", "Spinning Strike", "Impactful Crush", "Incandescent Blow"]],
    keyOn: "right click", delay: "10 ms",
    hold: ["Onslaught"], holdOn: "left click",
    buff: ["Power of the Storm", "Guardian Blessing"],
    hand: ["Recuperation", "Gust Rampage", "Marchutan's Wrath"],
    tags: {
      "Dark Crush": "main damage; only open for a moment after a ranged skill",
      "Spinning Strike": "opens Dark Crush 2 s",
      "Impactful Crush": "opens Dark Crush 2 s",
      "Onslaught": "restores MP",
    },
    steps: [
      "Undefeated Mantra on its own key, kept active (it doesn't stack with a Cleric's Light of Protection).",
      "Buff key: Power of the Storm with Guardian Blessing above it (both 2 min, so one key covers both).",
      "Hold the macro + Onslaught.",
      "By hand: Recuperation to heal, Gust Rampage in Stagger, Marchutan's Wrath (also opens Dark Crush 3 s; optional now).",
      "Carrying them: Healing Touch and Ensnaring Mark by hand; Sprint Mantra on its own key, kept active.",
    ],
  },
};

const PLAY_SOURCES = [
  ["aion2-meta: class guides (macros)", "https://aion2-meta.com/guides/gladiator/"],
  ["MetaBot: Arcana cards (skill pools)", "https://metabot.gg/en/aion-2/items/chalice-of-vigor"],
];

const PASSIVE_FX = {
  gladiator: {
    "Survival Stance": "Increases the caster's HP by 200. Increases Max HP by an additional 7%, Natural HP Regen by 20, PvE Damage Tolerance by 5.5%, and PvP Damage Tolerance by 2.75%.",
    "Blood Absorption": "The caster has a 50% chance to restore 20 (+100% Attack)-24 HP and 1.6% Max HP on landing an attack. Immediately restores 26% Max HP when HP drops to 50% or less. Cooldown: 1s…",
    "Attack Preparation": "Increases the caster's PvE Damage Boost by 5.5%, PvP Damage Boost by 2.75%, Defense by 2%, and Accuracy by 100.",
    "Destructive Impulse": "Deals 146 (+33% Attack) extra damage to targets afflicted with Stagger or an Impact-type status.",
    "Survival Willpower": "Increases the caster's Status Effect Resist by 17%. Increases PvE Damage Tolerance by 12% and PvP Damage Tolerance by 6% for 5s when afflicted with Stun, Knockdown, Airborne,…",
    "Protection Armor": "Increases the caster's Block by 200 and restores 53 (+100% Attack)-64 HP on Block. Cooldown: 1s",
    "Identify Weakness": "Increases the caster's Critical Hit by 100 and Perfect Chance by 0.5%.",
    "Impact Hit": "Increases the caster's Impact-type Chance by 11.2% and Double Chance by 0.3%.",
    "Experienced Counterstrike": "Increases Front Attack Damage Boost by 0.4%. Increases PvE Damage Boost by 5.4%, PvP Damage Boost by 2.7% for 20s for the caster and party members on Block. PvE Damage Boost and…",
    "Murderous Burst": "Grants a stack of Menace for 3s when landing an attack. Removes Menace at 5 stacks and deals 539 (+78% Attack) damage to up to 4 enemies within 5m of the caster and increases the…",
  },
  templar: {
    "Enhance Health": "Increases the caster's HP by 250. Increases Max HP by an additional 7.5% and Incoming Heal by 6%.",
    "Punishing Benediction": "Increases the caster's Critical Hit by 100 and grants Punishing Benediction for 10s when landing an attack. Punishing Benediction: Has a 50% chance to deal 69 (+38% Attack) extra…",
    "Guarding Seal": "Grants a Guarding Seal that blocks damage equaling 21% of Max HP for 30s when HP is 50% or less. Cooldown: 60s",
    "Insulting Roar": "Increases Enmity Boost by 100% for the caster and increases Attack by 5.5% for 5s on landing a Front Attack. Cooldown: 5s",
    "Fury": "Increases Front Attack Damage Boost by 0.3% for the caster, and increases PvE Damage Boost by 5.5% and PvP Damage Boost by 2.75% for 20s for the caster and party members on…",
    "Warding Shield": "Increases the caster's Block by 200 and restores 53 (+100% Attack)-64 HP on Block. Cooldown: 3s",
    "Ironclad Defense": "Increases the caster's Defense by 7% and Endurance by 1%.",
    "Impact Hit": "Increases the caster's Impact-type Chance by 11.2% and Double Chance by 0.3%.",
    "Survival Willpower": "Increases the caster's Status Effect Resist by 17%. Increases PvE Damage Tolerance by 12% and PvP Damage Tolerance by 6% for 5s when afflicted with Stun, Knockdown, Airborne,…",
    "Block Pain": "Grants Block Pain for 10s when struck by an enemy. Block Pain: Increases PvE Damage Tolerance by 11% and PvP Damage Tolerance by 5.5% Cooldown: 20s",
  },
  assassin: {
    "Heightened Sixth Sense": "Increases the caster's Evasion by 200 and HP by 150. Increases Max HP by an extra 6% and restores 85 (+100% Attack)-102 HP on Evasion. Cooldown: 3s",
    "Apply Poison": "Has a 15% chance to reduce the target's Incoming Heal by 12% and inflict Poison for 10s on landing an attack. Poison deals 233 (+138% Attack) Damage over Time every 1s. Cooldown:…",
    "Assault Stance": "Increases the caster's Critical Damage Boost by 6%.",
    "Ambush Stance": "Grants Ambush Stance for 10s when using skills that rush or involve movement. Ambush Stance: Has a 50% chance to deal 152 (+39% Attack) damage on landing an attack. Cooldown: 1s",
    "Revitalization Contract": "Increases the caster's Status Effect Resist by 17%. Increases Status Effect Resist by 10% for 5s when hit while afflicted with Stun, Knockdown, Airborne, Frost, or Fear (up to 10…",
    "Exploit Weakness": "Increases caster's Critical Hit by 100. Has a 25% chance to increase Attack by 5.5% for 10s, and a 7% chance to summon up to 5 clones on landing a Critical Hit. Each clone deals…",
    "Rear Smite": "Increases the caster's Back Attack Damage Boost by 3%, PvE Damage Boost by 3%, and PvP Damage Boost by 1.5%.",
    "Impact Hit": "Increases the caster's Impact-type Chance by 11.2% and Double Chance by 0.3%.",
    "Defense Break": "Reduces the target's Defense by 12% and Status Effect Resist by 11% for 10s when landing an attack on a target afflicted with Stagger or an Impact-type status. Cooldown: 20s",
    "Determination": "Deals 228 (+37.5% Attack) damage when landing an attack on a target with 30% HP or less. Cooldown: 1s",
  },
  ranger: {
    "Vigilant Eye": "Increases the caster's Evasion by 200, Max HP by 6%, and restores 85 (+100% Attack)-102 HP on Evasion. Cooldown: 3s",
    "Wind Vigor": "Increases Max Stamina by 15. Increases Move Speed by 10% for 1s when attacked. Cooldown: 5s",
    "Hunter's Resolve": "Increases the caster's Critical Damage Boost by 6%.",
    "Rooting Eye": "Has a 50% chance to deal 143 (+35% Attack) Wind damage when landing an attack on a target afflicted with Slow or Root. Cooldown: 1s",
    "Revitalization Contract": "Increases the caster's Status Effect Resist by 17%. Increases Status Effect Resist by 10% for 5s when hit while afflicted with Stun, Knockdown, Airborne, Frost, or Fear (up to 10…",
    "Concentrated Fire": "Has a 50% chance to deal 56 (+31.2% Attack) Wind damage to a target taking Damage over Time. Cooldown: 1s",
    "Focused Eye": "Increases the caster's Accuracy by 100, PvE Damage Boost by 1%, PvP Damage Boost by 0.5%, and Double Chance by 0.2%.",
    "Unyielding Resolve": "Increases the caster's Ailment-type Resist and Impact-type Resist by 11.2%.",
    "Melee Fire": "Has a 25% chance to inflict 148 (+26.4% Attack) extra Wind damage when landing an attack. Has a 5% chance to inflict Knock Back when landing an attack on a target within 5m.…",
    "Hunter's Soul": "Has a 50% chance to deal 344 (+53.8% Attack) Wind damage on a Critical Hit. Cooldown: 1s",
  },
  sorcerer: {
    "Fire Mark": "Inflicts Fire Mark for 5s on landing a Fire attack. Fire Mark: Has a 20% chance to take 32 (+55% Attack) extra damage when taking Fire damage while afflicted with Fire Mark.…",
    "Cold Snap": "Has a 50% chance to deal 43 (+23% Attack) extra damage when landing an attack on a target afflicted with Slow. Cooldown: 1s",
    "Robe of Cold": "Increases the caster's Defense by 1% and Critical Hit Resist by 55 and inflicts Slow on an enemy when struck by them, reducing the enemy's Move Speed by 25% for 2s. Cooldown: 10s",
    "Grace of Resistance": "Increases the caster's Mental-type Resist and Impact-type Resist by 11.2%.",
    "Revitalization Contract": "Increases the caster's Status Effect Resist by 17%. Increases Status Effect Resist by 10% for 5s when hit while afflicted with Stun, Knockdown, Airborne, Frost, or Fear (up to 10…",
    "Robe of Earth": "Increases Max MP by 7% and Natural MP Regen by 5. Increases Critical Hit by 105 when MP is 50% or more.",
    "Robe of Flame": "Increases the caster's Accuracy by 100, PvE Damage Boost by 1%, PvP Damage Boost by 0.5%, and Double Chance by 0.2%.",
    "Absorb Essence": "Increases Ailment-type and Mental-type Chance by 10.7% and restores 25 MP on landing an attack. Cooldown: 1s",
    "Grace of Enhancement": "Increases the caster's PvE Damage Boost by 20% and PvP Damage Boost by 10% when the caster's MP is 25% or more, and has a 50% chance to deal 106 (+18% Attack) damage on landing…",
    "Vitality Evaporation": "Deals 261 (+39% Attack) damage on hit if the target's HP is above 70%. Cooldown: 1s",
  },
  spiritmaster: {
    "Spirit Strike": "Increases the caster's PvE Damage Boost by 6%, PvP Damage Boost by 3%, and Perfect Chance by 0.4%. Increases the Spirit's PvE Damage Boost by 6%, PvP Damage Boost by 3%, and…",
    "Spirit's Descent": "Has a 50% chance to deal 47 (+26% Attack) extra damage whenever the Spiritmaster's attacks land within 10 seconds of summoning a Spirit. Duration is increased to 30s when an…",
    "Spirit Revitalization": "Has a 11% chance to reduce the cooldown of Spirit summon skills by 1s on hit. Immediately heals the Spirit for 12% of its Max HP when its HP is 50% or less. Cooldown: 1s Spirit…",
    "Spirit Communion": "Increases the caster's Accuracy by 100. Has a 10% chance to restore the caster's and Spirit's HP by 182 (+100% Attack)-200 when landing an attack. Cooldown: 1s",
    "Element Unification": "Increases Critical Damage Boost by 1.1% for the caster and Spirit for 10s upon landing a Spirit skill attack. Stacks up to 5 times. Cooldown: 1s",
    "Spirit Protection": "Increases the caster's Defense by 2% and Spirit's Defense by 2%.",
    "Corrode": "Increases the caster's Critical Hit by 100, with a 50% chance to deal 124 (+50.5% Attack) damage on landing a Critical Hit. Cooldown: 1s",
    "Mental Focus": "Increases the caster's Mental-type Chance(s) by 11% and Double Chance by 0.3%.",
    "Consecutive Countercurrent": "Has a 50% chance to deal 97 (+23.5% Attack) extra damage on landing an attack on a target that is taking Damage over Time. Cooldown: 1s",
    "Revitalization Contract": "Increases the caster's Status Effect Resist by 17%. Increases Status Effect Resist by 10% for 5s when hit while afflicted with Stun, Knockdown, Airborne, Frost, or Fear (up to 10…",
  },
  cleric: {
    "Warm Benediction": "Increases the caster's Max HP by 6% and Max MP by 7.",
    "Empyrean Lord's Grace": "Increases the caster's Critical Hit by 100, Double Chance by 0.2% and deals 71 (+42% Attack) extra damage on landing an attack on a target. Cooldown: 1s",
    "Immortal Veil": "Increases the caster's Defense by 2% and Critical Hit Resist by 100.",
    "Prayer of Concentration": "Forms a Protective Shield which blocks 424 damage and increases the caster's Heal Boost by 20% for 30s when HP is 50% or less. Cooldown: 60s",
    "Survival Willpower": "Increases the caster's Status Effect Resist by 17%. Increases PvE Damage Tolerance by 12% and PvP Damage Tolerance by 6% for 5s when afflicted with Stun, Knockdown, Airborne,…",
    "Empyrean Lords' Benediction": "Increases the caster's Block by 200 and restores 53 (+100% Attack)-64 HP on Block. Cooldown: 3s",
    "Healing Enhancement": "Increases the caster's Heal Boost by 22,400% of Attack.",
    "Heal Block": "Has a 7% chance to reduce the target's Incoming Heal by 32% for 5s on landing an attack. Cooldown: 5s",
    "Radiant Benediction": "Restores 384 (+100% Attack)-461 HP to the caster and party members within 40m on landing an attack. Cooldown: 5s",
    "Earth's Grace": "Increases the caster's Critical Damage Boost by 10.5% and Accuracy by 100.",
  },
  chanter: {
    "Blessing of Life": "Increases the caster's HP by 150. Increases Max HP by an additional 6.5% and Heal Boost by 15,300% of Attack.",
    "Protection Circle": "Grants a Protection Circle that lasts for 5s on landing an attack. Removes the Protection Circle at 10 stacks and grants Divine Barrier to the caster and party members, which…",
    "Attack Preparation": "Increases the caster's PvE Damage Boost by 5.5%, PvP Damage Boost by 2.75%, Defense by 2%, and Accuracy by 100.",
    "Raging Spell": "Deals 146 (+34% Attack) extra damage to targets afflicted with Stagger or an Impact-type status. Cooldown: 1s",
    "Survival Willpower": "Increases the caster's Status Effect Resist by 17%. Increases PvE Damage Tolerance by 12% and PvP Damage Tolerance by 6% for 5s when afflicted with Stun, Knockdown, Airborne,…",
    "Crossguard": "Increases the caster's Block by 200 and restores 53 (+100% Attack)-58 HP on Block. Cooldown: 1s",
    "Inspiring Spell": "Increases the caster's Critical Hit by 100 and Perfect Chance by 0.5%.",
    "Impact Hit": "Increases the caster's Impact-type Chance by 11.2% and Double Chance by 0.3%.",
    "Earth's Promise": "Reduces the target's PvE Damage Tolerance by 5.4% and PvP Damage Tolerance by 2.7% for 5s each time an attack lands. [Earth's Promise]'s PvE/PvP Damage Tolerance reduction effect…",
    "Wind's Promise": "Increases the caster's Critical Damage Boost by 5.7% and has a 50% chance to deal 554 (+82.6% Attack) extra damage to the target on landing a Critical Hit. Extra Damage Cooldown:…",
  },
};
