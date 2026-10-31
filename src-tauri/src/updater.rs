//! Citizen Score: updates from the project's GitHub releases.
//!
//! The meter knows which release it was built as (`CITIZEN_RELEASE`, set by
//! build.rs: the `v<version>-cs.<n>` tag). `update_check` asks GitHub for the
//! latest release and says whether it is newer; `update_install` downloads the
//! file this install updates from (platform::updater picks it: the MSI, the
//! package its package manager installed, or the portable archive for
//! /opt/citizen-score), checks it against the release's SHA256SUMS.txt, hands
//! it to the platform installer and exits so it can be replaced.
//!
//! Requests go only to api.github.com and github.com (and the release-asset
//! host GitHub redirects downloads to), only for this repository, and only
//! when the check is turned on (Settings → Updates).

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::sync::OnceLock;
use std::time::Duration;

const REPO: &str = "pbodds/citizen-score";
const MAX_JSON: u64 = 2 << 20;
const MAX_PACKAGE: u64 = 300 << 20;

/// The release this build is, e.g. "v2.0.70-cs.3"; "" for a build made
/// outside a release checkout.
pub const RELEASE: &str = env!("CITIZEN_RELEASE");

fn agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(600)))
            .timeout_connect(Some(Duration::from_secs(15)))
            .user_agent(concat!("CitizenScore/", env!("CARGO_PKG_VERSION")))
            .build()
            .into()
    })
}

/// The Citizen Score build number of a tag: "v2.0.70-cs.3" → (2, 0, 70, 3).
/// A plain upstream tag ("v2.0.70") counts as build 0 of that version.
fn tag_order(tag: &str) -> Option<(u32, u32, u32, u32)> {
    let rest = tag.strip_prefix('v')?;
    let (version, cs) = match rest.split_once("-cs.") {
        Some((v, n)) => (v, n.parse().ok()?),
        None => (rest, 0),
    };
    let mut parts = version.split('.').map(|p| p.parse::<u32>().ok());
    let (a, b, c) = (parts.next()??, parts.next()??, parts.next()??);
    if parts.next().is_some() {
        return None;
    }
    Some((a, b, c, cs))
}

/// Whether `latest` is a newer release than `current`.
fn is_newer(latest: &str, current: &str) -> bool {
    match (tag_order(latest), tag_order(current)) {
        (Some(l), Some(c)) => l > c,
        // A build that doesn't know its release: anything published is news.
        (Some(_), None) => true,
        _ => false,
    }
}

fn get_json(url: &str) -> Result<Value, String> {
    let mut res = agent()
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("GitHub: {e}"))?;
    res.body_mut().with_config().limit(MAX_JSON).read_json::<Value>().map_err(|e| format!("GitHub: {e}"))
}

fn latest_release() -> Result<Value, String> {
    get_json(&format!("https://api.github.com/repos/{REPO}/releases/latest"))
}

/// The download URL of the release file whose name ends with `suffix`.
fn asset<'a>(release: &'a Value, pred: impl Fn(&str) -> bool) -> Option<(&'a str, &'a str)> {
    release.get("assets")?.as_array()?.iter().find_map(|a| {
        let name = a.get("name")?.as_str()?;
        let url = a.get("browser_download_url")?.as_str()?;
        pred(name).then_some((name, url))
    })
}

/// Only this repository's release downloads.
fn allowed(url: &str) -> bool {
    url.starts_with(&format!("https://github.com/{REPO}/releases/download/"))
}

fn summary(release: &Value) -> Value {
    let latest = release.get("tag_name").and_then(Value::as_str).unwrap_or("");
    let suffix = crate::platform::updater::asset_suffix();
    let file = suffix.and_then(|s| asset(release, |n| n.ends_with(s))).map(|(n, _)| n);
    json!({
        "current": RELEASE,
        "latest": latest,
        "newer": is_newer(latest, RELEASE),
        "name": release.get("name").and_then(Value::as_str).unwrap_or(latest),
        "notes": release.get("body").and_then(Value::as_str).unwrap_or("").chars().take(4000).collect::<String>(),
        "url": release.get("html_url").and_then(Value::as_str).unwrap_or(""),
        "published": release.get("published_at").and_then(Value::as_str).unwrap_or(""),
        // Whether this install can put the update in place itself.
        "installable": file.is_some(),
        "file": file,
    })
}

#[tauri::command]
pub fn update_current() -> &'static str {
    RELEASE
}

