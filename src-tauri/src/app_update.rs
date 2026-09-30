use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::PathBuf,
    sync::Mutex,
};
use tauri::{AppHandle, Emitter};

static LOCK: Mutex<()> = Mutex::new(());
fn installer(_app: &AppHandle, version: &str) -> Result<PathBuf, String> {
    if version.split('.').count() != 3
        || !version
            .split('.')
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
    {
        return Err("Invalid release version".into());
    }
    let dir = crate::cache_location::root().join("updates");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("MyCode_{version}_x64-setup.exe")))
}

#[tauri::command(async)]
pub fn app_update_download(app: AppHandle, version: String) -> Result<(), String> {
    let _lock = LOCK.lock().map_err(|e| e.to_string())?;
    if !cfg!(windows) {
        return Err("In-app installation is currently supported on Windows.".into());
    }
    let target = installer(&app, &version)?;
    let agent = crate::managed_cli::download_agent();
    let release: Value = serde_json::from_str(
        &agent
            .get(&format!(
                "https://api.github.com/repos/dcxa521gi/MyCode-Pro/releases/tags/v{version}"
            ))
            .set("User-Agent", "MyCode")
            .call()
            .map_err(|e| e.to_string())?
            .into_string()
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if release["draft"] == true || release["prerelease"] == true {
        return Err("Invalid release".into());
    }
    let name = target.file_name().unwrap().to_string_lossy();
    let asset = release["assets"]
        .as_array()
        .and_then(|a| a.iter().find(|v| v["name"].as_str() == Some(&name)))
        .ok_or("Windows installer is not available")?;
    let digest = asset["digest"]
        .as_str()
        .and_then(|s| s.strip_prefix("sha256:"))
        .ok_or("Release checksum is missing")?;
    let url =
        format!("https://github.com/dcxa521gi/MyCode-Pro/releases/download/v{version}/{name}");
    let temporary = target.with_extension("download");
    let result = (|| -> Result<(), String> {
        let mut reader = agent
            .get(&url)
            .call()
            .map_err(|e| e.to_string())?
            .into_reader();
        let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        let mut buf = [0u8; 65536];
        let mut received = 0u64;
        let total = asset["size"].as_u64().ok_or("Invalid installer size")?;
        loop {
            let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            received += n as u64;
            if received > total {
                return Err("Installer size mismatch".into());
            }
            file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            hasher.update(&buf[..n]);
            let _ = app.emit(
                "mycode-update-progress",
                json!({"version":version,"progress":received * 100 / total.max(1)}),
            );
        }
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        if received != total || format!("{:x}", hasher.finalize()) != digest {
            return Err("Installer checksum mismatch".into());
        }
        fs::rename(&temporary, &target).map_err(|e| e.to_string())?;
        fs::write(target.with_extension("sha256"), digest).map_err(|e| e.to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

#[tauri::command(async)]
pub fn app_update_install(app: AppHandle, version: String) -> Result<(), String> {
    let _lock = LOCK.lock().map_err(|e| e.to_string())?;
    let target = installer(&app, &version)?;
    let expected = fs::read_to_string(target.with_extension("sha256"))
        .map_err(|_| "Download the update first")?;
    let data = fs::read(&target).map_err(|e| e.to_string())?;
    if format!("{:x}", Sha256::digest(data)) != expected {
        return Err("Installer checksum mismatch".into());
    }
    let mut command = std::process::Command::new(target);
    crate::hide_window_console(&mut command);
    command.spawn().map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}
