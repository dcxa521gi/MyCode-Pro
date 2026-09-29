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
