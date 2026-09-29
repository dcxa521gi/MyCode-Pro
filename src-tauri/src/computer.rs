use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ComputerConfig {
    pub enabled: bool,
    pub binary: String,
    pub generation: String,
}
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("computer");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}
pub fn load(app: &AppHandle) -> Result<ComputerConfig, String> {
    match fs::read(root(app)?.join("config.json")) {
        Ok(data) => {
            serde_json::from_slice(&data).map_err(|_| "Invalid computer configuration".into())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ComputerConfig::default()),
        Err(e) => Err(e.to_string()),
    }
}
fn save(app: &AppHandle, config: &ComputerConfig) -> Result<(), String> {
    let root = root(app)?;
    let pending = root.join("pending.json");
    fs::write(
        &pending,
        serde_json::to_vec(config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(pending, root.join("config.json")).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn computer_config(app: AppHandle) -> Result<ComputerConfig, String> {
    load(&app)
}
#[tauri::command]
pub fn computer_save(
    app: AppHandle,
    enabled: bool,
    binary: String,
) -> Result<ComputerConfig, String> {
    if enabled && !std::path::Path::new(&binary).is_file() {
        return Err("Install or select Cua Driver first.".into());
    }
    let config = ComputerConfig {
        enabled,
        binary,
        generation: uuid::Uuid::new_v4().to_string(),
    };
    save(&app, &config)?;
    let _ = app.emit("mycode-computer-status", &config);
    Ok(config)
}
pub fn mcp(app: &AppHandle) -> Result<Option<Value>, String> {
    let config = load(app)?;
    if !config.enabled {
        return Ok(None);
    }
    let script = root(app)?.join("computer-mcp.cjs");
    fs::write(&script, include_str!("computer-mcp.cjs")).map_err(|e| e.to_string())?;
    Ok(Some(
        json!({"command":crate::managed_cli::node(app)?,"args":[script,config.binary,root(app)?.join("config.json"),config.generation]}),
    ))
}
#[tauri::command(async)]
pub fn computer_install(app: AppHandle) -> Result<ComputerConfig, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Install Cua Driver from cua.ai, then select its executable.".into())
    }
    #[cfg(windows)]
    {
        use sha2::{Digest, Sha256};
        use std::io::Read;
        // Pinned reviewed release. Never run the upstream global installer.
        let (arch, expected) = if cfg!(target_arch = "aarch64") {
            (
                "arm64",
                "72d8713401ad1eb65f3046fe1c9d531840d36b3d5f999c79ac5fe1d4e8cff7e3",
            )
        } else {
            (
                "x86_64",
                "7b0ec893797fdeb0514d96f5797ad6aa53617eadcba2e47856461f60140c757b",
            )
        };
        let root = root(&app)?;
        let directory = root.join("0.30.4");
        let binary = directory.join("cua-driver.exe");
        if !binary.is_file() {
            let url = format!("https://github.com/trycua/cua/releases/download/cua-driver-rs-v0.30.4/cua-driver-rs-0.30.4-windows-{arch}-binary.zip");
            let mut bytes = vec![];
            crate::managed_cli::download_agent()
                .get(&url)
                .call()
                .map_err(|_| "Could not download Cua Driver")?
                .into_reader()
                .take(128 * 1024 * 1024)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if format!("{:x}", Sha256::digest(&bytes)) != expected {
                return Err("Cua Driver checksum mismatch".into());
            }
            let archive = root.join("driver.zip");
            fs::write(&archive, bytes).map_err(|e| e.to_string())?;
            let mut command = std::process::Command::new("powershell.exe");
            command.args(["-NoProfile","-NonInteractive","-Command", "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:MYCODE_CUA_ARCHIVE -DestinationPath $env:MYCODE_CUA_DEST -Force"])
                .env("MYCODE_CUA_ARCHIVE", &archive).env("MYCODE_CUA_DEST", &directory);
            crate::hide_window_console(&mut command);
            if !command.status().map_err(|e| e.to_string())?.success() || !binary.is_file() {
                return Err("Could not extract Cua Driver".into());
            }
            let _ = fs::remove_file(archive);
        }
        computer_save(app, false, binary.to_string_lossy().into_owned())
    }
}
