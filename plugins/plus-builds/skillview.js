// Citizen Score: every skill of a class (skills.js, from aion2-meta's class
// guides): for each active the level to raise it to and the specialty that
// goes in at each skill level, PvE and PvP; for each passive the level top
// players carry it at. Drawn in the Builds tab's "Skills" and "Passives".

const SPEC_RULE = "Each active has 5 specialties; a slot for one opens at skill level 8, 12, 16 and 20. Skill points raise a skill to 10, its four blue Daevanion nodes to 14, and +skill gear (rings, Arcana) beyond. → 20 is the total level to aim for; \"7 pts\" is how far to train it with skill points (Lv 2–4 cost 1 point, 5–7 2, 8–10 4).";

function skillTip(s) {
  return [s.n, s.meta, s.tip].filter(Boolean).join("\n");
}

// Which picks the Skills list shows: "meta" (what top players run, or an
// estimate of it) or "mm" (min-max: each specialty valued on what it does).
let specView = "meta";
try {
  if (localStorage.getItem("cs.specView") === "mm") specView = "mm";
} catch {}

// One mode's plan for an active: "→ 20" and its slots.
function specLine(a, mode) {
  if (specView === "mm" && a[mode]?.mm) return mmLine(a, mode);
  const p = a[mode];
  const line = el("div", `spLine ${mode}${p?.est ? " est" : ""}`);
  line.append(el("span", "spMode", MODE_NAME[mode]));
  if (!p || (!p.to && !p.slots.length)) {
    line.append(el("span", "spNone", "no pick listed: leave it low"));
    return line;
  }
  // No level to raise it to: top players barely use it, so leave it low;
  // the picks are for if you slot it anyway.
  const to = el("span", "spTo", p.to ? `→ ${p.to}` : "low");
  if (!p.to) to.title = `${p.tag || "Rarely used"}: leave it low. The picks are for if you slot it anyway.`;
  line.append(to);
  const pb = ptsBadge(a, mode, "");
  if (pb) line.append(pb);
  const slots = el("span", "spSlots");
  for (const [lv, picks] of p.slots) {
    const slot = el("span", "spSlot");
    slot.append(el("span", "spLv", String(lv)));
    const names = el("span", "spNames");
    picks.forEach(([name, k, opens], i) => {
      if (i) names.append(el("span", "spOr", " or "));
      const n = el("span", "spName", name);
      n.title = `Specialty ${k} of 5 · opens at skill level ${opens}${opens !== lv ? ` · put in at ${lv}` : ""}`;
      names.append(n);
    });
    slot.append(names);
    slots.append(slot);
  }
  line.append(slots);
  if (p.est) {
    const e = el("span", "spEst", "est.");
    e.title = p.est;
    line.append(e);
  }
  return line;
}

// The min-max picks, each with why; picks the meta doesn't take are marked.
function mmLine(a, mode) {
  const p = a[mode];
  const meta = new Set(p.est ? [] : p.slots.flatMap(([, picks]) => picks.map((x) => x[1])));
  const line = el("div", `spLine ${mode} mm`);
  line.append(el("span", "spMode", MODE_NAME[mode]));
  const to = el("span", "spTo", p.to ? `→ ${p.to}` : "low");
  if (!p.to) to.title = "Top players barely use it: leave it low. The picks are for if you slot it anyway.";
  line.append(to);
  const pb = ptsBadge(a, mode, "");
  if (pb) line.append(pb);
  const slots = el("span", "spSlots");
  for (const [lv, [[name, k, opens]], why] of p.mm.slots) {
    const slot = el("span", "spSlot");
    slot.append(el("span", "spLv", String(lv)));
    const names = el("span", "spNames");
    const n = el("span", "spName", name);
    n.title = `Specialty ${k} of 5 · opens at skill level ${opens}`;
    names.append(n);
    if (!p.est && !meta.has(k)) {
      const d = el("span", "spDiff", "≠ meta");
      d.title = "Top players take something else in this slot";
      names.append(d);
    }
    if (why) names.append(el("span", "spWhy", why));
    slot.append(names);
    slots.append(slot);
  }
  line.append(slots);
  return line;
}

function specToggle(id, modes, frag) {
  const bar = el("div", "spToggle");
  for (const [v, label, tip] of [
    ["meta", "Meta", "What top players run (marked est. where none is published)"],
    ["mm", "Min-max", "Each specialty valued on what it does for this skill, ignoring what others run: PvE vs a boss (CC-immune, single target), PvP vs players (block, evasion, CC, healers)"],
  ]) {
    const b = el("button", null, label);
    b.type = "button";
    b.title = tip;
    b.setAttribute("aria-pressed", String(specView === v));
    b.addEventListener("click", () => {
      if (specView === v) return;
      specView = v;
      try {
        localStorage.setItem("cs.specView", v);
      } catch {}
      frag.replaceWith(skillPlanPart(id, modes));
    });
    bar.append(b);
  }
  return bar;
}

