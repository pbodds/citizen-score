# Citizen Score

An AION 2 combat meter for Windows and Linux, with a Pet Map (and pet radar), World Timers, Dailies, Builds and Players docked under the DPS list. Built **offline**: the upstream account, uploads, supporter roster, Discord activity, Send Logs, update checks and shared boss-timer feed are not compiled in. Nothing leaves this computer, except a character lookup you start in Players.

- **Pet Map** (`plugins/plus-souls`): how many souls each pet still needs, where they drop, a **Best areas** ranking, and a **Map** tab. The Map tab shows a heatmap of every spawn that drops a soul you still need, weighted by drop chance, with Kibelisks (teleport crystals) drawn as numbered landmarks. **Show on map** in a pet's sources narrows the map to that pet. Drag to pan, scroll to zoom, double-click to refit, and hover a hot spot to see which pets and monsters are there.
- **Pet Radar** (in the Pet Map, **◎ Radar**): a widget over the game listing the monsters around you that drop souls you still need, nearest first, with their distance and compass direction, and a scope with north up. Pinned pets come first, and clicking a row in the unlocked radar pins its pet. The meter reads each monster's spawn (NPC id and position), drops it when it dies or leaves view (~65 m), and reads your position from the buffs you cast and where a zone load puts you. Between buffs your position is the median of the monsters in view, blended with your last buff's (about 15 m off at the median, 50 m at worst one time in ten, measured on saved fights); the badge shows green "live ±5 m" or amber "~ ±N m". The scope is square-root scaled out to 300 m: filled dots are monsters in view, rings are spawn points from the map data, and numbered ones match the list. Like a game radar it also shows the rest of what is in view, each a layer you toggle under the legend: other monsters (small red dots), bosses (purple diamonds, with the nearest named under the scope) and NPCs and objects (grey squares, off by default: the things the game sends without a monster name). Drag the grip in the unlocked radar's bottom-right corner to resize it (0.6× up to 2× or as tall as your screen allows; double-click the grip for the normal size): the whole card scales as one and the window follows, so nothing reflows or gets cut off, and the size is kept. A click on the unlocked scope zooms to the ~75 m in view, to scale, and back; a sweep turns while it has your position. Other players aren't shown: an enemy player's position beyond what the game itself shows you would be a wallhack. Gathering nodes and chests aren't in the packets the meter reads, so they can't be shown either. On the Map tab you show as a blue dot with how far off you may be. World units are centimetres, and a map pixel is a metre: map pixel = 4096 + world / 100.
- **World Timers** (`plugins/plus-timers`): fixed schedules, plus field bosses this meter sees die, counted down with the respawn time it has learned.
- **Dailies** (`plugins/plus-dailies`): dailies and weeklies per character, cleared at the game's resets (07:00 UTC on Global, weeklies on Wednesday; Korea and Taiwan at 05:00 local). Odyle Energy is read from the game. Click a task to count one done, and right-click to take one back. **Edit** renames tasks, sets how many times each repeats, and adds or removes them. Under ⚙ there's a reminder before a reset finds tasks undone (a banner, plus a desktop notification if you want one) and a checklist over the game.
- **Builds** (`plugins/plus-builds`, header icon ⚔): two tabs. **Builds**: a PvE and a PvP build for each class: the four stigmas (Global has 4 slots) and what to swap in, a Daevanion planner over all six boards (shared points for Nezekan–Triniel, its own sliders for Ariel and Azphel; Ariel's layout comes from NCSOFT's character site and its order from the boards of each class's top players, `plus/build_ariel.py`), skill level order and specialties, gear passives, stats and manastones, Theostone, Arcana and rotation. It opens on the class the meter sees you play. **Guide**: opens on **Your character**: the character the meter sees you play (or one you look up) read from NCSOFT's character site, every piece, board, Stigma, title and wing, then a list of changes in three tiers (do now, this week, longer term), each linking to its chapter. It checks item level gates, empty slots and Arcana, +10 enhancement left, gear below your tier and where it drops, empty and off-role Manastones, Theostones, belt/amulet/runes, Daevanion nodes top players of your class take that you don't, Stigmas and skill levels, titles, wings and live Odyle; **Set the Daevanion planner to my points** moves the planner to what you've actually spent (`advisor.js`). Then a searchable game guide in 26 chapters (new and changed ones marked NEW; getting started, **class play**: for any class and PvE/PvP, the stigmas, skills to level, the passives that matter with their tooltips, and the in-game macro drawn slot by slot (which skill fires first, what's held, the buff key, by hand, keep out); leveling, daily and weekly counters, item level and Odyle, dungeons, gear, enhancement, Manastones and Theostones, Arcana (with each card's skill pool for your class, marked ★ want / ✓ fine / ✗ skip), Daevanion, Stigmas, Combat Power, stat values and the damage formula, stat lines/rerolls/transfer, combat rules and caps, Pet Genus Insight rolls for all 5 boards, slot by slot (these four from Kanon's Aion 2 Bible, aion2bible.com and his 10/4 doc; Bible chapter numbers cited in each), wings/titles/pets/skins, Abyss and PvP, endgame, hidden cubes and Legions, crafting, Kinah, Season 1 dates and rotations, class tier list, FPS settings); the search narrows every chapter to the rows that mention your words. **Pop out** opens either in its own window (builds with every pick rate charted and PvE beside PvP; the guide in two columns). Data: `builds.js` (aion2-meta and MetaBot class guides), `play.js` (Arcana skill pools from MetaBot's client-data item pages, in-game macros and passive tooltips from aion2-meta; drawn by `playview.js`, also in the Builds tab's Passives, Arcana and Macro sections), `guide.js` + `progression.js` (MetaBot's client-data guides, aion2-meta, Odealo, GameTruth; compiled 2026-10-28). Update them after big patches.
- **Players** (`plugins/plus-players`, header icon: user with magnifier): search any Global character by name (region and faction filters, **Me** for the one you're playing) and open their combat power, item level, stats, gear, Arcana, pet and wings, skills and stigmas, titles and every Daevanion board node by node. It asks NCSOFT's own character site (the unofficial JSON its pages use), only when you search, through `src-tauri/src/plugins/players.rs` (permission `net:players`; fixed hosts, answers cached 5 minutes).
- **Alert banners** (World Timers', Dailies') open in the bottom-right corner of a monitor that has neither the game nor focus. Clicks go through them, and they never take focus. On Hyprland, a window rule for titles ending in `· banner` places them as they open (see `~/.config/hypr/hyprland.lua`).
- **Settings → Window**: snap the meter to a corner or edge of any monitor (it stays put as it resizes), set the edge gap, keep it on top, pin it to every workspace, set interface scale, corner rounding, panel height and accent colour, and toggle Hyprland's blur, shadow, border and animations for the meter. Settings also has a search box.

## Download

Get the latest build from [Releases](https://github.com/pbodds/citizen-score/releases/latest):

| System | File |
|---|---|
| Windows 10/11, installer | `Citizen-Score_<version>_x64.msi` |
| Windows 10/11, portable | `Citizen-Score_<version>_windows-x64-portable.zip` |
| Debian, Ubuntu, Mint, Pop!_OS | `citizen-score_<version>_amd64.deb` |
| Fedora, openSUSE, Bazzite | `citizen-score-<version>-1.x86_64.rpm` |
| Arch, CachyOS, Manjaro, EndeavourOS | `citizen-score-<version>-1-x86_64.pkg.tar.zst` |
| Any other Linux | `citizen-score-<version>-linux-x86_64.tar.gz` |

**Windows.** Install [Npcap](https://npcap.com/#download) first, with *WinPcap API-compatible Mode* ticked: the meter reads the game's traffic through it. Then run the installer, or unzip the portable build and run `Citizen Score.exe`. Keep the portable folder together, because the meter reads its `data` and `plugins` from it. The downloads aren't code-signed, so SmartScreen may warn. Choose *More info → Run anyway*.

**Linux.** Install the package for your distribution:

```
sudo apt install ./citizen-score_<version>_amd64.deb          # Debian, Ubuntu
sudo dnf install ./citizen-score-<version>-1.x86_64.rpm       # Fedora
sudo pacman -U citizen-score-<version>-1-x86_64.pkg.tar.zst   # Arch
```

On other distributions, unpack the `.tar.gz` and run `sudo ./install.sh` inside it. It installs to `/opt/citizen-score`, and `sudo ./install.sh --uninstall` removes it again. Each package lets the meter capture packets (`cap_net_raw`), so it never runs as root. AION 2 runs under Proton and the meter runs natively next to it. On Hyprland the meter can pin, snap and style its own windows. On KDE it adds window rules that keep it above a fullscreen game without taking focus from it.

Relog once after starting so the meter reads your character and pet list. Settings and history are kept in `%APPDATA%\com.citizenscore.meter` on Windows and in `~/.local/share/com.citizenscore.meter` on Linux.

## Build from source

You need Rust (stable), Node 20 or newer, and on Linux WebKitGTK 4.1 and libpcap headers.

```
npm ci
npx tauri build --no-bundle -- --no-default-features --features desktop   # into src-tauri/target/release
```

On Linux, `plus/citizen-score` is a launcher for a checkout. Link it into your PATH as `citizen-score`, then:

```
citizen-score            # start (detached)
citizen-score stop | restart | log
citizen-score build      # build this checkout (offline features)
citizen-score install    # install to /opt/citizen-score and grant packet capture (polkit prompt)
citizen-score sync       # rebase on upstream's latest, build, install (conflicts: see below)
```

On Arch, `cd packaging/arch && makepkg -si` builds and installs the package from the checkout.

Citizen Score has diverged a long way from upstream: the online services, their screens and the A2Tools names are gone. `sync` still fetches upstream and starts the rebase, but expect conflicts; porting a fix by hand (`git cherry-pick`) is usually easier.

## Releasing

`.github/workflows/release.yml` builds every download above on GitHub's Windows and Linux runners, installs the Linux packages on clean Ubuntu, Debian and Fedora to check them, and publishes a release with checksums when a version tag is pushed. The tag is the version in `src-tauri/Cargo.toml` with a Citizen Score build number, `v<version>-cs.<n>`, because upstream's plain `v<version>` tags are already in the history:

```
git tag v2.0.70-cs.1 && git push origin v2.0.70-cs.1
```

Run it from the Actions tab without a tag to build the files as artifacts without releasing them.

## Map data

`plugins/plus-souls/mapdata.js` and `plugins/plus-souls/maps/*.webp` are built by

```
python3 -I tools/citizen-map/build_map.py           # fetch what's new (cached in ~/.cache/citizen-score)
python3 -I tools/citizen-map/build_map.py --offline # rebuild from the cache only
```

It reads which monsters drop each soul from `sources.js`, then takes their spawn points, the Kibelisks and the map tiles from metabot.gg's public pages, one request at a time. It never uses metabot's `/api/`, which robots.txt disallows. Rerun it after a game patch adds pets. Maps without an image, such as dungeons, are drawn as a schematic: areas grouped by their nearest Kibelisk, not to scale.

Soul pages pin only some of a soul's monsters, so the builder also reads each missing monster's own page. What still has no data (dungeon maps metabot has no tiles for, a few monsters, the Abyss Kibelisks) is listed in the Map tab's **To add** box, with a `manual.json` template. Fill it from screenshots of the in-game map: copy `tools/citizen-map/manual.example.json` to `tools/citizen-map/manual.json`, put pixel positions in place of each `[0, 0]`, and rerun the builder with `--offline`. Points are pixels on the entry's `image`, or, for maps that already have one, on `plugins/plus-souls/maps/<map>.webp` (2048 across).

The radar's `plugins/plus-souls/npcids.js` (the NPC ids of every monster that drops a soul, the bosses' names, and which NPC ids the game names at all) is built from `sources.js` and `public/i18n/npcs/en.json` by `python3 -I tools/citizen-map/build_npcids.py`. Rerun it when either changes.
