// Citizen Score: draws how a class plays (play.js) for the Guide and the
// Builds tab: which skills to want on each Arcana card, the passives that
// matter, and the in-game macro drawn the way the hotbar stacks it.
//
// Wants come from the top players' numbers in builds.js: actives by the share
// taking them to Lv 20+, passives by the share of gear raising them, each
// against the class's best in that mode. ★ want = 60% of the best or more,
// ✓ fine = 25% (and 10% at least), the rest skip.

const WANT = 0.6;
const FINE = 0.25;
const TIER_NAME = { want: "★ Want", fine: "✓ Fine", skip: "✗ Skip" };

// { name: { v, tier } } for every active and passive of the class.
function playRanks(id, mode) {
  const b = BUILDS[id];
  const col = mode === "pvp" ? 2 : 1;
  const out = {};
  const rank = (rows, names) => {
    const val = (n) => rows.find((r) => r[0] === n)?.[col] ?? null;
    const top = Math.max(1, ...names.map((n) => val(n) ?? 0));
    for (const n of names) {
      const v = val(n);
      const tier = v !== null && v >= top * WANT ? "want" : v !== null && v >= Math.max(10, top * FINE) ? "fine" : "skip";
      out[n] = { v, tier };
    }
  };
  const p = ARCANA_POOLS[id];
  rank(b.skillRates, [...p.Parchment, ...p.Compass]);
  rank(b.passiveRates, [...p.Bell, ...p.Mirror]);
  // A skill the build levels is never a skip.
  const order = b[mode].levelOrder.join(" · ");
  for (const n of [...p.Parchment, ...p.Compass]) {
    if (out[n].tier === "skip" && order.includes(n)) out[n].tier = "fine";
  }
  return out;
}

const byRate = (ranks) => (x, y) => (ranks[y].v ?? -1) - (ranks[x].v ?? -1);

// [slot, pool, kind] in the order the game lists the slots.
function arcanaSlots(id) {
  const p = ARCANA_POOLS[id];
  return [
    ["Chalice", [...p.Parchment, ...p.Compass, ...p.Bell, ...p.Mirror], "any skill"],
    ["Parchment", p.Parchment, "actives"],
    ["Compass", p.Compass, "actives"],
    ["Bell", p.Bell, "passives"],
    ["Mirror", p.Mirror, "passives"],
  ];
}

function skillPill(name, r, tip) {
  const s = el("span", `pill ${r.tier}`, name);
  const rate = r.v === null ? "not in the top players' data" : `${Math.round(r.v)}% of top players`;
  s.title = tip ? `${name}: ${tip}\n${rate}` : `${name}: ${rate}`;
  return s;
}

// --- Arcana: the card and the skill to want, per slot -------------------------
function playArcana(id, mode) {
  const b = BUILDS[id];
  const ranks = playRanks(id, mode);
  const picks = new Map(arcanaPick(b, mode));
  const fx = PASSIVE_FX[id] || {};
  const box = el("div", "arcWant");
  box.append(el("p", "note", "Each card carries skill lines from its slot's list, +1 level each (1 line on Common up to 4 on a Unique; enhancing adds +1 to a random line). Keep cards whose lines are ★; ✓ will do until a better one; a card of ✗ lines is feed for enhancing or extraction. Transmutation lets you choose the lines."));
  for (const [slot, pool, kind] of arcanaSlots(id)) {
    const row = el("div", "awRow");
    const head = el("div", "awHead");
    head.append(el("span", "awSlot", slot), el("span", "awKind", kind));
    const cards = picks.get(slot) || [];
    if (cards.length) head.append(el("span", "awCard", cards.map((c) => `${c.card} · ${c.stat} (${pct(c.v)})`).join("  or  ")));
    row.append(head);
    const sorted = [...pool].sort(byRate(ranks));
    // The Chalice can roll all 22: name only the best few.
    const tiers = slot === "Chalice"
      ? [["want", sorted.filter((n) => ranks[n].tier === "want").slice(0, 6)]]
      : ["want", "fine", "skip"].map((t) => [t, sorted.filter((n) => ranks[n].tier === t)]);
    for (const [tier, names] of tiers) {
      if (!names.length) continue;
      const line = el("div", `awLine ${tier}`);
      line.append(el("span", `awTier ${tier}`, TIER_NAME[tier]));
      const pills = el("span", "awPills");
      for (const n of names) pills.append(skillPill(n, ranks[n], fx[n]));
      line.append(pills);
      row.append(line);
    }
    if (slot === "Chalice") row.append(el("p", "awNote", "Any ★ from the cards below counts here. Its 22-skill list makes a perfect drop rare: craft it first if you Transmute."));
    box.append(row);
  }
  return box;
}

