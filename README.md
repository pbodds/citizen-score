# Citizen Score

An AION 2 combat meter for this desktop, with a Pet Map and World Timers docked under the DPS list. It's based on [A2Tools DPS Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0, see LICENSE) and built **offline**: the upstream account, uploads, supporter roster, Discord activity, Send Logs, update checks and shared boss-timer feed are not compiled in. Nothing leaves this computer.

- **Pet Map** (`plugins/plus-souls`): how many souls each pet still needs, where they drop, a **Best areas** ranking, and a **Map** tab. The Map tab shows a heatmap of every spawn that drops a soul you still need, weighted by drop chance, with Kibelisks (teleport crystals) drawn as numbered landmarks. **Show on map** in a pet's sources narrows the map to that pet. Drag to pan, scroll to zoom, double-click to refit, and hover a hot spot to see which pets and monsters are there.
- **World Timers** (`plugins/plus-timers`): fixed schedules, plus field bosses this meter sees die, counted down with the respawn time it has learned.
- **Settings → Window**: snap the meter to a corner or edge of any monitor (it stays put as it resizes), set the edge gap, keep it on top, pin it to every workspace, set interface scale, corner rounding, panel height and accent colour, and toggle Hyprland's blur, shadow, border and animations for the meter. Settings also has a search box.

## Use

```
citizen-score            # start (detached)
citizen-score stop | restart | log
citizen-score build      # build this checkout (offline features)
citizen-score install    # install to /opt/citizen-score and grant packet capture (polkit prompt)
citizen-score sync       # rebase on upstream's latest, build, install
```

Relog once after starting so the meter reads your character and pet list.

## Map data

`plugins/plus-souls/mapdata.js` and `plugins/plus-souls/maps/*.webp` are built by

```
python3 -I tools/citizen-map/build_map.py           # fetch what's new (cached in ~/.cache/citizen-score)
python3 -I tools/citizen-map/build_map.py --offline # rebuild from the cache only
```

It reads which monsters drop each soul from `sources.js`, then takes their spawn points, the Kibelisks and the map tiles from metabot.gg's public pages, one request at a time. It never uses metabot's `/api/`, which robots.txt disallows. Rerun it after a game patch adds pets. Maps without an image, such as dungeons, are drawn as a schematic: areas grouped by their nearest Kibelisk, not to scale.
