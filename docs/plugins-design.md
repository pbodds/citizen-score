# Plugins: design

Status: the plugin window and SDK, decoders, widgets and developer mode are built, and Citizen Score docks its two plugins (Pet Map, World Timers) in the meter's window. Upstream also built a signed catalog for installing reviewed plugins from its servers; Citizen Score left it out, so plugins come bundled with the meter or load from a folder in developer mode.

## Why

Players want features next to the damage meter: world boss timers, pet soul tracking, other timers. Built into the meter, each one widens what the core has to maintain and review, and the core's job is the damage meter. Plugins let those features exist, from us or from other developers, while the core stays the same size.

One player already had an AI add boss timers to a copy of the meter "in one shot". The demand is real and so is the ease; a documented plugin API turns those private forks into reviewed plugins everyone can use.

## Goals

- Plugins add features without growing the core: the core gains a plugin host, a small API and a Plugins tab, nothing per plugin.
- A plugin can only do what its manifest declares.
- Plugins see only the player's own character. Never other players' names or identities.

## Non-goals (for now)

- Native code plugins. A plugin never runs code inside the meter's process, which on Linux holds the packet-capture permission and on Windows may run as administrator.
- Raw packets. Plugins get named numeric fields the meter extracts for them, never packet bytes.
- Network access from plugins.
- Data about other players.

## Overview

```
plugins/<id>/  (bundled next to the meter)  ──▶  Meter: plugin host
<any folder>   (developer mode)             ──▶    runs each plugin in a sandboxed frame,
                                                    gives it only what its manifest permits
```

## What a plugin is

A folder, shipped as a zip:

```
pet-souls/
  manifest.json      id, name, version, apiVersion, permissions, decoders, ui
  index.html         the plugin's page
  plugin.js          its code
  style.css
  data/pets.json     its own data (pet list, souls per level)
  README.md          shown on the website
  screenshots/
```

`manifest.json`:

```json
{
  "id": "pet-souls",
  "name": "Pet Soul Tracker",
  "version": "1.0.0",
  "apiVersion": 1,
  "author": "…",
  "description": "Souls still needed to raise each pet to level 3.",
  "permissions": ["storage", "notify", "events:character", "decoder:pet-soul-acquired"],
  "decoders": [ … see below … ],
  "ui": { "panel": { "width": 320, "height": 420 } }
}
```

## Runtime: the sandbox

Each plugin runs in a sandboxed iframe inside a host window the meter owns (one small window per plugin panel, like Details):

- The iframe has `sandbox="allow-scripts"` and no `allow-same-origin`: an opaque origin, no access to the host page, its storage or `window.__TAURI__`.
- Its files are served by the meter from a `plugin://<id>/` scheme with their own Content-Security-Policy: `default-src 'none'; script-src plugin:; style-src plugin: 'unsafe-inline'; img-src plugin: data:; connect-src 'none'`. No network, no remote scripts.
- It talks to the meter only by `postMessage` to the host page, which checks every request against the manifest's permissions before passing anything to the backend.
- The host window's label is added to the Tauri capabilities so the host can call the backend; the iframe itself never can.

To verify early (open question 1): that Tauri's injected IPC script and global do not reach a sandboxed child frame on WebView2 and WebKitGTK, and that the backend refuses IPC from a frame's opaque origin.

## The plugin API (apiVersion 1)

A small `a2` object the plugin loads (`plugin://sdk/a2.js`), wrapping postMessage:

| Call | Permission | What it does |
|---|---|---|
| `a2.on("character", fn)` | `events:character` | Your character: class, level, server, and when it changes |
| `a2.on("zone", fn)` | `events:zone` | Zone/dungeon entered (dungeon id, difficulty) |
| `a2.on("fight", fn)` | `events:fight` | Boss fight started/ended: boss code, duration, your damage |
| `a2.on("decoded:<name>", fn)` | `decoder:<name>` | Fields from one of the plugin's decoders (below) |
| `a2.storage.get/set(key, value)` | `storage` | The plugin's own JSON store, per character, 1 MB cap |
| `a2.notify(text, {sound})` | `notify` | A toast in the meter (and a sound if the user allows) |
| `a2.now()` | none | Server-aligned time, for timers |
| `a2.on("language", fn)` | none | The meter's language code, at start and whenever the user changes it |

Everything is asynchronous; nothing blocks the meter. A plugin that floods messages is rate-limited and then paused.

## Decoders: game data without raw packets

A plugin that needs game data describes the packets and fields it wants. The meter runs the decoder; the plugin only ever receives the extracted numbers.

```json
"decoders": [{
  "name": "pet-soul-acquired",
  "opcode": "?? ??",
  "self": "player",
  "fields": [
    { "name": "player", "type": "varint" },
    { "name": "petId",  "type": "u32" },
    { "name": "count",  "type": "u16" }
  ]
}]
```

- The meter hooks every decoded game frame at the single point all frames already pass through (`StreamProcessor::parse_perfect_packet`), compares the opcode, and reads the fields in order (`u8`, `u16`, `u32`, `u64`, `i32`, `varint`, `skip:N`).
- Numbers only. No string fields exist, so no names can ever be extracted.
- `self` is required: it names the entity field, and the meter drops the event unless that entity is the local player (`DataStorage::local_player_id`). This is what enforces "your own character only".
- Events reach a plugin as they are read, with `at` (unix ms) in their meta. A plugin with `events:character` gets them half a second later instead, stamped with the character: at login the game sends some data (the pet list) just before the record saying who is playing. A decoder with `"immediate": true` skips that wait, for records that never come at login (a soul picked up); it still never overtakes an earlier event of its plugin that is waiting. Meters before this ignore the key.
- At most 16 fields; events per second capped.
- v1 covers whole frames only. Records embedded mid-frame (the meter's own `scan_records`) are a later extension if a plugin needs them.

Reviewers see in the manifest exactly which packet and fields a plugin reads, and the website shows it in plain words.

For pet souls, the opcode and field layout still have to be found in a capture (open question 3).

## Storage

`app_data/plugins/<id>/` holds the installed bundle and `data/<character-key>.json`. Uninstall offers to keep or delete the data. Plugins never see each other's data.

## In the meter: Settings → Plugins

- **Installed**: enable/disable, open its panel, remove.
- **Check for updates**: reads every plugin folder again and reloads open plugin windows.
- **Developer mode** (Advanced): "Load plugin folder…" runs a local, unsigned plugin for authors to build and test, always with an "Unreviewed plugin" banner. Off by default.

## Example plugins

**World boss timers.** Needs only `a2.now()`, `notify`, `storage` (which bosses to watch) and `events:character` (server region). The schedules ship in the plugin's own data, so no decoder at all, unless boss spawns can be read from game packets, which would be a later version with a decoder.

**Pet soul tracker.** `decoder:pet-soul-acquired` for pickups, `storage` for counts per character, its own `data/pets.json` for souls per level, and a one-time "enter what you already have" screen unless a login packet lists current souls (open question 3).

## Phases

1. **Host and API, locally.** Sandbox host window, `a2` SDK, core events, storage, notify, decoders, developer mode. Proved with the boss timer and pet soul plugins (done).
2. **Docked panels.** Pet Map and World Timers open under the DPS list in the meter's own window (done, `public/src/js/dock.js`).

## Open questions

1. Confirm the sandbox holds on WebView2 and WebKitGTK: no IPC from a sandboxed child frame.
2. Pet souls: which packets carry soul drops, pickups and current counts? Needs a capture made while picking up souls and while logging in.
