#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

const APP_URL: &str = "https://nexo-hub-p2p.lovable.app/rooms";

fn main() {
    let insert = Shortcut::new(None, Code::Insert);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut != &insert {
                        return;
                    }
                    let active = event.state() == ShortcutState::Pressed;
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.eval(&format!(
                            "window.dispatchEvent(new CustomEvent('nexo-global-ptt',{{detail:{}}}))",
                            active
                        ));
                    }
                })
                .build(),
        )
        .setup(move |app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(APP_URL.parse().unwrap()))
                .title("Nexo")
                .inner_size(1400.0, 900.0)
                .min_inner_size(900.0, 600.0)
                .initialization_script("window.__NEXO_DESKTOP__ = true;")
                .build()?;
            app.global_shortcut().register(insert)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Nexo Desktop");
}
