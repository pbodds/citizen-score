//! Citizen Score: the Window settings for the meter's main window.
//!
//! Keep on top goes through Tauri everywhere. The rest is the compositor's:
//! under Hyprland the meter's own window (this process, its main title) is
//! found with `hyprctl clients` and changed with Lua dispatchers (0.56 on):
//! pinned to every workspace, snapped to a corner of a monitor's free area
//! (bars excluded), and its blur, shadow, border and animations. Elsewhere
//! those report "unsupported" and the page greys them out.

use serde_json::Value;
use std::process::Command;
use tauri::Manager;

fn hyprland() -> bool {
    std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some()
}

fn hyprctl_json(what: &str) -> Option<Value> {
    let out = Command::new("hyprctl").args([what, "-j"]).output().ok()?;
    serde_json::from_slice(&out.stdout).ok()
}

fn dispatch(lua: &str) -> Result<(), String> {
    let out = Command::new("hyprctl").args(["dispatch", lua]).output().map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout);
    if text.trim() == "ok" { Ok(()) } else { Err(text.trim().to_string()) }
}

/// The main window as Hyprland lists it: this process, the main window's title.
fn main_client(app: &tauri::AppHandle) -> Option<Value> {
    let title = app.get_webview_window("main")?.title().ok()?;
    let pid = std::process::id() as u64;
    hyprctl_json("clients")?
        .as_array()?
        .iter()
        .find(|c| c["pid"].as_u64() == Some(pid) && c["title"].as_str() == Some(title.as_str()))
        .cloned()
}

fn pair(v: &Value) -> (i64, i64) {
    (v[0].as_i64().unwrap_or(0), v[1].as_i64().unwrap_or(0))
}

/// Where a window of `size` goes for `corner` on `monitor` (layout pixels),
/// `gap` in from the edges of the area bars leave free.
fn snap_target(monitor: &Value, size: (i64, i64), corner: &str, gap: i64) -> Option<(i64, i64)> {
    let scale = monitor["scale"].as_f64().filter(|s| *s > 0.0).unwrap_or(1.0);
    let transformed = monitor["transform"].as_i64().unwrap_or(0) % 2 == 1;
    let (mut w, mut h) = (monitor["width"].as_f64()? / scale, monitor["height"].as_f64()? / scale);
    if transformed {
        std::mem::swap(&mut w, &mut h);
    }
    let (mx, my) = (monitor["x"].as_i64()?, monitor["y"].as_i64()?);
    let r = &monitor["reserved"]; // left, top, right, bottom
    let res = |i: usize| r[i].as_i64().unwrap_or(0);
    let left = mx + res(0) + gap;
    let top = my + res(1) + gap;
    let right = mx + w as i64 - res(2) - gap - size.0;
    let bottom = my + h as i64 - res(3) - gap - size.1;
    let center_x = mx + (w as i64 - size.0) / 2;
    let center_y = my + (h as i64 - size.1) / 2;
    Some(match corner {
        "top-left" => (left, top),
        "top" => (center_x, top),
        "top-right" => (right, top),
        "left" => (left, center_y),
        "center" => (center_x, center_y),
        "right" => (right, center_y),
        "bottom-left" => (left, bottom),
        "bottom" => (center_x, bottom),
        "bottom-right" => (right, bottom),
        _ => return None,
    })
}

/// What the page can offer: which options this desktop supports, and the
/// monitors to snap to (by name, in hyprctl's order).
#[tauri::command]
pub fn citizen_window_caps() -> Value {
    let monitors = if hyprland() {
        hyprctl_json("monitors")
            .and_then(|m| m.as_array().cloned())
            .unwrap_or_default()
            .iter()
            .map(|m| {
                serde_json::json!({
                    "name": m["name"],
                    "label": format!("{} · {}×{}", m["name"].as_str().unwrap_or("?"),
                        m["width"].as_i64().unwrap_or(0), m["height"].as_i64().unwrap_or(0)),
                    "focused": m["focused"],
                })
            })
            .collect()
    } else {
        Vec::new()
    };
    serde_json::json!({ "compositor": hyprland(), "monitors": monitors })
}

