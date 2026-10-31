// Citizen Score: updates from GitHub (src-tauri/src/updater.rs).
//
// The meter window checks the latest release shortly after it starts and
// every few hours. When one is newer, a box says so over the meter: with
// "Install automatically" on (the default) it counts down and installs,
// otherwise it waits for Update now. Installing downloads the release file
// for this install, checks its checksum, and restarts the meter on the new
// version (on Linux after the system's password prompt).
//
// Settings → Updates turns the check and the automatic install on or off,
// and has Check now. Settings: citizen.update.check, citizen.update.auto.
(() => {
  if (!window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;
  const view = window.A2_VIEW || window.__A2_VIEW__ || new URLSearchParams(location.search).get("view") || "main";
  const isSettings = view === "settings";
  const isMain = view === "main" && !document.documentElement.classList.contains("detailsWindow");
  if (!isMain && !isSettings) return;

  const FIRST_CHECK_MS = 15_000;
  const EVERY_MS = 4 * 60 * 60_000;
  const COUNTDOWN_S = 15;
  const P = "citizen.update.";
  const get = (name) => {
    const v = window.javaBridge?.getSetting?.(P + name);
    return v === undefined || v === null || v === "" ? "true" : String(v);
  };
  const set = (name, value) => window.javaBridge?.setSetting?.(P + name, String(value));
  const on = (name) => get(name) !== "false";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const label = (tag) => String(tag || "").replace(/^v/, "") || "a development build";
  // The release notes' "What's new" (release.yml writes it from the tag's
  // message), without Markdown's marks; nothing when there isn't one (the
  // rest is the downloads table).
  const shortNotes = (text) => {
    const lines = String(text || "").split(/\r?\n/);
    const start = lines.findIndex((l) => /^#+\s*what'?s new/i.test(l.trim()));
    if (start < 0) return "";
    const end = lines.findIndex((l, i) => i > start && /^#/.test(l.trim()));
    return lines
      .slice(start + 1, end < 0 ? undefined : end)
      .map((l) => l.replace(/^[>*\-\s]+/, "").replace(/[*_`]/g, "").trim())
      .filter((l) => l && !l.startsWith("|"))
      .slice(0, 4)
      .join("\n");
  };

  let installing = false;
  async function install(status) {
    if (installing) return;
    installing = true;
    status("Downloading and checking the update…");
    try {
      // The meter exits once the installer has started.
      await invoke("update_install");
    } catch (e) {
      installing = false;
      status(`Couldn't update: ${e?.message || e}`, true);
    }
  }

  // ---- the box over the meter --------------------------------------------
  let box = null;
  let timer = 0;
  let snoozed = "";
  // The meter window fits its content (tauriBridge.js): grow it for the box.
  const refit = () => requestAnimationFrame(() => window.javaBridge?.updateOverlaySize?.());
  function closeBox() {
    clearInterval(timer);
    box?.remove();
    box = null;
    refit();
  }
  function showBox(info) {
    if (box || installing || snoozed === info.latest) return;
    box = el("div", "csUpdate");
    box.setAttribute("role", "alertdialog");
    box.dataset.noDrag = "true";
    const title = el("div", "csUpdateTitle", `Update available · ${label(info.latest)}`);
    const from = el("div", "csUpdateFrom", `You have ${label(info.current)}`);
    const notes = el("div", "csUpdateNotes", shortNotes(info.notes));
    const status = el("div", "csUpdateStatus");
    const setStatus = (text, bad = false) => {
      status.textContent = text;
      status.classList.toggle("isBad", bad);
    };
    const row = el("div", "csUpdateBtns");
    const later = el("button", "csUpdateBtn", "Not now");
    later.type = "button";
    later.addEventListener("click", () => {
      snoozed = info.latest;
      closeBox();
    });
    if (info.installable) {
      const now = el("button", "csUpdateBtn isPrimary", "Update now");
      now.type = "button";
      now.addEventListener("click", () => {
        clearInterval(timer);
        now.disabled = true;
        install(setStatus).then(() => { now.disabled = installing; });
      });
      row.append(now, later);
      if (on("auto")) {
        let left = COUNTDOWN_S;
        const tick = () => setStatus(`Updating in ${left} s. The meter restarts on the new version.`);
        tick();
        timer = setInterval(() => {
          left -= 1;
          if (left > 0) return tick();
          clearInterval(timer);
          now.disabled = true;
          install(setStatus);
        }, 1000);
      }
    } else {
      const get = el("button", "csUpdateBtn isPrimary", "Download");
      get.type = "button";
      get.title = "This copy can't update itself: get the new version from GitHub";
      get.addEventListener("click", () => invoke("open_url", { url: info.url }).catch(() => {}));
      row.append(get, later);
      setStatus("This copy can't update itself.");
    }
    box.append(title, from, notes, status, row);
    // Inside the meter, under its footer, so the window grows to hold it.
    (document.querySelector(".meter") || document.body).append(box);
    refit();
  }

  async function check() {
    if (!on("check")) return;
    try {
      const info = await invoke("update_check");
      if (info?.newer) showBox(info);
    } catch (e) {
      console.warn("Citizen Score: update check", e);
    }
  }

  // ---- Settings → Updates ------------------------------------------------
  function setupSettings() {
    const section = document.querySelector("#settingsSection-updates");
    if (!section) return;
    const checkBox = section.querySelector(".csUpdateCheckCheckbox");
    const autoBox = section.querySelector(".csUpdateAutoCheckbox");
    const btn = section.querySelector(".csUpdateNowBtn");
    const out = section.querySelector(".csUpdateResult");
    const current = section.querySelector(".csUpdateCurrent");
    invoke("update_current").then((tag) => { current.textContent = label(tag); }).catch(() => {});
    const sync = () => {
      checkBox.checked = on("check");
      autoBox.checked = on("auto");
    };
    sync();
    window.__TAURI__.event.listen("setting-changed", (e) => {
      if (String(e?.payload?.key || "").startsWith(P)) sync();
    });
    checkBox.addEventListener("change", () => set("check", checkBox.checked));
    autoBox.addEventListener("change", () => set("auto", autoBox.checked));
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      out.classList.remove("isBad");
      out.replaceChildren(el("span", null, "Checking GitHub…"));
      try {
        const info = await invoke("update_check");
        if (!info?.newer) {
          out.replaceChildren(el("span", null, `Up to date (latest: ${label(info?.latest)}).`));
        } else {
          const line = el("span", null, `${label(info.latest)} is out. `);
          const act = el("button", "csUpdateBtn isPrimary", info.installable ? "Update now" : "Download");
          act.type = "button";
          act.addEventListener("click", () => {
            if (!info.installable) return invoke("open_url", { url: info.url }).catch(() => {});
            act.disabled = true;
            install((text, bad) => {
              line.textContent = `${text} `;
              out.classList.toggle("isBad", !!bad);
            }).then(() => { act.disabled = installing; });
          });
          out.replaceChildren(line, act);
        }
      } catch (e) {
        out.classList.add("isBad");
        out.replaceChildren(el("span", null, `Couldn't reach GitHub: ${e?.message || e}`));
      }
      btn.disabled = false;
    });
  }

  (async () => {
    await window.a2SettingsReady?.catch?.(() => {});
    if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
    if (isSettings) return setupSettings();
    setTimeout(check, FIRST_CHECK_MS);
    setInterval(check, EVERY_MS);
  })();
})();
