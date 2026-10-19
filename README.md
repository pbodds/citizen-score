# Citizen Score

An AION 2 combat meter for Windows and Linux, with a Pet Map and World Timers docked under the DPS list. It's based on [A2Tools DPS Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0, see LICENSE) and built **offline**: the upstream account, uploads, supporter roster, Discord activity, Send Logs, update checks and shared boss-timer feed are not compiled in. Nothing leaves this computer.

- **Pet Map** (`plugins/plus-souls`): how many souls each pet still needs, where they drop, a **Best areas** ranking, and a **Map** tab. The Map tab shows a heatmap of every spawn that drops a soul you still need, weighted by drop chance, with Kibelisks (teleport crystals) drawn as numbered landmarks. **Show on map** in a pet's sources narrows the map to that pet. Drag to pan, scroll to zoom, double-click to refit, and hover a hot spot to see which pets and monsters are there.
- **World Timers** (`plugins/plus-timers`): fixed schedules, plus field bosses this meter sees die, counted down with the respawn time it has learned.
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
citizen-score sync       # rebase on upstream's latest, build, install
```

On Arch, `cd packaging/arch && makepkg -si` builds and installs the package from the checkout.

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