/// One Window setting, applied to the main window now.
///   on_top {value}                  keep above other windows
///   zoom {value}                    the page's scale, 0.8 to 1.5 (the window
///                                   resizes to it, as devicePixelRatio follows)
///   pin {value}                     on every workspace (Hyprland)
///   prop {name, value}              blur | shadow | border | anim on or off (Hyprland)
///   snap {corner, monitor, gap}     move to a corner; monitor "" = the one it is on
#[tauri::command]
pub fn citizen_window(app: tauri::AppHandle, op: String, args: Value) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("no main window")?;
    if op == "on_top" {
        return window.set_always_on_top(args["value"].as_bool().unwrap_or(true)).map_err(|e| e.to_string());
    }
    if op == "zoom" {
        let value = args["value"].as_f64().unwrap_or(1.0).clamp(0.8, 1.5);
        return window.set_zoom(value).map_err(|e| e.to_string());
    }
    if !hyprland() {
        return Err("unsupported".into());
    }
    let client = main_client(&app).ok_or("main window not found")?;
    let address = client["address"].as_str().ok_or("no address")?.to_string();
    let target = format!("address:{address}");
    match op.as_str() {
        "pin" => {
            // Hyprland's pin toggles: only when it differs.
            let want = args["value"].as_bool().unwrap_or(false);
            if client["pinned"].as_bool() != Some(want) {
                dispatch(&format!(r#"hl.dsp.window.pin({{ window = "{target}" }})"#))?;
            }
            Ok(())
        }
        "prop" => {
            let prop = match args["name"].as_str() {
                Some("blur") => "no_blur",
                Some("shadow") => "no_shadow",
                Some("border") => "no_border",
                Some("anim") => "no_anim",
                _ => return Err("unknown prop".into()),
            };
            let off = if args["value"].as_bool().unwrap_or(true) { "0" } else { "1" };
            dispatch(&format!(r#"hl.dsp.window.set_prop({{ prop = "{prop}", value = "{off}", window = "{target}" }})"#))
        }
        "snap" => {
            let corner = args["corner"].as_str().unwrap_or("free");
            if corner == "free" {
                return Ok(());
            }
            let gap = args["gap"].as_i64().unwrap_or(12).clamp(0, 400);
            let wanted = args["monitor"].as_str().unwrap_or("");
            let monitors = hyprctl_json("monitors").ok_or("no monitors")?;
            let list = monitors.as_array().ok_or("no monitors")?;
            let on = client["monitor"].as_i64();
            let monitor = list
                .iter()
                .find(|m| !wanted.is_empty() && m["name"].as_str() == Some(wanted))
                .or_else(|| list.iter().find(|m| m["id"].as_i64() == on))
                .ok_or("monitor not found")?;
            let (x, y) = snap_target(monitor, pair(&client["size"]), corner, gap).ok_or("bad corner")?;
            if pair(&client["at"]) == (x, y) {
                return Ok(());
            }
            dispatch(&format!(r#"hl.dsp.window.move({{ x = {x}, y = {y}, window = "{target}" }})"#))
        }
        _ => Err("unknown op".into()),
    }
}

/// World Timers' alert banner (a plugin widget): pinned, without blur, shadow
/// or border, in the bottom-right corner of a monitor other than the focused
/// one (where the game is), else the focused one. A window rule can't do this:
/// the window takes its title only after Hyprland has mapped it. Waits for the
/// window to be listed, off the caller's thread.
pub fn place_banner(window: &tauri::WebviewWindow) {
    if !hyprland() {
        place_banner_portable(window);
        return;
    }
    let Ok(title) = window.title() else { return };
    std::thread::spawn(move || {
        let pid = std::process::id() as u64;
        let mut client = None;
        for _ in 0..40 {
            client = hyprctl_json("clients").and_then(|list| {
                list.as_array()?
                    .iter()
                    .find(|c| c["pid"].as_u64() == Some(pid) && c["title"].as_str() == Some(title.as_str()) && c["mapped"].as_bool() == Some(true))
                    .cloned()
            });
            if client.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        let Some(client) = client else { return };
        let Some(address) = client["address"].as_str() else { return };
        let target = format!("address:{address}");
        for prop in ["no_blur", "no_shadow", "no_border"] {
            let _ = dispatch(&format!(r#"hl.dsp.window.set_prop({{ prop = "{prop}", value = "1", window = "{target}" }})"#));
        }
        if client["pinned"].as_bool() != Some(true) {
            let _ = dispatch(&format!(r#"hl.dsp.window.pin({{ window = "{target}" }})"#));
        }
        let Some(monitors) = hyprctl_json("monitors") else { return };
        let Some(list) = monitors.as_array() else { return };
        let monitor = list
            .iter()
            .filter(|m| m["focused"].as_bool() != Some(true))
            .max_by_key(|m| m["x"].as_i64().unwrap_or(0))
            .or_else(|| list.first());
        let Some((x, y)) = monitor.and_then(|m| snap_target(m, pair(&client["size"]), "bottom-right", 24)) else { return };
        let _ = dispatch(&format!(r#"hl.dsp.window.move({{ x = {x}, y = {y}, window = "{target}" }})"#));
    });
}

/// Elsewhere (Windows, other Linux desktops), through Tauri: the bottom-right
/// of the work area (taskbar excluded) of a monitor other than the meter's,
/// which sits over the game, else the meter's own. Wayland desktops other than
/// Hyprland ignore the move, and the banner opens where they put it.
fn place_banner_portable(window: &tauri::WebviewWindow) {
    let Ok(monitors) = window.available_monitors() else { return };
    let meter = window.app_handle().get_webview_window("main").and_then(|w| w.current_monitor().ok().flatten());
    let same = |m: &tauri::Monitor| meter.as_ref().is_some_and(|o| o.position() == m.position() && o.size() == m.size());
    let Some(monitor) = monitors
        .iter()
        .filter(|m| !same(m))
        .max_by_key(|m| m.position().x)
        .or(meter.as_ref())
        .or(monitors.first())
    else {
        return;
    };
    let Ok(size) = window.outer_size() else { return };
    let area = monitor.work_area();
    let gap = (24.0 * monitor.scale_factor()) as i32;
    let x = area.position.x + area.size.width as i32 - size.width as i32 - gap;
    let y = area.position.y + area.size.height as i32 - size.height as i32 - gap;
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snaps_inside_the_free_area() {
        let m = serde_json::json!({ "x": 1920, "y": -180, "width": 3440, "height": 1440, "scale": 1.0,
            "transform": 0, "reserved": [0, 26, 0, 0] });
        assert_eq!(snap_target(&m, (400, 300), "top-left", 12), Some((1932, -142)));
        assert_eq!(snap_target(&m, (400, 300), "bottom-right", 12), Some((1920 + 3440 - 412, -180 + 1440 - 312)));
        assert_eq!(snap_target(&m, (400, 300), "center", 12), Some((1920 + 1520, -180 + 570)));
        assert_eq!(snap_target(&m, (400, 300), "free", 12), None);
    }
}
