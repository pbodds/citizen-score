# What leaves your machine

Nothing. Citizen Score has no account, no uploads, no update check and no
telemetry, and the network code that upstream used for those isn't in the
source. The only connections it makes are the ones you start: a link you click
opens in your browser, and skill and item icons load from the game's own
image server (`assets.playnccdn.com`).

## What it reads

The meter reads AION 2's network traffic on this computer (Npcap on Windows,
libpcap on Linux) in order to compute damage. It needs packet-capture
permission for that, and nothing else: on Linux the packages grant it
`cap_net_raw` and it never runs as root.

## What it writes

Everything lives in one folder: `%APPDATA%\com.citizenscore.meter\` on Windows,
`~/.local/share/com.citizenscore.meter/` on Linux.

| What | Where in that folder | Notes |
| --- | --- | --- |
| Settings | `settings.json` | |
| Fight history | `history/*.json` | One file per boss fight. Party members' names are masked when the record is made (`obscure_nickname` in `src-tauri/src/entity/fight_record.rs`), so a file holds `Ta****x`, not the real name. Your own name isn't masked. |
| Evidence Slices | `slices/` | The packet types the damage parser reads for each saved fight, with every character name replaced by an opaque token. Deleting a fight deletes its slice. |
| Plugin data | `plugin-data/<plugin>/` | What Pet Map and World Timers save (souls collected, alert choices). |
| Diagnostics | `debug.log`, `packets_*.txt` | Only while *Settings → Diagnostics* says so. Off by default. |

### Packet logs are sensitive

*Enable packet logging* records **the whole server-to-client game connection**,
not a combat feed. AION 2 sends everything down one connection, so a capture
contains player chat, names of players who weren't in your party, account
statistics, session IDs and server addresses. Running

```
A2_REPLAY_CAPTURE=<your capture> cargo test --test capture_contents -- --ignored --nocapture
```

over a capture lists what is in it. Read that before you share one with anybody.
The files grow for as long as the setting is on; delete them when you're done.

`src-tauri/diagnostics/packet_dump.rs` is a developer tool that isn't part of
the downloads. It captures every network adapter with no filter, so its
`rawpackets_*.txt` files include other applications' traffic.

## Checking for yourself

The source is all here. The Rust side has no HTTP client among its direct dependencies
(`src-tauri/Cargo.toml`), and the pages' Content Security Policy
(`src-tauri/tauri.conf.json`) allows connections only to the app itself and the
icon server.
