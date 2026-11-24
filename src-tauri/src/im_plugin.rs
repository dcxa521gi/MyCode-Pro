//! Versioned local IM transport updates, independent of credentials and sessions.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

const FEED: &str =
    "https://raw.githubusercontent.com/dcxa521gi/MyCode-Pro/mycode-im-runtime/manifest.json";
const BASE: &str = "https://raw.githubusercontent.com/dcxa521gi/MyCode-Pro/mycode-im-runtime/";
const LIMIT: u64 = 32 * 1024 * 1024;
static UPDATE_LOCK: Mutex<()> = Mutex::new(());
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    version: String,
    min_app_version: String,
    protocol: u32,
    sha256: String,
    file: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginState {
    current: String,
    latest: String,
    available: bool,
    staged: bool,
}
fn version(value: &str) -> Result<(u32, u32, u32), String> {
    let parts: Vec<_> = value.split('.').map(str::parse::<u32>).collect();
    if let [Ok(a), Ok(b), Ok(c)] = parts.as_slice() {
        Ok((*a, *b, *c))
    } else {
        Err("Invalid IM plugin version".into())
    }
}
fn validate(manifest: &Manifest, app_version: &str) -> Result<(), String> {
    version(&manifest.version)?;
    if manifest.protocol != 1 || version(&manifest.min_app_version)? > version(app_version)? {
        return Err("Update MyCode before installing this IM plugin version.".into());
    }
    if manifest.sha256.len() != 64
        || !manifest.sha256.bytes().all(|c| c.is_ascii_hexdigit())
        || manifest.file != format!("im-bridge-{}-{}.cjs", manifest.version, manifest.sha256)
    {
        return Err("Invalid IM plugin manifest".into());
    }
    Ok(())
}
fn directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("im-plugins"))
}
fn installed(app: &AppHandle) -> Option<(Manifest, PathBuf)> {
    let root = directory(app).ok()?;
    let manifest: Manifest =
        serde_json::from_slice(&fs::read(root.join("current.json")).ok()?).ok()?;
    validate(&manifest, env!("CARGO_PKG_VERSION")).ok()?;
    if version(&manifest.version).ok()? <= version(env!("CARGO_PKG_VERSION")).ok()? {
        return None;
    }
    let path = root.join(&manifest.file);
    if root.join(format!("{}.rejected", manifest.file)).exists() {
        return None;
    }
    if fs::metadata(&path).ok()?.len() > LIMIT {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    if format!("{:x}", Sha256::digest(&bytes)) != manifest.sha256.to_ascii_lowercase() {
        return None;
    }
    Some((manifest, path))
}
pub fn runtime_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(installed(app)
        .map(|(_, path)| path)
        .unwrap_or(crate::managed_cli::runtime_dir(app)?.join("im-bridge.cjs")))
}
pub fn reject_runtime(app: &AppHandle, path: &std::path::Path) {
    if let (Ok(root), Some(name)) = (directory(app), path.file_name()) {
        if path.parent() == Some(root.as_path()) {
            let _ = fs::write(
                root.join(format!("{}.rejected", name.to_string_lossy())),
                b"Runtime exited unexpectedly; using bundled transport.",
            );
        }
    }
}

#[tauri::command(async)]
pub fn im_plugin_update(app: AppHandle, install: bool) -> Result<PluginState, String> {
    let _lock = UPDATE_LOCK.lock().map_err(|e| e.to_string())?;
    let current = installed(&app)
        .map(|(m, _)| m.version)
        .unwrap_or_else(|| env!("CARGO_PKG_VERSION").into());
    let mut body = Vec::new();
    crate::managed_cli::download_agent()
        .get(FEED)
        .call()
        .map_err(|_| "Could not check IM plugin updates. Check your network and retry.")?
        .into_reader()
        .take(64 * 1024)
        .read_to_end(&mut body)
        .map_err(|e| e.to_string())?;
    let manifest: Manifest =
        serde_json::from_slice(&body).map_err(|_| "Invalid IM plugin manifest")?;
    validate(&manifest, env!("CARGO_PKG_VERSION"))?;
    let available = version(&manifest.version)? > version(&current)?;
    if directory(&app)?
        .join(format!("{}.rejected", manifest.file))
        .exists()
    {
        return Err("This IM plugin previously failed to start. The bundled plugin is active; wait for a newer update.".into());
    }
    if !available || !install {
        return Ok(PluginState {
            current,
            latest: manifest.version,
            available,
            staged: false,
        });
    }
    let mut bytes = Vec::new();
    crate::managed_cli::download_agent()
        .get(&format!("{BASE}{}", manifest.file))
        .call()
        .map_err(|_| "Could not download the IM plugin.")?
        .into_reader()
        .take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > LIMIT
        || format!("{:x}", Sha256::digest(&bytes)) != manifest.sha256.to_ascii_lowercase()
    {
        return Err("IM plugin checksum verification failed. The current plugin was kept.".into());
    }
    let root = directory(&app)?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let target = root.join(&manifest.file);
    let temporary = root.join(format!("{}.pending.cjs", uuid::Uuid::new_v4()));
    fs::write(&temporary, &bytes).map_err(|e| e.to_string())?;
    let mut command = Command::new(crate::managed_cli::node(&app)?);
    command
        .arg("--check")
        .arg(&temporary)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    crate::hide_window_console(&mut command);
    let mut child = command
        .spawn()
        .map_err(|_| "Could not verify the IM plugin.")?;
    let start = std::time::Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                let _ = fs::remove_file(&temporary);
                return Err("Could not verify the IM plugin.".into());
            }
            break;
        }
        if start.elapsed() > std::time::Duration::from_secs(30) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(&temporary);
            return Err("Could not verify the IM plugin.".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    fs::rename(&temporary, &target).map_err(|e| e.to_string())?;
    let pending = root.join("current.pending");
    fs::write(
        &pending,
        serde_json::to_vec(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(pending, root.join("current.json")).map_err(|e| e.to_string())?;
    // Keep active transports and pending replies alive; activate only on next runtime start.
    Ok(PluginState {
        current,
        latest: manifest.version,
        available: false,
        staged: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn manifest() -> Manifest {
        Manifest {
            version: "0.24.2".into(),
            min_app_version: "0.24.1".into(),
            protocol: 1,
            sha256: "a".repeat(64),
            file: format!("im-bridge-0.24.2-{}.cjs", "a".repeat(64)),
        }
    }
    #[test]
    fn rejects_unsafe_names_and_incompatible_updates() {
        let mut m = manifest();
        assert!(validate(&m, "0.24.1").is_ok());
        assert!(validate(&m, "0.24.0").is_err());
        m.file = "../im-secrets.dat".into();
        assert!(validate(&m, "0.24.1").is_err());
        m = manifest();
        m.protocol = 2;
        assert!(validate(&m, "0.24.1").is_err());
        m = manifest();
        m.sha256 = "g".repeat(64);
        assert!(validate(&m, "0.24.1").is_err());
    }
}
