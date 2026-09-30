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
pub struct MediaCandidate {
    path: String,
    bytes: u64,
}

fn media_candidates(store: &SessionStore) -> Result<Vec<MediaCandidate>, String> {
    let conn = store.lock_conn()?;
    let mut references = String::new();
    for query in ["SELECT blocks_json FROM sessions", "SELECT body FROM notes"] {
        let mut statement = conn.prepare(query).map_err(|e| e.to_string())?;
        for value in statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
        {
            references.push_str(&value.map_err(|e| e.to_string())?);
        }
    }
    let mut result = Vec::new();
    for folder in ["attachments", "captures"] {
        let root = crate::cache_location::root().join(folder);
        let Ok(root_meta) = fs::symlink_metadata(&root) else {
            continue;
        };
        if root_meta.file_type().is_symlink() {
            continue;
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if root_meta.file_attributes() & 0x400 != 0 {
                continue;
            }
        }
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let meta = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
            if !meta.is_file() || meta.file_type().is_symlink() {
                continue;
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta.file_attributes() & 0x400 != 0 {
                    continue;
                }
            }
            let old = meta
                .modified()
                .ok()
                .and_then(|t| SystemTime::now().duration_since(t).ok())
                .is_some_and(|age| age > Duration::from_secs(7 * 86400));
            if old && !references.contains(entry.file_name().to_string_lossy().as_ref()) {
                result.push(MediaCandidate {
                    path: crate::fs::path_to_js(&entry.path()),
                    bytes: meta.len(),
                });
            }
        }
    }
    Ok(result)
}

#[tauri::command(async)]
pub fn storage_media_scan(store: State<'_, SessionStore>) -> Result<Vec<MediaCandidate>, String> {
    media_candidates(&store)
}

/// Quarantine only the exact previewed files that are still old and unreferenced.
/// Keep a recovery manifest and copies rather than irreversibly deleting media.
#[tauri::command(async)]
pub fn storage_media_clean(
    app: AppHandle,
    store: State<'_, SessionStore>,
    paths: Vec<String>,
    protected_paths: Vec<String>,
) -> Result<String, String> {
    let candidates = media_candidates(&store)?;
    let target = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups")
        .join(format!("media-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let conn = store.lock_conn()?;
    let mut manifest = Vec::new();
    for file in candidates
        .into_iter()
        .filter(|candidate| paths.contains(&candidate.path))
    {
        let original = std::path::PathBuf::from(&file.path);
        if protected_paths.iter().any(|path| {
            path.replace('\\', "/")
                .eq_ignore_ascii_case(&file.path.replace('\\', "/"))
        }) {
            continue;
        }
        let Some(name) = original.file_name() else {
            continue;
        };
        let referenced: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM sessions WHERE instr(blocks_json,?1)>0 UNION ALL SELECT 1 FROM notes WHERE instr(body,?1)>0)", [name.to_string_lossy().as_ref()], |row| row.get(0)).map_err(|e| e.to_string())?;
        if referenced {
            continue;
        }
        let destination = target.join(format!(
            "{}-{}",
            uuid::Uuid::new_v4(),
            name.to_string_lossy()
        ));
        fs::copy(&original, &destination).map_err(|e| e.to_string())?;
        manifest.push(
            serde_json::json!({"original": file.path,"backup":crate::fs::path_to_js(&destination)}),
        );
        fs::write(
            target.join("manifest.json"),
            serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        fs::remove_file(&original).map_err(|e| e.to_string())?;
    }
    Ok(crate::fs::path_to_js(&target))
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleanup_preserves_media_recent_logs_and_conversations() {
        let root =
            std::env::temp_dir().join(format!("mycode-storage-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        for name in ["old.log", "recent.log", "attachment.png", "sessions.sqlite"] {
            let path = root.join(name);
            fs::write(&path, b"keep-data").unwrap();
            if name != "recent.log" {
                fs::File::options()
                    .write(true)
                    .open(path)
                    .unwrap()
                    .set_times(
                        fs::FileTimes::new()
                            .set_modified(SystemTime::now() - Duration::from_secs(8 * 86400)),
                    )
                    .unwrap();
            }
        }
        let mut scan = StorageEntry {
            name: String::new(),
            path: String::new(),
            bytes: 0,
            files: 0,
            reclaimable_bytes: 0,
        };
        measure(&root, &mut scan, false).unwrap();
        assert_eq!(scan.files, 4);
        assert_eq!(scan.reclaimable_bytes, 9);
        assert!(root.join("old.log").exists());
        measure(&root, &mut scan, true).unwrap();
        assert!(!root.join("old.log").exists());
        for name in ["recent.log", "attachment.png", "sessions.sqlite"] {
            assert_eq!(fs::read(root.join(name)).unwrap(), b"keep-data");
        }
        fs::remove_dir_all(root).unwrap();
    }
}
