// Citizen Score: the docked panels. The meter's main window hosts the Pet Map
// (plus-souls) and World Timers (plus-timers) plugins below the DPS list, each
// opened from its header icon, one at a time. Both run from the start, hidden
// when closed, so timers keep counting and alerts keep coming.
//
// Each plugin runs as in its own window (pluginHost.js): a sandboxed frame
// with no access to this page, asking for things by message, and getting only
// what its manifest permits. Calls to the meter name the plugin (`plugin`),
// since they all come from the main window.
(() => {
  // Only the meter's own window docks panels. History, Details and Settings
  // windows run this same page; there the plugins refuse to start ("not a
  // plugin window") and the dock would cover their content.
  const view = window.A2_VIEW || window.__A2_VIEW__ || new URLSearchParams(location.search).get("view") || "main";
  if (!window.__TAURI__ || view !== "main") return;
  const { invoke, convertFileSrc } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  const meter = document.querySelector(".meter");
  const header = meter?.querySelector(".header");
  if (!meter || !header) return;

  const PANELS = [
    { id: "plus-souls", btn: ".petMapBtn" },
    { id: "plus-timers", btn: ".timersBtn" },
  ];
  const OPEN_KEY = "citizen.dock.open";

  // The panel area, under the header: the DPS list stays the meter, a panel
  // opens beneath it.
  const dock = document.createElement("div");
  dock.className = "dockPanel";
  dock.hidden = true;
  const footer = meter.querySelector(".meterFooter");
  (footer?.nextSibling ? meter.insertBefore(dock, footer.nextSibling) : meter.appendChild(dock));

  const hosts = new Map();

  function mount({ id, btn }) {
    const button = header.querySelector(btn);
    const stage = document.createElement("div");
    stage.className = "dockStage";
    stage.hidden = true;
    const toast = document.createElement("div");
    toast.className = "dockToast";
    toast.hidden = true;
    stage.appendChild(toast);
    dock.appendChild(stage);

    let frame = null;
    let manifest = null;
    let ready = false;
    const queue = [];
    const call = (cmd, args = {}) => invoke(cmd, { ...args, plugin: id });
    const allowed = (permission) => !!manifest?.permissions?.includes(permission);
    const send = (msg) => frame?.contentWindow?.postMessage({ a2: 1, ...msg }, "*");

    const CURSOR_KEY = `citizen.dock.cursor.${id}`;
    let run = null;
    let delivered = 0;
    const saveCursor = () => {
      try { localStorage.setItem(CURSOR_KEY, JSON.stringify({ run, seq: delivered })); } catch {}
    };
    const deliver = (event, data, extra = {}) => {
      if (event.startsWith("decoded:") && !allowed(`decoder:${event.slice(8)}`)) return;
      if (event === "character" && !allowed("events:character")) return;
      if ((event === "bossMap" || event === "bossLive") && !allowed("feed:boss-timers")) return;
      if ((event === "zone" || event === "bossKill") && !allowed("events:zone")) return;
      const msg = { event, data, ...extra };
      if (ready) send(msg);
      else queue.push(msg);
    };
    const deliverLogged = (e) => {
      if (typeof e?.seq !== "number" || e.seq <= delivered) return;
      delivered = e.seq;
      deliver(e.event, e.data, { character: e.character ?? null, at: e.at ?? null });
      if (ready) saveCursor();
    };
    let early = [];

    let toastTimer = 0;
    const showToast = (text) => {
      toast.textContent = text.slice(0, 200);
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
    };
    const need = (permission) => {
      if (!allowed(permission)) throw new Error(`the plugin lacks the "${permission}" permission`);
    };
    let lastLinkAt = 0;

    const calls = {
      ready: () => {
        ready = true;
        for (const m of queue.splice(0)) send(m);
        saveCursor();
        return true;
      },
      "storage.get": ([key]) => call("plugin_storage_get", { key: String(key) }),
      "storage.set": ([key, value]) => call("plugin_storage_set", { key: String(key), value: String(value) }),
      bossTimers: ([server]) => (need("feed:boss-timers"), call("plugin_boss_timers", { server: Number(server) })),
      "bossTimers.follow": ([server, bosses]) => (need("feed:boss-timers"),
        call("plugin_boss_follow", { server: Number(server), bosses: (Array.isArray(bosses) ? bosses : []).map(String) })),
      localWorld: () => (need("events:zone"), call("plugin_local_world")),
      // Docked, the plugin's "window" is its panel: showing it opens the
      // panel (an alert, when the player asked for that); hiding and fitting
      // leave the meter as the player has it.
      "window.show": () => (need("window"), open(id), true),
      "window.hide": () => (need("window"), true),
      "window.fit": () => (need("window"), true),
      "widgets.open": ([name, size]) => (need("widgets"), call("plugin_widget_open",
        { name: String(name), width: Number(size?.width) || 64, height: Number(size?.height) || 64 })),
      "widgets.close": ([name]) => (need("widgets"), call("plugin_widget_close", { name: String(name) })),
      "widgets.send": ([name, data]) => (need("widgets"), call("plugin_widget_send", { name: String(name), data: data ?? null })),
      "widgets.lock": ([locked]) => (need("widgets"), call("plugin_widgets_lock", { locked: !!locked })),
      "widgets.locked": () => (need("widgets"), call("plugin_widgets_locked")),
      notify: ([text]) => (need("notify"), showToast(String(text)), true),
      desktopNotify: ([title, body]) => (need("notify"),
        call("plugin_desktop_notify", { title: String(title), body: String(body ?? "") })),
      openUrl: ([raw]) => {
        const url = new URL(String(raw));
        if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048) {
          throw new Error("only https links open");
        }
        const now = Date.now();
        if (now - lastLinkAt < 1000) throw new Error("one link a second");
        lastLinkAt = now;
        return invoke("open_url", { url: url.href });
      },
    };

    window.addEventListener("message", async (event) => {
      if (!frame || event.source !== frame.contentWindow) return;
      const msg = event.data;
      if (!msg || msg.a2 !== 1 || !msg.id || typeof msg.call !== "string") return;
      const fn = calls[msg.call];
      try {
        if (!fn) throw new Error(`unknown call ${msg.call}`);
        send({ id: msg.id, result: await fn(Array.isArray(msg.args) ? msg.args : []) });
      } catch (e) {
        send({ id: msg.id, error: String(e?.message || e) });
      }
    });

    const onEvent = (payload) => {
      if (typeof payload.event !== "string") return;
      if (payload.plugin !== undefined && payload.plugin !== id) return;
      if (payload.event === "widget" || payload.event === "locked") return;
      if (payload.event === "widget-message" && !allowed("widgets")) return;
      if (typeof payload.seq !== "number") deliver(payload.event, payload.data);
      else if (early) early.push(payload);
      else deliverLogged(payload);
    };

    call("plugin_hello").then((hello) => {
      manifest = hello.manifest;
      deliver("language", hello.language || "en");
      deliver("compact", false);
      if (hello.character) deliver("character", hello.character);
      if (typeof hello.game === "boolean") deliver("game", { running: hello.game });
      run = hello.run;
      try {
        const cursor = JSON.parse(localStorage.getItem(CURSOR_KEY) || "null");
        if (cursor?.run === run) delivered = Number(cursor.seq) || 0;
      } catch {}
      const logged = [...(hello.replay || []), ...early].sort((a, b) => a.seq - b.seq);
      early = null;
      for (const e of logged) deliverLogged(e);
      frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("title", manifest.name);
      const base = convertFileSrc("", "a2plugin").replace(/\/*$/, "/");
      frame.src = `${base}${encodeURIComponent(id)}/index.html`;
      stage.insertBefore(frame, toast);
    }).catch((e) => {
      stage.textContent = `This panel could not start: ${e}`;
    });

    button?.addEventListener("click", () => toggle(id));
    button?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(id); }
    });
    hosts.set(id, { stage, button, onEvent });
  }

  let current = null;
  function show(id) {
    current = hosts.has(id) ? id : null;
    for (const [pid, h] of hosts) {
      const on = pid === current;
      h.stage.hidden = !on;
      h.button?.classList.toggle("isActive", on);
      h.button?.setAttribute("aria-pressed", String(on));
    }
    dock.hidden = !current;
    meter.classList.toggle("hasDock", !!current);
    try { localStorage.setItem(OPEN_KEY, current || ""); } catch {}
    // The window follows the meter's height; ask now rather than at the next tick.
    window.javaBridge?.updateOverlaySize?.();
  }
  const open = (id) => show(id);
  const toggle = (id) => show(current === id ? null : id);

  PANELS.forEach(mount);
  listen("plugin-event", (event) => {
    const payload = event.payload || {};
    for (const h of hosts.values()) h.onEvent(payload);
  });
  // Settings → Plugins → Open on a docked plugin.
  listen("dock-open", (event) => open(String(event.payload)));

  let saved = "";
  try { saved = localStorage.getItem(OPEN_KEY) || ""; } catch {}
  show(saved);
  window.lucide?.createIcons?.();
})();
