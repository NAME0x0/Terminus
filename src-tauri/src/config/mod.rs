use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("failed to determine config directory")]
    MissingConfigDir,
    #[error("failed to read config: {0}")]
    Read(#[from] std::io::Error),
    #[error("failed to parse config: {0}")]
    Parse(#[from] toml::de::Error),
    #[error("failed to serialize default config: {0}")]
    Serialize(#[from] toml::ser::Error),
    #[error("failed to watch config: {0}")]
    Watch(#[from] notify::Error),
    #[error("config path has no parent directory")]
    MissingConfigParent,
}

pub struct ConfigWatcher {
    _watcher: Mutex<RecommendedWatcher>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub appearance: AppearanceConfig,
    #[serde(default)]
    pub shell: ShellConfig,
    #[serde(default = "default_keybindings")]
    pub keybindings: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceConfig {
    pub theme: String,
    pub font_family: String,
    pub font_size: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ShellConfig {
    #[serde(default)]
    pub program: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<PathBuf>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            appearance: AppearanceConfig {
                theme: "default".to_string(),
                font_family: "Cascadia Code".to_string(),
                font_size: 13,
            },
            shell: ShellConfig::default(),
            keybindings: default_keybindings(),
        }
    }
}

pub fn load_config() -> Result<Config, ConfigError> {
    let path = config_path()?;
    load_config_at(&path)
}

pub fn start_config_watcher<F>(on_reload: F) -> Result<ConfigWatcher, ConfigError>
where
    F: Fn(Config) + Send + 'static,
{
    let path = config_path()?;
    load_config_at(&path)?;
    watch_config_at(path, on_reload)
}

fn load_config_at(path: &Path) -> Result<Config, ConfigError> {
    if !path.exists() {
        write_default_config(path)?;
        return Ok(Config::default());
    }

    let raw = fs::read_to_string(path)?;
    match toml::from_str(&raw) {
        Ok(config) => Ok(config),
        Err(error) => {
            eprintln!(
                "failed to parse {}: {error}; using defaults",
                path.display()
            );
            Ok(Config::default())
        }
    }
}

fn config_path() -> Result<PathBuf, ConfigError> {
    let mut dir = dirs::config_dir().ok_or(ConfigError::MissingConfigDir)?;
    dir.push("Terminus");
    dir.push("config.toml");
    Ok(dir)
}

fn write_default_config(path: &Path) -> Result<(), ConfigError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = toml::to_string_pretty(&Config::default())?;
    fs::write(path, raw)?;
    Ok(())
}

fn watch_config_at<F>(path: PathBuf, on_reload: F) -> Result<ConfigWatcher, ConfigError>
where
    F: Fn(Config) + Send + 'static,
{
    let parent = path
        .parent()
        .ok_or(ConfigError::MissingConfigParent)?
        .to_path_buf();
    let watched_path = path.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let event = match result {
            Ok(event) => event,
            Err(error) => {
                eprintln!("config watcher error: {error}");
                return;
            }
        };
        if !event
            .paths
            .iter()
            .any(|candidate| candidate == &watched_path)
        {
            return;
        }

        match load_config_at(&watched_path) {
            Ok(config) => on_reload(config),
            Err(error) => eprintln!(
                "failed to reload config {}: {error}",
                watched_path.display()
            ),
        }
    })?;
    watcher.watch(&parent, RecursiveMode::NonRecursive)?;

    Ok(ConfigWatcher {
        _watcher: Mutex::new(watcher),
    })
}

