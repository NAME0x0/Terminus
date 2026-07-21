use std::ffi::OsString;
use std::path::PathBuf;

const CONFIG_DIR_OVERRIDE: &str = "TERMINUS_CONFIG_DIR";

pub fn config_dir() -> Option<PathBuf> {
    resolve_config_dir(std::env::var_os(CONFIG_DIR_OVERRIDE), dirs::config_dir())
}

fn resolve_config_dir(
    override_dir: Option<OsString>,
    platform_config_dir: Option<PathBuf>,
) -> Option<PathBuf> {
    if let Some(override_dir) = override_dir.filter(|value| !value.is_empty()) {
        return Some(PathBuf::from(override_dir));
    }

    platform_config_dir.map(|directory| directory.join("Terminus"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_config_directory_wins_without_appending_product_name() {
        let resolved = resolve_config_dir(
            Some(OsString::from("D:/isolated/terminus")),
            Some(PathBuf::from("D:/platform")),
        );

        assert_eq!(resolved, Some(PathBuf::from("D:/isolated/terminus")));
    }

    #[test]
    fn platform_config_directory_keeps_existing_terminus_location() {
        let resolved = resolve_config_dir(None, Some(PathBuf::from("D:/platform")));

        assert_eq!(resolved, Some(PathBuf::from("D:/platform/Terminus")));
    }

    #[test]
    fn empty_override_falls_back_to_platform_config_directory() {
        let resolved =
            resolve_config_dir(Some(OsString::new()), Some(PathBuf::from("D:/platform")));

        assert_eq!(resolved, Some(PathBuf::from("D:/platform/Terminus")));
    }
}
