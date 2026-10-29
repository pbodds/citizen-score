// The pet radar's window (radar.js sends it what to show). North is up and
// you are in the middle. Distance runs on a square-root scale, so the
// monsters in view (within ~65 m, the dashed ring) get most of the room and
// spawn points out to 300 m still fit. Filled dots are monsters in view,
// rings spawn points; the numbered ones are the list's rows. Unlocked, it
// follows the pointer when dragged, and a click on a row pins that row's pet
// (pinned pets come first, in gold). Locked, it says so in its header: it
// can't be clicked then, so 🔓 beside ◎ Radar in the Pet Map unlocks it.
//
// Under the pets, the rest of what is in view: small red dots are other
// monsters, purple diamonds bosses (the nearest named under the scope), grey
// squares NPCs and objects. The buttons under the legend turn each layer on
// and off, and a click on the scope zooms to the 65 m in view and back.
//
// The grip in the bottom-right corner scales the whole card (double-click it
// for the normal size). The card is always laid out at its normal size and
// scaled as one, so nothing reflows; the plugin sizes the window to match,
// and grows it if the card ever reports needing more room.
const scope = document.querySelector(".scope");
const rowsEl = document.querySelector(".rows");
const emptyEl = document.querySelector(".empty");
const stateEl = document.querySelector(".state");
const card = document.querySelector(".card");
const SIZE = 190;
const VIEW_M = 65;
// Far: spawn points out to 300 m. Near: what is in view, to scale.
const ZOOMS = {
  far: { range: 300, rings: [25, VIEW_M, 150, 300], labels: [VIEW_M, 300] },
  near: { range: 75, rings: [25, 50, VIEW_M], labels: [25, VIEW_M] },
};
const COLOR = {
  live: "#ff7a59", pin: "#ffd54a", spawn: "rgba(255, 255, 255, 0.6)", me: "#8fc2ff",
  mob: "rgba(255, 92, 92, 0.85)", boss: "#c48bff", npc: "rgba(170, 182, 200, 0.8)",
};
const KIND = { pet: 0, mob: 1, boss: 2, npc: 3 };
const scopeWrap = document.querySelector(".scopeWrap");
const sweepEl = document.querySelector(".sweep");
const bossEl = document.querySelector(".boss");
let zoom = "far";
try {
  if (localStorage.getItem("radarZoom") === "near") zoom = "near";
} catch {}
const SVG = "http://www.w3.org/2000/svg";
let locked = false;
let last = null;
let scale = 1;
const sizeTag = document.createElement("span");
sizeTag.className = "sizeTag";
document.body.append(sizeTag);
let fitSent = 0;
const SCALE_MIN = 0.6, SCALE_MAX = 2;

// No bigger than the screen is tall, or the window manager squeezes it.
function maxScale() {
  const tall = card.offsetHeight + 8, room = (window.screen?.availHeight || 0) - 40;
  return room > 0 && tall > 0 ? Math.max(1, Math.min(SCALE_MAX, room / tall)) : SCALE_MAX;
}

function applyScale(s) {
  scale = Math.min(maxScale(), Math.max(SCALE_MIN, s));
  sizeTag.textContent = `${scale.toFixed(2)}×`;
  document.body.style.setProperty("--scale", String(scale));
  if (last) drawScope(last);
  reportArea();
}

