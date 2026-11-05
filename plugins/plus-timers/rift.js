// Rift card (Citizen Score): the Spacetime Rift's countdown in a card of its
// own over the game (widget "rift-card", drawn by widget.js), switched on
// under Settings. Before it opens: "in 1:23:45", its start time and the two
// after it, and a bar filling up to the opening; while the portal is up
// (10 minutes): "Open · 7:12 left", the bar draining. It glows amber in the
// last SOON_MS. Drag it to move it (unless the icons are locked), double-click
// to open this window, ✕ to switch it off.
//
// Loaded after plugin.js and pins.js: uses EVENTS, nextOf, timeZone, clock,
// span, text, ui, prefs, savePrefs, els, option, language, windowApi,
// showFull. ("rift" alone is the name a pinned rift alert's icon gets.)

const RIFT_WIDGET = "rift-card";
const RIFT_SIZE = { width: 272, height: 124 };
const RIFT_UI = {
  en: { card: "Rift card over the game", note: "A card with the Spacetime Rift's countdown, over the game. Drag it where you want it; double-click it to open this window.",
    open: "Open", left: (t) => `${t} left`, in: (t) => `in ${t}`, then: "then", noServer: "Pick a region under Settings" },
  ko: { card: "게임 위에 균열 카드", note: "시공의 균열 카운트다운 카드를 게임 위에 띄웁니다. 끌어서 옮기고, 더블클릭하면 이 창이 열립니다.",
    open: "열림", left: (t) => `${t} 남음`, in: (t) => `${t} 후`, then: "다음", noServer: "설정에서 지역을 선택하세요" },
};
const riftWords = () => RIFT_UI[language] || RIFT_UI.en;
const riftEvent = () => EVENTS.find((ev) => ev.id === "rift");
let riftOpen = false;
let riftBusy = false;

// Its current or next showing, and the two after it.
function riftTimes(now) {
  const ev = riftEvent();
  const tz = timeZone();
  if (!ev || !tz) return null;
  const out = [];
  let at = now;
  for (let i = 0; i < 3; i++) {
    const next = nextOf(ev, tz, at);
    if (!next) break;
    out.push(next);
    at = next.end;
  }
  return out.length ? out : null;
}

function riftData(now) {
  const w = riftWords();
  const ev = riftEvent();
  const times = riftTimes(now);
  const name = ev ? text(ev.name) : "Spacetime Rift";
  if (!times) return { rift: true, name, countdown: "–", sub: w.noServer, state: "idle", progress: 0 };
  const fmt = clock();
  const [cur, ...later] = times;
  const running = cur.start <= now;
  const hm = (ms) => {
    try {
      return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", timeZone: fmt.resolvedOptions().timeZone }).format(new Date(ms));
    } catch {
      return fmt.format(new Date(ms));
    }
  };
  // The bar: filling over the wait since the last one closed (one cycle,
  // the gap to the showing after), draining while it is open.
  const cycle = later[0] ? later[0].start - cur.start : 3 * 3600_000;
  const wait = Math.max(1, cycle - (cur.end - cur.start));
  const progress = running
    ? (cur.end - now) / Math.max(1, cur.end - cur.start)
    : 1 - Math.min(1, (cur.start - now) / wait);
  return {
    rift: true,
    name,
    where: (ev.where || []).map(text).join(" · "),
    countdown: running ? w.left(span(cur.end - now)) : w.in(span(cur.start - now)),
    badge: running ? w.open : "",
    at: running ? "" : fmt.format(new Date(cur.start)),
    later: later.length ? `${w.then} ${later.map((t) => hm(t.start)).join(", ")}` : "",
    state: running ? "open" : cur.start - now <= SOON_MS ? "soon" : "wait",
    progress: Math.max(0, Math.min(1, progress)),
  };
}

async function updateRift(now) {
  if (riftBusy || !(a2.widgets && typeof a2.widgets.open === "function")) return;
  riftBusy = true;
  try {
    if (!prefs.riftCard) {
      if (riftOpen) {
        riftOpen = false;
        await a2.widgets.close(RIFT_WIDGET).catch(() => {});
      }
      return;
    }
    if (!riftOpen) {
      riftOpen = await a2.widgets.open(RIFT_WIDGET, RIFT_SIZE).then(() => true, () => false);
      if (!riftOpen) return;
    }
    a2.widgets.send(RIFT_WIDGET, riftData(now)).catch(() => {});
  } finally {
    riftBusy = false;
  }
}

function setRiftCard(on) {
  prefs.riftCard = !!on;
  savePrefs();
  riftSwitch.checked = prefs.riftCard;
  updateRift(Date.now());
}

a2.on("widget-message", (msg) => {
  if (msg?.name !== RIFT_WIDGET) return;
  if (msg.data?.ready) updateRift(Date.now());
  if (msg.data?.close) setRiftCard(false);
});

// Settings: the switch, under Text size.
const riftRow = document.createElement("label");
riftRow.className = "setting popRow";
const riftLabel = document.createElement("span");
const riftSwitch = document.createElement("input");
riftSwitch.type = "checkbox";
riftSwitch.className = "switch";
riftSwitch.setAttribute("role", "switch");
riftRow.append(riftLabel, " ", riftSwitch);
const riftNote = document.createElement("p");
riftNote.className = "note";
els.scaleSelect.closest(".setting").after(riftRow, riftNote);
riftSwitch.addEventListener("change", () => setRiftCard(riftSwitch.checked));
function renderRiftSetting() {
  const w = riftWords();
  riftLabel.textContent = w.card;
  riftNote.textContent = w.note;
  riftSwitch.checked = !!prefs.riftCard;
  if (!(a2.widgets && typeof a2.widgets.open === "function")) riftSwitch.disabled = true;
}
{
  const before = renderStatic;
  renderStatic = function () {
    before();
    renderRiftSetting();
  };
}
renderRiftSetting();
setInterval(() => updateRift(Date.now()), 1000);
