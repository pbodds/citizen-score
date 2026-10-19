// World Timers+ (Citizen Score): what this meter sees itself, on top of Event
// Timers' shared feed.
//
// - A field boss this meter sees die (a2.on("bossKill")) starts its countdown
//   at once: the respawn comes from the cooldown learned for that boss, else
//   the row says how long ago it died until someone's map says when it's back.
// - Cooldowns are learned from the in-game map: a boss seen dying here, then
//   listed dead on a map with its return time, gave away its respawn
//   (return − death). Kept per boss, the newest reading winning.
// - The map you are on (a2.on("zone")) marks its bosses 📍 and lists them
//   first: which bosses a map holds is learned from each map you open.
// - Alerts also go to the desktop (notify-send), over the game.
//
// Plain globals from plugin.js are used as they are: ownMap, feed, mergeOwn,
// serverId, render, alertBanner, prefs.

const PLUS_UI = {
  en: { killed: (t) => `killed ${t} ago`, notLearned: "respawn not learned yet: open the map once it's dead" },
  ko: { killed: (t) => `${t} 전 처치`, notLearned: "재출현 시간 학습 전: 죽은 뒤 지도를 한 번 열어 주세요" },
};
const plusWords = () => PLUS_UI[language] || PLUS_UI.en;
// A respawn longer than this isn't one (a misread or a kill long before).
const MAX_COOLDOWN_S = 2 * 24 * 3600;
// Kills kept to learn from, and shown after a restart, this long.
const KEEP_KILL_S = 24 * 3600;

let plus = { kills: {}, cooldowns: {}, maps: {} };
let zoneMap = null;
const savePlus = () => a2.storage.set("plus", plus).catch(() => {});

function bossOnThisMap(id) {
  return zoneMap != null && (plus.maps[zoneMap] || []).includes(String(id));
}

// A kill, as a dead entry for the merge: reported as of the moment it died,
// so a newer map reading always wins over it.
function killEntry(id, diedAt) {
  const cd = Number(plus.cooldowns[id]) || 0;
  return {
    state: "dead",
    diedAt,
    nextSpawn: cd ? diedAt + cd : null,
    predicted: !!cd,
    reportedAt: diedAt,
    confirmed: true,
  };
}

function applyKills() {
  const server = serverId();
  if (!server) return;
  const kills = plus.kills[server] || {};
  if (ownMap.server !== server) ownMap = { server, bosses: {} };
  for (const [id, diedAt] of Object.entries(kills)) {
    const mine = ownMap.bosses[id];
    if (!mine || (Number(mine.reportedAt) || 0) < diedAt) ownMap.bosses[id] = killEntry(id, diedAt);
  }
  const base = feed?.server === server ? feed.bosses || {} : {};
  feed = { ...(feed?.server === server ? feed : {}), server, bosses: mergeOwn(base), at: Date.now() };
  render();
}

function noteKill(kill) {
  const server = serverId();
  const id = kill?.boss != null ? String(kill.boss) : "";
  const diedAt = Number(kill?.diedAt) || 0;
  if (!server || !id || !diedAt) return false;
  const kills = (plus.kills[server] ||= {});
  if ((kills[id] || 0) >= diedAt) return false;
  kills[id] = diedAt;
  return true;
}

function pruneKills() {
  const cutoff = Date.now() / 1000 - KEEP_KILL_S;
  for (const kills of Object.values(plus.kills)) {
    for (const [id, at] of Object.entries(kills)) if (at < cutoff) delete kills[id];
  }
}

a2.on("bossKill", (kill) => {
  if (!noteKill(kill)) return;
  savePlus();
  applyKills();
});

// A map just opened: learn which bosses it holds, and the respawn of each
// seen dying here that it lists dead with its return time.
a2.on("bossMap", (m) => {
  if (!m || typeof m.bosses !== "object") return;
  const ids = Object.keys(m.bosses);
  if (m.map != null && ids.length) plus.maps[m.map] = ids;
  const kills = plus.kills[serverId()] || {};
  for (const [id, b] of Object.entries(m.bosses)) {
    const died = kills[id];
    const back = Number(b?.nextSpawn) || 0;
    if (b?.state !== "dead" || !died || !back) continue;
    const cd = back - died;
    if (cd > 60 && cd < MAX_COOLDOWN_S) plus.cooldowns[id] = Math.round(cd / 60) * 60;
  }
  savePlus();
  render();
});

a2.on("zone", (z) => {
  zoneMap = z?.map ?? null;
  render();
});

a2.on("character", () => applyKills());

// Alerts reach the desktop too.
{
  const inWindow = alertBanner;
  alertBanner = function (message, opts = {}) {
    inWindow(message, opts);
    if (prefs.desktop !== false && typeof a2.desktopNotify === "function") {
      a2.desktopNotify("AION 2", message).catch(() => {});
    }
  };
}

(async () => {
  plus = { ...plus, ...((await a2.storage.get("plus").catch(() => null)) || {}) };
  pruneKills();
  // What happened while this window was closed, and where the player is.
  try {
    const world = await a2.localWorld();
    zoneMap = world?.map ?? null;
    for (const k of world?.kills || []) noteKill(k);
  } catch {}
  savePlus();
  applyKills();
})();
