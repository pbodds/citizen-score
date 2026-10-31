// Citizen Score: how the meter looks over the game.
//
// Solid background: the meter's background at full strength, whatever the
// Background and Title bar opacity sliders say (they are kept for when it is
// off). Light mode: a light meter with dark text (citizen.css). Each is a
// button in the meter's footer and a switch in Settings → Look, and every
// window follows a change at once. Settings: citizen.look.solid,
// citizen.look.light.
(() => {
  const P = "citizen.look.";
  const KEYS = ["solid", "light"];
  const CLASS = { solid: "csSolid", light: "csLight" };
  const ICON = { solid: ["square", "blend"], light: ["sun", "moon"] };
  const LABEL = {
    solid: ["Solid background", "See-through background"],
    light: ["Light mode", "Dark mode"],
  };
  const get = (name) => String(window.javaBridge?.getSetting?.(P + name) ?? "") === "true";
  const set = (name, on) => window.javaBridge?.setSetting?.(P + name, String(on));

  const root = document.documentElement;
  const refit = () => requestAnimationFrame(() => window.javaBridge?.updateOverlaySize?.());

  function apply(name, on) {
    root.classList.toggle(CLASS[name], on);
    // The footer button offers the other look: the sun while dark, the moon
    // while light.
    const btn = document.querySelector(`.csLookBtn.cs${name[0].toUpperCase()}${name.slice(1)}Btn`);
    if (btn) {
      btn.setAttribute("aria-pressed", String(on));
      const [offLabel, onLabel] = LABEL[name];
      const label = on ? onLabel : offLabel;
      btn.setAttribute("aria-label", label);
      btn.title = label;
      const icon = btn.querySelector("svg, [data-lucide]");
      if (icon) {
        const i = document.createElement("i");
        i.setAttribute("data-lucide", ICON[name][on ? 1 : 0]);
        icon.replaceWith(i);
        window.lucide?.createIcons?.({ root: btn });
      }
    }
    const box = document.querySelector(`.cs${name[0].toUpperCase()}${name.slice(1)}Checkbox`);
    if (box) box.checked = on;
  }

  const sync = () => KEYS.forEach((name) => apply(name, get(name)));

  function flip(name) {
    const on = !root.classList.contains(CLASS[name]);
    apply(name, on);
    set(name, on);
    refit();
  }

  function wire() {
    for (const name of KEYS) {
      const suffix = `${name[0].toUpperCase()}${name.slice(1)}`;
      const btn = document.querySelector(`.csLookBtn.cs${suffix}Btn`);
      btn?.addEventListener("click", (e) => {
        e.stopPropagation();
        flip(name);
      });
      const box = document.querySelector(`.cs${suffix}Checkbox`);
      box?.addEventListener("change", () => {
        apply(name, box.checked);
        set(name, box.checked);
      });
    }
    sync();
    window.__TAURI__?.event?.listen?.("setting-changed", (e) => {
      const name = String(e?.payload?.key || "").slice(P.length);
      if (String(e?.payload?.key || "").startsWith(P) && KEYS.includes(name)) {
        apply(name, String(e.payload.value) === "true");
        refit();
      }
    });
  }

  (async () => {
    await window.a2SettingsReady?.catch?.(() => {});
    if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
    wire();
  })();
})();
