//! Installing a downloaded update, the way this meter was installed:
//!
//! - a package (/usr/bin/citizen-score): the package manager that owns it
//!   installs the new one (the Arch package through pacman, the .deb through
//!   apt, the .rpm through dnf, zypper or rpm);
//! - /opt/citizen-score (the portable archive's install.sh, or a checkout's
//!   `citizen-score install`): the archive is unpacked over it, the same steps
//!   install.sh takes, without touching /usr/local.
//!
//! pkexec asks for the password through the desktop's own prompt. The package
//! is copied somewhere only root can write and its checksum checked again
//! there, so nothing running as you can swap it between the meter's check and
//! the install. Packet capture is granted to the new binary again (the
//! packages' own install scripts do it; for /opt the script below).

use std::path::Path;
use std::process::{Command, Stdio};

const PACKAGE_BINARY: &str = "/usr/bin/citizen-score";
const OPT_BINARY: &str = "/opt/citizen-score/citizen-score";

/// How this meter was installed, and so how it updates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Install {
    Pacman,
    Apt,
    Dpkg,
    Dnf,
    Zypper,
    Rpm,
    Opt,
}

impl Install {
    /// The release file it installs from.
    fn asset_suffix(self) -> &'static str {
        match self {
            Install::Pacman => "-x86_64.pkg.tar.zst",
            Install::Apt | Install::Dpkg => "_amd64.deb",
            Install::Dnf | Install::Zypper | Install::Rpm => ".x86_64.rpm",
            Install::Opt => "-linux-x86_64.tar.gz",
        }
    }

    /// The command, run as root, that installs the package file `$f`.
    fn install_command(self) -> &'static str {
        match self {
            Install::Pacman => r#"/usr/bin/pacman -U --noconfirm "$f""#,
            // apt resolves any new dependency; dpkg alone would leave it broken.
            Install::Apt => r#"/usr/bin/apt-get install -y --allow-downgrades "$f""#,
            Install::Dpkg => r#"/usr/bin/dpkg -i "$f""#,
            Install::Dnf => r#"/usr/bin/dnf install -y "$f""#,
            // Our packages are not signed with a key zypper knows.
            Install::Zypper => r#"/usr/bin/zypper --non-interactive install --allow-unsigned-rpm "$f""#,
            Install::Rpm => r#"/usr/bin/rpm -U --replacepkgs "$f""#,
            Install::Opt => OPT_INSTALL,
        }
    }
}

/// Unpacks the portable archive `$f` (in `$stage`) over /opt/citizen-score:
/// install.sh's steps, without its /usr/local launcher and menu entry.
const OPT_INSTALL: &str = r#"
    tar -xzf "$f" -C "$stage"
    src=$(find "$stage" -mindepth 1 -maxdepth 1 -type d -name 'citizen-score-*' | head -n1)
    [ -x "$src/citizen-score" ] || { echo "the archive has no citizen-score" >&2; exit 1; }
    dest=/opt/citizen-score
    new=$(mktemp -d /opt/.citizen-score.XXXXXX)
    install -m755 "$src/citizen-score" "$src/citizen-score-hotkeys" "$new/"
    cp -r "$src/data" "$src/plugins" "$new/"
    install -m644 "$src/icon.png" "$new/"
    [ -f "$src/LICENSE" ] && install -m644 "$src/LICENSE" "$new/"
    chown -R root:root "$new"
    chmod 755 "$new"
    rm -rf "$dest.old"
    [ -d "$dest" ] && mv "$dest" "$dest.old"
    mv "$new" "$dest"
    rm -rf "$dest.old"
    setcap cap_net_raw=ep "$dest/citizen-score"
"#;

fn succeeds(program: &str, args: &[&str]) -> bool {
    Path::new(program).exists()
        && Command::new(program)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
}

/// How the running meter was installed. A build run from a checkout, or a
/// copy put somewhere else by hand, is neither and is left alone.
fn install() -> Option<Install> {
    let exe = std::env::current_exe().ok()?;
    if !Path::new("/usr/bin/pkexec").exists() {
        return None;
    }
    if exe == Path::new(OPT_BINARY) {
        return Some(Install::Opt);
    }
    if exe != Path::new(PACKAGE_BINARY) {
        return None;
    }
    // Bazzite, Silverblue and the other image-based Fedoras: /usr is read-only
    // and packages are layered with rpm-ostree, updated with the system.
    if Path::new("/run/ostree-booted").exists() {
        return None;
    }
    if succeeds("/usr/bin/pacman", &["-Qqo", PACKAGE_BINARY]) {
        return Some(Install::Pacman);
    }
    if succeeds("/usr/bin/dpkg", &["-S", PACKAGE_BINARY]) {
        return Some(if Path::new("/usr/bin/apt-get").exists() { Install::Apt } else { Install::Dpkg });
    }
    if succeeds("/usr/bin/rpm", &["-qf", PACKAGE_BINARY]) {
        return Some(if Path::new("/usr/bin/dnf").exists() {
            Install::Dnf
        } else if Path::new("/usr/bin/zypper").exists() {
            Install::Zypper
        } else {
            Install::Rpm
        });
    }
    None
}

/// The end of the release file name this install updates from, or None when
/// it can't update itself.
pub fn asset_suffix() -> Option<&'static str> {
    install().map(Install::asset_suffix)
}

/// Once the meter has exited: check the package again as root, install it,
/// then start the meter again (the new one, or the old one if the password
/// prompt was cancelled, so a refused update never leaves you without one).
pub fn run_installer(package: &Path, sha256: &str) -> Result<(), String> {
    use std::os::unix::process::CommandExt;
    let how = install().ok_or("this install cannot update itself")?;
    if sha256.len() != 64 || !sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("bad checksum".into());
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let root = format!(
        r#"
        set -eu
        stage=$(mktemp -d /var/tmp/.citizen-score-update.XXXXXX)
        trap 'rm -rf "$stage"' EXIT
        f="$stage/$(basename "$1")"
        cp "$1" "$f"
        echo "$2  $f" | sha256sum -c --quiet
        {install}
        "#,
        install = how.install_command(),
    );
    let outer = r#"
        while kill -0 "$2" 2>/dev/null; do sleep 0.2; done
        if pkexec /bin/sh -c "$5" citizen-score-update "$1" "$3"; then
          echo "Citizen Score: update installed"
        else
          echo "Citizen Score: update not installed (cancelled or failed)"
        fi
        rm -f "$1"
        if command -v uwsm-app >/dev/null; then exec uwsm-app -- "$4"; else exec "$4"; fi
    "#;
    tracing::info!("Updating through {:?}: {}", how, package.display());
    Command::new("/bin/sh")
        .arg("-c")
        .arg(outer)
        .arg("citizen-score-update")
        .arg(package)
        .arg(std::process::id().to_string())
        .arg(sha256)
        .arg(exe)
        .arg(root)
        .stdin(Stdio::null())
        // Its own process group, so closing a terminal the meter was started
        // from does not take the update down with it. Output goes to the
        // meter's own log.
        .process_group(0)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("could not start the update: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_install_takes_its_own_file() {
        assert_eq!(Install::Pacman.asset_suffix(), "-x86_64.pkg.tar.zst");
        assert_eq!(Install::Apt.asset_suffix(), "_amd64.deb");
        assert_eq!(Install::Dnf.asset_suffix(), ".x86_64.rpm");
        assert_eq!(Install::Opt.asset_suffix(), "-linux-x86_64.tar.gz");
    }

    #[test]
    fn a_test_run_is_not_an_installed_meter() {
        assert_eq!(install(), None);
        assert_eq!(asset_suffix(), None);
    }
}