/// The latest release, and whether it is newer than this build.
#[tauri::command]
pub async fn update_check() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| latest_release().map(|r| summary(&r)))
        .await
        .map_err(|e| e.to_string())?
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// The checksum SHA256SUMS.txt lists for `file`.
fn listed_sum(sums: &str, file: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let (sum, name) = line.split_once(char::is_whitespace)?;
        let name = name.trim_start().trim_start_matches('*');
        (name == file && sum.len() == 64).then(|| sum.to_ascii_lowercase())
    })
}

fn download(url: &str, limit: u64) -> Result<Vec<u8>, String> {
    if !allowed(url) {
        return Err(format!("not a {REPO} release file: {url}"));
    }
    let mut res = agent().get(url).call().map_err(|e| format!("download: {e}"))?;
    let mut bytes = Vec::new();
    res.body_mut()
        .with_config()
        .limit(limit)
        .reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("download: {e}"))?;
    Ok(bytes)
}

/// Download the latest release's file for this install, check it, start its
/// installer and exit. The meter comes back on its own once it is installed.
#[tauri::command]
pub async fn update_install(app: tauri::AppHandle) -> Result<(), String> {
    let path = tauri::async_runtime::spawn_blocking(|| -> Result<(std::path::PathBuf, String), String> {
        let suffix = crate::platform::updater::asset_suffix().ok_or("this install can't update itself: download the new version from GitHub")?;
        let release = latest_release()?;
        let latest = release.get("tag_name").and_then(Value::as_str).unwrap_or("");
        if !is_newer(latest, RELEASE) {
            return Err("already up to date".into());
        }
        let (file, url) = asset(&release, |n| n.ends_with(suffix)).ok_or("the release has no file for this install")?;
        let (_, sums_url) = asset(&release, |n| n == "SHA256SUMS.txt").ok_or("the release has no SHA256SUMS.txt")?;
        let sums = String::from_utf8(download(sums_url, MAX_JSON)?).map_err(|_| "SHA256SUMS.txt is not text")?;
        let want = listed_sum(&sums, file).ok_or_else(|| format!("SHA256SUMS.txt doesn't list {file}"))?;
        let bytes = download(url, MAX_PACKAGE)?;
        let got = sha256_hex(&bytes);
        if got != want {
            return Err(format!("{file} doesn't match its checksum; not installing it"));
        }
        let dir = std::env::temp_dir().join("citizen-score-update");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        // The name matters: package managers go by the extension.
        let path = dir.join(file.rsplit('/').next().unwrap_or(file));
        std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
        tracing::info!("Update {latest}: {} ({} bytes, sha256 {got})", path.display(), bytes.len());
        Ok((path, got))
    })
    .await
    .map_err(|e| e.to_string())??;
    crate::platform::updater::run_installer(&path.0, &path.1)?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_goes_by_version_then_build() {
        assert!(is_newer("v2.0.70-cs.4", "v2.0.70-cs.3"));
        assert!(is_newer("v2.0.71-cs.1", "v2.0.70-cs.9"));
        assert!(is_newer("v2.0.70-cs.10", "v2.0.70-cs.9"));
        assert!(!is_newer("v2.0.70-cs.3", "v2.0.70-cs.3"));
        assert!(!is_newer("v2.0.70-cs.2", "v2.0.70-cs.3"));
        assert!(is_newer("v2.0.70-cs.1", ""));
        assert!(!is_newer("nonsense", "v2.0.70-cs.3"));
    }

    #[test]
    fn sums_are_read_by_file_name() {
        let a = "a".repeat(64);
        let b = "B".repeat(64);
        let sums = format!("{a}  Citizen-Score_2.0.70_x64.msi\n{b} *citizen-score_2.0.70_amd64.deb\n");
        assert_eq!(listed_sum(&sums, "Citizen-Score_2.0.70_x64.msi").as_deref(), Some(a.as_str()));
        assert_eq!(listed_sum(&sums, "citizen-score_2.0.70_amd64.deb"), Some("b".repeat(64)));
        assert_eq!(listed_sum(&sums, "other"), None);
    }

    #[test]
    fn only_this_repositorys_downloads() {
        assert!(allowed("https://github.com/pbodds/citizen-score/releases/download/v2.0.70-cs.3/SHA256SUMS.txt"));
        assert!(!allowed("https://github.com/someone/else/releases/download/x/y"));
        assert!(!allowed("http://github.com/pbodds/citizen-score/releases/download/x"));
    }
}
