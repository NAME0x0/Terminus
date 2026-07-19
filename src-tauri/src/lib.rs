mod commands;
mod config;
mod pty;
mod session;
mod workspace;

use std::sync::Mutex;

use session::SessionManager;
use tauri::{Emitter, Manager};

pub struct AppState {
    sessions: Mutex<SessionManager>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            sessions: Mutex::new(SessionManager::default()),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let watcher = config::start_config_watcher(move |config| {
                if let Err(error) = app_handle.emit("config://reloaded", config) {
                    eprintln!("failed to emit config reload: {error}");
                }
            })?;
            app.manage(watcher);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_terminal,
            commands::write_stdin,
            commands::resize,
            commands::close_terminal,
            commands::get_config,
            commands::save_config,
            commands::get_workspace_store,
            commands::save_workspace_store
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Terminus");
}