fn default_keybindings() -> HashMap<String, String> {
    HashMap::from([
        ("Ctrl+Shift+T".to_string(), "newTab".to_string()),
        ("Ctrl+Shift+W".to_string(), "closeTab".to_string()),
        ("Ctrl+PageDown".to_string(), "nextTab".to_string()),
        ("Ctrl+PageUp".to_string(), "previousTab".to_string()),
        ("Alt+Shift+-".to_string(), "splitHorizontal".to_string()),
        ("Alt+Shift+\\".to_string(), "splitVertical".to_string()),
        (
            "Ctrl+Shift+Enter".to_string(),
            "toggleMaximizePane".to_string(),
        ),
        ("Ctrl+Shift+P".to_string(), "commandPalette".to_string()),
        ("Ctrl+Shift+}".to_string(), "focusNextPane".to_string()),
        ("Ctrl+Shift+{".to_string(), "focusPreviousPane".to_string()),
        ("Ctrl+Alt+ArrowUp".to_string(), "focusPaneUp".to_string()),
        (
            "Ctrl+Alt+ArrowDown".to_string(),
            "focusPaneDown".to_string(),
        ),
        (
            "Ctrl+Alt+ArrowLeft".to_string(),
            "focusPaneLeft".to_string(),
        ),
        (
            "Ctrl+Alt+ArrowRight".to_string(),
            "focusPaneRight".to_string(),
        ),
        ("Ctrl+Shift+F".to_string(), "find".to_string()),
        ("Ctrl+Shift+C".to_string(), "copy".to_string()),
        ("Ctrl+Shift+V".to_string(), "paste".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    #[test]
    fn default_config_has_terminal_defaults() {
        let config = Config::default();

        assert_eq!(config.appearance.theme, "default");
        assert_eq!(config.appearance.font_family, "Cascadia Code");
        assert_eq!(config.keybindings["Ctrl+Shift+T"], "newTab");
    }

    #[test]
    fn invalid_config_falls_back_to_defaults() {
        let directory = unique_test_directory("invalid-config");
        fs::create_dir_all(&directory).expect("create test config directory");
        let path = directory.join("config.toml");
        fs::write(&path, "appearance = [not valid toml").expect("write invalid config");

        let config = load_config_at(&path).expect("invalid config should not block loading");

        assert_eq!(config.appearance.theme, "default");
        fs::remove_dir_all(directory).expect("remove test config directory");
    }

    #[test]
    fn partial_config_uses_shell_and_keybinding_defaults() {
        let directory = unique_test_directory("partial-config");
        fs::create_dir_all(&directory).expect("create test config directory");
        let path = directory.join("config.toml");
        fs::write(
            &path,
            "[appearance]\ntheme = \"default\"\nfontFamily = \"Mono\"\nfontSize = 15\n",
        )
        .expect("write partial config");

        let config = load_config_at(&path).expect("partial config should load");

        assert!(config.shell.program.is_none());
        assert!(config.shell.args.is_empty());
        assert_eq!(config.keybindings["Ctrl+Shift+T"], "newTab");
        fs::remove_dir_all(directory).expect("remove test config directory");
    }

    #[test]
    fn watcher_reloads_changed_config() {
        let directory = unique_test_directory("watch-config");
        fs::create_dir_all(&directory).expect("create test config directory");
        let path = directory.join("config.toml");
        write_default_config(&path).expect("write initial config");
        let (sender, receiver) = mpsc::channel();
        let _watcher = watch_config_at(path.clone(), move |config| {
            let _ = sender.send(config);
        })
        .expect("watch config");

        let mut changed = Config::default();
        changed.appearance.font_size = 18;
        fs::write(
            &path,
            toml::to_string_pretty(&changed).expect("serialize changed config"),
        )
        .expect("write changed config");

        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        let reloaded = loop {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let config = receiver
                .recv_timeout(remaining)
                .expect("receive changed config before timeout");
            if config.appearance.font_size == 18 {
                break config;
            }
        };

        assert_eq!(reloaded.appearance.font_size, 18);
        drop(_watcher);
        fs::remove_dir_all(directory).expect("remove test config directory");
    }

    fn unique_test_directory(label: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "terminus-{label}-{}-{timestamp}",
            std::process::id()
        ))
    }
}