// --- Passives that matter -----------------------------------------------------
function playPassives(id, mode, all = false) {
  const ranks = playRanks(id, mode);
  const p = ARCANA_POOLS[id];
  const fx = PASSIVE_FX[id] || {};
  const names = [...p.Bell, ...p.Mirror].sort(byRate(ranks)).filter((n) => all || ranks[n].tier !== "skip");
  const ul = el("ul", "passives");
  for (const n of names) {
    const r = ranks[n];
    const li = el("li", r.tier);
    const top = el("div", "psTop");
    top.append(el("span", `awTier ${r.tier}`, TIER_NAME[r.tier]), el("strong", "psName", n));
    top.append(el("span", "psWhere", `${p.Bell.includes(n) ? "Bell" : "Mirror"} card · ${r.v === null ? "–" : `${Math.round(r.v)}%`} of top gear`));
    li.append(top);
    if (fx[n]) li.append(el("div", "psFx", fx[n]));
    ul.append(li);
  }
  return ul;
}

// --- The in-game macro --------------------------------------------------------
// One stacked slot, drawn as the hotbar shows it: top skill on top, the
// bottom one (fires first) last.
function macroStack(names, tags, fx) {
  const stack = el("ol", "mStack");
  [...names].reverse().forEach((n, k) => {
    const pos = names.length - k;
    const li = el("li", pos === 1 ? "first" : "");
    li.append(el("span", "mPos", String(pos)), el("span", "mName", n));
    if (pos === 1 && names.length > 1) li.append(el("span", "mFirst", "fires first"));
    if (tags?.[n]) li.append(el("span", "mTag", tags[n]));
    if (fx?.[n]) li.title = fx[n];
    stack.append(li);
  });
  return stack;
}

function macroKey(label, on, extra) {
  const h = el("div", "mHead");
  h.append(el("span", "mKey", label));
  if (on) h.append(el("span", "mOn", on));
  if (extra) h.append(el("span", "mExtra", extra));
  return h;
}

function chipRow(label, names, cls) {
  const row = el("div", `mRow ${cls || ""}`);
  row.append(el("span", "mKey", label));
  const chips = el("span", "awPills");
  for (const n of names) chips.append(el("span", "pill", n));
  row.append(chips);
  return row;
}

function playMacro(id) {
  const m = MACROS[id];
  const box = el("div", "macro");
  if (!m) return box;
  const key = el("div", "mCard");
  key.append(macroKey("Macro key", m.keyOn, `entries run top → bottom · ${m.delay}`));
  m.key.forEach((slot, i) => {
    const entry = el("div", "mEntry");
    entry.append(el("span", "mEn", `Entry ${i + 1}`), macroStack(slot, m.tags));
    key.append(entry);
  });
  box.append(key);
  if (m.hold?.length) {
    const hold = el("div", "mCard hold");
    hold.append(macroKey(m.holdStack ? "+ Hold with it (one stacked slot)" : "+ Hold with it", m.holdOn, m.holdStack ? null : "basic attack"));
    hold.append(macroStack(m.hold, m.tags));
    box.append(hold);
  }
  if (m.buff?.length) {
    const buff = el("div", "mCard buff");
    buff.append(macroKey("Buff key", "own key", "one stacked slot, pressed at each burst"));
    buff.append(macroStack(m.buff, m.tags));
    box.append(buff);
  }
  if (m.hand?.length) box.append(chipRow("By hand", m.hand));
  if (m.out?.length) box.append(chipRow("Keep out", m.out, "out"));
  const steps = el("ol", "rotation mSteps");
  for (const s of m.steps) steps.append(el("li", null, s));
  box.append(el("div", "subHead", "In a fight"), steps);
  return box;
}

