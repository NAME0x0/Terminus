use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{
    native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize as PortablePtySize,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

#[derive(Debug, Clone, Copy)]
pub struct PtySize {
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Error)]
pub enum PtyError {
    #[error("pty error: {0}")]
    Portable(#[from] anyhow::Error),
    #[error("pty io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("pty {0} lock poisoned")]
    Lock(&'static str),
    #[error("pty session has exited")]
    Exited,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PtyLifecycle {
    Running,
    Exited { code: Option<u32> },
}

#[derive(Clone, Debug, Serialize)]
struct TerminalOutput {
    id: u64,
    data: String,
}

#[derive(Clone, Debug, Serialize)]
struct TerminalExit {
    id: u64,
    code: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum PtyEvent {
    Output(Vec<u8>),
    Exit { code: Option<u32> },
}

pub struct PtySession {
    master: Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>,
    writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    lifecycle: Arc<Mutex<PtyLifecycle>>,
    cwd: Option<PathBuf>,
}

impl PtySession {
    pub fn spawn(
        id: u64,
        app: AppHandle,
        shell: String,
        args: Vec<String>,
        cwd: Option<PathBuf>,
        size: PtySize,
    ) -> Result<Self, PtyError> {
        Self::spawn_with_events(shell, args, cwd, size, move |event| match event {
            PtyEvent::Output(data) => {
                let payload = TerminalOutput {
                    id,
                    data: STANDARD.encode(data),
                };
                let _ = app.emit("terminal://output", payload);
            }
            PtyEvent::Exit { code } => {
                let _ = app.emit("terminal://exit", TerminalExit { id, code });
            }
        })
    }

    pub(crate) fn spawn_with_events<F>(
        shell: String,
        args: Vec<String>,
        cwd: Option<PathBuf>,
        size: PtySize,
        emit: F,
    ) -> Result<Self, PtyError>
    where
        F: Fn(PtyEvent) + Send + Sync + 'static,
    {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(to_portable_size(size))?;
        let mut command = CommandBuilder::new(&shell);
        configure_shell_integration(&mut command, &shell);
        command.args(args);
        if let Some(cwd) = &cwd {
            command.cwd(cwd);
        }

        let mut child = pair.slave.spawn_command(command)?;
        let killer = child.clone_killer();
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader()?;
        let writer = Arc::new(Mutex::new(Some(pair.master.take_writer()?)));
        let master = Arc::new(Mutex::new(Some(pair.master)));
        let lifecycle = Arc::new(Mutex::new(PtyLifecycle::Running));
        let emit = Arc::new(emit);
        let output_emit = Arc::clone(&emit);

        let reader_thread = thread::spawn(move || {
            let mut buf = [0_u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        output_emit(PtyEvent::Output(buf[..n].to_vec()));
                    }
                    Err(_) => break,
                }
            }
        });

        let wait_master = Arc::clone(&master);
        let wait_writer = Arc::clone(&writer);
        let wait_lifecycle = Arc::clone(&lifecycle);
        thread::spawn(move || {
            let code = child.wait().ok().map(|status| status.exit_code());

            if let Ok(mut writer) = wait_writer.lock() {
                writer.take();
            }
            if let Ok(mut master) = wait_master.lock() {
                master.take();
            }
            let _ = reader_thread.join();

            if let Ok(mut lifecycle) = wait_lifecycle.lock() {
                *lifecycle = PtyLifecycle::Exited { code };
            }
            emit(PtyEvent::Exit { code });
        });

        Ok(Self {
            master,
            writer,
            killer,
            lifecycle,
            cwd,
        })
    }

    pub fn cwd(&self) -> Option<&PathBuf> {
        self.cwd.as_ref()
    }

    pub fn lifecycle(&self) -> Result<PtyLifecycle, PtyError> {
        self.lifecycle
            .lock()
            .map(|lifecycle| *lifecycle)
            .map_err(|_| PtyError::Lock("lifecycle"))
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), PtyError> {
        self.ensure_running()?;
        let mut writer = self.writer.lock().map_err(|_| PtyError::Lock("writer"))?;
        let writer = writer.as_mut().ok_or(PtyError::Exited)?;
        writer.write_all(data)?;
        writer.flush()?;
        Ok(())
    }

    pub fn resize(&mut self, size: PtySize) -> Result<(), PtyError> {
        self.ensure_running()?;
        let master = self.master.lock().map_err(|_| PtyError::Lock("master"))?;
        let master = master.as_ref().ok_or(PtyError::Exited)?;
        master.resize(to_portable_size(size))?;
        Ok(())
    }

    fn ensure_running(&self) -> Result<(), PtyError> {
        match self.lifecycle()? {
            PtyLifecycle::Running => Ok(()),
            PtyLifecycle::Exited { .. } => Err(PtyError::Exited),
        }
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        if matches!(self.lifecycle(), Ok(PtyLifecycle::Running)) {
            let _ = self.killer.kill();
        }
        if let Ok(mut writer) = self.writer.lock() {
            writer.take();
        }
        if let Ok(mut master) = self.master.lock() {
            master.take();
        }
    }
}

fn to_portable_size(size: PtySize) -> PortablePtySize {
    PortablePtySize {
        rows: size.rows,
        cols: size.cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

#[cfg(windows)]
fn configure_shell_integration(command: &mut CommandBuilder, shell: &str) {
    let is_cmd = Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            name.eq_ignore_ascii_case("cmd.exe") || name.eq_ignore_ascii_case("cmd")
        });
    if !is_cmd {
        return;
    }

    let visible_prompt = command
        .get_env("PROMPT")
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("$P$G");
    command.env("PROMPT", format!("$E]7;file:///$P$E\\{visible_prompt}"));
}

#[cfg(not(windows))]
fn configure_shell_integration(_command: &mut CommandBuilder, _shell: &str) {}

#[cfg(test)]
mod tests {
    use std::sync::mpsc::{self, Receiver};
    use std::time::{Duration, Instant};

    use super::*;

    #[cfg(windows)]
    #[test]
    fn cmd_shell_integration_reports_cwd_and_preserves_the_visible_prompt() {
        let mut command = CommandBuilder::new("C:\\Windows\\System32\\cmd.exe");
        command.env("PROMPT", "terminus $P$G");

        configure_shell_integration(&mut command, "C:\\Windows\\System32\\cmd.exe");

        assert_eq!(
            command.get_env("PROMPT").and_then(|value| value.to_str()),
            Some("$E]7;file:///$P$E\\terminus $P$G")
        );
    }

    #[test]
    fn reports_process_output_and_nonzero_exit_code() {
        let (shell, args) = output_then_exit_command(7);
        let (tx, rx) = mpsc::channel();
        let mut session = PtySession::spawn_with_events(
            shell,
            args,
            None,
            PtySize { cols: 80, rows: 24 },
            move |event| {
                tx.send(event)
                    .expect("test event receiver should remain open");
            },
        )
        .expect("test process should spawn");

        let (output, exit_code) = collect_until_exit(&rx);

        assert!(
            String::from_utf8_lossy(&output).contains("terminus"),
            "expected PTY output to contain the marker, got {:?}",
            String::from_utf8_lossy(&output)
        );
        assert_eq!(exit_code, Some(7));
        assert_eq!(
            session.lifecycle().expect("lifecycle should be readable"),
            PtyLifecycle::Exited { code: Some(7) }
        );
        assert!(matches!(session.write(b"ignored"), Err(PtyError::Exited)));
        assert!(matches!(
            session.resize(PtySize {
                cols: 100,
                rows: 30
            }),
            Err(PtyError::Exited)
        ));
    }

    #[test]
    fn terminal_smoke_interactive_input_and_resize() {
        let (shell, args, input) = interactive_round_trip_command();
        let (tx, rx) = mpsc::channel();
        let mut session = PtySession::spawn_with_events(
            shell,
            args,
            None,
            PtySize { cols: 80, rows: 24 },
            move |event| {
                tx.send(event)
                    .expect("test event receiver should remain open");
            },
        )
        .expect("interactive shell should spawn");

        session
            .resize(PtySize {
                cols: 120,
                rows: 40,
            })
            .expect("live PTY should resize");
        session.write(input).expect("live PTY should accept input");

        let (output, exit_code) = collect_until_exit(&rx);
        let output = String::from_utf8_lossy(&output);
        assert!(
            output.contains("terminus-roundtrip"),
            "expected interactive output marker, got {output:?}"
        );
        assert_eq!(exit_code, Some(0));
    }

    #[test]
    fn terminal_smoke_preserves_ansi_and_sustained_output() {
        let (shell, args) = ansi_and_large_output_command();
        let (tx, rx) = mpsc::channel();
        let _session = PtySession::spawn_with_events(
            shell,
            args,
            None,
            PtySize {
                cols: 120,
                rows: 40,
            },
            move |event| {
                tx.send(event)
                    .expect("test event receiver should remain open");
            },
        )
        .expect("output process should spawn");

        let (output, exit_code) = collect_until_exit(&rx);
        let text = String::from_utf8_lossy(&output);
        assert!(
            text.contains("\u{1b}[31m") && text.contains("terminus-color"),
            "expected ANSI red plus the colored output marker"
        );
        assert!(
            text.contains("\u{1b}[0m") || text.contains("\u{1b}[m"),
            "expected an ANSI reset sequence"
        );
        assert!(
            text.contains("terminus-line-512"),
            "expected the final sustained-output marker"
        );
        assert!(
            output.len() > 8_000,
            "expected a meaningful sustained output payload"
        );
        assert_eq!(exit_code, Some(0));
    }

    fn collect_until_exit(receiver: &Receiver<PtyEvent>) -> (Vec<u8>, Option<u32>) {
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut output = Vec::new();
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            match receiver.recv_timeout(remaining) {
                Ok(PtyEvent::Output(data)) => output.extend(data),
                Ok(PtyEvent::Exit { code }) => return (output, code),
                Err(error) => panic!("timed out waiting for PTY exit event: {error}"),
            }
        }
    }

    #[cfg(windows)]
    fn output_then_exit_command(code: u32) -> (String, Vec<String>) {
        (
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()),
            vec![
                "/d".to_string(),
                "/s".to_string(),
                "/c".to_string(),
                format!("echo terminus & exit /b {code}"),
            ],
        )
    }

