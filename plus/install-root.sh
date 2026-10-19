#!/usr/bin/env bash
# Install a built Citizen Score into /opt/citizen-score and grant it packet capture.
# Run as root (citizen-score install calls it through pkexec): root-owned, so the
# binary holding cap_net_raw can't be swapped by anything running as you.
#   install-root.sh <checkout>
set -euo pipefail
src=${1:?usage: install-root.sh <checkout>}
dest=/opt/citizen-score
rel="$src/src-tauri/target/release"
[ -x "$rel/citizen-score" ] && [ -x "$rel/citizen-score-hotkeys" ] || { echo "not built: run citizen-score build first" >&2; exit 1; }
stage=$(mktemp -d /opt/.citizen-score.XXXXXX)
trap 'rm -rf "$stage"' EXIT
install -m755 "$rel/citizen-score" "$rel/citizen-score-hotkeys" "$stage/"
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
setcap cap_net_raw=ep "$dest/citizen-score"
echo "Installed to $dest ($(getcap "$dest/citizen-score"))"
