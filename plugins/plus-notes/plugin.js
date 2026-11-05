// Notes: a notepad for what you need to do.
//
// - Pages (tabs along the top): "General" to start with; add more with +,
//   double-click a tab to rename it, and remove one from its rename box.
// - Each page has a to-do list (tick, change, remove, clear the done ones;
//   ticked ones sink below the rest) and free notes, saved as you type.
// - Everything is kept in the plugin's own storage, on this computer.

const MAX_PAGES = 12;
const MAX_TASKS = 200;
const MAX_NOTES = 100_000;

const els = {
  tabs: document.querySelector(".tabs"),
  scale: document.querySelector(".scaleSelect"),
  add: document.querySelector(".add"),
  newTask: document.querySelector(".newTask"),
  tasks: document.querySelector(".tasks"),
  count: document.querySelector(".count"),
  clearDone: document.querySelector(".clearDone"),
  notes: document.querySelector(".notes"),
  saved: document.querySelector(".saved"),
};

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let pages = [{ id: "general", name: "General", tasks: [], notes: "" }];
let prefs = { page: "general", scale: 1 };

let saveTimer = 0;
function save(now = false) {
  clearTimeout(saveTimer);
  const run = () => {
    a2.storage.set("pages", pages)
      .then(() => { els.saved.textContent = "saved"; })
      .catch((e) => { els.saved.textContent = `not saved: ${e.message || e}`; });
    a2.storage.set("prefs", prefs).catch(() => {});
  };
  if (now) run();
  else {
    els.saved.textContent = "…";
    saveTimer = setTimeout(run, 400);
  }
}

// ===== Text size =====
const SCALES = [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN_LAYOUT_PX = 260;
const MIN_ZOOM = 0.75;
const textScale = () => (SCALES.includes(Number(prefs.scale)) ? Number(prefs.scale) : 1);
function applyScale() {
  const fit = window.innerWidth > 0 ? window.innerWidth / MIN_LAYOUT_PX : Infinity;
  const value = String(Math.round(Math.max(MIN_ZOOM, Math.min(textScale(), fit)) * 1000) / 1000);
  if (document.documentElement.style.zoom !== value) document.documentElement.style.zoom = value;
}
window.addEventListener("resize", () => applyScale());
function renderScale() {
  els.scale.replaceChildren(...SCALES.map((x) => {
    const o = document.createElement("option");
    o.value = String(x);
    o.textContent = `${Math.round(x * 100)}%`;
    return o;
  }));
  els.scale.value = String(textScale());
}

// ===== Pages =====
const page = () => pages.find((p) => p.id === prefs.page) || pages[0];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderTabs() {
  const cur = page();
  els.tabs.replaceChildren(...pages.map((p) => {
    const b = el("button", `tab${p === cur ? " on" : ""}`, p.name);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(p === cur));
    const left = p.tasks.filter((t) => !t.done).length;
    if (left) b.append(el("span", "tabCount", String(left)));
    b.title = "Double-click to rename";
    b.addEventListener("click", () => {
      if (prefs.page === p.id) return;
      prefs.page = p.id;
      save(true);
      render();
    });
    b.addEventListener("dblclick", () => renameTab(b, p));
    return b;
  }));
  if (pages.length < MAX_PAGES) {
    const plus = el("button", "tab plus", "+");
    plus.type = "button";
    plus.title = "A new page";
    plus.addEventListener("click", () => {
      const p = { id: uid(), name: `Page ${pages.length + 1}`, tasks: [], notes: "" };
      pages.push(p);
      prefs.page = p.id;
      save(true);
      render();
      renameTab(els.tabs.querySelector(".tab.on"), p);
    });
    els.tabs.append(plus);
  }
}

