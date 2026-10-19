#!/usr/bin/env bash
# Install a built A2Tools Plus into /opt/a2plus and grant it packet capture.
# Run as root (a2plus install calls it through pkexec): root-owned, so the
# binary holding cap_net_raw can't be swapped by anything running as you.
#   install-root.sh <checkout>
set -euo pipefail
src=${1:?usage: install-root.sh <checkout>}
dest=/opt/a2plus
rel="$src/src-tauri/target/release"
[ -x "$rel/a2plus" ] && [ -x "$rel/a2tools-hotkeys" ] || { echo "not built: run a2plus build first" >&2; exit 1; }
stage=$(mktemp -d /opt/.a2plus.XXXXXX)
trap 'rm -rf "$stage"' EXIT
install -m755 "$rel/a2plus" "$rel/a2tools-hotkeys" "$stage/"
cp -r "$src/src/data" "$stage/data"
cp -r "$src/plugins" "$stage/plugins"
install -Dm644 "$src/src-tauri/icons/128x128.png" "$stage/icon.png"
chown -R root:root "$stage"
chmod 755 "$stage"
rm -rf "$dest.old"
[ -d "$dest" ] && mv "$dest" "$dest.old"
mv "$stage" "$dest"
trap - EXIT
rm -rf "$dest.old"
setcap cap_net_raw=ep "$dest/a2plus"
echo "Installed to $dest ($(getcap "$dest/a2plus"))"
