# A2Tools Plus

A fork of [A2Tools DPS Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0) that runs beside the packaged meter, with:

- **World Timers+** (`plugins/plus-timers`, from A2 Tools' Event Timers): events, scheduled bosses and field bosses. A field boss this meter sees die starts its countdown at once, using the respawn learned the first time you open the map after one of its kills (shown with ≈). Bosses on the map you're on are marked 📍 and listed first. Alerts also go to the desktop through notify-send.
- **Pet Souls+** (`plugins/plus-souls`, from A2 Tools' Pet Soul Tracker): the pet list plus an **Areas** tab that ranks zones by how many unfinished pets drop souls there and how many souls they still need, with expected kills and the nearest Kibelisk. The map you're on comes first.
- Core: `events:zone` for plugins (`zone`, `bossKill`, `a2.localWorld()`), `a2.desktopNotify()`, plugins in `plugins/` load as trusted, its own identity (`com.a2plus.meter`, binary `a2plus`), and the self-updater turned off.

## Use

```
a2plus            # start (detached)
a2plus stop | restart | log
a2plus build      # build this checkout
a2plus install    # install to /opt/a2plus and grant packet capture (polkit prompt)
a2plus sync       # rebase on upstream's latest, build, install
```

Relog once after starting so the meter reads your character and pet list.
