use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tauri::AppHandle;
use thiserror::Error;

#[cfg(test)]
use crate::pty::PtyLifecycle;
use crate::pty::{PtyError, PtySession, PtySize};

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("terminal session {0} was not found")]
    Missing(u64),
    #[error(transparent)]
    Pty(#[from] PtyError),
}

#[derive(Default)]
pub struct SessionManager {
    next_id: u64,
    sessions: HashMap<u64, PtySession>,
}

impl SessionManager {
    pub fn create(
        &mut self,
        app: AppHandle,
        shell: String,
        args: Vec<String>,
        cwd: Option<PathBuf>,
        size: PtySize,
    ) -> Result<u64, SessionError> {
        self.create_with(|id| PtySession::spawn(id, app, shell, args, cwd, size))
    }

    fn create_with<F>(&mut self, spawn: F) -> Result<u64, SessionError>
    where
        F: FnOnce(u64) -> Result<PtySession, PtyError>,
    {
        let id = self.next_id + 1;
        let session = spawn(id)?;
        self.next_id = id;
        self.sessions.insert(id, session);
        Ok(id)
    }

    pub fn write(&mut self, id: u64, data: &[u8]) -> Result<(), SessionError> {
        let session = self
            .sessions
            .get_mut(&id)
            .ok_or(SessionError::Missing(id))?;
        session.write(data)?;
        Ok(())
    }

    pub fn resize(&mut self, id: u64, size: PtySize) -> Result<(), SessionError> {
        let session = self
            .sessions
            .get_mut(&id)
            .ok_or(SessionError::Missing(id))?;
        session.resize(size)?;
        Ok(())
    }

    pub fn cwd(&self, id: u64) -> Option<&Path> {
        self.sessions
            .get(&id)
            .and_then(|session| session.cwd().map(PathBuf::as_path))
    }

    #[cfg(test)]
    fn lifecycle(&self, id: u64) -> Result<PtyLifecycle, SessionError> {
        self.sessions
            .get(&id)
            .ok_or(SessionError::Missing(id))?
            .lifecycle()
            .map_err(SessionError::from)
    }

    pub fn close(&mut self, id: u64) -> Result<(), SessionError> {
        self.sessions
            .remove(&id)
            .map(drop)
            .ok_or(SessionError::Missing(id))
    }
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;
    use std::time::Duration;

    use crate::pty::PtyEvent;

    use super::*;

    #[test]
    fn failed_spawn_preserves_id_and_close_terminates_live_session() {
        let mut manager = SessionManager::default();
        let failed = manager.create_with(|_| {
            PtySession::spawn_with_events(
                "terminus-command-that-does-not-exist".to_string(),
                Vec::new(),
                None,
                PtySize { cols: 80, rows: 24 },
                |_| {},
            )
        });
        assert!(failed.is_err());

        let (shell, args) = interactive_shell_command();
        let (tx, rx) = mpsc::channel();
        let id = manager
            .create_with(|_| {
                PtySession::spawn_with_events(
                    shell,
                    args,
                    None,
                    PtySize { cols: 80, rows: 24 },
                    move |event| {
                        let _ = tx.send(event);
                    },
                )
            })
            .expect("interactive shell should spawn");

        assert_eq!(id, 1, "failed spawns must not consume session ids");
        assert_eq!(
            manager.lifecycle(id).expect("session should exist"),
            PtyLifecycle::Running
        );

        manager.close(id).expect("live session should close");
        assert!(matches!(
            manager.lifecycle(id),
            Err(SessionError::Missing(missing)) if missing == id
        ));
        assert!(matches!(
            manager.close(id),
            Err(SessionError::Missing(missing)) if missing == id
        ));

        loop {
            match rx.recv_timeout(Duration::from_secs(10)) {
                Ok(PtyEvent::Exit { .. }) => break,
                Ok(PtyEvent::Output(_)) => {}
                Err(error) => panic!("timed out waiting for closed PTY to exit: {error}"),
            }
        }
    }

    #[cfg(windows)]
    fn interactive_shell_command() -> (String, Vec<String>) {
        (
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()),
            vec!["/d".to_string(), "/q".to_string()],
        )
    }

    #[cfg(not(windows))]
    fn interactive_shell_command() -> (String, Vec<String>) {
        ("/bin/sh".to_string(), Vec::new())
    }
}
