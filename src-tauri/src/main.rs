// pattern maker PM-1 - desktop shell. The whole app lives in the webview;
// the host provides nothing beyond a window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running pattern maker");
}
