use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
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
    config.installed = crate::cache_location::root()
        .join("browser/browsers")
        .is_dir()
        && root.join("ready").is_file()
        && root
            .join(if cfg!(windows) {
                "node_modules/@playwright/mcp/cli.js"
            } else {
                "lib/node_modules/@playwright/mcp/cli.js"
            })
            .is_file();
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
    let _lock = BROWSER_INSTALL_LOCK
        .try_lock()
        .map_err(|_| "Browser installation is already running".to_string())?;
    let root = root(&app)?;
    browser_save(app.clone(), false)?;
    if root.join("ready").exists() {
        fs::remove_file(root.join("ready")).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("mycode-browser-install", "Installing browser tools…");
    crate::managed_cli::managed_cli_install(app.clone(), "browser".into())?;
    let _ = app.emit("mycode-browser-install", "Downloading Chromium…");
    let log = fs::File::create(root.join("chromium-install.log")).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(crate::managed_cli::node(&app)?);
    // npm may nest Playwright under @playwright/mcp instead of hoisting it.
    // Resolve from the package that owns the dependency, on every platform.
    cmd.args(["-e", "const {createRequire}=require('node:module');const r=createRequire(process.argv[1]);const cli=require('node:path').join(require('node:path').dirname(r.resolve('playwright/package.json')),'cli.js');process.argv=['node',cli,'install','chromium'];require(cli);"])
        .arg(root.join(if cfg!(windows) { "node_modules/@playwright/mcp/package.json" } else { "lib/node_modules/@playwright/mcp/package.json" }))
        .env("PLAYWRIGHT_BROWSERS_PATH", crate::cache_location::root().join("browser/browsers"))
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log));
    crate::managed_cli::apply_network(&mut cmd);
    crate::managed_cli::apply_path(&mut cmd);
    crate::hide_window_console(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let start = Instant::now();
    let mut last_report = Instant::now();
    loop {
        if last_report.elapsed() >= Duration::from_secs(2) {
            let _ = app.emit("mycode-browser-install", "Downloading Chromium…");
            last_report = Instant::now();
        }
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
        json!({"command":crate::managed_cli::node(app)?,"args":[bridge,root,config.generation,crate::cache_location::root().join("browser")]}),
    ))
}
