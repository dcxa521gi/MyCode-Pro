use std::{fs, path::PathBuf, sync::RwLock};
use tauri::{AppHandle, Manager};

static ROOT: RwLock<Option<PathBuf>> = RwLock::new(None);

pub fn root() -> PathBuf {
    ROOT.read()
        .ok()
        .and_then(|p| p.clone())
        .unwrap_or_else(|| std::env::temp_dir().join("MyCode"))
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.join("cache-location.json"))
}

pub fn initialize(app: &AppHandle) {
    if let Ok(path) =
        config_path(app).and_then(|p| fs::read_to_string(p).map_err(|e| e.to_string()))
    {
        if let Ok(path) = serde_json::from_str::<PathBuf>(&path) {
            if path.is_absolute() && fs::create_dir_all(&path).is_ok() {
                if let Ok(mut root) = ROOT.write() {
                    *root = Some(path);
                }
            }
        }
    }
}

#[tauri::command]
pub fn cache_location() -> String {
    crate::fs::path_to_js(&root())
}

#[tauri::command]
pub fn cache_set_location(app: AppHandle, folder: String) -> Result<String, String> {
    let parent = PathBuf::from(folder);
    if !parent.is_absolute() {
        return Err("Choose an absolute cache folder".into());
    }
    // Own a dedicated child, never treat the user's selected folder as disposable.
    let target = parent.join("MyCode-cache");
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let probe = target.join(format!(".write-test-{}", uuid::Uuid::new_v4()));
    fs::write(&probe, []).map_err(|e| e.to_string())?;
    fs::remove_file(probe).map_err(|e| e.to_string())?;
    let config = config_path(&app)?;
    let pending = config.with_extension("pending.json");
    fs::write(
        &pending,
        serde_json::to_vec(&target).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(pending, config).map_err(|e| e.to_string())?;
    *ROOT.write().map_err(|e| e.to_string())? = Some(target);
    Ok(cache_location())
}

pub fn workspace(app: &AppHandle) -> Result<String, String> {
    let config = config_path(app)?.with_file_name("workspace-location.json");
    let path = if config.exists() {
        serde_json::from_slice::<PathBuf>(&fs::read(config).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?
    } else {
        PathBuf::from(crate::dirs_home().ok_or("Home directory is unavailable")?).join("MyCode")
    };
    if !path.is_absolute() {
        return Err("Workspace path must be absolute".into());
    }
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(crate::fs::path_to_js(&path))
}

#[tauri::command]
pub fn workspace_set_location(app: AppHandle, folder: String) -> Result<String, String> {
    let path = PathBuf::from(folder);
    if !path.is_absolute() || !path.is_dir() {
        return Err("Choose an existing workspace folder".into());
    }
    let config = config_path(&app)?.with_file_name("workspace-location.json");
    let pending = config.with_extension("pending.json");
    fs::write(
        &pending,
        serde_json::to_vec(&path).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(pending, config).map_err(|e| e.to_string())?;
    Ok(crate::fs::path_to_js(&path))
}

#[tauri::command]
pub fn create_project_folder(parent: String, name: String) -> Result<String, String> {
    let parent = PathBuf::from(parent);
    let name = name.trim();
    if !parent.is_absolute() || !parent.is_dir() {
        return Err("Choose an existing workspace folder".into());
    }
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.ends_with(['.', ' '])
        || name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
    {
        return Err("Enter a valid project name".into());
    }
    let path = parent.join(name);
    // Never silently reuse an existing directory when creating a new project.
    fs::create_dir(&path).map_err(|e| e.to_string())?;
    Ok(crate::fs::path_to_js(&path))
}

pub fn project_storage(cwd: &std::path::Path) -> Result<PathBuf, String> {
    let root = cwd.join(".mycode");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join(".gitignore"))
    {
        Ok(mut file) => {
            use std::io::Write;
            file.write_all(b"*\n").map_err(|e| e.to_string())?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(e.to_string()),
    }
    Ok(root)
}

pub fn configure_task(
    cmd: &mut std::process::Command,
    cwd: &std::path::Path,
) -> Result<(), String> {
    let root = project_storage(cwd)?;
    for (key, child) in [
        ("TEMP", "tmp"),
        ("TMP", "tmp"),
        ("TMPDIR", "tmp"),
        ("CLAUDE_CODE_TMPDIR", "tmp"),
        ("XDG_CACHE_HOME", "cache"),
        ("npm_config_cache", "cache/npm"),
        ("PIP_CACHE_DIR", "cache/pip"),
        ("UV_CACHE_DIR", "cache/uv"),
    ] {
        let path = root.join(child);
        fs::create_dir_all(&path).map_err(|e| format!("Cannot prepare project storage: {e}"))?;
        cmd.env(key, path);
    }
    Ok(())
}

pub fn migrate_workspace(app: &AppHandle, legacy: Option<&str>) -> Result<(), String> {
    if !config_path(app)?
        .with_file_name("workspace-location.json")
        .exists()
    {
        if let Some(folder) = legacy {
            let path = PathBuf::from(folder);
            if path.is_absolute() && path.is_dir() {
                workspace_set_location(app.clone(), folder.to_owned())?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn project_creation_rejects_escape_and_preserves_existing_files() {
        let root = std::env::temp_dir().join(format!("mycode-path-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let parent = root.to_string_lossy().into_owned();
        assert!(create_project_folder(parent.clone(), "../outside".into()).is_err());
        let created = create_project_folder(parent.clone(), "Project".into()).unwrap();
        fs::write(PathBuf::from(&created).join("keep.txt"), b"keep").unwrap();
        assert!(create_project_folder(parent, "Project".into()).is_err());
        assert_eq!(
            fs::read(PathBuf::from(created).join("keep.txt")).unwrap(),
            b"keep"
        );
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn task_caches_are_inside_project_without_overriding_credentials() {
        let root = std::env::temp_dir().join(format!("mycode-env-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let mut cmd = std::process::Command::new("unused");
        configure_task(&mut cmd, &root).unwrap();
        for (key, value) in cmd.get_envs() {
            assert_ne!(key, "HOME");
            assert_ne!(key, "CODEX_HOME");
            assert_ne!(key, "CLAUDE_CONFIG_DIR");
            assert!(PathBuf::from(value.unwrap()).starts_with(root.join(".mycode")));
        }
        fs::remove_dir_all(root).unwrap();
    }
}