function drawScope(d) {
  // Drawn at the scaled size, so it stays sharp.
  const dpr = (window.devicePixelRatio || 1) * scale;
  const px = Math.round(SIZE * dpr);
  if (scope.width !== px) {
    scope.width = px;
    scope.height = px;
  }
  const g = scope.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, SIZE, SIZE);
  const c = SIZE / 2, r = c - 10;
  const Z = ZOOMS[zoom];
  const RANGE_M = Z.range;
  // Far is on a square-root scale, so what is in view gets the room; near
  // is to scale. Past the edge sits on the edge.
  const rad = zoom === "far" ? (m) => Math.sqrt(Math.min(m, RANGE_M) / RANGE_M) * r : (m) => (Math.min(m, RANGE_M) / RANGE_M) * r;
  const at = (dx, dy) => {
    const m = Math.hypot(dx, dy);
    if (!m) return [c, c];
    const k = rad(m) / m;
    return [c + dx * k, c + dy * k];
  };
  g.fillStyle = "rgba(255, 255, 255, 0.03)";
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 1;
  g.font = "9px system-ui, sans-serif";
  g.textAlign = "right";
  for (const m of Z.rings) {
    g.setLineDash(m === VIEW_M ? [3, 3] : []);
    g.strokeStyle = m === VIEW_M ? "rgba(143, 194, 255, 0.45)" : "rgba(255, 255, 255, 0.13)";
    g.beginPath();
    g.arc(c, c, rad(m), 0, Math.PI * 2);
    g.stroke();
    // Only a few are labelled: the rest crowd.
    if (!Z.labels.includes(m)) continue;
    g.fillStyle = "rgba(255, 255, 255, 0.45)";
    g.fillText(`${m} m`, c + rad(m) - 2, c + 9);
  }
  g.setLineDash([]);
  g.strokeStyle = "rgba(255, 255, 255, 0.09)";
  g.beginPath();
  g.moveTo(c, c - r); g.lineTo(c, c + r);
  g.moveTo(c - r, c); g.lineTo(c + r, c);
  g.stroke();
  g.fillStyle = "rgba(255, 255, 255, 0.75)";
  g.font = "bold 10px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("N", c, 5);
  g.fillStyle = "rgba(255, 255, 255, 0.35)";
  g.font = "9px system-ui, sans-serif";
  g.fillText("E", SIZE - 4, c);
  g.fillText("S", c, SIZE - 4);
  g.fillText("W", 4, c);

  // How far off where you are may be, then the unnumbered dots, then the
  // numbered ones over them.
  const me = d.me;
  if (me?.approx) {
    g.beginPath();
    g.arc(c, c, Math.max(5, rad(me.err)), 0, Math.PI * 2);
    g.fillStyle = "rgba(143, 194, 255, 0.12)";
    g.fill();
  }
  const dots = d.dots || [];
  for (const [dx, dy, live, pinned, n, kind = KIND.pet] of dots) {
    if (n) continue;
    const [x, y] = at(dx, dy);
    g.beginPath();
    if (kind === KIND.mob) {
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fillStyle = COLOR.mob;
      g.fill();
    } else if (kind === KIND.npc) {
      g.fillStyle = COLOR.npc;
      g.fillRect(x - 2, y - 2, 4, 4);
    } else if (kind === KIND.boss) {
      g.moveTo(x, y - 5.5); g.lineTo(x + 5.5, y); g.lineTo(x, y + 5.5); g.lineTo(x - 5.5, y); g.closePath();
      g.fillStyle = COLOR.boss;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = "#0a0e16";
      g.stroke();
    } else if (live) {
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fillStyle = pinned ? COLOR.pin : COLOR.live;
      g.fill();
    } else {
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.lineWidth = 1.2;
      g.strokeStyle = pinned ? COLOR.pin : COLOR.spawn;
      g.stroke();
    }
  }
  // Row 1 last, so it's on top where they overlap.
  g.font = "bold 9px system-ui, sans-serif";
  for (const [dx, dy, live, pinned, n] of [...dots].filter((t) => t[4]).sort((a, b) => b[4] - a[4])) {
    const [x, y] = at(dx, dy);
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    if (live) {
      g.fillStyle = pinned ? COLOR.pin : COLOR.live;
      g.fill();
      g.fillStyle = "#0a0e16";
    } else {
      g.fillStyle = "rgba(10, 14, 22, 0.85)";
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = pinned ? COLOR.pin : COLOR.spawn;
      g.stroke();
      g.fillStyle = pinned ? COLOR.pin : "#fff";
    }
    g.fillText(String(n), x, y + 0.5);
  }
  if (me) {
    g.beginPath();
    g.arc(c, c, 4.5, 0, Math.PI * 2);
    g.fillStyle = COLOR.me;
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = "#0a0e16";
    g.stroke();
  }
}

function showState(me) {
  if (!me) {
    stateEl.className = "state none";
    stateEl.textContent = "no position";
    stateEl.title = "Waiting for where you are: move near monsters or cast a buff";
  } else if (!me.approx) {
    stateEl.className = "state sure";
    stateEl.textContent = `● live ±${me.err} m`;
    stateEl.title = "Where you are, from a buff you just cast";
  } else {
    stateEl.className = "state guess";
    stateEl.textContent = `~ ±${me.err} m`;
    stateEl.title = "Where you are is estimated from the monsters around you. Casting any buff on yourself pins it down";
  }
}

function showLayers(d) {
  const layers = d.layers || {};
  const counts = d.counts || {};
  for (const b of document.querySelectorAll(".layers button")) {
    const k = b.dataset.layer;
    b.classList.toggle("off", layers[k] === false);
    b.querySelector("b").textContent = counts[k] ? String(counts[k]) : "";
    b.title = `${layers[k] === false ? "Show" : "Hide"} ${b.textContent.replace(/\d+/, "").trim()} on the radar`;
  }
  bossEl.hidden = !d.boss;
  if (d.boss) {
    bossEl.textContent = `◆ ${d.boss.name} · ${d.me?.approx ? "~" : ""}${d.boss.dist} m ${d.boss.dir}`;
    bossEl.title = "The nearest boss in view";
  }
}

