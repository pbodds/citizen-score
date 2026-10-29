// Dailies' widgets: "banner", the reminder (clicks go through it, and it goes
// by itself), and "list", the checklist over the game, which follows the
// pointer when dragged unless the widgets are locked.
const banner = document.querySelector(".banner");
const bannerLines = document.querySelector(".bannerLines");
const list = document.querySelector(".list");
let locked = false;

function fill(part, data) {
  part.querySelector(".in").textContent = data.resetIn ? `· resets in ${data.resetIn}` : "";
  const ol = part.querySelector(".left");
  const items = data.left.length ? data.left : ["All done"];
  ol.replaceChildren(...items.map((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    if (!data.left.length) li.className = "none";
    return li;
  }));
}

a2.on("widget", (d) => {
  if (!d) return;
  if (d.banner) {
    document.body.classList.add("isBanner");
    banner.hidden = false;
    list.hidden = true;
    bannerLines.replaceChildren(...(d.lines || []).map((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      return div;
    }));
    banner.style.animation = "none";
    void banner.offsetWidth;
    banner.style.animation = "";
    return;
  }
  if (d.list) {
    list.hidden = false;
    document.querySelector(".who").textContent = d.name || "Dailies";
    document.querySelector(".odyle").textContent = d.odyle ? `Odyle ${d.odyle}` : "";
    fill(document.querySelector(".part.daily"), d.daily);
    fill(document.querySelector(".part.weekly"), d.weekly);
    reportArea();
  }
});

let lastArea = "";
function reportArea() {
  if (typeof a2.widget.area !== "function" || list.hidden) return;
  const r = list.getBoundingClientRect();
  const area = { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  const key = JSON.stringify(area);
  if (key === lastArea) return;
  lastArea = key;
  a2.widget.area(area).catch(() => {});
}
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});

const DRAG_PX = 4;
let press = null;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || list.hidden) return;
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
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", () => { press = null; });

a2.ready().then(() => a2.widget.name === "list" && a2.widget.post({ ready: true })).catch(() => {});
