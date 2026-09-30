use crate::session_store::SessionStore;
use serde::Serialize;
use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime},
};
use tauri::{AppHandle, Manager, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageEntry {
    name: String,
    path: String,
    bytes: u64,
    files: usize,
    reclaimable_bytes: u64,
}

fn measure(path: &Path, entry: &mut StorageEntry, cleanup: bool) -> Result<(), String> {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return Ok(());
    };
    // Never follow a directory junction or symbolic link outside app ownership.
    if meta.file_type().is_symlink() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return Ok(());
        }
    }
    if meta.is_dir() {
        for file in fs::read_dir(path).map_err(|e| e.to_string())? {
            measure(&file.map_err(|e| e.to_string())?.path(), entry, cleanup)?;
        }
    } else if meta.is_file() {
        entry.bytes += meta.len();
        entry.files += 1;
        let stale = meta
            .modified()
            .ok()
            .and_then(|t| SystemTime::now().duration_since(t).ok())
            .is_some_and(|age| age > Duration::from_secs(7 * 86400));
        // Only obsolete diagnostic logs are disposable. Conversations, drafts,
        // recordings and generated media remain protected, even without a reference.
        if stale && path.extension().is_some_and(|s| s == "log") {
            entry.reclaimable_bytes += meta.len();
            if cleanup {
                fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command(async)]
pub fn storage_overview(app: AppHandle) -> Result<Vec<StorageEntry>, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let roots = [
        ("Application data", data),
        ("Cache folder", crate::cache_location::root()),
    ];
    roots
        .into_iter()
        .map(|(name, path)| {
            let mut entry = StorageEntry {
                name: name.into(),
                path: crate::fs::path_to_js(&path),
                bytes: 0,
                files: 0,
                reclaimable_bytes: 0,
            };
            measure(&path, &mut entry, false)?;
            Ok(entry)
        })
        .collect()
}

#[tauri::command(async)]
pub fn storage_clean_logs(app: AppHandle) -> Result<u64, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut entry = StorageEntry {
        name: String::new(),
        path: String::new(),
        bytes: 0,
        files: 0,
        reclaimable_bytes: 0,
    };
    measure(&root, &mut entry, true)?;
    Ok(entry.reclaimable_bytes)
}

#[tauri::command(async)]
pub fn storage_database_check(store: State<'_, SessionStore>) -> Result<String, String> {
    let conn = store.lock_conn()?;
    conn.query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn storage_database_compact(
    app: AppHandle,
    store: State<'_, SessionStore>,
) -> Result<String, String> {
    let backups = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    let backup = backups.join(format!("sessions-{}.sqlite", uuid::Uuid::new_v4()));
    let conn = store.lock_conn()?;
    conn.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])
        .map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM; PRAGMA optimize;")
        .map_err(|e| e.to_string())?;
    Ok(crate::fs::path_to_js(&backup))
}
