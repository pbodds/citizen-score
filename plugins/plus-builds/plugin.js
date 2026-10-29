// Builds: a PvE and a PvP build for each class (builds.js), docked in the
// meter, opening on the class the meter sees you play.
//
// - The panel shows one build at a time, its parts folding.
// - Daevanion has a points slider (planner.js); the points are kept, and the
//   pop-out's slider moves with the panel's.
// - Guide (guide.js, guideview.js) is the game guide: every system, folding
//   chapters and a search over all of them. The pop-out shows it too.
// - At the top of the Guide, "Your character" (advisor.js) reads the character
//   you play from NCSOFT's site and lists what to change. Its last reading is
//   kept (storage "me"), refreshed when you switch character or press Refresh.
// - Pop out opens the "pop" widget: its own window, the whole build with every
//   pick rate charted, PvE and PvP side by side if asked. It is drawn from the
//   same files; this page only tells it which class and build, and sizes it.

const POP_SIZES = [
  { width: 640, height: 560 },
  { width: 820, height: 720 },
  { width: 1040, height: 860 },
  { width: 1280, height: 980 },
];
const CLASS_ORDER = ["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"];

const els = {
  tabs: [...document.querySelectorAll(".tabs button")],
  modes: [...document.querySelectorAll(".modes button")],
  pop: document.querySelector(".popBtn"),
  classes: document.querySelector(".classes"),
  build: document.querySelector(".build"),
  guide: document.querySelector(".guide"),
  scale: document.querySelector(".scaleSelect"),
};

// pts/ar/az: the planner's shared, Ariel and Azphel points (null: the top players').
// tab: "build" or "guide"; gOpen: the guide's open chapters; gq: its search.
// scale: the Text size, here and in the pop-out.
let prefs = { cls: null, mode: "pve", popMode: "compare", popSize: 1, popOpen: false, open: {}, pts: null, ar: null, az: null, tab: "build", gOpen: {}, gq: "", scale: 1 };
let detected = null;
let view = null;
const save = () => a2.storage.set("prefs", prefs).catch(() => {});
// A slider fires on every step: save once it settles.
let saveTimer = 0;
const saveSoon = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
};
const classId = () => (BUILDS[prefs.cls] ? prefs.cls : detected || "gladiator");

function popSize() {
  const s = POP_SIZES[Math.max(0, Math.min(POP_SIZES.length - 1, prefs.popSize))];
  // Never taller than the screen it opens on.
  const maxH = Math.max(400, (window.screen?.availHeight || 1080) - 40);
  return { width: s.width, height: Math.min(s.height, maxH) };
}

