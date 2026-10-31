use std::path::Path;

/// No installer format for this platform yet: it never updates itself.
pub fn asset_suffix() -> Option<&'static str> {
    None
}

pub fn run_installer(_package: &Path, _sha256: &str) -> Result<(), String> {
    Err("automatic updates are not supported on this platform yet".to_string())
}