// Every active of class `id`, for `modes` (["pve"], ["pvp"] or both).
function skillPlanPart(id, modes) {
  const plan = SKILL_PLAN[id];
  const frag = el("div", "skillPlan");
  if (!plan) return frag;
  frag.append(el("div", "subHead", "Every skill: level and specialty per slot"));
  frag.append(specToggle(id, modes, frag));
  frag.append(el("p", "note", SPEC_RULE));
  if (specView === "mm") frag.append(el("p", "note", "Min-max: each specialty judged on what it does for this skill, not on how many players take it. PvE assumes a boss (immune to crowd control, one target, long fight); PvP assumes players (they block, evade, crowd-control and heal). ≠ meta marks a pick top players don't make: worth testing, not gospel."));
  for (const a of plan.actives) {
    const row = el("div", "spRow");
    const head = el("div", "spHead");
    const name = el("span", "spSkill", a.n);
    name.title = skillTip(a);
    head.append(name);
    if (a.pri) head.append(el("span", `spPri ${/first/i.test(a.pri) ? "first" : /second/i.test(a.pri) ? "second" : "last"}`, a.pri));
    const lvb = ptsBadge(a, "lvl", "leveling: ");
    if (lvb) head.append(lvb);
    if (a.avg !== null && a.avg !== undefined) head.append(el("span", "spAvg", `top avg Lv ${a.avg}`));
    row.append(head);
    for (const m of modes) row.append(specLine(a, m));
    const notes = [...new Set(modes.map((m) => a[m]?.note).filter(Boolean))];
    for (const n of notes) row.append(el("div", "spNote", n));
    frag.append(row);
  }
  frag.append(el("p", "note", `Levels: average of the ${plan.sample || "top global players"}. Specialties: the Korean meta picks; lines marked est. are estimates where no pick is published (hover for why). A specialty in an earlier slot can wait for a later one: hover a pick for which it is and when it opens.`));
  return frag;
}

// Every passive of class `id`: the level top players carry it at.
function passiveLevelsPart(id, mode) {
  const plan = SKILL_PLAN[id];
  const frag = el("div", "skillPlan");
  if (!plan?.passives?.length) return frag;
  frag.append(el("div", "subHead", "Every passive: level top players carry"));
  const col = mode === "pvp" ? "pvp" : "pve";
  const rows = [...plan.passives].sort((x, y) => (y[col] ?? -1) - (x[col] ?? -1) || (y.avg ?? 0) - (x.avg ?? 0));
  const t = el("table", "pvTable");
  const hr = el("tr");
  for (const h of ["Passive", "Verdict", "Train", "Top avg Lv", "PvE gear", "PvP gear"]) hr.append(el("th", null, h));
  t.append(hr);
  for (const p of rows) {
    const tr = el("tr", /look/i.test(p.verdict) ? "want" : /comes/i.test(p.verdict) ? "fine" : "skip");
    const n = el("td", "pvName", p.n);
    n.title = skillTip(p);
    const tp = p.pts?.[col];
    const train = el("td", "pvNum", tp ? `${tp[0]} pts` : "–");
    if (tp) train.title = `Train to Lv ${tp[0]} with skill points${tp[1] ? ` (+${tp[1]} from Daevanion and gear on top players)` : ""}; leveling: ${p.pts.lvl ? `${p.pts.lvl[0]} pts` : "leave it"} (MetaBot builds)`;
    tr.append(n, el("td", "pvVerdict", p.verdict), train, el("td", "pvNum", p.avg ?? "–"), el("td", "pvNum", pct(p.pve)), el("td", "pvNum", pct(p.pvp)));
    t.append(tr);
  }
  frag.append(t);
  frag.append(el("p", "note", "Passives go up with gear lines, Bell and Mirror Arcana and green Daevanion nodes; the average is what the best players reach, so it is the level to aim for."));
  return frag;
}

// --- Stigma levels (MetaBot) --------------------------------------------------
// Stigma points: none before character Lv. 23, 29 by Lv. 45. A level costs
// 1 point up to Lv. 5, 2 up to 10, 4 up to 15, 8 up to 20.
const STIGMA_POINTS_45 = 29;
const STIGMA_SLOT_LV = [22, 27, 32, 37];
const STIGMA_POINTS_AT = [[27, 5], [30, 8], [32, 10], [37, 15], [40, 19], [45, 29]];

