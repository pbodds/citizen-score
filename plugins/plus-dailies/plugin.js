// Dailies: what is left to do before the game's resets, per character.
//
// - The resets are AION 2's: dailies and weeklies at one moment, 07:00 UTC
//   (16:00 KST) on Global servers, weeklies on Wednesday's. Korea and Taiwan
//   reset at 05:00 local (shugo.gg/timers, 2026-10-26).
// - The list of tasks is shared; the counts are each character's, cleared
//   when a reset has passed since they were last touched.
// - Odyle Energy comes from the game itself (a2.on("odyle"), permission
//   events:counters): the meter reads it at login and as it changes.
// - A reminder before a reset finds tasks undone: a banner in a corner of
//   another monitor (it never takes focus or the mouse) and, if asked, a
//   desktop notification.
// - The checklist can sit over the game as a widget ("list").

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
// The daily reset's hour in UTC, and the weekday (UTC) of the weekly one.
const REGIONS = {
  global: { hour: 7, weekday: 3 }, // Wednesday 07:00 UTC
  kr: { hour: 20, weekday: 2 }, // Wednesday 05:00 KST = Tuesday 20:00 UTC
  tw: { hour: 21, weekday: 2 }, // Wednesday 05:00 Taipei = Tuesday 21:00 UTC
};
const WEEKLY_REMIND_FACTOR = 6; // weeklies are reminded this many times earlier
const BANNER_MS = 20_000;
const BANNER_SIZE = { width: 380, height: 150 };
const LIST_SIZE = { width: 240, height: 320 };

// What the plugin starts with. The game's own limits vary by content and
// change with patches, so each is 1 until set (Edit).
const DEFAULT_TASKS = [
  { id: "d-quests", name: "Daily quests", period: "daily", max: 1 },
  { id: "d-dungeons", name: "Dungeon entries", period: "daily", max: 1 },
  { id: "d-shugo", name: "Shugo Festival", period: "daily", max: 1 },
  { id: "d-transcend", name: "Transcendence", period: "daily", max: 1 },
  { id: "d-arena", name: "Arena", period: "daily", max: 1 },
  { id: "d-attendance", name: "Attendance", period: "daily", max: 1 },
  { id: "w-quests", name: "Weekly quests", period: "weekly", max: 1 },
  { id: "w-raids", name: "Raids", period: "weekly", max: 1 },
  { id: "w-battlefield", name: "Battlefield", period: "weekly", max: 1 },
  { id: "w-siege", name: "Artifact Siege", period: "weekly", max: 1 },
  { id: "w-abyss", name: "Abyss Points cap", period: "weekly", max: 1 },
  { id: "w-pass", name: "Daeva Pass missions", period: "weekly", max: 1 },
];

const els = {
  resets: document.querySelector(".resets"),
  chars: document.querySelector(".chars"),
  odyle: document.querySelector(".odyle"),
  editBtn: document.querySelector(".editBtn"),
  optsBtn: document.querySelector(".optsBtn"),
  options: document.querySelector(".options"),
  region: document.querySelector(".region"),
  remind: document.querySelector(".remind"),
  desktop: document.querySelector(".desktop"),
  overlay: document.querySelector(".overlay"),
  lockOverlay: document.querySelector(".lockOverlay"),
  testBtn: document.querySelector(".testBtn"),
  lists: [...document.querySelectorAll(".tasks")],
  counts: { daily: document.querySelector(".count.daily"), weekly: document.querySelector(".count.weekly") },
  adds: [...document.querySelectorAll(".addBtn")],
  defaultsBtn: document.querySelector(".defaultsBtn"),
};

let tasks = DEFAULT_TASKS.map((t) => ({ ...t }));
// Per character: { name, server, done: { taskId: n }, daily, weekly (the
// resets their counts belong to, ms), odyle: { basic, charged, at } }.
let chars = {};
let prefs = { region: "global", remind: 60, desktop: false, overlay: false, reminded: {} };
let current = null; // the character logged in
let shown = null; // the character the panel shows
let editing = false;

const save = (k, v) => a2.storage.set(k, v).catch(() => {});
const saveAll = () => {
  save("tasks", tasks);
  save("chars", chars);
  save("prefs", prefs);
};

// ===== Resets =====

