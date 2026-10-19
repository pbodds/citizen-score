//! When the capture library will not load and the meter can install it
//! (Windows: Npcap), offer to: fetch Npcap's current installer from
//! npcap.com, run it, and start capturing as soon as it loads, with no
//! restart. Elsewhere the page is told, as before.


use tauri::Emitter;

use crate::capture::pcap_capturer::PcapCapturer;







/// Called at startup when the capture library did not load.
///
/// Where the meter can install Npcap (Windows, online build) it offers to
/// download the installer. Otherwise the page shows the help: on Linux libpcap
/// comes from the packages, and the private build downloads nothing, so it
/// says where to get Npcap and leaves the installing to the player.
pub fn offer(app: tauri::AppHandle, capturer: PcapCapturer) {
    drop(capturer);
    tauri::async_runtime::spawn(async move {
        // Small delay so the page is listening.
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let _ = app.emit("npcap-missing", ());
    });
}


