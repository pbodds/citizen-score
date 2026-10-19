#!/bin/sh
# Citizen Score, from the portable Linux archive (citizen-score-<v>-linux-x86_64.tar.gz),
# for distributions without a .deb, .rpm or Arch package. Run it from the
# unpacked folder:
#
#   sudo ./install.sh             install to /opt/citizen-score
#   sudo ./install.sh --uninstall remove it again (settings and history stay,
#                                 in ~/.local/share/com.citizenscore.meter)
#
# Root-owned, so the binary that holds packet-capture permission (CAP_NET_RAW)
# can't be swapped by anything running as you. The meter itself never runs as
# root. Needs WebKitGTK 4.1, GTK 3, libpcap and setcap (libcap) installed.
set -eu
dest=/opt/citizen-score
here=$(cd "$(dirname "$0")" && pwd)

[ "$(id -u)" = 0 ] || { echo "Run as root: sudo $0 $*" >&2; exit 1; }

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$dest" /usr/local/bin/citizen-score \
    /usr/local/share/applications/citizen-score.desktop \
    /usr/local/share/icons/hicolor/128x128/apps/citizen-score.png
  echo "Citizen Score removed."
  exit 0
fi

[ -x "$here/citizen-score" ] || { echo "citizen-score not found next to $0" >&2; exit 1; }
command -v setcap >/dev/null || { echo "setcap is missing: install libcap (libcap2-bin on Debian/Ubuntu)" >&2; exit 1; }

stage=$(mktemp -d /opt/.citizen-score.XXXXXX)
trap 'rm -rf "$stage"' EXIT
install -m755 "$here/citizen-score" "$here/a2tools-hotkeys" "$stage/"
cp -r "$here/data" "$here/plugins" "$stage/"
install -m644 "$here/icon.png" "$here/LICENSE" "$stage/"
chown -R root:root "$stage"
chmod 755 "$stage"
rm -rf "$dest.old"
[ -d "$dest" ] && mv "$dest" "$dest.old"
mv "$stage" "$dest"
trap - EXIT
rm -rf "$dest.old"
setcap cap_net_raw=ep "$dest/citizen-score"

ln -sf "$dest/citizen-score" /usr/local/bin/citizen-score
install -Dm644 "$dest/icon.png" /usr/local/share/icons/hicolor/128x128/apps/citizen-score.png
mkdir -p /usr/local/share/applications
cat > /usr/local/share/applications/citizen-score.desktop <<DESKTOP
[Desktop Entry]
Type=Application
Name=Citizen Score
Comment=Real-time DPS meter for AION 2
Exec=$dest/citizen-score
Icon=citizen-score
StartupWMClass=citizen-score
Categories=Game;Utility;
DESKTOP

echo "Installed to $dest ($(getcap "$dest/citizen-score"))."
echo "Start it from your app menu, or run: citizen-score"