    #[cfg(not(windows))]
    fn output_then_exit_command(code: u32) -> (String, Vec<String>) {
        (
            "/bin/sh".to_string(),
            vec![
                "-c".to_string(),
                format!("printf 'terminus\\n'; exit {code}"),
            ],
        )
    }

    #[cfg(windows)]
    fn interactive_round_trip_command() -> (String, Vec<String>, &'static [u8]) {
        (
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()),
            vec!["/d".to_string(), "/q".to_string()],
            b"echo terminus-roundtrip\r\nexit /b 0\r\n",
        )
    }

    #[cfg(not(windows))]
    fn interactive_round_trip_command() -> (String, Vec<String>, &'static [u8]) {
        (
            "/bin/sh".to_string(),
            Vec::new(),
            b"printf 'terminus-roundtrip\\n'\nexit 0\n",
        )
    }

    #[cfg(windows)]
    fn ansi_and_large_output_command() -> (String, Vec<String>) {
        (
            "powershell.exe".to_string(),
            vec![
                "-NoLogo".to_string(),
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                "$e=[char]27; Write-Output \"$e[31mterminus-color$e[0m\"; 1..512 | ForEach-Object { \"terminus-line-$_\" }".to_string(),
            ],
        )
    }

    #[cfg(not(windows))]
    fn ansi_and_large_output_command() -> (String, Vec<String>) {
        (
            "/bin/sh".to_string(),
            vec![
                "-c".to_string(),
                "printf '\\033[31mterminus-color\\033[0m\\n'; i=1; while [ $i -le 512 ]; do printf 'terminus-line-%s\\n' \"$i\"; i=$((i + 1)); done".to_string(),
            ],
        )
    }
}
