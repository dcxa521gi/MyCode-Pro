use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};
static INSTALL_LOCK: Mutex<()> = Mutex::new(());
static RUNTIME_PATH: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
pub fn init(app: &AppHandle) {
    if let Ok(dir) = runtime_dir(app) {
        let _ = RUNTIME_PATH.set(dir);
    }
}
pub fn apply_path(cmd: &mut Command) {
    if let Some(runtime) = RUNTIME_PATH.get() {
        let previous = cmd
            .get_envs()
            .find(|(key, _)| key.eq_ignore_ascii_case("PATH"))
            .and_then(|(_, value)| value.map(|v| v.to_os_string()))
            .or_else(|| std::env::var_os("PATH"))
            .unwrap_or_default();
        let paths = std::iter::once(runtime.clone()).chain(std::env::split_paths(&previous));
        if let Ok(path) = std::env::join_paths(paths) {
            cmd.env("PATH", path);
        }
    }
}
pub fn runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let bundled = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("runtime");
    if bundled
        .join(if cfg!(windows) { "node.exe" } else { "node" })
        .is_file()
    {
        return Ok(bundled);
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime");
    if development.exists() {
        return Ok(development);
    }
    Err("MyCode runtime is missing. Reinstall the application.".into())
}
pub fn node(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(runtime_dir(app)?.join(if cfg!(windows) { "node.exe" } else { "node" }))
}
fn paths_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("cli-paths.json"))
}
#[tauri::command(async)]
pub fn managed_cli_paths(app: AppHandle) -> Result<HashMap<String, String>, String> {
    match fs::read(paths_file(&app)?) {
        Ok(data) => {
            serde_json::from_slice(&data).map_err(|_| "Invalid CLI path configuration".into())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command(async)]
pub fn managed_cli_save_path(
    app: AppHandle,
    provider: String,
    path: Option<String>,
) -> Result<(), String> {
    let _lock = INSTALL_LOCK.lock().map_err(|e| e.to_string())?;
    if ![
        "claude",
        "codex",
        "cursor",
        "grok",
        "opencode",
        "pi",
        "omp",
        "fx",
        "hermes",
        "antigravity",
    ]
    .contains(&provider.as_str())
    {
        return Err("Unknown CLI".into());
    }
    let mut paths = managed_cli_paths(app.clone())?;
    if let Some(path) = path.filter(|p| !p.trim().is_empty()) {
        let normalized = path.trim().trim_matches('"').to_string();
        let resolved = crate::harness::resolve_harness_binary_override(&provider, &normalized)?;
        paths.insert(provider, resolved.to_string_lossy().into());
    } else {
        paths.remove(&provider);
    }
    fs::write(
        paths_file(&app)?,
        serde_json::to_vec(&paths).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
fn package(provider: &str) -> Result<(&'static str, &'static str), String> {
    match provider{"claude"=>Ok(("@anthropic-ai/claude-code","claude")),"codex"=>Ok(("@openai/codex","codex")),"pi"=>Ok(("@earendil-works/pi-coding-agent","pi")),"opencode"=>Ok(("opencode-ai","opencode")),_=>Err("This CLI requires its official platform installer. Configure its executable path after installation.".into())}
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRelease {
    version: String,
    managed_path: Option<String>,
}
#[tauri::command(async)]
pub fn managed_cli_latest(app: AppHandle, provider: String) -> Result<CliRelease, String> {
    let (pkg, bin) = package(&provider)?;
    let endpoint = format!(
        "https://registry.npmjs.org/{}/latest",
        pkg.replace('/', "%2F")
    );
    let response = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .get(&endpoint)
        .call()
        .map_err(|_| "Could not check the latest CLI version")?
        .into_string()
        .map_err(|_| "Invalid registry response")?;
    let value: Value = serde_json::from_str(&response).map_err(|_| "Invalid registry response")?;
    let version = value["version"]
        .as_str()
        .ok_or("Missing CLI version")?
        .to_string();
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli")
        .join(&provider);
    let executable = if cfg!(windows) {
        dir.join(format!("{bin}.cmd"))
    } else {
        dir.join("bin").join(bin)
    };
    Ok(CliRelease {
        version,
        managed_path: executable
            .is_file()
            .then(|| executable.to_string_lossy().into()),
    })
}
#[tauri::command(async)]
pub fn managed_cli_install(app: AppHandle, provider: String) -> Result<String, String> {
    let _lock = INSTALL_LOCK.lock().map_err(|e| e.to_string())?;
    let (pkg, bin) = package(&provider)?;
    let runtime = runtime_dir(&app)?;
    let prefix = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli")
        .join(&provider);
    fs::create_dir_all(&prefix).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(node(&app)?);
    cmd.arg(runtime.join("npm/bin/npm-cli.js"))
        .args(["install", "--global", "--no-audit", "--no-fund", "--prefix"])
        .arg(&prefix)
        .arg(format!("{pkg}@latest"))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    crate::harness::apply_gui_env(&mut cmd);
    apply_path(&mut cmd);
    crate::hide_window_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|_| "Could not start the application installer")?;
    let started = std::time::Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                return Err("CLI installation failed. Check network access and retry.".into());
            }
            break;
        }
        if started.elapsed() > std::time::Duration::from_secs(600) {
            let _ = child.kill();
            return Err("CLI installation timed out".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    let path = if cfg!(windows) {
        prefix.join(format!("{bin}.cmd"))
    } else {
        prefix.join("bin").join(bin)
    };
    if !path.is_file() {
        return Err("Installed CLI executable was not found".into());
    }
    Ok(path.to_string_lossy().into())
}
