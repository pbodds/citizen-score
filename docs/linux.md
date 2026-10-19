# Citizen Score on Linux (Proton)

The meter runs natively on Linux while AION 2 runs under Proton. Every package needs a 64-bit (x86_64) system with WebKitGTK 4.1: Ubuntu 22.04, Debian 12, Fedora 39 or newer, any current Arch, Bazzite, or SteamOS through distrobox.

- **[Install](#install)** · [Bazzite and other image-based Fedoras](#bazzite-silverblue-kinoite-aurora-bluefin) · [Steam Deck and Steam Machine](#steam-deck-and-steam-machine-steamos)
- **[Update](#update)**
- **[Start and remove](#start-and-remove)**
- **[What works on Linux](#what-works-on-linux)**
- **[Global hotkeys](#global-hotkeys)**
- **[GNOME: keep the meter above other windows](#gnome-keep-the-meter-above-other-windows)**
- **[Tiling desktops](#tiling-desktops-hyprland-sway-i3)** (Hyprland, Sway, i3)
- **[Logs for a bug report](#logs-for-a-bug-report)**
- **[Troubleshooting](#troubleshooting)**

## Install

Download the package for your system from [Releases](https://github.com/pbodds/citizen-score/releases/latest) and install it. Each package grants the packet-capture permission itself (`cap_net_raw`), so you never need `setcap`, and the meter never runs as root.

| System | Command |
| --- | --- |
| Ubuntu, Debian, Linux Mint, Pop!_OS | `sudo apt install ./citizen-score_<version>_amd64.deb` |
| Fedora | `sudo dnf install ./citizen-score-<version>-1.x86_64.rpm` |
| openSUSE | `sudo zypper install ./citizen-score-<version>-1.x86_64.rpm` |
| Arch, CachyOS, Manjaro, EndeavourOS | `sudo pacman -U citizen-score-<version>-1-x86_64.pkg.tar.zst` |
| Anything else | unpack `citizen-score-<version>-linux-x86_64.tar.gz`, then `sudo ./install.sh` inside it |

On Arch you can also build the package from a checkout: `cd packaging/arch && makepkg -si`.

### Bazzite, Silverblue, Kinoite, Aurora, Bluefin

Layer the `.rpm` onto the system, then restart:

```bash
rpm-ostree install ./citizen-score-<version>-1.x86_64.rpm
```

The `.rpm` declares the capture permission in the package itself, which rpm-ostree applies; no install script is needed.

### Steam Deck and Steam Machine (SteamOS)

SteamOS replaces its read-only system with every update, so anything installed into it directly is wiped. Instead, the meter goes in a **distrobox**: a container with its own Arch Linux inside, which SteamOS 3.5 and later include. It must be created with `--root`: an ordinary (rootless) container cannot read the game's network traffic.

The overlay only works in **Desktop Mode**. In Game Mode, nothing can draw over the game.

1. Switch to Desktop Mode: press the **Steam** button, then **Power**, then **Switch to Desktop**.
2. Open **Konsole**. If you have never set a password for the `deck` user, set one now with `passwd` (sudo needs it).
3. Keep the box on your home partition. SteamOS stores containers made with `--root` on a small system partition, which the box doesn't fit on ("insufficient space"). Point that storage at your home partition, once:

    ```bash
    sudo mkdir -p /home/.citizen-score-containers
    sudo tee /etc/containers/storage.conf <<'EOF'
    [storage]
    driver = "overlay"
    graphroot = "/home/.citizen-score-containers"
    runroot = "/run/containers/storage"
    EOF
    ```

    If an earlier attempt stopped with "insufficient space", clear what it left behind first: `sudo podman system reset --force`.

4. Create the box. The first time you enter it, it takes a few minutes to set up and asks you to choose a password for your user inside the box:

    ```bash
    distrobox create --root --name citizen-score --image archlinux:latest
    ```

5. Download the Arch package from [Releases](https://github.com/pbodds/citizen-score/releases/latest) into your home folder, then install it inside the box:

    ```bash
    distrobox enter --root citizen-score -- sudo pacman -Syu --noconfirm
    distrobox enter --root citizen-score -- sudo pacman -U --noconfirm ~/citizen-score-*-x86_64.pkg.tar.zst
    ```

6. Start AION 2 from Steam, still in Desktop Mode, set to borderless or windowed. Then start the meter from Konsole:

    ```bash
    distrobox enter --root citizen-score -- citizen-score
    ```

SteamOS updates leave the box alone, so the meter survives them. This route has not been confirmed on a real Steam Deck yet.

## Update

Citizen Score doesn't check for updates or download anything. To update, download the new package from [Releases](https://github.com/pbodds/citizen-score/releases) and install it over the old one with the same command as above. Settings and history are kept.

## Start and remove

The meter is in your application menu as Citizen Score. To start it from a terminal with its output saved, which helps with a bug report:

```bash
citizen-score 2>&1 | tee ~/meter-console.log
```

To remove it:

| Installed with | Command |
| --- | --- |
| `.deb` | `sudo apt remove citizen-score` |
| `.rpm` on Fedora | `sudo dnf remove citizen-score` |
| `.rpm` on image-based Fedoras | `rpm-ostree uninstall citizen-score`, then restart |
| `.rpm` on openSUSE | `sudo zypper remove citizen-score` |
| Arch package | `sudo pacman -R citizen-score` |
| `.tar.gz` | `sudo ./install.sh --uninstall` |
| Steam Deck | `distrobox rm --root citizen-score` (removes the whole box) |

Settings and history stay in `~/.local/share/com.citizenscore.meter`.

## What works on Linux

| Feature | On Linux |
| --- | --- |
| Damage meter, Details, History | Works |
| Ping | Works |
| Pet Map, World Timers and their alert banner | Works. On Hyprland the banner goes to the bottom-right corner of another monitor |
| Finding the game | Looks for the running AION2.exe process under Proton |
| Global hotkeys | Once turned on in Settings → Keybinds, through your desktop's global shortcuts: see [Global hotkeys](#global-hotkeys) |
| Click-through lock | When the meter runs through XWayland (`GDK_BACKEND=x11 citizen-score`): turn on the lock button in Settings. On native Wayland an app cannot see where the pointer is outside its own window, so the button stays hidden there |
| Screenshots | To the clipboard and a folder (`~/Pictures/Citizen Score` by default). On Linux the meter pictures itself on a plain background, since Wayland lets no app copy the screen |
| Window settings (snap, pin, blur, shadow, border) | Hyprland |
| Auto-hide when the game loses focus | KDE Plasma |

## Global hotkeys

The meter's three hotkeys (reset, show or hide, click-through lock) work through your desktop's global shortcuts. They are off until you turn on **Use keybinds** under **Settings → Keybinds**. Wayland lets no app grab keys itself, so the meter asks the desktop for them, and the desktop has the final say on which keys they use.

The keys are registered by a small helper, `citizen-score-hotkeys`, installed next to the meter. The meter holds the permission to capture packets, and Linux won't let the desktop's shortcut service read a program holding a permission the service doesn't have, so the meter can't register shortcuts itself. The helper has no such permission and only handles keybinds.

| Desktop | What happens |
| --- | --- |
| KDE Plasma 6 | On the first start, Plasma asks you to confirm the meter's shortcuts. Change them later in **System Settings → Keyboard → Shortcuts** |
| GNOME 48 and later | GNOME asks you to confirm the shortcuts on the first start; change them in **Settings → Keyboard → Keyboard Shortcuts** |
| Hyprland | The meter binds its keys itself each time it starts, unless a key is already bound in your config. To bind them yourself instead, see below |
| Other desktops | Works if the desktop's portal supports global shortcuts; otherwise there are no hotkeys |

**Hyprland.** The meter's shortcuts are `com.citizenscore.meter:reset`, `:toggle` and `:lock`. `hyprctl globalshortcuts` lists them while the meter runs. To bind them in your config:

```lua
hl.bind("CTRL + ALT + R", hl.dsp.global("com.citizenscore.meter:reset"))
hl.bind("CTRL + ALT + Up", hl.dsp.global("com.citizenscore.meter:toggle"))
hl.bind("CTRL + ALT + L", hl.dsp.global("com.citizenscore.meter:lock"))
```

On an older Hyprland that uses `hyprland.conf`:

```
bind = CTRL ALT, R, global, com.citizenscore.meter:reset
bind = CTRL ALT, Up, global, com.citizenscore.meter:toggle
bind = CTRL ALT, L, global, com.citizenscore.meter:lock
```

A key the meter finds already bound is left to your binding, so give the meter's shortcuts keys of their own.

## GNOME: keep the meter above other windows

In a GNOME Wayland session, the meter prefers XWayland when an X11 display is available, so its always-on-top request works without a GNOME Shell extension. Only the meter uses XWayland; the session stays on Wayland. An explicit `GDK_BACKEND` takes precedence:

```sh
GDK_BACKEND=x11 citizen-score       # XWayland
GDK_BACKEND=wayland citizen-score   # native Wayland, sharper at fractional scaling
```

On native Wayland, GNOME ignores the keep-above request: focus the meter, press **Alt+Space**, and select **Always on Top**.

On GNOME the compositor resizes the meter's window directly, as it does on Hyprland. Other desktops resize it by temporarily expanding a transparent viewport.

## Tiling desktops (Hyprland, Sway, i3)

A tiling window manager tiles every new window unless told otherwise, which breaks an overlay: the meter is squeezed beside the game, and its tooltips appear in the wrong place. Give the meter's window (class `citizen-score`) a rule that makes it float and keeps it on every workspace. On Hyprland (Lua configuration):

```lua
hl.window_rule({
    name = "citizen-score",
    match = { class = "^(citizen\\-score)$" },
    float = true,
    pin = true,
    no_blur = true,
    border_size = 0,
})
```

Settings → Window can also pin the meter, snap it to a corner and turn off blur, shadow and border on Hyprland. On Sway and i3, the equivalent is `floating enable` and `sticky enable` for `app_id`/`class` `citizen-score`.

## Logs for a bug report

1. Start AION 2 from Steam as you normally do.
2. Start the meter from a terminal: `citizen-score 2>&1 | tee ~/meter-console.log`.
3. In the meter, open **Settings**. Under **Diagnostics**, tick **Enable debug logging** and **Enable packet logging**.
4. Log in, enter the world, and fight a training dummy or some monsters for a minute or two.
5. Untick **Enable packet logging**, then close the meter.

The files are `debug.log` and the newest `packets_YYYYMMDD_HHMMSS.txt` in `~/.local/share/com.citizenscore.meter/`, and `meter-console.log` in your home folder. They contain character names, yours and those of players near you, so share them with care. Say which distribution, desktop and session type (`echo $XDG_SESSION_TYPE`) you use, and whether the game was fullscreen, borderless or windowed.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `debug.log` says it failed to load libpcap | Install libpcap (`libpcap0.8` on Debian and Ubuntu, `libpcap` elsewhere), then start the meter again. |
| The meter warns it can't capture, or `debug.log` has no `Capture active` lines | The capture permission is missing: reinstall the package. A build from source needs `sudo setcap cap_net_raw=ep <binary>` after every rebuild. Don't run the meter with `sudo`. |
| `debug.log` says `No AION2 window found` while the game is running | The meter didn't find the game process. Check `ps aux \| grep -i aion`. |
| `debug.log` says `Not locked yet` with `0 with game markers` while you fight | Capture sees traffic but not the game's. A VPN or ping reducer can cause this. |
| The window never opens, with `Error 71 (Protocol error) dispatching to Wayland display`, or it's blank | Some setups (NVIDIA especially) reject WebKit's GPU buffers; the meter already asks WebKit to use shared memory. Remove `WEBKIT_DISABLE_DMABUF_RENDERER=1` if you added it to a launcher. Otherwise try `GDK_BACKEND=x11 citizen-score`. |
| The meter goes behind the game | Run the game borderless or windowed. On GNOME, see [above](#gnome-keep-the-meter-above-other-windows). On KDE Plasma the meter adds a window rule for itself on its first start ("Citizen Score above fullscreen games", Layer forced to Overlay, in System Settings → Window Management → Window Rules); restart the meter once if it's still behind. |
| On a tiling desktop the meter is tiled beside the game | See [Tiling desktops](#tiling-desktops-hyprland-sway-i3). |
