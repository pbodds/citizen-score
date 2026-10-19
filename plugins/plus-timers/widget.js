// A pinned timer's icon (pins.js sends it what to show every second). It
// follows the pointer when dragged, unless the pins are locked; a
// double-click opens the plugin's window.
const pin = document.querySelector(".pin");
const glyph = document.querySelector(".glyph");
const art = document.querySelector(".art");
const time = document.querySelector(".time");
const nameEl = document.querySelector(".name");
const sub = document.querySelector(".sub");
const badge = document.querySelector(".badge");
let locked = false;

// Two letters for the badge: the first of each of the first two words, or the
// first two of one word ("Shugo" is "SH", "Kaira the Watcher" is "KT").
const initials = (name) => {
  const words = String(name || "").split(/[\s·:,-]+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? [...words[0]][0] + [...words[words.length - 1]][0] : [...words[0]].slice(0, 2).join("");
  return letters.toUpperCase();
};

a2.on("widget", (d) => {
  if (!d) return;
  // The game's icon when there is one, else the initials. Taken from the
  // page's own copy (widget.html), which on Linux is the image itself.
  const src = (d.icon && document.querySelector(`.icons img[data-icon="${d.icon}"]`)?.getAttribute("src")) || "";
  if (art.getAttribute("src") !== src) {
    if (src) art.setAttribute("src", src);
    else art.removeAttribute("src");
  }
  art.hidden = !src;
  glyph.hidden = !!src;
  glyph.textContent = initials(d.name);
  time.textContent = d.countdown || "";
  sub.textContent = d.sub || "";
  // A field boss's HP: the ring drains from the top as it falls.
  const hasHp = typeof d.hp === "number";
  badge.classList.toggle("hasHp", hasHp);
  const hpColor = hasHp ? (d.hp > 50 ? "#5fe08a" : d.hp > 20 ? "#ffd54a" : "#ff5a4f") : "";
  if (hasHp) {
    badge.style.setProperty("--hp", `${d.hp}%`);
    badge.style.setProperty("--hp-color", hpColor);
  }
  // The HP in the ring's colour; "Enter" keeps its own.
  sub.style.color = hpColor;
  nameEl.textContent = d.showName ? d.name : "";
  pin.className = `pin ${d.kind || "event"}${d.running ? " running" : ""}${d.due ? " due" : ""} ${d.effect || "shake"}`;
  document.title = d.name || "Event Timers";
  reportArea();
});

// The icon's drawn parts: only they take the mouse, so icons set close
// together don't catch each other's drags (meter 2.0.70 on, Linux; elsewhere
// a press beside them just does nothing).
const SHOWN = ".badge, .time, .sub, .name";
let lastArea = "";
function reportArea() {
  if (typeof a2.widget.area !== "function") return;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const el of document.querySelectorAll(SHOWN)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // The badge's ring and glow reach a little past it.
    const pad = el === badge ? 4 : 0;
    left = Math.min(left, r.left - pad);
    top = Math.min(top, r.top - pad);
    right = Math.max(right, r.right + pad);
    bottom = Math.max(bottom, r.bottom + pad);
  }
  if (!(right > left && bottom > top)) return;
  const area = { x: Math.max(0, Math.floor(left)), y: Math.max(0, Math.floor(top)), width: Math.ceil(right - left), height: Math.ceil(bottom - top) };
  const key = JSON.stringify(area);
  if (key === lastArea) return;
  lastArea = key;
  a2.widget.area(area).catch(() => {});
}
addEventListener("resize", () => {
  lastArea = "";
  reportArea();
});
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});

// A press becomes a drag only once the pointer moves: a window drag starts
// at once took the mouse (Windows), so the release never reached the page
// and a double-click never happened. Two clicks within DOUBLE_MS open the
// plugin's window.
const DRAG_PX = 4;
const DOUBLE_MS = 400;
let press = null;
let lastClick = 0;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || !(e.target instanceof Element) || !e.target.closest(SHOWN)) return;
  e.preventDefault();
  press = { x: e.screenX, y: e.screenY };
});
document.addEventListener("mousemove", (e) => {
  if (!press) return;
  if (!(e.buttons & 1)) {
    press = null;
    return;
  }
  if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) >= DRAG_PX) {
    press = null;
    lastClick = 0;
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !press) return;
  press = null;
  const now = Date.now();
  if (now - lastClick <= DOUBLE_MS) {
    lastClick = 0;
    a2.widget.post({ open: true }).catch(() => {});
  } else {
    lastClick = now;
  }
});
// A right-click stops its alert's sound (unlocked: a locked icon lets clicks
// through to the game).
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  a2.widget.post({ mute: true }).catch(() => {});
});

a2.ready();