// PvP has no set macro: fights are combos by hand (builds.js).
function playCombos(id) {
  const box = el("div");
  box.append(el("p", "note", "PvP has no set macro: fights are combos pressed by hand. Keep the PvE macro for bosses and switch preset (Alt + Num4/5/6)."));
  const ol = el("ol", "rotation");
  for (const s of BUILDS[id].pvp.rotation) ol.append(el("li", null, s));
  box.append(ol);
  return box;
}

// --- The class's whole play: stigmas, skill order, passives, macro -----------
function playSkills(id, mode) {
  const b = BUILDS[id];
  const box = el("div", "play");
  box.append(chipRow("Stigmas", b[mode].stigmas, "stig"));
  const order = el("ol", "order");
  for (const s of b[mode].levelOrder) order.append(el("li", null, s));
  box.append(el("div", "subHead", "Level these skills first"), order);
  box.append(el("p", "note", b[mode].skip));
  box.append(el("div", "subHead", "Passives that matter (on gear, Daevanion green nodes, Bell and Mirror cards)"), playPassives(id, mode));
  if (mode === "pvp") {
    box.append(el("div", "subHead", "Combos"), playCombos(id));
  } else {
    box.append(el("div", "subHead", "Macro setup"), playMacro(id));
  }
  return box;
}

// Everything a search could find in a play part, for the guide's search box.
function playText(kind, id) {
  const b = BUILDS[id];
  const m = MACROS[id] || {};
  const p = ARCANA_POOLS[id] || {};
  const words = kind === "arcana"
    ? [...Object.values(p).flat(), ...ARCANA_ROWS.flat(), "roll", "want"]
    : [...b.pve.stigmas, ...b.pve.levelOrder, ...(p.Bell || []), ...(p.Mirror || []), ...Object.values(PASSIVE_FX[id] || {}),
      ...(m.key || []).flat(), ...(m.hold || []), ...(m.buff || []), ...(m.hand || []), ...(m.steps || []), ...b.pvp.rotation, "macro", "rotation", "passive"];
  return words.join(" ").toLowerCase();
}

// A play part with its own class and PvE/PvP pickers. pick: { cls, mode };
// onPick(cls, mode) when the player changes either.
function playPart(kind, pick, onPick) {
  const box = el("div", "playPart");
  box.dataset.kind = kind;
  const bar = el("div", "playBar");
  const chips = el("div", "chips playChips");
  for (const id of Object.keys(BUILDS)) {
    const b = el("button", null, BUILDS[id].name);
    b.type = "button";
    b.setAttribute("aria-pressed", String(id === pick.cls));
    b.addEventListener("click", () => onPick(id, pick.mode));
    chips.append(b);
  }
  const modes = el("div", "chips playModes");
  for (const m of ["pve", "pvp"]) {
    const b = el("button", null, MODE_NAME[m]);
    b.type = "button";
    b.dataset.mode = m;
    b.setAttribute("aria-pressed", String(m === pick.mode));
    b.addEventListener("click", () => onPick(pick.cls, m));
    modes.append(b);
  }
  bar.append(chips, modes);
  box.append(bar, kind === "arcana" ? playArcana(pick.cls, pick.mode) : playSkills(pick.cls, pick.mode));
  return box;
}
