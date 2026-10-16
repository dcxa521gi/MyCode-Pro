use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

static LOCK: Mutex<()> = Mutex::new(());

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root.join("group-task-index.json"))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let source = if path.exists() {
        path.to_path_buf()
    } else {
        path.with_extension("bak")
    };
    serde_json::from_slice(&fs::read(&source).map_err(|e| format!("{}: {e}", source.display()))?)
        .map_err(|e| e.to_string())
}

fn index(app: &AppHandle) -> Result<BTreeMap<String, PathBuf>, String> {
    let path = index_path(app)?;
    if !path.exists() && !path.with_extension("bak").exists() {
        return Ok(BTreeMap::new());
    }
    serde_json::from_value(read_json(&path)?).map_err(|e| e.to_string())
}

fn write_json(path: &Path, value: &impl serde::Serialize) -> Result<(), String> {
    let pending = path.with_extension("tmp");
    let backup = path.with_extension("bak");
    fs::write(
        &pending,
        serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if path.exists() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|e| e.to_string())?;
        }
        fs::rename(path, &backup).map_err(|e| e.to_string())?;
    }
    if let Err(error) = fs::rename(&pending, path) {
        if backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        return Err(error.to_string());
    }
    if backup.exists() {
        fs::remove_file(backup).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command(async)]
pub fn group_tasks_list(app: AppHandle) -> Result<Vec<Value>, String> {
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    index(&app)?.values().map(|path| read_json(path)).collect()
}

#[tauri::command(async)]
pub fn group_tasks_save(app: AppHandle, room: Value) -> Result<(), String> {
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    if room["kind"] != "mycode-group-task-v1" {
        return Err("Invalid group task format".into());
    }
    let id = room["id"].as_str().ok_or("Missing group task ID")?;
    uuid::Uuid::parse_str(id).map_err(|_| "Invalid group task ID")?;
    let cwd = PathBuf::from(room["cwd"].as_str().ok_or("Missing group task folder")?);
    if !cwd.is_absolute() || !cwd.is_dir() {
        return Err("Choose an existing group task folder".into());
    }
    let cwd = cwd.canonicalize().map_err(|e| e.to_string())?;
    let members = room["members"]
        .as_array()
        .ok_or("Missing group task members")?;
    if !(2..=16).contains(&members.len())
        || members
            .iter()
            .filter(|member| member["manager"] == true)
            .count()
            != 1
    {
        return Err("A group task needs 2–16 agents and exactly one manager".into());
    }
    if serde_json::to_vec(&room).map_err(|e| e.to_string())?.len() > 32 * 1024 * 1024 {
        return Err("Group task history exceeds 32 MB".into());
    }
    let mut locations = index(&app)?;
    let path = cwd
        .join(".mycode")
        .join("group-tasks")
        .join(id)
        .join("room.json");
    if locations.get(id).is_some_and(|old| old != &path) {
        return Err("Move group task folders through MyCode before editing their location".into());
    }
    let parent = path.parent().ok_or("Invalid group task folder")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    if !parent
        .canonicalize()
        .map_err(|e| e.to_string())?
        .starts_with(&cwd)
    {
        return Err("Group task data must stay inside its folder".into());
    }
    write_json(&path, &room)?;
    locations.insert(id.to_owned(), path);
    write_json(&index_path(&app)?, &locations)
}

#[cfg(test)]
mod tests {
    use super::{read_json, write_json};

    #[test]
    fn replaces_an_existing_room_without_losing_the_previous_write() {
        let path =
            std::env::temp_dir().join(format!("mycode-group-task-{}.json", uuid::Uuid::new_v4()));
        write_json(&path, &serde_json::json!({ "version": 1 })).unwrap();
        write_json(&path, &serde_json::json!({ "version": 2 })).unwrap();
        assert_eq!(read_json(&path).unwrap()["version"], 2);
        assert!(!path.with_extension("bak").exists());
        std::fs::remove_file(path).unwrap();
    }
}
