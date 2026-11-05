// Players: who is around you, and whoever you are fighting.
//
// - The meter names the players it sees spawn near you (allies and enemies
//   alike), and which of them you hit or were hit by (a2.on("players"),
//   permission events:players). Only names: never where they are.
// - Party members come with the game's own level, gear score and combat
//   power (the party roster). Anyone else is looked up on NCSOFT's character
//   site, by name and, when the meter knows it, home server — only when you
//   hover a name or fight someone, and remembered for 10 minutes.
// - Hovering a name shows a card: combat power, item level and gear.
// - "Fight card": the player you are fighting, the same card over the game.
//   The game sends nothing when you merely Tab-target or mouse over someone,
//   so the card follows hits (yours on them, or theirs on you).

const AROUND_MAX = 30;
const LOOKUP_TTL = 10 * 60_000;
const LOOKUP_FAIL_TTL = 60_000;
const HOVER_MS = 250;
const FIGHT_RECENT_MS = 20_000; // a hit within this long = still fighting
const FIGHT_LINGER_MS = 45_000; // the card stays this long after the last hit
const FIGHT_SIZE = { width: 270, height: 330 };

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
  };
}

function drawCard(box, d, state) {
  box.replaceChildren();
  const head = el("div", "cardHead");
  head.append(el("strong", null, d.name));
  if (d.party) head.append(el("span", "tag", "party"));
  box.append(head);
  if (d.sub) box.append(el("div", "hitSub", d.sub));
  const nums = el("div", "bigNums");
  for (const [label, v] of [["Combat Power", d.cp], ["Item Level", d.il]]) {
    const b = el("div", "bigNum");
    b.append(el("strong", null, v ? num(v) : "–"), el("span", null, label));
    nums.append(b);
  }
  box.append(nums);
  if (!d.sure) box.append(el("p", "note", "Several characters have this name; this is the one on your server."));
  if (state) box.append(el("p", state.startsWith("!") ? "err" : "note", state.replace(/^!/, "")));
  if (d.gear.length) {
    const g = el("div", "cardGear");
    for (const it of d.gear) {
      const r = el("div", `cg g-${it.grade}`);
      r.append(el("span", "cgSlot", it.slot), el("span", "cgName", it.name), el("span", "cgLvl", it.lvl));
      g.append(r);
    }
    box.append(g);
  }
}

// --- The list, on the home view --------------------------------------------------
function aroundSection() {
  const wrap = el("div", "around");
  const head = el("div", "listHead aroundHead");
  head.append(el("span", null, "Around you"));
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
  const list = around.slice(0, AROUND_MAX);
  if (!list.length) {
    wrap.append(el("p", "note", "Players the meter sees near you show here (allies and enemies), with your party's combat power and gear score. Hover a name for their gear."));
    return wrap;
  }
  const box = el("div", "hits");
  for (const p of list) {
    const row = el("button", "hit aroundRow");
    row.type = "button";
    const main = el("span", "hitMain");
    main.append(el("strong", null, p.name));
    const cls = CLASS_BY_KO[p.class] || "";
    const fighting = p.fought && now - p.fought < FIGHT_RECENT_MS;
    const bits = [cls, p.party ? "party" : "", p.fought ? `fought ${ago(p.fought)} ago` : `seen ${ago(p.seen)} ago`];
    main.append(el("span", "hitSub", bits.filter(Boolean).join(" · ")));
    row.append(main);
    if (fighting) row.classList.add("fighting");
    if (p.party?.combatPower) row.append(el("span", "hitCp", num(p.party.combatPower)));
    row.addEventListener("mouseenter", () => hoverStart(row, p));
    row.addEventListener("mouseleave", hoverEnd);
    row.addEventListener("click", async () => {
      hoverEnd();
      status(`Finding ${p.name}…`);
      try {
        const found = await lookup(p);
        if (found.ref) openChar(found.ref);
        else {
          els.q.value = p.name;
          search(p.name);
        }
      } catch (e) {
        status(`Couldn't find ${p.name}: ${e.message || e}`, "err");
      }
    });
    box.append(row);
  }
  wrap.append(box);
  return wrap;
}

// --- Hover card -----------------------------------------------------------------
const hoverCard = el("div", "hoverCard");
hoverCard.hidden = true;
let hoverTimer = 0;
let hoverFor = null;

function hoverStart(row, p) {
  clearTimeout(hoverTimer);
  hoverFor = p.name;
  hoverTimer = setTimeout(async () => {
    // Under the row, inside the list (offsets are in the page's own px,
    // whatever its text size zoom).
    const list = row.parentElement;
    if (!list) return;
    list.append(hoverCard);
    hoverCard.style.top = `${row.offsetTop + row.offsetHeight + 2}px`;
    hoverCard.hidden = false;
    drawCard(hoverCard, cardData(p, null), "Looking them up…");
    try {
      const found = await lookup(p);
      if (hoverFor !== p.name) return;
      if (!found.ref) {
        drawCard(hoverCard, cardData(p, null), found.choices?.length
          ? `${found.choices.length} characters have this name in ${REGION_NAMES[prefs.region]}. Click to pick one.`
          : `Not found in ${REGION_NAMES[prefs.region]}.`);
      } else drawCard(hoverCard, cardData(p, found));
    } catch (e) {
      if (hoverFor === p.name) drawCard(hoverCard, cardData(p, null), `!Lookup failed: ${e.message || e}`);
    }
  }, HOVER_MS);
}
function hoverEnd() {
  clearTimeout(hoverTimer);
  hoverFor = null;
  hoverCard.hidden = true;
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
  } catch (e) {
    if (popHover !== id) return;
    popCard = { ...cardData(p, null), state: "Lookup failed." };
  }
  sendPop();
}

a2.on("players", (d) => {
  around = Array.isArray(d?.players) ? d.players : [];
  // Redraw the list only on the home view, and not under a hovered row.
  const home = els.out.querySelector(".around");
  if (home && !hoverFor) home.replaceWith(aroundSection());
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
