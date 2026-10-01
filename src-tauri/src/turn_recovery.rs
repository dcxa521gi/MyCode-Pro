use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
static GATE: Mutex<()> = Mutex::new(());
#[derive(Default, Serialize, Deserialize)]
struct Manifest {
    before: BTreeMap<String, String>,
    after: BTreeMap<String, Option<String>>,
    #[serde(default)]
    unsafe_edit: bool,
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn scan(
    root: &Path,
    dir: &Path,
    out: &mut BTreeMap<String, String>,
    bytes: &mut u64,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            if !matches!(
                entry.file_name().to_string_lossy().as_ref(),
                ".git" | ".mycode" | "node_modules" | "target" | ".venv" | "__pycache__" | ".next"
            ) {
                scan(root, &path, out, bytes)?;
            }
            continue;
        }
        if !kind.is_file() {
            continue;
        }
        let size = entry.metadata().map_err(|e| e.to_string())?.len();
        *bytes += size;
        if size > 16 * 1024 * 1024 || *bytes > 128 * 1024 * 1024 || out.len() >= 5000 {
            return Err("Project is too large for a safe turn snapshot".into());
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        out.insert(relative, hash(&fs::read(&path).map_err(|e| e.to_string())?));
    }
    Ok(())
}
fn location(cwd: &str, id: &str) -> Result<(PathBuf, PathBuf), String> {
    if uuid::Uuid::parse_str(id).is_err() {
        return Err("Invalid turn ID".into());
    }
    let root = PathBuf::from(cwd)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let store = crate::cache_location::project_storage(&root)?
        .join("turn-history")
        .join(id);
    Ok((root, store))
}
fn safe_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    if rel.is_absolute()
        || rel.components().any(|c| !matches!(c, Component::Normal(_)))
        || relative.replace('\\', "/").starts_with(".mycode/")
    {
        return Err("Invalid checkpoint path".into());
    }
    let path = root.join(rel);
    let mut parent = path.as_path();
    while !parent.exists() {
        parent = parent.parent().ok_or("Invalid checkpoint path")?;
    }
    if !parent
        .canonicalize()
        .map_err(|e| e.to_string())?
        .starts_with(root)
    {
        return Err("Checkpoint path escapes project".into());
    }
    Ok(path)
}
fn load(store: &Path) -> Result<Manifest, String> {
    serde_json::from_slice(&fs::read(store.join("manifest.json")).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}
fn save(store: &Path, m: &Manifest) -> Result<(), String> {
    let json = serde_json::to_vec(m).map_err(|e| e.to_string())?;
    fs::write(store.join("manifest.json"), json).map_err(|e| e.to_string())
}
fn operate(
    cwd: String,
    id: String,
    operation: String,
    paths: Vec<String>,
) -> Result<serde_json::Value, String> {
    let _lock = GATE.lock().map_err(|e| e.to_string())?;
    let (root, store) = location(&cwd, &id)?;
    if operation == "begin" {
        if store.join("manifest.json").exists() {
            return Ok(serde_json::json!({"ready":true}));
        }
        let mut m = Manifest::default();
        scan(&root, &root, &mut m.before, &mut 0)?;
        fs::create_dir_all(store.join("before")).map_err(|e| e.to_string())?;
        for (relative, digest) in &m.before {
            let data = fs::read(safe_path(&root, relative)?).map_err(|e| e.to_string())?;
            if hash(&data) != *digest {
                return Err("Project changed while creating the turn snapshot".into());
            }
            fs::write(store.join("before").join(digest), data).map_err(|e| e.to_string())?;
        }
        save(&store, &m)?;
        return Ok(serde_json::json!({"ready":true}));
    }
    let mut m = load(&store)?;
    if operation == "capture" {
        let captured: Result<(), String> = (|| {
            for input in paths {
                let p = PathBuf::from(&input);
                let relative = if p.is_absolute() {
                    // Resolve existing ancestors too: macOS /var aliases /private/var,
                    // and Windows paths may arrive without their verbatim prefix.
                    let mut ancestor = p.as_path();
                    let mut suffix = Vec::new();
                    while !ancestor.exists() {
                        suffix.push(
                            ancestor
                                .file_name()
                                .ok_or("Invalid edit path")?
                                .to_os_string(),
                        );
                        ancestor = ancestor.parent().ok_or("Invalid edit path")?;
                    }
                    let mut resolved = ancestor.canonicalize().map_err(|e| e.to_string())?;
                    for part in suffix.into_iter().rev() {
                        resolved.push(part);
                    }
                    resolved
                        .strip_prefix(&root)
                        .map_err(|_| "Edit outside project cannot be recalled")?
                        .to_string_lossy()
                        .replace('\\', "/")
                } else {
                    input.replace('\\', "/")
                };
                if relative.split('/').any(|part| {
                    matches!(
                        part,
                        ".git"
                            | ".mycode"
                            | "node_modules"
                            | "target"
                            | ".venv"
                            | "__pycache__"
                            | ".next"
                    )
                }) {
                    return Err("Edits in excluded folders cannot be recalled".into());
                }
                let p = safe_path(&root, &relative)?;
                let digest = if p.is_file() {
                    Some(hash(&fs::read(p).map_err(|e| e.to_string())?))
                } else if !p.exists() {
                    None
                } else {
                    return Err("Cannot snapshot directory edits".into());
                };
                m.after.insert(relative, digest);
            }
            Ok(())
        })();
        if let Err(error) = captured {
            m.unsafe_edit = true;
            save(&store, &m)?;
            return Err(error);
        }
        save(&store, &m)?;
        return Ok(serde_json::json!({"ready":true}));
    }
    let mut current = BTreeMap::new();
    scan(&root, &root, &mut current, &mut 0)?;
    let changed: Vec<String> = m
        .before
        .keys()
        .chain(current.keys())
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .filter(|p| m.before.get(*p) != current.get(*p))
        .cloned()
        .collect();
    let safe = !m.unsafe_edit
        && changed.iter().all(|p| {
            m.after
                .get(p)
                .is_some_and(|after| after.as_ref() == current.get(p))
        });
    if operation == "status" {
        return Ok(serde_json::json!({"files":changed,"undoable":safe}));
    }
    if operation != "undo" {
        return Err("Unsupported recovery operation".into());
    }
    if !safe {
        return Err(
            "Files changed outside captured agent edits; recall was stopped to preserve your work"
                .into(),
        );
    }
    // Read every restoration and rollback payload before changing any file.
    let mut writes = Vec::new();
    for relative in &changed {
        let path = safe_path(&root, relative)?;
        let before = m
            .before
            .get(relative)
            .map(|digest| fs::read(store.join("before").join(digest)))
            .transpose()
            .map_err(|e| e.to_string())?;
        let after = if path.exists() {
            Some(fs::read(&path).map_err(|e| e.to_string())?)
        } else {
            None
        };
        if after.as_ref().map(|v| hash(v)) != current.get(relative).cloned() {
            return Err("Files changed during recall; nothing was restored".into());
        }
        writes.push((path, before, after));
    }
    for (index, (path, before, _)) in writes.iter().enumerate() {
        if let Err(error) = restore(path, before.as_deref()) {
            for (p, _, after) in writes[..=index].iter().rev() {
                let _ = restore(p, after.as_deref());
            }
            return Err(format!("File restoration failed: {error}"));
        }
    }
    Ok(serde_json::json!({"files":changed,"undoable":true}))
}
fn restore(path: &Path, data: Option<&[u8]>) -> Result<(), String> {
    if let Some(data) = data {
        fs::create_dir_all(path.parent().ok_or("Invalid path")?).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())
    } else if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}
