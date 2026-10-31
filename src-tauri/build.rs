fn main() {
    // `tauri_build` generates the Windows resource bundle and the capability
    // schema. It cannot run for the wasm32 build of the parser — that build
    // exists so the log service can re-derive an uploaded fight with the same
    // code the client ran, and it has no Tauri in it at all.
    #[cfg(feature = "desktop")]
    tauri_build::build();

    // The release this build is (updater.rs): CITIZEN_RELEASE from the release
    // workflow (the tag it builds), or else the newest Citizen Score tag in the
    // checkout's history. Empty when neither is there.
    println!("cargo:rerun-if-env-changed=CITIZEN_RELEASE");
    for path in ["../.git/HEAD", "../.git/refs/tags", "../.git/packed-refs"] {
        if std::path::Path::new(path).exists() {
            println!("cargo:rerun-if-changed={path}");
        }
    }
    let is_release = |t: &str| t.starts_with('v') && t.contains("-cs.");
    let release = std::env::var("CITIZEN_RELEASE")
        .ok()
        .filter(|t| is_release(t))
        .or_else(|| {
            let out = std::process::Command::new("git")
                .args(["describe", "--tags", "--abbrev=0", "--match", "v*-cs.*"])
                .output()
                .ok()?;
            let tag = String::from_utf8(out.stdout).ok()?.trim().to_string();
            (out.status.success() && is_release(&tag)).then_some(tag)
        })
        .unwrap_or_default();
    println!("cargo:rustc-env=CITIZEN_RELEASE={release}");
}