const region = () => REGIONS[prefs.region] || REGIONS.global;
function lastDaily(now = Date.now()) {
  const h = region().hour * HOUR_MS;
  return Math.floor((now - h) / DAY_MS) * DAY_MS + h;
}
function lastWeekly(now = Date.now()) {
  const d = lastDaily(now);
  const back = (new Date(d).getUTCDay() - region().weekday + 7) % 7;
  return d - back * DAY_MS;
}
const nextReset = (period, now = Date.now()) => (period === "weekly" ? lastWeekly(now) + 7 * DAY_MS : lastDaily(now) + DAY_MS);

function span(ms) {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(min).padStart(2, "0")}m` : `${min}m`;
}

// A character's counts, cleared of any reset that passed since.
function charOf(k) {
  const c = chars[k];
  if (!c) return null;
  const daily = lastDaily(), weekly = lastWeekly();
  let changed = false;
  if ((c.daily || 0) < daily) {
    for (const t of tasks) if (t.period === "daily") delete c.done[t.id];
    c.daily = daily;
    changed = true;
  }
  if ((c.weekly || 0) < weekly) {
    for (const t of tasks) if (t.period === "weekly") delete c.done[t.id];
    c.weekly = weekly;
    changed = true;
  }
  if (changed) save("chars", chars);
  return c;
}

function tally(c, period) {
  const list = tasks.filter((t) => t.period === period);
  const done = list.filter((t) => (c?.done[t.id] || 0) >= t.max).length;
  return { done, total: list.length, left: list.filter((t) => (c?.done[t.id] || 0) < t.max) };
}

// ===== Rendering =====

function renderResets() {
  const now = Date.now();
  const d = nextReset("daily", now) - now, w = nextReset("weekly", now) - now;
  const soon = (ms) => (ms < 2 * HOUR_MS ? ' class="soon"' : "");
  els.resets.innerHTML = `Daily reset <strong${soon(d)}>${span(d)}</strong> · Weekly <strong${soon(w)}>${span(w)}</strong>`;
}

function renderChars() {
  const keys = Object.keys(chars).sort((a, b) => (chars[b].seenAt || 0) - (chars[a].seenAt || 0));
  els.chars.replaceChildren(...keys.map((k) => {
    const c = charOf(k);
    const t = tally(c, "daily"), w = tally(c, "weekly");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.key = k;
    b.setAttribute("aria-pressed", String(k === shown));
    b.title = `${c.name}: dailies ${t.done}/${t.total}, weeklies ${w.done}/${w.total}${k === current ? " (playing)" : ""}`;
    b.textContent = c.name + (k === current ? " ●" : "");
    const n = document.createElement("span");
    n.className = "n" + (t.left.length ? " left" : "");
    n.textContent = `${t.done}/${t.total}`;
    b.append(n);
    return b;
  }));
}

function renderOdyle() {
  const o = chars[shown]?.odyle;
  els.odyle.hidden = !o;
  if (!o) return;
  els.odyle.replaceChildren();
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Odyle Energy";
  const val = document.createElement("span");
  val.className = "val";
  val.textContent = `${o.basic} basic · ${o.charged} charged`;
  const auto = document.createElement("span");
  auto.className = "auto";
  auto.textContent = `from the game, ${span(Date.now() - o.at)} ago`;
  els.odyle.append(label, val, auto);
}

function renderTasks() {
  const c = shown ? charOf(shown) : null;
  document.body.classList.toggle("editing", editing);
  for (const list of els.lists) {
    const period = list.dataset.period;
    list.replaceChildren(...tasks.filter((t) => t.period === period).map((t) => {
      const li = document.createElement("li");
      const n = c?.done[t.id] || 0;
      li.className = `task${n >= t.max ? " done" : n > 0 ? " part" : ""}`;
      li.dataset.id = t.id;
      if (editing) {
        const name = document.createElement("input");
        name.className = "nameEdit";
        name.value = t.name;
        name.maxLength = 40;
        name.addEventListener("change", () => { t.name = name.value.trim() || t.name; save("tasks", tasks); sendOverlay(); });
        const max = document.createElement("input");
        max.className = "maxEdit";
        max.type = "number";
        max.min = "1";
        max.max = "99";
        max.value = String(t.max);
        max.title = "How many times a reset";
        max.addEventListener("change", () => { t.max = Math.min(99, Math.max(1, Number(max.value) || 1)); save("tasks", tasks); render(); });
        const del = document.createElement("button");
        del.type = "button";
        del.className = "del";
        del.textContent = "×";
        del.title = "Remove";
        del.addEventListener("click", () => { tasks = tasks.filter((x) => x !== t); save("tasks", tasks); render(); });
        li.append(name, max, del);
        return li;
      }
      const box = document.createElement("span");
      box.className = "box";
      box.textContent = n >= t.max ? "✓" : "";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = t.name;
      li.append(box, name);
      if (t.max > 1) {
        const tl = document.createElement("span");
        tl.className = "tally";
        tl.textContent = `${n}/${t.max}`;
        li.append(tl);
      }
      return li;
    }));
    const t = tally(c, period);
    els.counts[period].textContent = c ? `${t.done}/${t.total}` : "";
  }
}

function render() {
  renderResets();
  renderChars();
  renderOdyle();
  renderTasks();
  sendOverlay();
}

// ===== Counting =====

function bump(id, by) {
  const c = shown && charOf(shown);
  const t = tasks.find((x) => x.id === id);
  if (!c || !t) return;
  const n = (c.done[id] || 0) + by;
  // A click on a finished task starts it over.
  c.done[id] = n > t.max ? 0 : Math.max(0, n);
  save("chars", chars);
  render();
}

for (const list of els.lists) {
  list.addEventListener("click", (e) => {
    if (editing) return;
    const li = e.target.closest(".task");
    if (li) bump(li.dataset.id, 1);
  });
  list.addEventListener("contextmenu", (e) => {
    if (editing) return;
    const li = e.target.closest(".task");
    if (!li) return;
    e.preventDefault();
    bump(li.dataset.id, -1);
  });
}
els.chars.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-key]");
  if (!b) return;
  shown = b.dataset.key;
  render();
});

// ===== Editing and options =====

els.editBtn.addEventListener("click", () => {
  editing = !editing;
  els.editBtn.setAttribute("aria-pressed", String(editing));
  render();
});
for (const b of els.adds) {
  b.addEventListener("click", () => {
    const period = b.dataset.period;
    tasks.push({ id: `${period[0]}-${Date.now().toString(36)}`, name: period === "daily" ? "New daily" : "New weekly", period, max: 1 });
    save("tasks", tasks);
    render();
    els.lists.find((l) => l.dataset.period === period)?.querySelector(".task:last-child .nameEdit")?.select();
  });
}
els.defaultsBtn.addEventListener("click", () => {
  tasks = DEFAULT_TASKS.map((t) => ({ ...t }));
  save("tasks", tasks);
  render();
});
els.optsBtn.addEventListener("click", () => {
  els.options.hidden = !els.options.hidden;
  els.optsBtn.setAttribute("aria-pressed", String(!els.options.hidden));
});
els.region.addEventListener("change", () => {
  prefs.region = els.region.value;
  save("prefs", prefs);
  render();
});
els.remind.addEventListener("change", () => {
  prefs.remind = Number(els.remind.value) || 0;
  save("prefs", prefs);
});
els.desktop.addEventListener("change", () => {
  prefs.desktop = els.desktop.checked;
  save("prefs", prefs);
});
els.overlay.addEventListener("change", () => {
  prefs.overlay = els.overlay.checked;
  save("prefs", prefs);
  showOverlay();
});
els.lockOverlay.addEventListener("change", () => {
  a2.widgets.lock(els.lockOverlay.checked).catch(() => {});
});
els.testBtn.addEventListener("click", () => remind(true));

// ===== The overlay and the reminder =====

function overlayData() {
  const c = shown && charOf(shown);
  const now = Date.now();
  const part = (period) => ({
    resetIn: span(nextReset(period, now) - now),
    left: c ? tally(c, period).left.map((t) => (t.max > 1 ? `${t.name} ${c.done[t.id] || 0}/${t.max}` : t.name)) : [],
  });
  return { list: true, name: c?.name || "", daily: part("daily"), weekly: part("weekly"), odyle: c?.odyle ? `${c.odyle.basic} · ${c.odyle.charged}` : "" };
}
let overlaySent = "";
function sendOverlay() {
  if (!prefs.overlay) return;
  const data = overlayData();
  const key = JSON.stringify(data);
  if (key === overlaySent) return;
  overlaySent = key;
  a2.widgets.send("list", data).catch(() => {});
}
function showOverlay() {
  overlaySent = "";
  if (prefs.overlay) a2.widgets.open("list", LIST_SIZE).then(sendOverlay).catch(() => {});
  else a2.widgets.close("list").catch(() => {});
}

let bannerTimer = 0;
function banner(lines) {
  a2.widgets.open("banner", BANNER_SIZE)
    .then(() => a2.widgets.send("banner", { banner: true, lines }))
    .catch(() => a2.notify(lines.join(" ")).catch(() => {}));
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => a2.widgets.close("banner").catch(() => {}), BANNER_MS);
  if (prefs.desktop) a2.desktopNotify("AION 2 · Dailies", lines.join("\n")).catch(() => {});
}

// Once per reset and period: the characters with something left, when the
// reset is closer than the lead the player picked.
function remind(test = false) {
  if (!prefs.remind && !test) return;
  const now = Date.now();
  const lines = [];
  for (const period of ["daily", "weekly"]) {
    const at = nextReset(period, now);
    const lead = prefs.remind * 60_000 * (period === "weekly" ? WEEKLY_REMIND_FACTOR : 1);
    const tag = `${period}-${at}`;
    if (!test && (at - now > lead || prefs.reminded[tag])) continue;
    for (const k of Object.keys(chars)) {
      const c = charOf(k);
      const { left } = tally(c, period);
      if (!left.length) continue;
      const names = left.slice(0, 3).map((t) => t.name).join(", ") + (left.length > 3 ? `, +${left.length - 3}` : "");
      lines.push(`${period === "daily" ? "Daily" : "Weekly"} reset in ${span(at - now)}: ${c.name} has ${left.length} left (${names})`);
    }
    if (!test) prefs.reminded[tag] = true;
  }
  if (!test) {
    // Only the marks of resets still ahead.
    for (const tag of Object.keys(prefs.reminded)) if (Number(tag.split("-")[1]) < now) delete prefs.reminded[tag];
    save("prefs", prefs);
  }
  if (lines.length) banner(lines.slice(0, 4));
  else if (test) banner(["Nothing left before the next resets. 🎉"]);
}

// ===== Events =====

const keyOf = (c) => (c?.name ? `${Number(c.serverId) || 0}-${c.name}` : null);

a2.on("character", (c) => {
  const k = keyOf(c);
  if (!k) return;
  chars[k] = chars[k] || { name: c.name, server: Number(c.serverId) || 0, done: {}, daily: lastDaily(), weekly: lastWeekly() };
  chars[k].name = c.name;
  chars[k].seenAt = Date.now();
  current = k;
  shown = k;
  save("chars", chars);
  render();
});

a2.on("odyle", ({ basic, charged, owner }) => {
  // The owner the meter named, else whoever is playing.
  const k = Object.keys(chars).find((x) => chars[x].name === owner && (!current || chars[x].server === chars[current]?.server)) || current;
  if (!k || !chars[k]) return;
  chars[k].odyle = { basic, charged, at: Date.now() };
  save("chars", chars);
  render();
});

a2.on("widget-message", ({ name, data }) => {
  if (name === "list" && data?.ready) {
    overlaySent = "";
    sendOverlay();
  }
});

a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  const savedTasks = await a2.storage.get("tasks").catch(() => null);
  if (Array.isArray(savedTasks)) tasks = savedTasks;
  chars = (await a2.storage.get("chars").catch(() => null)) || {};
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  prefs.reminded = prefs.reminded || {};
  els.region.value = prefs.region;
  els.remind.value = String(prefs.remind);
  els.desktop.checked = !!prefs.desktop;
  els.overlay.checked = !!prefs.overlay;
  els.lockOverlay.checked = !!(await a2.widgets.locked().catch(() => false));
  if (!shown) shown = Object.keys(chars).sort((a, b) => (chars[b].seenAt || 0) - (chars[a].seenAt || 0))[0] || null;
  await a2.ready();
  render();
  showOverlay();
  setInterval(() => {
    render();
    remind();
  }, 30_000);
})();
