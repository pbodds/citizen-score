// Builds' pop-out ("pop"): the whole build in its own window. The plugin's
// page says which class and build to show; picks made here go back to it, so
// the panel and the pop-out stay on the same class. Dragged by its header.
const bar = document.querySelector(".bar");
const build = document.querySelector(".build");
const guide = document.querySelector(".guide");
const tabs = [...document.querySelectorAll(".tabs button")];
const chips = document.querySelector(".classes");
const modes = [...document.querySelectorAll(".modes button")];
const CLASS_ORDER = ["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"];
let state = { tab: "build", cls: "gladiator", mode: "compare", detected: null, size: 1, sizes: 4, pts: null, ar: null, az: null, scale: 1 };
let view = null;
let locked = false;
let drawn = "";
let guideView = null;

// Text size, from the panel (A− / A+ here ask it to change). Held down so the
// page still lays out at MIN_LAYOUT_PX or more, as in the panel.
const TEXT_SCALES = [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN_LAYOUT_PX = 520;
function applyScale() {
  const scale = TEXT_SCALES.includes(Number(state.scale)) ? Number(state.scale) : 1;
  const fit = window.innerWidth > 0 ? window.innerWidth / MIN_LAYOUT_PX : Infinity;
  const value = String(Math.round(Math.max(0.75, Math.min(scale, fit)) * 1000) / 1000);
  if (document.documentElement.style.zoom !== value) document.documentElement.style.zoom = value;
  for (const b of document.querySelectorAll(".textBtn")) {
    b.disabled = Number(b.dataset.text) < 0 ? scale <= TEXT_SCALES[0] : scale >= TEXT_SCALES[TEXT_SCALES.length - 1];
  }
}
window.addEventListener("resize", () => applyScale());

function draw() {
  applyScale();
  const onGuide = state.tab === "guide";
  for (const b of tabs) b.setAttribute("aria-selected", String(b.dataset.tab === state.tab));
  document.body.classList.toggle("onGuide", onGuide);
  guide.hidden = !onGuide;
  build.hidden = onGuide;
  if (onGuide) {
    const mode = state.mode === "pvp" ? "pvp" : "pve";
    if (!guideView) {
      guideView = renderGuide(guide, {
        deep: true,
        cls: state.cls,
        mode,
        onPick: (cls, m) => {
          state.cls = cls;
          post({ cls });
          if (state.mode !== "compare" && m !== state.mode) {
            state.mode = m;
            post({ mode: m });
          }
        },
      });
    }
    guideView.setPick(state.cls, mode);
    return;
  }
  for (const b of modes) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  chips.replaceChildren(...CLASS_ORDER.map((id) => {
    const b = el("button", id === state.detected ? "you" : null, BUILDS[id].name);
    b.type = "button";
    b.dataset.cls = id;
    b.title = `${BUILDS[id].role}${id === state.detected ? " (you)" : ""}`;
    b.setAttribute("aria-pressed", String(id === state.cls));
    return b;
  }));
  for (const b of document.querySelectorAll(".sizeBtn")) {
    const step = Number(b.dataset.step);
    b.disabled = step < 0 ? state.size <= 0 : state.size >= state.sizes - 1;
  }
  // Redraw the build only when it changed, so the scroll stays put; the
  // planner's points just move its sliders.
  const key = `${state.cls}/${state.mode}`;
  if (key !== drawn) {
    drawn = key;
    view = renderBuild(build, state.cls, state.mode, {
      deep: true,
      pts: state.pts,
      ar: state.ar,
      az: state.az,
      onPts: ({ pts, ar, az }) => {
        state.ar = ar;
        state.pts = pts;
        state.az = az;
        post({ pts, ar, az });
      },
    });
    build.scrollTop = 0;
  } else {
    view?.setPts({ pts: state.pts, ar: state.ar, az: state.az });
  }
}

a2.on("widget", (d) => {
  if (!d) return;
  state = { ...state, ...d };
  draw();
});
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});

const post = (data) => a2.widget.post(data).catch(() => {});
document.addEventListener("click", (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;
  const link = t.closest("a[data-url]");
  if (link) {
    e.preventDefault();
    return post({ url: link.dataset.url });
  }
  const tab = t.closest(".tabs button")?.dataset.tab;
  if (tab) {
    state.tab = tab;
    draw();
    return post({ tab });
  }
  const mode = t.closest(".modes button")?.dataset.mode;
  if (mode) {
    state.mode = mode;
    draw();
    return post({ mode });
  }
  const cls = t.closest(".classes button")?.dataset.cls;
  if (cls) {
    state.cls = cls;
    draw();
    return post({ cls });
  }
  const text = t.closest(".textBtn");
  if (text) return post({ text: Number(text.dataset.text) });
  const size = t.closest(".sizeBtn");
  if (size) return post({ step: Number(size.dataset.step) });
  if (t.closest(".closeBtn")) post({ close: true });
});

// A press on the header (not on its buttons) drags the window.
const DRAG_PX = 4;
let press = null;
bar.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || (e.target instanceof Element && e.target.closest("button"))) return;
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

a2.ready().then(() => post({ ready: true })).catch(() => {});