function stigmaCost(lv) {
  let total = 0, prev = 0;
  for (const [top, each] of [[5, 1], [10, 2], [15, 4], [20, 8]]) {
    total += Math.max(0, Math.min(lv, top) - prev) * each;
    prev = top;
  }
  return total;
}

// The build's stigmas (builds.js) with the level to train each to: MetaBot's
// build card for the mode when it runs the same stigma, else the top players'
// average level (est.). Ordered into slots like MetaBot's leveling build.
function stigmaLevels(id, mode, names) {
  const st = SKILL_PLAN[id]?.stigmas;
  if (!st) return null;
  const card = st.cards[mode] || [];
  const lvl = st.cards.lvl || [];
  const rows = names.map((n) => {
    const c = card.find((x) => x[1] === n);
    const r = st.rates.find((x) => x[0] === n);
    const avg = r ? r[2] : null;
    const to = c ? c[2] : avg ? Math.max(1, Math.round(avg)) : 1;
    const lvlAt = lvl.findIndex((x) => x[1] === n);
    return { n, to, avg, share: r ? r[1] : null, est: !c, cost: stigmaCost(to), order: lvlAt < 0 ? 9 : lvlAt };
  });
  rows.sort((a, b) => a.order - b.order || b.to - a.to);
  rows.forEach((r, i) => (r.opens = STIGMA_SLOT_LV[i]));
  return rows;
}

function stigmaLevelsPart(id, mode, names) {
  const rows = stigmaLevels(id, mode, names);
  const frag = el("div", "skillPlan");
  if (!rows) return frag;
  frag.append(el("div", "subHead", `${MODE_NAME[mode]}: stigma levels`));
  const t = el("table", "pvTable stLv");
  const hr = el("tr");
  for (const [h, tip] of [
    ["Slot", "Character level the slot opens at: slot the stigma then"],
    ["Stigma"],
    ["Train to", "Level to raise it to with stigma points"],
    ["Points", "Stigma points that level costs from nothing"],
    ["Top avg", "Average level of this stigma on top players (MetaBot), bonuses included"],
  ]) {
    const th = el("th", null, h);
    if (tip) th.title = tip;
    hr.append(th);
  }
  t.append(hr);
  let total = 0;
  for (const r of rows) {
    total += r.cost;
    const tr = el("tr", "want");
    tr.append(el("td", "pvNum", `Lv ${r.opens}`));
    const n = el("td", "pvName", r.n);
    if (r.est) {
      const e = el("span", "spEst", "est.");
      e.title = "MetaBot's build runs a different stigma here: level is the top players' average for this one";
      n.append(e);
    }
    const to = el("td", "pvNum stTo", `→ ${r.to}`);
    tr.append(n, to, el("td", "pvNum", String(r.cost)), el("td", "pvNum", r.avg ?? "–"));
    t.append(tr);
  }
  frag.append(t);
  const over = total > STIGMA_POINTS_45;
  frag.append(el("p", `note${over ? " warnNote" : ""}`,
    `${total} of the ${STIGMA_POINTS_45} stigma points you have at Lv. 45${over ? `: ${total - STIGMA_POINTS_45} short, so take the last slot a level or two lower` : ""}. Points come in at Lv. ${STIGMA_POINTS_AT.map(([l, p]) => `${l}: ${p}`).join(", ")}. Each level costs 1 point up to Lv. 5, 2 up to 10, 4 up to 15 and 8 up to 20 (Lv. 20 = 75 points), so spread points: the first levels are cheap.`));
  const lv = SKILL_PLAN[id].stigmas.cards.lvl;
  if (lv?.length) {
    const p = el("p", "note");
    p.append(el("strong", null, "While leveling: "), document.createTextNode(lv.map(([at, n, l]) => `Lv ${at} ${n} → ${l}`).join(" · ")));
    frag.append(p);
  }
  return frag;
}

// "→ 7 pts": the level MetaBot's build trains a skill to with skill points.
function ptsBadge(a, key, label) {
  const v = a.pts?.[key];
  if (!v) return null;
  const b = el("span", "spPts", `${label}${v[0]} pts`);
  b.title = `Train to Lv ${v[0]} with skill points${v[1] ? `; Daevanion and gear add +${v[1]} on top players` : ""} (MetaBot ${key === "pve" ? "Endgame PvE build, from top players" : key === "pvp" ? "PvP build" : "Leveling 1–45 build"}). Skill points cap at Lv 10.`;
  return b;
}
