use serde_json::Value;
use std::{collections::BTreeMap, fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
static LOCK: Mutex<()> = Mutex::new(());
fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root.join("group-index.json"))
}
fn index(app: &AppHandle) -> Result<BTreeMap<String, PathBuf>, String> {
    let path = index_path(app)?;
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
fn write(path: &std::path::Path, value: &impl serde::Serialize) -> Result<(), String> {
    let pending = path.with_extension("pending.json");
    fs::write(
        &pending,
        serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(pending, path).map_err(|e| e.to_string())
}
#[tauri::command(async)]
pub fn groups_list(app: AppHandle) -> Result<Vec<Value>, String> {
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    index(&app)?
        .values()
        .map(|path| {
            let bytes =
                fs::read(path).map_err(|e| format!("Cannot read group {}: {e}", path.display()))?;
            serde_json::from_slice(&bytes).map_err(|e| e.to_string())
        })
        .collect()
}
#[tauri::command(async)]
pub fn groups_save(app: AppHandle, group: Value) -> Result<(), String> {
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let id = group["id"].as_str().ok_or("Missing group ID")?;
    uuid::Uuid::parse_str(id).map_err(|_| "Invalid group ID")?;
    let cwd = PathBuf::from(group["cwd"].as_str().ok_or("Missing group folder")?);
    if !cwd.is_absolute() || !cwd.is_dir() {
        return Err("Choose an existing workspace folder".into());
    }
    let members = group["members"].as_array().ok_or("Missing group members")?;
    if members.len() < 2
        || members.len() > 16
        || members.iter().filter(|m| m["manager"] == true).count() != 1
    {
        return Err("A group requires 2–16 members and exactly one manager".into());
    }
    if serde_json::to_vec(&group).map_err(|e| e.to_string())?.len() > 32 * 1024 * 1024 {
        return Err("Group history exceeds 32 MB; start a new group".into());
    }
    let mut locations = index(&app)?;
    let path = cwd
        .join(".mycode")
        .join("groups")
        .join(id)
        .join("chat.json");
    if locations.get(id).is_some_and(|old| old != &path) {
        return Err("Existing group folders cannot be changed without migrating history".into());
    }
    fs::create_dir_all(path.parent().ok_or("Invalid group folder")?).map_err(|e| e.to_string())?;
    fs::create_dir_all(
        path.parent()
            .ok_or("Invalid group folder")?
            .join("workspace"),
    )
    .map_err(|e| e.to_string())?;
    write(&path, &group)?;
    locations.insert(id.to_owned(), path);
    write(&index_path(&app)?, &locations)
}
