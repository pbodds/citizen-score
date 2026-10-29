//! Citizen Score: player lookup, for plugins with the `net:players` permission.
//!
//! The meter's only outbound requests, and only when the player searches: the
//! JSON routes NCSOFT's own character pages call (unofficial, undocumented;
//! paths from github.com/nuriland/aion2-api). A plugin page can't reach them
//! itself (no network in its sandbox, and no CORS), so it names an operation
//! and its fields, and the URL is built here: hosts and paths are fixed, and
//! nothing else leaves the machine.
//!
//! Answers are kept 5 minutes (images an hour) so paging back and forth
//! doesn't ask again.

use base64::Engine as _;
use parking_lot::Mutex;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const SEARCH: &str = "https://api-search.plaync.com/aion2global/search/v2/character";
const SITE: &str = "https://aion2.plaync.com/api/character/";
/// Images may only come from NCSOFT's portrait and game-icon hosts.
const IMAGE_PREFIXES: [&str; 2] = [
    "https://profileimg.plaync.com/game_profile_images/",
    "https://assets.playnccdn.com/static-aion2-gamedata/resources/",
];
/// Global's five shards (NA East, NA West, Europe, Latin America, Asia).
const REGIONS: [&str; 5] = ["nae", "naw", "eu", "la", "as"];
const JSON_TTL: Duration = Duration::from_secs(300);
const IMAGE_TTL: Duration = Duration::from_secs(3600);
const MAX_BODY: u64 = 4 << 20;

fn cache() -> &'static Mutex<HashMap<String, (Instant, Value)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (Instant, Value)>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

fn agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(15)))
            .user_agent(concat!("CitizenScore/", env!("CARGO_PKG_VERSION")))
            .build()
            .into()
    })
}

fn text(args: &Value, key: &str, max: usize) -> Result<String, String> {
    let s = args.get(key).and_then(Value::as_str).unwrap_or("").trim().to_string();
    if s.is_empty() || s.len() > max {
        return Err(format!("{key}: expected text up to {max} bytes"));
    }
    Ok(s)
}

fn number(args: &Value, key: &str, range: std::ops::RangeInclusive<u64>) -> Result<u64, String> {
    let n = args.get(key).and_then(Value::as_u64).ok_or_else(|| format!("{key}: expected a number"))?;
    if range.contains(&n) { Ok(n) } else { Err(format!("{key}: out of range")) }
}

fn region(args: &Value) -> Result<&'static str, String> {
    let r = args.get("region").and_then(Value::as_str).unwrap_or("nae");
    REGIONS.iter().copied().find(|x| *x == r).ok_or_else(|| "region: one of nae, naw, eu, la, as".into())
}

/// Search hands out ids percent-encoded ("…%3D"); the other routes want them plain.
fn character_id(args: &Value) -> Result<String, String> {
    let raw = text(args, "characterId", 200)?;
    let id = raw.replace("%3D", "=").replace("%3d", "=").replace("%2B", "+").replace("%2F", "/");
    if id.chars().all(|c| c.is_ascii_alphanumeric() || "-_=+/".contains(c)) {
        Ok(id)
    } else {
        Err("characterId: not an id".into())
    }
}

