// Players' widget "fight": a card of the player you are fighting, over the
// game. Dragged by its body unless the widgets are locked; ✕ turns it off.
const card = document.querySelector(".card");
const $ = (s) => card.querySelector(s);
let locked = false;
const num = (n) => (n ? Number(n).toLocaleString("en-US") : "–");

a2.on("widget", (d) => {
  if (!d) return;
  if (d.around) return drawAround(d);
  card.hidden = false;
  $(".name").textContent = d.name || "";
  $(".tag").hidden = !d.party;
  $(".sub").textContent = d.sub || "";
  $(".cp").textContent = num(d.cp);
  $(".il").textContent = num(d.il);
  $(".state").textContent = d.state || (d.sure === false ? "Several have this name; the one on your server." : "");
  $(".gear").replaceChildren(...(d.gear || []).map((it) => {
    const r = document.createElement("div");
    r.className = `g g-${it.grade || ""}`;
    r.title = it.name;
    for (const [cls, text] of [["slot", it.slot], ["nm", it.name], ["lv", it.lvl]]) {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = text || "";
      r.append(s);
    }
    return r;
  }));
  drawMore($(".more"), d, true);
  const side = $(".side");
  side.hidden = !d.side;
  side.textContent = d.side || "";
  side.className = `tag side ${d.side || ""}`;
  reportArea();
});

// --- "around": the list, hovered rows' cards asked of the panel ---------------
// Gear summary, Arcana, stigmas and skills, pet and wings under a card.
function drawMore(box, c, compact) {
  box.replaceChildren();
  const add = (cls, text) => {
    const e = document.createElement("div");
    e.className = cls;
    if (text != null) e.textContent = text;
    box.append(e);
    return e;
  };
  if (c.summary?.length) add("more sum", c.summary.join(" · "));
  if (c.stigmas?.length) add("more", "").append(lab("Stigmas"), c.stigmas.map(([n, l]) => `${n} ${l}`).join(" · "));
  if (c.skills?.length && !compact) add("more", "").append(lab("Skills"), c.skills.slice(0, 6).map(([n, l]) => `${n} ${l}`).join(" · "));
  if (compact && c.arcana?.length) {
    const r = add("more", "");
    r.append(lab("Arcana"), c.arcana.map((a) => `${a.name.replace(/ of .*/, "")} ${a.lvl}`).join(" · "));
    r.title = c.arcana.map((a) => `${a.name} ${a.lvl}${a.lines?.length ? `: ${a.lines.join(", ")}` : ""}`).join("\n");
  }
  for (const a of compact ? [] : c.arcana || []) {
    const r = add(`more arc g-${a.grade}`, "");
    const n = document.createElement("span");
    n.className = "nm";
    n.textContent = `${a.name} ${a.lvl}`;
    r.append(n);
    if (a.lines?.length) r.append(`: ${a.lines.join(", ")}`);
  }
  if (c.extras) add("more dim", c.extras);
}
function lab(text) {
  const s = document.createElement("span");
  s.className = "lab";
  s.textContent = `${text} `;
  return s;
}

const pop = document.querySelector(".aroundPop");
const rowsBox = pop.querySelector(".rows");
const ZOOMS = [0.95, 1, 1.12, 1.25];
let hovered = null;

function drawCardInto(box, c) {
  box.replaceChildren();
  const add = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    box.append(e);
    return e;
  };
  const nums = add("div", "nums");
  for (const [v, label] of [[c.cp, "Combat Power"], [c.il, "Item Level"]]) {
    const d = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = num(v);
    const sp = document.createElement("span");
    sp.textContent = label;
    d.append(b, sp);
    nums.append(d);
  }
  if (c.sub) add("div", "sub", c.sub);
  const state = c.state || (c.sure === false ? "Several have this name; the one on your server." : "");
  if (state) add("div", "state", state);
  const gear = add("div", "gear");
  for (const it of c.gear || []) {
    const r = document.createElement("div");
    r.className = `g g-${it.grade || ""}`;
    for (const [cls, text] of [["slot", it.slot], ["nm", it.name], ["lv", it.lvl]]) {
      const sp = document.createElement("span");
      sp.className = cls;
      sp.textContent = text || "";
      r.append(sp);
    }
    gear.append(r);
  }
  drawMore(add("div", "moreBox"), c);
}

function drawAround(d) {
  document.body.classList.add("isAround");
  card.hidden = true;
  pop.hidden = false;
  const z = ZOOMS[d.size] ?? 1;
  document.documentElement.style.zoom = String(z);
  document.documentElement.style.setProperty("--z", String(z));
  pop.querySelector(".popCount").textContent = d.rows.length ? String(d.rows.length) : "";
  if (!d.rows.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Nobody yet: players the meter sees near you show here.";
    rowsBox.replaceChildren(p);
    return;
  }
  rowsBox.replaceChildren(...d.rows.map((r) => {
    const row = document.createElement("div");
    row.className = `prow${r.fighting ? " fighting" : ""}${r.stale ? " stale" : ""}${r.id === hovered ? " on" : ""}`;
    const badge = document.createElement("span");
    badge.className = `clsBadge c-${r.clsName || "none"}`;
    badge.textContent = r.cls || "?";
    row.append(badge);
    const main = document.createElement("div");
    main.className = "pmain";
    const name = document.createElement("strong");
    name.textContent = r.name;
    for (const [on, text, cls] of [[r.party, "party", "tag"], [r.side, r.side, `tag side ${r.side}`]]) {
      if (!on) continue;
      const t = document.createElement("span");
      t.className = cls;
      t.textContent = text;
      name.append(" ", t);
    }
    const sub = document.createElement("span");
    sub.className = "psub";
    sub.textContent = r.sub;
    main.append(name, sub);
    const cp = document.createElement("span");
    cp.className = "pcp";
    cp.textContent = r.cp ? num(r.cp) : "";
    row.append(main, cp);
    row.addEventListener("mouseenter", () => {
      hovered = r.id;
      a2.widget.post({ hover: r.id }).catch(() => {});
    });
    row.addEventListener("click", () => a2.widget.post({ open: r.id }).catch(() => {}));
    if (r.id === d.hover && d.card) {
      const c = document.createElement("div");
      c.className = "pcard";
      drawCardInto(c, d.card);
      row.after(c);
      return [row, c];
    }
    return [row];
  }).flat());
}
rowsBox.addEventListener("mouseleave", () => {
  hovered = null;
  a2.widget.post({ hover: null }).catch(() => {});
});
pop.querySelector(".popX").addEventListener("click", () => a2.widget.post({ close: true }).catch(() => {}));
for (const b of pop.querySelectorAll(".sz")) b.addEventListener("click", () => a2.widget.post({ size: Number(b.dataset.d) }).catch(() => {}));

let lastArea = "";
function reportArea() {
  if (typeof a2.widget.area !== "function" || card.hidden) return;
  const r = card.getBoundingClientRect();
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

$(".x").addEventListener("click", () => a2.widget.post({ close: true }).catch(() => {}));

const DRAG_PX = 4;
let press = null;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || e.target.closest("button")) return;
  // The list drags by its title bar only, so rows stay clickable.
  if (card.hidden && !e.target.closest(".popHead")) return;
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

a2.ready().then(() => a2.widget.post({ ready: true })).catch(() => {});