// Text size: the whole page scaled, spacing and controls with the text. The
// page is laid out at its width divided by the zoom, so the zoom is held down
// to keep that at MIN_LAYOUT_PX or more (the meter's own scale comes on top),
// and checked again whenever the panel is resized. The pop-out gets the same
// size (TEXT_SCALES is shared with widget.js through sendPop).
const TEXT_SCALES = [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN_LAYOUT_PX = 300;
const MIN_ZOOM = 0.75;
const textScale = () => (TEXT_SCALES.includes(Number(prefs.scale)) ? Number(prefs.scale) : 1);
function applyScale() {
  const fit = window.innerWidth > 0 ? window.innerWidth / MIN_LAYOUT_PX : Infinity;
  const value = String(Math.round(Math.max(MIN_ZOOM, Math.min(textScale(), fit)) * 1000) / 1000);
  if (document.documentElement.style.zoom !== value) document.documentElement.style.zoom = value;
}
window.addEventListener("resize", () => applyScale());
function renderScale() {
  els.scale.replaceChildren(...TEXT_SCALES.map((x) => {
    const o = document.createElement("option");
    o.value = String(x);
    o.textContent = `${Math.round(x * 100)}%`;
    return o;
  }));
  els.scale.value = String(textScale());
}
function setScale(x) {
  if (!TEXT_SCALES.includes(x)) return;
  prefs.scale = x;
  save();
  els.scale.value = String(x);
  applyScale();
  sendPop();
}
els.scale.addEventListener("change", () => setScale(Number(els.scale.value)));

function renderChips(root, current) {
  root.replaceChildren(...CLASS_ORDER.map((id) => {
    const b = el("button", null, BUILDS[id].name);
    b.type = "button";
    b.dataset.cls = id;
    b.setAttribute("aria-pressed", String(id === current));
    b.title = `${BUILDS[id].name}: ${BUILDS[id].role}${id === detected ? " (you)" : ""}`;
    if (id === detected) b.classList.add("you");
    return b;
  }));
}

let guideDrawn = false;
let guideView = null;
// The advisor: whom to read (meChar from the meter), the last reading, progress.
let meChar = null;
let meState = null;
let meBusy = "";
let meError = "";
let odyle = null;
const ME_STALE_MS = 30 * 60 * 1000;

function drawMe() {
  if (!guideView) return;
  guideView.me.hidden = false;
  renderAdvisor(guideView.me, {
    state: meState, me: meChar, odyle, busy: meBusy, error: meError, region: prefs.meRef?.region,
    onRefresh: () => readMe(true),
    onLookup: (name, region) => {
      prefs.meRef = null;
      save();
      readMe(true, { name, serverId: null }, region);
    },
    onChapter: (id) => guideView.open(id),
    onUsePoints: (spent) => {
      prefs.pts = ["Nezekan", "Zikel", "Vaizel", "Triniel"].reduce((s, k) => s + (spent[k] || 0), 0);
      if (spent.Ariel !== undefined) prefs.ar = spent.Ariel;
      if (spent.Azphel !== undefined) prefs.az = spent.Azphel;
      if (meState?.info?.profile) prefs.cls = classOf(meState.info) || prefs.cls;
      save();
      prefs.tab = "build";
      prefs.open.Daevanion = true;
      render();
      sendPop();
    },
  });
}

// Read the character (the meter's, or one looked up by name) and redraw.
async function readMe(force = false, who = null, region = null) {
  const target = who || meChar;
  if (!target?.name || meBusy) return;
  const same = meState && meState.info?.profile?.characterName === target.name;
  if (!force && same && Date.now() - meState.at < ME_STALE_MS) return drawMe();
  meError = "";
  meBusy = "finding";
  drawMe();
  try {
    let ref = prefs.meRef && prefs.meRef.name === target.name ? prefs.meRef : null;
    if (!ref) ref = await advFind(target, region || prefs.meRef?.region || "nae");
    if (!ref) throw new Error(`${target.name} isn't on NCSOFT's character site in any Global region yet`);
    prefs.meRef = ref;
    save();
    meState = await advLoad(ref, (step) => {
      meBusy = step;
      drawMe();
    });
    a2.storage.set("me", meState).catch(() => {});
  } catch (e) {
    meError = `Couldn't read the character: ${e.message || e}`;
  }
  meBusy = "";
  drawMe();
}
function render() {
  const guide = prefs.tab === "guide";
  for (const b of els.tabs) b.setAttribute("aria-selected", String(b.dataset.tab === prefs.tab));
  document.body.classList.toggle("onGuide", guide);
  els.guide.hidden = !guide;
  els.build.hidden = guide;
  els.classes.hidden = guide;
  if (guide) {
    // Drawn once: re-drawing would lose the search box's focus and scroll.
    if (!guideDrawn) {
      guideDrawn = true;
      guideView = renderGuide(els.guide, {
        open: prefs.gOpen,
        query: prefs.gq,
        onToggle: (ch, on) => {
          prefs.gOpen[ch] = on;
          save();
        },
        onQuery: (q) => {
          prefs.gq = q;
          saveSoon();
        },
        cls: classId(),
        mode: prefs.mode,
        // Class play and Arcana wants in the guide follow the Builds tab's class.
        onPick: (cls, mode) => {
          prefs.cls = cls;
          prefs.mode = mode;
          if (prefs.popMode !== "compare") prefs.popMode = mode;
          save();
          sendPop();
        },
      });
      drawMe();
      readMe();
    }
    guideView.setPick(classId(), prefs.mode);
    els.pop.setAttribute("aria-pressed", String(!!prefs.popOpen));
    return;
  }
  const id = classId();
  for (const b of els.modes) b.setAttribute("aria-pressed", String(b.dataset.mode === prefs.mode));
  els.pop.setAttribute("aria-pressed", String(!!prefs.popOpen));
  renderChips(els.classes, id);
  view = renderBuild(els.build, id, prefs.mode, {
    open: prefs.open,
    onToggle: (title, on) => {
      prefs.open[title] = on;
      save();
    },
    pts: prefs.pts,
    ar: prefs.ar,
    az: prefs.az,
    onPts: ({ pts, ar, az }) => {
      prefs.ar = ar;
      prefs.pts = pts;
      prefs.az = az;
      saveSoon();
      sendPop();
    },
  });
}

// --- The pop-out -------------------------------------------------------------
function sendPop() {
  if (!prefs.popOpen) return;
  a2.widgets.send("pop", { tab: prefs.tab, cls: classId(), mode: prefs.popMode, detected, size: prefs.popSize, sizes: POP_SIZES.length, pts: prefs.pts, ar: prefs.ar, az: prefs.az, scale: textScale() }).catch(() => {});
}
function openPop() {
  prefs.popOpen = true;
  save();
  render();
  a2.widgets.open("pop", popSize()).then(sendPop).catch((e) => {
    console.error("Builds: pop-out", e);
    prefs.popOpen = false;
    render();
  });
}
function closePop() {
  prefs.popOpen = false;
  save();
  render();
  a2.widgets.close("pop").catch(() => {});
}

a2.on("widget-message", ({ name, data }) => {
  if (name !== "pop" || !data) return;
  if (data.ready) return sendPop();
  if (data.close) return closePop();
  if (data.tab === "build" || data.tab === "guide") {
    prefs.tab = data.tab;
    save();
    render();
  }
  if (data.cls && BUILDS[data.cls]) {
    prefs.cls = data.cls;
    save();
    render();
    sendPop();
  }
  if (data.mode && ["pve", "pvp", "compare"].includes(data.mode)) {
    prefs.popMode = data.mode;
    save();
    sendPop();
  }
  // The pop-out's slider: the panel's follows.
  if ("pts" in data || "az" in data || "ar" in data) {
    if (typeof data.ar === "number") prefs.ar = data.ar;
    if (typeof data.pts === "number") prefs.pts = data.pts;
    if (typeof data.az === "number") prefs.az = data.az;
    saveSoon();
    view?.setPts({ pts: prefs.pts, ar: prefs.ar, az: prefs.az });
  }
  // The pop-out's A− / A+.
  if (typeof data.text === "number") {
    const i = TEXT_SCALES.indexOf(textScale()) + Math.sign(data.text);
    if (i >= 0 && i < TEXT_SCALES.length) setScale(TEXT_SCALES[i]);
  }
  if (typeof data.step === "number") {
    const next = Math.max(0, Math.min(POP_SIZES.length - 1, prefs.popSize + Math.sign(data.step)));
    if (next !== prefs.popSize) {
      prefs.popSize = next;
      save();
      a2.widgets.open("pop", popSize()).then(sendPop).catch(() => {});
    }
  }
  // Links in the pop-out open from here (widgets can't open them).
  if (typeof data.url === "string" && (BUILD_SOURCES.some(([, u]) => u === data.url) || GUIDE_URLS.has(data.url))) {
    const a = document.createElement("a");
    a.href = data.url;
    document.body.append(a);
    a.click();
    a.remove();
  }
});

// --- Panel input -------------------------------------------------------------
document.addEventListener("click", (e) => {
  const t = e.target instanceof Element ? e.target : null;
  const tab = t?.closest(".tabs button")?.dataset.tab;
  if (tab) {
    prefs.tab = tab;
    save();
    render();
    sendPop();
    return;
  }
  const mode = t?.closest(".modes button")?.dataset.mode;
  if (mode) {
    prefs.mode = mode;
    // The pop-out follows a change here, unless it is showing both.
    if (prefs.popMode !== "compare") prefs.popMode = mode;
    save();
    render();
    sendPop();
    return;
  }
  const cls = t?.closest(".classes button")?.dataset.cls;
  if (cls) {
    prefs.cls = cls;
    save();
    render();
    sendPop();
    return;
  }
  if (t?.closest(".popBtn")) (prefs.popOpen ? closePop() : openPop());
});

a2.on("character", (c) => {
  const id = BUILD_BY_KO[c?.class];
  if (!id || id === detected) return;
  detected = id;
  // A class picked by hand stays picked; otherwise follow the character.
  if (!prefs.cls) {
    render();
    sendPop();
  } else {
    renderChips(els.classes, classId());
  }
});

a2.on("character", (c) => {
  if (!c?.name || c.name === meChar?.name) return;
  meChar = { name: c.name, serverId: Number(c.serverId) || null };
  if (prefs.tab === "guide") readMe();
  else drawMe();
});
// Odyle Energy, live from the meter.
a2.on("odyle", (o) => {
  odyle = o || null;
  drawMe();
});

a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  prefs.open = prefs.open || {};
  prefs.gOpen = prefs.gOpen || {};
  meState = await a2.storage.get("me").catch(() => null);
  if (!meState?.info?.profile || !meState.ref) meState = null;
  renderScale();
  applyScale();
  await a2.ready();
  render();
  if (prefs.popOpen) openPop();
})();