function render(d) {
  last = d;
  if (d.scale && d.scale !== scale && !resizing) applyScale(d.scale);
  drawScope(d);
  showState(d.me);
  showLayers(d);
  sweepEl.classList.toggle("off", !d.me);
  scopeWrap.classList.toggle("near", zoom === "near");
  rowsEl.replaceChildren(...(d.rows || []).map((row) => {
    const li = document.createElement("li");
    li.className = `row${row.live ? "" : " spawn"}${row.pinned ? " pinned" : ""}`;
    li.dataset.pet = row.pet;
    li.title = `${row.live ? "In view" : "A spawn point (none in view)"}: ${row.dist} m ${row.dir}. Click to ${row.pinned ? "unpin" : "pin"} its pet`;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = String(row.n);
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = row.name;
    const dist = document.createElement("span");
    dist.className = "dist";
    const dir = document.createElement("small");
    dir.textContent = row.dir;
    dist.append(`${d.me?.approx ? "~" : ""}${row.dist} m`, dir);
    const arrow = document.createElementNS(SVG, "svg");
    arrow.setAttribute("class", "arrow");
    arrow.setAttribute("viewBox", "-10 -10 20 20");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", "M0 -9 L6 -1.5 L2 -1.5 L2 8.5 L-2 8.5 L-2 -1.5 L-6 -1.5 Z");
    path.setAttribute("transform", `rotate(${row.bearing})`);
    arrow.append(path);
    const pets = document.createElement("span");
    pets.className = "pets";
    pets.textContent = row.pets;
    li.append(n, name, dist, arrow, pets);
    return li;
  }));
  const none = !(d.rows || []).length;
  emptyEl.hidden = !none;
  emptyEl.textContent = !d.me
    ? "Waiting for your position: move near monsters or cast a buff."
    : d.mapKnown ? "Nothing you need within 300 m." : "Nothing you need in view. (This map's spawn points aren't known yet.)";
  reportArea();
  reportFit();
}

// More room than the window has (at scale 1): the plugin grows it.
function reportFit() {
  const need = Math.ceil(card.offsetHeight + 8);
  if (need <= fitSent) return;
  fitSent = need;
  a2.widget.post({ fit: need }).catch(() => {});
}

// The whole card takes the mouse while unlocked; clicks go through elsewhere.
let lastArea = "";
function reportArea() {
  if (typeof a2.widget.area !== "function") return;
  const r = card.getBoundingClientRect();
  const area = { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  const key = JSON.stringify(area);
  if (key === lastArea) return;
  lastArea = key;
  a2.widget.area(area).catch(() => {});
}

a2.on("widget", (d) => d && render(d));
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});

// A press becomes a drag once the pointer moves; a click on a row pins.
const DRAG_PX = 4;
let press = null;
let resizing = null;
const grip = document.querySelector(".grip");
grip.addEventListener("dblclick", () => {
  applyScale(1);
  a2.widget.post({ scale: 1 }).catch(() => {});
});
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked) return;
  e.preventDefault();
  if (e.target === grip) {
    resizing = { x: e.screenX, y: e.screenY, from: scale };
    document.body.classList.add("resizing");
    return;
  }
  const t = e.target instanceof Element ? e.target : null;
  press = { x: e.screenX, y: e.screenY, row: t?.closest(".row"), layer: t?.closest("[data-layer]")?.dataset.layer, scope: !!t?.closest(".scopeWrap") };
});
document.addEventListener("mousemove", (e) => {
  if (resizing) {
    // The card's width follows the pointer; height comes with it.
    const w = card.offsetWidth;
    applyScale(resizing.from + Math.max(e.screenX - resizing.x, (e.screenY - resizing.y) * (w / card.offsetHeight)) / w);
    return;
  }
  if (!press) return;
  if (!(e.buttons & 1)) {
    press = null;
    return;
  }
  if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) >= DRAG_PX) {
    press = null;
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0 && resizing) {
    resizing = null;
    document.body.classList.remove("resizing");
    a2.widget.post({ scale: Math.round(scale * 100) / 100 }).catch(() => {});
    return;
  }
  if (e.button !== 0 || !press) return;
  const { row, layer, scope: onScope } = press;
  press = null;
  if (row?.dataset.pet) a2.widget.post({ pin: row.dataset.pet }).catch(() => {});
  if (layer) a2.widget.post({ layer }).catch(() => {});
  if (onScope) {
    zoom = zoom === "far" ? "near" : "far";
    try {
      localStorage.setItem("radarZoom", zoom);
    } catch {}
    if (last) render(last);
  }
});

render({ me: null, rows: [], dots: [], mapKnown: true });
a2.ready().then(() => a2.widget.post({ ready: true })).catch(() => {});