function renameTab(button, p) {
  if (!button) return;
  const box = el("span", "rename");
  const input = el("input");
  input.value = p.name;
  input.maxLength = 30;
  box.append(input);
  if (pages.length > 1) {
    const del = el("button", "delPage", "Remove");
    del.type = "button";
    del.title = "Remove this page, its to-dos and notes";
    del.addEventListener("mousedown", (e) => e.preventDefault());
    del.addEventListener("click", () => {
      const has = p.tasks.length || p.notes.trim();
      if (has && del.dataset.sure !== "1") {
        del.dataset.sure = "1";
        del.textContent = "Sure? Click again";
        input.focus();
        return;
      }
      pages = pages.filter((x) => x !== p);
      prefs.page = pages[0].id;
      save(true);
      render();
    });
    box.append(del);
  }
  button.replaceWith(box);
  input.focus();
  input.select();
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    if (keep && input.value.trim()) p.name = input.value.trim();
    save(true);
    renderTabs();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

// ===== To-dos =====
function renderTasks() {
  const p = page();
  // Not done first, each part in the order added.
  const order = [...p.tasks.filter((t) => !t.done), ...p.tasks.filter((t) => t.done)];
  els.tasks.replaceChildren(...order.map((t) => {
    const li = el("li", `task${t.done ? " done" : ""}`);
    const box = el("span", "box", t.done ? "✓" : "");
    const text = el("span", "text", t.text);
    const del = el("button", "del", "✕");
    del.type = "button";
    del.title = "Remove";
    li.append(box, text, del);
    li.addEventListener("click", (e) => {
      if (e.target === del || li.querySelector("input")) return;
      t.done = !t.done;
      t.doneAt = t.done ? Date.now() : 0;
      save();
      renderTasks();
      renderTabs();
    });
    li.addEventListener("dblclick", (e) => {
      if (e.target === del) return;
      // The double-click's two clicks ticked and unticked it: back as it was.
      editTask(li, text, t);
    });
    del.addEventListener("click", () => {
      p.tasks = p.tasks.filter((x) => x !== t);
      save();
      renderTasks();
      renderTabs();
    });
    return li;
  }));
  const left = p.tasks.filter((t) => !t.done).length;
  const doneN = p.tasks.length - left;
  els.count.textContent = p.tasks.length ? `${left} left${doneN ? ` · ${doneN} done` : ""}` : "";
  els.clearDone.hidden = !doneN;
  if (!p.tasks.length) els.tasks.append(el("li", "empty", "Nothing yet. Type above and press Enter."));
}

function editTask(li, text, t) {
  const input = el("input", "editTask");
  input.value = t.text;
  input.maxLength = 300;
  text.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    if (keep && input.value.trim()) t.text = input.value.trim();
    save();
    renderTasks();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

els.add.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.newTask.value.trim();
  const p = page();
  if (!text || p.tasks.length >= MAX_TASKS) return;
  p.tasks.push({ id: uid(), text, done: false, at: Date.now() });
  els.newTask.value = "";
  save();
  renderTasks();
  renderTabs();
});
els.clearDone.addEventListener("click", () => {
  const p = page();
  p.tasks = p.tasks.filter((t) => !t.done);
  save();
  renderTasks();
  renderTabs();
});

// ===== Notes =====
els.notes.addEventListener("input", () => {
  page().notes = els.notes.value.slice(0, MAX_NOTES);
  save();
  fitNotes();
});
// The box grows with what is written (the panel scrolls), never below 8 lines.
function fitNotes() {
  els.notes.style.height = "auto";
  els.notes.style.height = `${Math.max(140, els.notes.scrollHeight + 4)}px`;
}

function render() {
  renderTabs();
  renderTasks();
  const p = page();
  if (els.notes.value !== p.notes) els.notes.value = p.notes;
  els.saved.textContent = "";
  fitNotes();
}

els.scale.addEventListener("change", () => {
  prefs.scale = Number(els.scale.value);
  save(true);
  applyScale();
});
// Don't lose the last keystrokes when the meter closes.
window.addEventListener("pagehide", () => save(true));

(async () => {
  try {
    const saved = await a2.storage.get("pages");
    if (Array.isArray(saved) && saved.length) {
      pages = saved.filter((p) => p && p.id).map((p) => ({
        id: String(p.id), name: String(p.name || "Page"), notes: String(p.notes || ""),
        tasks: Array.isArray(p.tasks) ? p.tasks.filter((t) => t && t.text) : [],
      }));
    }
    const sp = await a2.storage.get("prefs");
    if (sp) prefs = { ...prefs, ...sp };
  } catch {}
  if (!pages.length) pages = [{ id: "general", name: "General", tasks: [], notes: "" }];
  renderScale();
  applyScale();
  render();
  a2.ready();
})();
