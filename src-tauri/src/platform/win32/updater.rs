//! Installing a downloaded update: the MSI, over the current install.

use std::path::Path;

/// The release file this install updates from: the MSI. The portable copy
/// (its README.txt beside the exe, release.yml) is left alone.
pub fn asset_suffix() -> Option<&'static str> {
    let exe = std::env::current_exe().ok()?;
    let portable = exe.parent()?.join("README.txt").exists();
    (!portable).then_some("_x64.msi")
}

/// Start the MSI installer over the current install and return; the caller
/// exits so the installer can replace the running files. The checksum was
/// checked by the caller.
///
/// msiexec.exe uses its own non-standard command line parser, so
/// PROPERTY="value" pairs with spaces require literal embedded quotes, which
/// std::process::Command's normal arg quoting does not produce. raw_arg
/// controls the exact command line.
pub fn run_installer(package: &Path, _sha256: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let install_dir = exe.parent().ok_or("no install folder")?.display().to_string();
    let mut cmd = std::process::Command::new("msiexec");
    cmd.raw_arg("/i")
        .raw_arg(format!("\"{}\"", package.display()))
        .raw_arg("/passive")
        .raw_arg(format!("INSTALLDIR=\"{}\"", install_dir))
        .raw_arg("AUTOLAUNCHAPP=1");
    tracing::info!("msiexec /i \"{}\" /passive INSTALLDIR=\"{}\" AUTOLAUNCHAPP=1", package.display(), install_dir);
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}