/// The request for an operation: (url, query pairs). Every value is checked.
fn request(op: &str, args: &Value) -> Result<(String, Vec<(&'static str, String)>), String> {
    let reg = region(args)?;
    match op {
        "search" => {
            let mut q = vec![
                ("keyword", text(args, "keyword", 64)?),
                ("region", reg.to_string()),
                ("localeInfo", "en-US".to_string()),
                ("page", number(args, "page", 1..=500).unwrap_or(1).to_string()),
                ("size", number(args, "size", 1..=50).unwrap_or(20).to_string()),
            ];
            if let Ok(race) = number(args, "race", 1..=2) {
                q.push(("race", race.to_string()));
            }
            if let Ok(server) = number(args, "serverId", 1000..=9999) {
                q.push(("serverId", server.to_string()));
            }
            Ok((SEARCH.to_string(), q))
        }
        "info" | "equipment" | "daevanion" | "item" => {
            let mut q = vec![
                ("lang", "en-US".to_string()),
                ("region", reg.to_string()),
                ("serverId", number(args, "serverId", 1000..=9999)?.to_string()),
                ("characterId", character_id(args)?),
            ];
            let path = match op {
                "daevanion" => {
                    q.push(("boardId", number(args, "boardId", 1..=999)?.to_string()));
                    "daevanion/detail"
                }
                // One equipped piece: item level, Manastones, Theostone slot.
                "item" => {
                    q.push(("id", number(args, "id", 1..=9_999_999_999)?.to_string()));
                    q.push(("enchantLevel", number(args, "enchantLevel", 0..=99)?.to_string()));
                    q.push(("slotPos", number(args, "slotPos", 0..=999)?.to_string()));
                    "equipment/item"
                }
                other => other,
            };
            Ok((format!("{SITE}{path}"), q))
        }
        _ => Err(format!("unknown operation {op:?}")),
    }
}

fn get_json(url: &str, query: &[(&'static str, String)]) -> Result<Value, String> {
    let mut req = agent().get(url).header("Accept", "application/json");
    for (k, v) in query {
        req = req.query(*k, v);
    }
    let mut res = req.call().map_err(|e| format!("PLAYNC: {e}"))?;
    res.body_mut()
        .with_config()
        .limit(MAX_BODY)
        .read_json::<Value>()
        .map_err(|e| format!("PLAYNC answered something unreadable: {e}"))
}

/// A portrait or icon, as a data: URL the plugin can show.
fn get_image(url: &str) -> Result<Value, String> {
    if url.len() > 512 || !IMAGE_PREFIXES.iter().any(|p| url.starts_with(p)) || url.contains("..") {
        return Err("not a PLAYNC image".into());
    }
    let mut res = agent().get(url).call().map_err(|e| format!("PLAYNC: {e}"))?;
    let kind = res.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("image/png").to_string();
    if !kind.starts_with("image/") {
        return Err("not an image".into());
    }
    let bytes = res.body_mut().with_config().limit(MAX_BODY).read_to_vec().map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(Value::String(format!("data:{kind};base64,{b64}")))
}

#[tauri::command]
pub async fn plugin_players(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    plugin: Option<String>,
    op: String,
    args: Value,
) -> Result<Value, String> {
    let id = super::window_plugin(&window, plugin.as_deref())?;
    super::require(&app, &id, "net:players")?;
    let (key, ttl) = if op == "image" {
        (format!("image {}", args.get("url").and_then(Value::as_str).unwrap_or("")), IMAGE_TTL)
    } else {
        let (url, q) = request(&op, &args)?;
        (format!("{url}?{q:?}"), JSON_TTL)
    };
    if let Some((at, v)) = cache().lock().get(&key) {
        if at.elapsed() < ttl {
            return Ok(v.clone());
        }
    }
    let job = {
        let (op, args) = (op.clone(), args.clone());
        move || {
            if op == "image" {
                get_image(args.get("url").and_then(Value::as_str).unwrap_or(""))
            } else {
                let (url, q) = request(&op, &args)?;
                get_json(&url, &q)
            }
        }
    };
    let value = tokio::task::spawn_blocking(job).await.map_err(|e| e.to_string())??;
    let mut c = cache().lock();
    c.retain(|_, (at, _)| at.elapsed() < IMAGE_TTL);
    c.insert(key, (Instant::now(), value.clone()));
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_fixed_routes() {
        assert!(request("search", &json!({ "keyword": "Nemo" })).unwrap().0.starts_with("https://api-search.plaync.com/"));
        assert!(request("search", &json!({ "keyword": "" })).is_err());
        assert!(request("search", &json!({ "keyword": "a", "region": "kr" })).is_err());
        assert!(request("../x", &json!({})).is_err());
        let (url, q) = request("info", &json!({ "serverId": 2103, "characterId": "abc-_%3D" })).unwrap();
        assert_eq!(url, "https://aion2.plaync.com/api/character/info");
        assert!(q.contains(&("characterId", "abc-_=".to_string())));
        assert!(request("info", &json!({ "serverId": 2103, "characterId": "a&b=c" })).is_err());
        let (url, _) = request("item", &json!({ "serverId": 2103, "characterId": "x", "id": 110730051, "enchantLevel": 10, "slotPos": 1 })).unwrap();
        assert_eq!(url, "https://aion2.plaync.com/api/character/equipment/item");
        assert!(request("item", &json!({ "serverId": 2103, "characterId": "x" })).is_err());
        assert!(get_image("https://evil.example/x.png").is_err());
        assert!(get_image("https://assets.playnccdn.com/static-aion2-gamedata/resources/../../x").is_err());
    }
}
