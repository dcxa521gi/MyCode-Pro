use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
static BROWSER_INSTALL_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrowserConfig {
    enabled: bool,
    installed: bool,
    generation: String,
}
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli/browser");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}
fn load(app: &AppHandle) -> Result<BrowserConfig, String> {
    let root = root(app)?;
    let mut config: BrowserConfig = match fs::read(root.join("browser.json")) {
        Ok(data) => serde_json::from_slice(&data).map_err(|e| e.to_string())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => BrowserConfig::default(),
        Err(e) => return Err(e.to_string()),
    };
    config.installed =
        root.join("ready").is_file() && root.join("node_modules/@playwright/mcp/cli.js").is_file();
    Ok(config)
}
#[tauri::command]
pub fn browser_config(app: AppHandle) -> Result<BrowserConfig, String> {
    load(&app)
}
#[tauri::command]
pub fn browser_save(app: AppHandle, enabled: bool) -> Result<BrowserConfig, String> {
    let mut config = load(&app)?;
    if enabled && !config.installed {
        return Err("Install the headless browser first.".into());
    }
    config.enabled = enabled;
    config.generation = uuid::Uuid::new_v4().to_string();
    let root = root(&app)?;
    fs::write(
        root.join("browser.pending.json"),
        serde_json::to_vec(&config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(root.join("browser.pending.json"), root.join("browser.json"))
        .map_err(|e| e.to_string())?;
    Ok(config)
}
#[tauri::command(async)]
pub fn browser_install(app: AppHandle) -> Result<BrowserConfig, String> {
    let _lock = BROWSER_INSTALL_LOCK.lock().map_err(|e| e.to_string())?;
    let root = root(&app)?;
    browser_save(app.clone(), false)?;
    if root.join("ready").exists() {
        fs::remove_file(root.join("ready")).map_err(|e| e.to_string())?;
    }
    crate::managed_cli::managed_cli_install(app.clone(), "browser".into())?;
    let log = fs::File::create(root.join("chromium-install.log")).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(crate::managed_cli::node(&app)?);
    cmd.arg(root.join("node_modules/playwright/cli.js"))
        .args(["install", "chromium"])
        .env("PLAYWRIGHT_BROWSERS_PATH", root.join("browsers"))
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log));
    crate::managed_cli::apply_network(&mut cmd);
    crate::managed_cli::apply_path(&mut cmd);
    crate::hide_window_console(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                return Err(format!(
                    "Browser installation failed. Log: {}",
                    root.join("chromium-install.log").display()
                ));
            }
            break;
        }
        if start.elapsed() > Duration::from_secs(900) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Browser installation timed out".into());
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    fs::write(root.join("ready"), b"chromium").map_err(|e| e.to_string())?;
    load(&app)
}
pub fn mcp(app: &AppHandle) -> Result<Option<Value>, String> {
    let config = load(app)?;
    if !config.enabled || !config.installed {
        return Ok(None);
    }
    let root = root(app)?;
    let bridge = root.join("browser-mcp.cjs");
    fs::write(&bridge, include_str!("browser-mcp.cjs")).map_err(|e| e.to_string())?;
    Ok(Some(
        json!({"command":crate::managed_cli::node(app)?,"args":[bridge,root,config.generation]}),
    ))
}
