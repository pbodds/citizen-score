// Citizen Score: the Window settings, and the settings window's own touches.
//
// Every value is a setting like the meter's others (citizen.window.*): saved
// by the backend and broadcast to every window as setting-changed, so the
// Settings window writes and the main window applies. The main window owns
// its placement and compositor options (citizen_window in Rust, Hyprland for
// most of them); the look (accent, rounding, panel height) applies wherever
// it is drawn.
(() => {
  if (!window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  const view = window.A2_VIEW || window.__A2_VIEW__ || new URLSearchParams(location.search).get("view") || "main";
  const isSettings = view === "settings";
  const isMain = view === "main" && !document.documentElement.classList.contains("detailsWindow");

  const P = "citizen.window.";
  const DEFAULTS = {
    snap: "free",
    monitor: "",
    gap: "12",
    onTop: "true",
    pin: "false",
    scale: "100",
    radius: "8",
    dockHeight: "470",
    accent: "#5fb4ff",
    blur: "true",
    shadow: "true",
    border: "false",
    anim: "true",
  };
  const get = (name) => {
    const v = window.javaBridge?.getSetting?.(P + name);
    return v === undefined || v === null || v === "" ? DEFAULTS[name] : String(v);
  };
  const set = (name, value) => window.javaBridge?.setSetting?.(P + name, String(value));
  const on = (name) => get(name) === "true";
  const fill = (input) => {
    const pct = ((input.value - input.min) / (input.max - input.min || 1)) * 100;
    input.style.setProperty("--range-pct", `${pct}%`);
  };
  const win = (op, args = {}) => invoke("citizen_window", { op, args }).catch(() => {});

  // ---- the look, in every window ----------------------------------------
  const applyLook = () => {
    const root = document.documentElement.style;
    const accent = /^#[0-9a-f]{6}$/i.test(get("accent")) ? get("accent") : DEFAULTS.accent;
    root.setProperty("--cs-accent", accent);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
    root.setProperty("--cs-accent-rgb", `${r}, ${g}, ${b}`);
    if (isMain) {
      const radius = Math.max(0, Math.min(18, Number(get("radius")) || 0));
      root.setProperty("--rounded", `${radius}px`);
      root.setProperty("--rounded-lg", `${radius + 2}px`);
      root.setProperty("--cs-dock-height", `${dockHeight()}px`);
    }
  };

  // The docked panel's height in page px, held down so the meter and panel
  // fit the screen at the meter's scale: the scale multiplies every page px,
  // and the screen reports real ones, so at 150% a tall panel ran the window
  // off the bottom of a 1080p screen.
  function dockHeight() {
    const wanted = Math.max(320, Math.min(760, Number(get("dockHeight")) || 470));
    const zoom = Math.max(0.5, (Number(get("scale")) || 100) / 100);
    const screenH = window.screen?.availHeight || 0;
    const meter = document.querySelector(".meter");
    const dock = document.querySelector(".dockPanel");
    if (!screenH || !meter) return wanted;
    const rest = meter.offsetHeight - (dock && !dock.hidden ? dock.offsetHeight : 0);
    const room = Math.floor(screenH / zoom - rest - 48);
    return Math.max(200, Math.min(wanted, room));
  }

  // ---- the main window: placement and the compositor ---------------------
  let snapTimer = 0;
  const snap = () => {
    clearTimeout(snapTimer);
    // After the window has taken its new size (resize_window is async).
    snapTimer = setTimeout(() => {
      const corner = get("snap");
      if (corner !== "free") win("snap", { corner, monitor: get("monitor"), gap: Number(get("gap")) || 0 });
    }, 120);
  };
  const applyWindow = (name) => {
    if (!isMain) return;
    const all = !name;
    if (all || name === "onTop") win("on_top", { value: on("onTop") });
    if (all || name === "pin") win("pin", { value: on("pin") });
    if (all || name === "scale") win("zoom", { value: (Number(get("scale")) || 100) / 100 });
    for (const prop of ["blur", "shadow", "border", "anim"]) {
      if (all || name === prop) win("prop", { name: prop, value: on(prop) });
    }
    if (all || ["snap", "monitor", "gap", "scale", "dockHeight"].includes(name)) snap();
  };
  if (isMain) {
    // A corner-snapped meter stays in its corner as it grows (a docked panel,
    // more players) or shrinks.
    let lastSize = "";
    new ResizeObserver(() => {
      const size = `${innerWidth}x${innerHeight}`;
      if (size !== lastSize) {
        lastSize = size;
        snap();
      }
      // The room below may have changed (another monitor, more players).
      const h = `${dockHeight()}px`;
      if (document.documentElement.style.getPropertyValue("--cs-dock-height") !== h) {
        document.documentElement.style.setProperty("--cs-dock-height", h);
      }
    }).observe(document.documentElement);
  }

  listen("setting-changed", (event) => {
    const key = event?.payload?.key;
    if (typeof key !== "string" || !key.startsWith(P)) return;
    applyLook();
    applyWindow(key.slice(P.length));
    if (isSettings) syncForm();
  });

  // ---- the Settings window ---------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  let caps = { compositor: false, monitors: [] };

  function syncForm() {
    const section = $("#settingsSection-window");
    if (!section) return;
    for (const cell of section.querySelectorAll(".csSnapCell")) {
      cell.setAttribute("aria-pressed", String(cell.dataset.corner === get("snap")));
    }
    const monitor = $(".csMonitorSelect");
    if (monitor) monitor.value = get("monitor");
    const checks = { csOnTopCheckbox: "onTop", csPinCheckbox: "pin", csBlurCheckbox: "blur", csShadowCheckbox: "shadow", csBorderCheckbox: "border", csAnimCheckbox: "anim" };
    for (const [cls, name] of Object.entries(checks)) {
      const box = section.querySelector(`.${cls}`);
      if (box) box.checked = on(name);
    }
    const ranges = { csSnapGapInput: "gap", csScaleInput: "scale", csRadiusInput: "radius", csDockHeightInput: "dockHeight" };
    for (const [cls, name] of Object.entries(ranges)) {
      const input = section.querySelector(`.${cls}`);
      if (!input || document.activeElement === input) continue;
      input.value = get(name);
      fill(input);
      const out = section.querySelector(`.${cls}Value`);
      if (out) out.textContent = `${input.value}${input.dataset.unit || ""}`;
    }
    for (const sw of section.querySelectorAll(".csSwatch")) {
      sw.setAttribute("aria-pressed", String(sw.dataset.accent.toLowerCase() === get("accent").toLowerCase()));
    }
  }

  async function setupSettings() {
    const section = $("#settingsSection-window");
    if (!section) return;
    document.documentElement.classList.add("csSettings");

    // The header names the app, with its mark (beside the title: i18n
    // rewrites the title's text).
    const title = $(".settingsPanel .settingsTitle");
    if (title && !$(".settingsPanel .csBrand")) {
      const brand = document.createElement("span");
      brand.className = "csBrand";
      brand.innerHTML = '<img src="/assets/logo.png" alt="" /><span class="csBrandName">Citizen Score</span><span class="csBrandSep" aria-hidden="true">/</span>';
      title.before(brand);
    }

    // Search across every section: matching settings show, the rest fold away.
    const nav = $(".settingsPanel .settingsNav");
    if (nav && !nav.querySelector(".csSearch")) {
      const box = document.createElement("label");
      box.className = "csSearch";
      box.innerHTML = '<i data-lucide="search" aria-hidden="true"></i><input type="search" placeholder="Search settings" aria-label="Search settings" spellcheck="false" />';
      nav.prepend(box);
      window.lucide?.createIcons?.({ root: box });
      const input = box.querySelector("input");
      input.addEventListener("input", () => filter(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          input.value = "";
          filter("");
        }
      });
    }

    caps = await invoke("citizen_window_caps").catch(() => caps);
    document.documentElement.classList.toggle("csNoCompositorDesk", !caps.compositor);
    for (const el of section.querySelectorAll(".csNeedsCompositor")) {
      const row = el.closest(".settingsToggle, .settingsRow") || el;
      row.classList.add("csNeedsCompositor");
    }
    const monitor = $(".csMonitorSelect");
    for (const m of caps.monitors || []) {
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.textContent = m.label;
      monitor?.append(opt);
    }
    monitor?.addEventListener("change", () => set("monitor", monitor.value));

    for (const cell of section.querySelectorAll(".csSnapCell")) {
      cell.addEventListener("click", () => set("snap", get("snap") === cell.dataset.corner ? "free" : cell.dataset.corner));
    }
    const checks = { csOnTopCheckbox: "onTop", csPinCheckbox: "pin", csBlurCheckbox: "blur", csShadowCheckbox: "shadow", csBorderCheckbox: "border", csAnimCheckbox: "anim" };
    for (const [cls, name] of Object.entries(checks)) {
      section.querySelector(`.${cls}`)?.addEventListener("change", (e) => set(name, e.target.checked));
    }
    const ranges = { csSnapGapInput: "gap", csScaleInput: "scale", csRadiusInput: "radius", csDockHeightInput: "dockHeight" };
    for (const [cls, name] of Object.entries(ranges)) {
      const input = section.querySelector(`.${cls}`);
      const out = section.querySelector(`.${cls}Value`);
      if (!input) continue;
      input.addEventListener("mousedown", (e) => e.stopPropagation());
      input.addEventListener("input", () => {
        fill(input);
        if (out) out.textContent = `${input.value}${input.dataset.unit || ""}`;
      });
      // Scale and panel height resize the window: once, on release.
      input.addEventListener("change", () => set(name, input.value));
      if (name === "radius" || name === "gap") input.addEventListener("input", () => set(name, input.value));
    }
    for (const sw of section.querySelectorAll(".csSwatch")) {
      sw.addEventListener("click", () => set("accent", sw.dataset.accent));
    }
    syncForm();
  }

  // Shows only the settings rows whose text matches, in every section, and
  // the sections that have any; clearing it goes back to the open section.
  let openBeforeSearch = null;
  function filter(text) {
    const q = text.trim().toLowerCase();
    const sections = [...document.querySelectorAll(".settingsPanel .settingsSection")];
    const body = $(".settingsPanel .settingsBody");
    if (!q) {
      document.documentElement.classList.remove("csSearching");
      for (const el of document.querySelectorAll(".csMiss")) el.classList.remove("csMiss");
      for (const s of sections) s.hidden = !s.classList.contains("isActive");
      if (openBeforeSearch) body.dataset.section = openBeforeSearch;
      openBeforeSearch = null;
      return;
    }
    if (!openBeforeSearch) openBeforeSearch = body?.dataset.section || null;
    document.documentElement.classList.add("csSearching");
    for (const s of sections) {
      if (getComputedStyle(document.querySelector(`.settingsNavItem[data-section="${s.dataset.section}"]`) || s).display === "none") {
        s.hidden = true;
        continue;
      }
      let any = false;
      for (const row of s.querySelectorAll(".settingsRow, .settingsToggle")) {
        if (row.parentElement.closest(".settingsRow, .settingsToggle")) continue;
        const hit = row.textContent.toLowerCase().includes(q);
        row.classList.toggle("csMiss", !hit);
        any ||= hit;
      }
      s.hidden = !any;
    }
    if (body) body.dataset.section = "search";
  }

  (async () => {
    await window.a2SettingsReady?.catch?.(() => {});
    applyLook();
    if (isMain) applyWindow();
    if (isSettings) {
      if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
      setupSettings();
    }
  })();
})();
