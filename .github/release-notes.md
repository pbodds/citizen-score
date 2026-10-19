## Downloads

| System | File |
|---|---|
| Windows 10/11 (installer) | `Citizen-Score_*_x64.msi` |
| Windows 10/11 (portable) | `Citizen-Score_*_windows-x64-portable.zip` |
| Debian, Ubuntu, Mint, Pop!_OS | `citizen-score_*_amd64.deb` |
| Fedora, openSUSE, Bazzite | `citizen-score-*.x86_64.rpm` |
| Arch, CachyOS, Manjaro, EndeavourOS | `citizen-score-*.pkg.tar.zst` |
| Any other Linux | `citizen-score-*-linux-x86_64.tar.gz` (unpack, `sudo ./install.sh`) |

**Windows** needs [Npcap](https://npcap.com/#download) installed first, with *WinPcap API-compatible Mode* ticked. The files aren't code-signed, so SmartScreen may warn: choose *More info → Run anyway*.

**Linux**: the packages grant packet-capture permission (`cap_net_raw`) to the meter on install, so it never runs as root. AION 2 runs under Proton; the meter runs natively next to it.

Check a download against `SHA256SUMS.txt` with `sha256sum -c SHA256SUMS.txt --ignore-missing`.
