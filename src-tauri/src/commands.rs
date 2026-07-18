use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::config::{load_config, save_config as persist_config, Config};
use crate::pty::PtySize;
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalRequest {
    pub shell: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalResponse {
    pub id: u64,
    pub cwd: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TerminalDataRequest {
    pub id: u64,
    pub data: String,
}

#[derive(Debug, Deserialize)]
pub struct ResizeRequest {
    pub id: u64,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Deserialize)]
pub struct TerminalIdRequest {
    pub id: u64,
}

#[tauri::command]
pub fn create_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    request: CreateTerminalRequest,
) -> Result<CreateTerminalResponse, String> {
    let config = load_config().map_err(|err| err.to_string())?;
    let shell = request
        .shell
        .or(config.shell.program)
        .unwrap_or_else(default_shell);
    let args = if request.args.is_empty() {
        config.shell.args
    } else {
        request.args
    };
    let cwd = request.cwd.or(config.shell.cwd).or_else(default_cwd);
    let size = PtySize {
        cols: request.cols.max(1),
        rows: request.rows.max(1),
    };

    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "session manager lock poisoned".to_string())?;
    let id = sessions
        .create(app, shell, args, cwd, size)
        .map_err(|err| err.to_string())?;

    Ok(CreateTerminalResponse {
        id,
        cwd: sessions.cwd(id).map(|path| path.display().to_string()),
    })
}

#[tauri::command]
pub fn write_stdin(state: State<'_, AppState>, request: TerminalDataRequest) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "session manager lock poisoned".to_string())?;
    sessions
        .write(request.id, request.data.as_bytes())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn resize(state: State<'_, AppState>, request: ResizeRequest) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "session manager lock poisoned".to_string())?;
    sessions
        .resize(
            request.id,
            PtySize {
                cols: request.cols.max(1),
                rows: request.rows.max(1),
            },
        )
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn close_terminal(
    state: State<'_, AppState>,
    request: TerminalIdRequest,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "session manager lock poisoned".to_string())?;
    sessions.close(request.id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_config() -> Result<Config, String> {
    load_config().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_config(config: Config) -> Result<Config, String> {
    persist_config(&config).map_err(|err| err.to_string())?;
    Ok(config)
}

fn default_shell() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }

    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

fn default_cwd() -> Option<PathBuf> {
    std::env::current_dir().ok()
}
