use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const WORKSPACE_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStore {
    pub schema_version: u32,
    pub active_workspace_id: Option<String>,
    pub workspaces: Vec<SavedWorkspace>,
}

impl Default for WorkspaceStore {
    fn default() -> Self {
        Self {
            schema_version: WORKSPACE_SCHEMA_VERSION,
            active_workspace_id: None,
            workspaces: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SavedWorkspace {
    pub id: String,
    pub name: String,
    pub project_path: Option<PathBuf>,
    pub layout: WorkspaceLayout,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceLayout {
    pub tabs: Vec<WorkspaceTab>,
    pub active_tab_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTab {
    pub id: String,
    pub title: String,
    pub root: WorkspaceLayoutNode,
    pub focused_pane_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum WorkspaceLayoutNode {
    Leaf {
        pane: WorkspacePane,
    },
    Split {
        direction: SplitDirection,
        ratio: f32,
        first: Box<WorkspaceLayoutNode>,
        second: Box<WorkspaceLayoutNode>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePane {
    pub id: String,
    pub cwd: Option<PathBuf>,
    pub shell_profile: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("could not determine the platform config directory")]
    MissingConfigDir,
    #[error("workspace store IO failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("workspace store JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
    #[error("workspace store schema {0} is not supported")]
    UnsupportedSchema(u32),
    #[error("workspace store is invalid: {0}")]
    InvalidData(String),
}

pub fn load_workspace_store() -> Result<WorkspaceStore, WorkspaceError> {
    load_workspace_store_at(&workspace_store_path()?)
}

pub fn save_workspace_store(store: &WorkspaceStore) -> Result<(), WorkspaceError> {
    save_workspace_store_at(&workspace_store_path()?, store)
}

fn workspace_store_path() -> Result<PathBuf, WorkspaceError> {
    let mut directory = crate::app_paths::config_dir().ok_or(WorkspaceError::MissingConfigDir)?;
    directory.push("workspaces.json");
    Ok(directory)
}

fn load_workspace_store_at(path: &Path) -> Result<WorkspaceStore, WorkspaceError> {
    if !path.exists() {
        return Ok(WorkspaceStore::default());
    }

    let raw = fs::read_to_string(path)?;
    let store = serde_json::from_str(&raw)?;
    validate_store(&store)?;
    Ok(store)
}

fn save_workspace_store_at(path: &Path, store: &WorkspaceStore) -> Result<(), WorkspaceError> {
    validate_store(store)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(store)?;
    fs::write(path, raw)?;
    Ok(())
}

fn validate_store(store: &WorkspaceStore) -> Result<(), WorkspaceError> {
    if store.schema_version != WORKSPACE_SCHEMA_VERSION {
        return Err(WorkspaceError::UnsupportedSchema(store.schema_version));
    }

    let mut workspace_ids = HashSet::new();
    let mut workspace_names = HashSet::new();
    for workspace in &store.workspaces {
        validate_nonempty("workspace id", &workspace.id)?;
        validate_nonempty("workspace name", &workspace.name)?;
        if !workspace_ids.insert(workspace.id.as_str()) {
            return Err(invalid(format!("duplicate workspace id {}", workspace.id)));
        }
        if !workspace_names.insert(workspace.name.to_lowercase()) {
            return Err(invalid(format!(
                "duplicate workspace name {}",
                workspace.name
            )));
        }
        validate_layout(&workspace.layout)?;
    }

    if let Some(active_id) = store.active_workspace_id.as_deref() {
        validate_nonempty("active workspace id", active_id)?;
        if !workspace_ids.contains(active_id) {
            return Err(invalid(format!(
                "active workspace {active_id} does not exist"
            )));
        }
    }

    Ok(())
}

fn validate_layout(layout: &WorkspaceLayout) -> Result<(), WorkspaceError> {
    if layout.tabs.is_empty() {
        return Err(invalid("workspace layout must contain at least one tab"));
    }

    let mut tab_ids = HashSet::new();
    for tab in &layout.tabs {
        validate_nonempty("tab id", &tab.id)?;
        validate_nonempty("focused pane id", &tab.focused_pane_id)?;
        if !tab_ids.insert(tab.id.as_str()) {
            return Err(invalid(format!("duplicate tab id {}", tab.id)));
        }

        let mut pane_ids = HashSet::new();
        validate_node(&tab.root, &mut pane_ids)?;
        if !pane_ids.contains(tab.focused_pane_id.as_str()) {
            return Err(invalid(format!(
                "focused pane {} does not exist in tab {}",
                tab.focused_pane_id, tab.id
            )));
        }
    }

    validate_nonempty("active tab id", &layout.active_tab_id)?;
    if !tab_ids.contains(layout.active_tab_id.as_str()) {
        return Err(invalid(format!(
            "active tab {} does not exist",
            layout.active_tab_id
        )));
    }
    Ok(())
}

fn validate_node<'a>(
    node: &'a WorkspaceLayoutNode,
    pane_ids: &mut HashSet<&'a str>,
) -> Result<(), WorkspaceError> {
    match node {
        WorkspaceLayoutNode::Leaf { pane } => {
            validate_nonempty("pane id", &pane.id)?;
            if !pane_ids.insert(pane.id.as_str()) {
                return Err(invalid(format!("duplicate pane id {}", pane.id)));
            }
        }
        WorkspaceLayoutNode::Split {
            ratio,
            first,
            second,
            ..
        } => {
            if !ratio.is_finite() || *ratio <= 0.0 || *ratio >= 1.0 {
                return Err(invalid("split ratio must be between zero and one"));
            }
            validate_node(first, pane_ids)?;
            validate_node(second, pane_ids)?;
        }
    }
    Ok(())
}

fn validate_nonempty(label: &str, value: &str) -> Result<(), WorkspaceError> {
    if value.trim().is_empty() {
        return Err(invalid(format!("{label} cannot be empty")));
    }
    Ok(())
}

fn invalid(message: impl Into<String>) -> WorkspaceError {
    WorkspaceError::InvalidData(message.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn missing_store_starts_empty() {
        let directory = unique_test_directory("missing");
        let store = load_workspace_store_at(&directory.join("workspaces.json"))
            .expect("missing store should use defaults");

        assert_eq!(store, WorkspaceStore::default());
    }

    #[test]
    fn workspace_store_round_trips_a_split_layout() {
        let directory = unique_test_directory("round-trip");
        let path = directory.join("workspaces.json");
        let store = test_store();

        save_workspace_store_at(&path, &store).expect("save workspace store");
        let loaded = load_workspace_store_at(&path).expect("load workspace store");

        assert_eq!(loaded, store);
        fs::remove_dir_all(directory).expect("remove test workspace directory");
    }

    #[test]
    fn malformed_store_is_reported_without_overwriting_it() {
        let directory = unique_test_directory("malformed");
        fs::create_dir_all(&directory).expect("create test workspace directory");
        let path = directory.join("workspaces.json");
        fs::write(&path, "{ definitely not json").expect("write malformed workspace store");

        let error = load_workspace_store_at(&path).expect_err("malformed store should fail");

        assert!(matches!(error, WorkspaceError::Json(_)));
        assert_eq!(
            fs::read_to_string(&path).expect("read malformed workspace store"),
            "{ definitely not json"
        );
        fs::remove_dir_all(directory).expect("remove test workspace directory");
    }

    #[test]
    fn invalid_layout_references_are_rejected() {
        let directory = unique_test_directory("invalid-layout");
        let path = directory.join("workspaces.json");
        let mut store = test_store();
        store.workspaces[0].layout.tabs[0].focused_pane_id = "missing-pane".to_string();

        let error = save_workspace_store_at(&path, &store).expect_err("invalid layout should fail");

        assert!(matches!(error, WorkspaceError::InvalidData(_)));
        assert!(!path.exists());
    }

    #[test]
    fn unsupported_schema_is_rejected() {
        let directory = unique_test_directory("schema");
        let path = directory.join("workspaces.json");
        let mut store = test_store();
        store.schema_version = WORKSPACE_SCHEMA_VERSION + 1;

        let error = save_workspace_store_at(&path, &store).expect_err("future schema should fail");

        assert!(matches!(error, WorkspaceError::UnsupportedSchema(_)));
        assert!(!path.exists());
    }

    #[test]
    fn json_contract_matches_the_frontend_workspace_types() {
        let value = serde_json::to_value(test_store()).expect("serialize workspace store");

        assert_eq!(value["schemaVersion"], WORKSPACE_SCHEMA_VERSION);
        assert_eq!(value["activeWorkspaceId"], "workspace-1");
        assert_eq!(value["workspaces"][0]["projectPath"], "D:/Terminus");
        assert_eq!(value["workspaces"][0]["layout"]["activeTabId"], "tab-1");
        assert_eq!(
            value["workspaces"][0]["layout"]["tabs"][0]["root"]["type"],
            "split"
        );
        assert_eq!(
            value["workspaces"][0]["layout"]["tabs"][0]["root"]["first"]["pane"]["shellProfile"],
            serde_json::Value::Null
        );
    }

    fn test_store() -> WorkspaceStore {
        WorkspaceStore {
            schema_version: WORKSPACE_SCHEMA_VERSION,
            active_workspace_id: Some("workspace-1".to_string()),
            workspaces: vec![SavedWorkspace {
                id: "workspace-1".to_string(),
                name: "Terminus".to_string(),
                project_path: Some(PathBuf::from("D:/Terminus")),
                updated_at: 1,
                layout: WorkspaceLayout {
                    active_tab_id: "tab-1".to_string(),
                    tabs: vec![WorkspaceTab {
                        id: "tab-1".to_string(),
                        title: "Terminus".to_string(),
                        focused_pane_id: "pane-2".to_string(),
                        root: WorkspaceLayoutNode::Split {
                            direction: SplitDirection::Vertical,
                            ratio: 0.5,
                            first: Box::new(leaf("pane-1", "D:/Terminus")),
                            second: Box::new(leaf("pane-2", "D:/Terminus/frontend")),
                        },
                    }],
                },
            }],
        }
    }

    fn leaf(id: &str, cwd: &str) -> WorkspaceLayoutNode {
        WorkspaceLayoutNode::Leaf {
            pane: WorkspacePane {
                id: id.to_string(),
                cwd: Some(PathBuf::from(cwd)),
                shell_profile: None,
            },
        }
    }

    fn unique_test_directory(label: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should follow epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("terminus-workspace-{label}-{timestamp}"))
    }
}