#[tauri::command]
pub async fn turn_recovery(
    cwd: String,
    id: String,
    operation: String,
    paths: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        operate(cwd, id, operation, paths.unwrap_or_default())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restores_deleted_files_and_removes_created_files_using_absolute_paths() {
        let root = std::env::temp_dir().join(format!("mycode-recall-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let original = root.join("before.txt");
        let created = root.join("after.txt");
        fs::write(&original, "original").unwrap();
        let cwd = root.to_string_lossy().into_owned();
        let id = uuid::Uuid::new_v4().to_string();
        operate(cwd.clone(), id.clone(), "begin".into(), vec![]).unwrap();
        fs::remove_file(&original).unwrap();
        fs::write(&created, "created").unwrap();
        operate(
            cwd.clone(),
            id.clone(),
            "capture".into(),
            vec![
                original.to_string_lossy().into_owned(),
                created.to_string_lossy().into_owned(),
            ],
        )
        .unwrap();
        operate(cwd, id, "undo".into(), vec![]).unwrap();
        assert_eq!(fs::read_to_string(original).unwrap(), "original");
        assert!(!created.exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn recalls_only_captured_edits_and_rejects_later_user_writes() {
        let root = std::env::temp_dir().join(format!("mycode-recall-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let file = root.join("a.txt");
        fs::write(&file, "original").unwrap();
        let cwd = root.to_string_lossy().into_owned();
        let id = uuid::Uuid::new_v4().to_string();
        operate(cwd.clone(), id.clone(), "begin".into(), vec![]).unwrap();
        fs::write(&file, "agent").unwrap();
        operate(
            cwd.clone(),
            id.clone(),
            "capture".into(),
            vec!["a.txt".into()],
        )
        .unwrap();
        fs::write(&file, "user").unwrap();
        assert!(operate(cwd.clone(), id.clone(), "undo".into(), vec![]).is_err());
        assert_eq!(fs::read_to_string(&file).unwrap(), "user");
        fs::write(&file, "agent").unwrap();
        operate(cwd, id, "undo".into(), vec![]).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "original");
        fs::remove_dir_all(root).unwrap();
    }
}
