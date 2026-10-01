use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager};
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
fn external_runtime_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let text = path.to_string_lossy().replace('/', "\\");
        if let Some(unc) = text.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{unc}"));
        }
        if let Some(local) = text.strip_prefix(r"\\?\") {
            return PathBuf::from(local);
        }
    }
    path
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
        return Ok(external_runtime_path(bundled));
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime");
    if development.exists() {
        return Ok(external_runtime_path(development));
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
        "claude", "codex", "cursor", "grok", "opencode", "pi", "hermes", "minimax", "mimo",
        "freebuff",
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
pub fn apply_network(cmd: &mut Command) {
    if let Some(proxy) = system_proxy() {
        cmd.env("HTTPS_PROXY", &proxy).env("HTTP_PROXY", proxy);
    }
}
pub(crate) fn system_proxy() -> Option<String> {
    for key in ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                return Some(value);
            }
        }
    }
    #[cfg(windows)]
    {
        static PROXY: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
        PROXY.get_or_init(|| {
        let mut cmd = Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", r"$p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; if($p.ProxyEnable -eq 1){$p.ProxyServer}"]);
        crate::hide_window_console(&mut cmd);
        if let Ok(output) = cmd.output() {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            let value = if raw.contains('=') {
                raw.split(';')
                    .find_map(|part| {
                        part.strip_prefix("https=")
                            .or_else(|| part.strip_prefix("http="))
                    })
                    .unwrap_or("")
                    .to_owned()
            } else {
                raw
            };
            if !value.is_empty() {
                return Some(if value.contains("://") {
                    value
                } else {
                    format!("http://{value}")
                });
            }
        }
        None
        }).clone()
    }
    #[cfg(not(windows))]
    None
}
fn package(provider: &str) -> Result<(&'static str, &'static str), String> {
    match provider{"minimax"=>Ok(("@minimax-ai/code","mcode")),"freebuff"=>Ok(("freebuff","freebuff")),"browser"=>Ok(("@playwright/mcp","playwright-mcp")),"mimo"=>Ok(("@mimo-ai/cli","mimo")),"claude"=>Ok(("@anthropic-ai/claude-code","claude")),"codex"=>Ok(("@openai/codex","codex")),"pi"=>Ok(("@earendil-works/pi-coding-agent","pi")),"opencode"=>Ok(("opencode-ai","opencode")),_=>Err("This CLI requires its official platform installer. Configure its executable path after installation.".into())}
}
pub(crate) fn download_agent() -> ureq::Agent {
    let mut builder = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(300));
    if let Some(proxy) = system_proxy().and_then(|p| ureq::Proxy::new(p).ok()) {
        builder = builder.proxy(proxy);
    }
    builder.build()
}
fn github_release(repo: &str) -> Result<Value, String> {
    let text = download_agent()
        .get(&format!(
            "https://api.github.com/repos/{repo}/releases/latest"
        ))
        .set("User-Agent", "MyCode")
        .call()
        .map_err(|_| "Could not fetch the official release")?
        .into_string()
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}
fn safe_version(value: &str) -> Result<&str, String> {
    if !value.is_empty()
        && value.len() < 100
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
    {
        Ok(value)
    } else {
        Err("Invalid release version".into())
    }
}
fn install_omp(app: &AppHandle) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let release = github_release("can1357/oh-my-pi")?;
    let version = safe_version(
        release["tag_name"]
            .as_str()
            .ok_or("Missing release version")?,
    )?;
    let os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };
    let name = format!("omp-{os}-{arch}{}", if cfg!(windows) { ".exe" } else { "" });
    let assets = release["assets"]
        .as_array()
        .ok_or("Missing release assets")?;
    let url = |name: &str| -> Result<&str, String> {
        let value = assets
            .iter()
            .find(|a| a["name"].as_str() == Some(name))
            .and_then(|a| a["browser_download_url"].as_str())
            .ok_or("This platform has no official OMP binary")?;
        if !value.starts_with("https://github.com/can1357/oh-my-pi/releases/download/") {
            return Err("Invalid download URL".into());
        }
        Ok(value)
    };
    let hashes = download_agent()
        .get(url("SHA256SUMS.txt")?)
        .call()
        .map_err(|_| "Could not download OMP checksums")?
        .into_string()
        .map_err(|e| e.to_string())?;
    let expected = hashes
        .lines()
        .find_map(|line| {
            let mut p = line.split_whitespace();
            let hash = p.next()?;
            (p.next()?.trim_start_matches('*') == name).then_some(hash)
        })
        .ok_or("Missing OMP checksum")?;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli/omp")
        .join(version);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let binary = dir.join(if cfg!(windows) { "omp.exe" } else { "omp" });
    if binary.is_file() {
        return Ok(binary.to_string_lossy().into());
    }
    let mut bytes = Vec::new();
    download_agent()
        .get(url(&name)?)
        .call()
        .map_err(|_| "OMP download failed")?
        .into_reader()
        .take(512 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if format!("{:x}", Sha256::digest(&bytes)) != expected.to_ascii_lowercase() {
        return Err("OMP checksum mismatch".into());
    }
    let temporary = binary.with_extension("download");
    fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
    fs::rename(&temporary, &binary).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&binary, fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    Ok(binary.to_string_lossy().into())
}
#[cfg(windows)]
fn install_grok(app: &AppHandle) -> Result<String, String> {
    use std::io::Read;
    let version = download_agent()
        .get("https://x.ai/cli/stable")
        .call()
        .map_err(|_| "Could not fetch Grok version")?
        .into_string()
        .map_err(|e| e.to_string())?;
    let version = safe_version(version.trim())?;
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x86_64"
    };
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli/grok")
        .join(version);
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let binary = directory.join("grok.exe");
    if binary.is_file() {
        return Ok(binary.to_string_lossy().into());
    }
    let url = format!("https://x.ai/cli/grok-{version}-windows-{arch}.exe");
    let mut bytes = Vec::new();
    download_agent()
        .get(&url)
        .call()
        .map_err(|_| "Grok download failed")?
        .into_reader()
        .take(512 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if !bytes.starts_with(b"MZ") {
        return Err("Invalid Windows CLI download".into());
    }
    let temporary = binary.with_extension("download");
    fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
    fs::rename(&temporary, &binary).map_err(|e| e.to_string())?;
    Ok(binary.to_string_lossy().into())
}
fn cursor_release() -> Result<(String, String), String> {
    let script = download_agent()
        .get("https://cursor.com/install?win32=true")
        .call()
        .map_err(|_| "Could not fetch the official Cursor release")?
        .into_string()
        .map_err(|e| e.to_string())?;
    let value = |prefix: &str| -> Result<String, String> {
        script
            .lines()
            .find_map(|line| {
                line.trim()
                    .strip_prefix(prefix)
                    .and_then(|s| s.strip_suffix('\''))
                    .map(str::to_owned)
            })
            .ok_or("Unrecognized official Cursor installer".into())
    };
    let version = value("$version = '")?;
    let url = value("$downloadUrl = '")?;
    if !url.starts_with("https://downloads.cursor.com/lab/")
        || !version
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-'))
    {
        return Err("Invalid Cursor release metadata".into());
    }
    Ok((version, url))
}
#[cfg(windows)]
fn install_cursor(app: &AppHandle) -> Result<String, String> {
    use std::io::Read;
    let (version, base) = cursor_release()?;
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli/cursor");
    let versions = root.join("versions");
    fs::create_dir_all(&versions).map_err(|e| e.to_string())?;
    let executable = root.join("cursor-agent.cmd");
    if !versions.join(&version).is_dir() {
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x64"
        };
        let response = download_agent()
            .get(&format!("{base}windows/{arch}/agent-cli-package.zip"))
            .call()
            .map_err(|_| "Cursor download failed")?;
        let archive = root.join("package.zip");
        let mut file = fs::File::create(&archive).map_err(|e| e.to_string())?;
        std::io::copy(
            &mut response.into_reader().take(512 * 1024 * 1024),
            &mut file,
        )
        .map_err(|e| e.to_string())?;
        drop(file);
        let mut command = Command::new("powershell.exe");
        command.args(["-NoProfile","-NonInteractive","-Command", r"$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:MYCODE_ARCHIVE -DestinationPath $env:MYCODE_VERSIONS -Force; Rename-Item -LiteralPath (Join-Path $env:MYCODE_VERSIONS 'dist-package') -NewName $env:MYCODE_VERSION; Get-ChildItem -LiteralPath (Join-Path $env:MYCODE_VERSIONS $env:MYCODE_VERSION) -Filter 'cursor-agent*' -File | Copy-Item -Destination $env:MYCODE_CLI_ROOT -Force"])
          .env("MYCODE_ARCHIVE",&archive).env("MYCODE_VERSIONS",&versions).env("MYCODE_VERSION",&version).env("MYCODE_CLI_ROOT",&root);
        crate::hide_window_console(&mut command);
        if !command.status().map_err(|e| e.to_string())?.success() {
            return Err("Could not extract Cursor CLI".into());
        }
        let _ = fs::remove_file(archive);
    }
    let executable = if executable.is_file() {
        executable
    } else {
        root.join("cursor-agent.exe")
    };
    if !executable.is_file() {
        return Err("Cursor launcher was not found".into());
    }
    Ok(executable.to_string_lossy().into())
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRelease {
    version: String,
    managed_path: Option<String>,
}
#[tauri::command(async)]
pub fn managed_cli_latest(app: AppHandle, provider: String) -> Result<CliRelease, String> {
    if ["omp", "fx", "antigravity", "zcode"].contains(&provider.as_str()) {
        return Err("This CLI is no longer supported in MyCode".into());
    }
    if provider == "omp" || provider == "zcode" || provider == "hermes" {
        let repo = match provider.as_str() {
            "omp" => "can1357/oh-my-pi",
            "zcode" => "zai-org/ZCode",
            _ => "NousResearch/hermes-agent",
        };
        let release = github_release(repo)?;
        return Ok(CliRelease {
            version: release["tag_name"]
                .as_str()
                .unwrap_or("unknown")
                .to_string(),
            managed_path: None,
        });
    }
    if provider == "fx" || provider == "grok" {
        let url = if provider == "fx" {
            "https://releases.fx.sh/latest.txt"
        } else {
            "https://x.ai/cli/stable"
        };
        let version = download_agent()
            .get(url)
            .call()
            .map_err(|_| "Could not check official release")?
            .into_string()
            .map_err(|e| e.to_string())?;
        return Ok(CliRelease {
            version: safe_version(version.trim())?.to_string(),
            managed_path: None,
        });
    }
    if provider == "cursor" {
        let (version, _) = cursor_release()?;
        return Ok(CliRelease {
            version,
            managed_path: None,
        });
    }
    let (pkg, bin) = package(&provider)?;
    let endpoint = format!(
        "https://registry.npmjs.org/{}/latest",
        pkg.replace('/', "%2F")
    );
    let mut builder = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(20));
    if let Some(proxy) = system_proxy().and_then(|p| ureq::Proxy::new(p).ok()) {
        builder = builder.proxy(proxy);
    }
    let response = builder
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
    let result = install_cli(&app, &provider);
    if result.is_ok() {
        let _ = app.emit("mycode-cli-updated", &provider);
    }
    result
}

fn install_cli(app: &AppHandle, provider: &str) -> Result<String, String> {
    let app = app.clone();
    let provider = provider.to_owned();
    if ["omp", "fx", "antigravity", "zcode"].contains(&provider.as_str()) {
        return Err("This CLI is no longer supported in MyCode".into());
    }
    let _lock = INSTALL_LOCK.lock().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    if provider == "hermes" {
        return install_hermes(&app);
    }
    if provider == "omp" {
        return install_omp(&app);
    }
    #[cfg(windows)]
    if provider == "grok" {
        return install_grok(&app);
    }
    #[cfg(windows)]
    if provider == "cursor" {
        return install_cursor(&app);
    }
    let (pkg, bin) = package(&provider)?;
    let runtime = runtime_dir(&app)?;
    let prefix = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli")
        .join(&provider);
    fs::create_dir_all(&prefix).map_err(|e| e.to_string())?;
    let log_path = prefix.join("install.log");
    let log = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(node(&app)?);
    if let Some(proxy) = system_proxy() {
        cmd.env("HTTPS_PROXY", &proxy)
            .env("HTTP_PROXY", &proxy)
            .env("npm_config_proxy", &proxy)
            .env("npm_config_https_proxy", proxy);
    }
    cmd.env(
        "npm_config_cache",
        crate::cache_location::root().join("npm"),
    );
    cmd.arg(runtime.join("npm/bin/npm-cli.js"))
        .args(["install", "--global", "--no-audit", "--no-fund", "--prefix"])
        .arg(&prefix)
        .arg(format!("{pkg}@latest"))
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log));
    if provider == "minimax" {
        cmd.args([
            "--ignore-scripts=false",
            "--include=optional",
            "--allow-scripts=@minimax-ai/code,better-sqlite3",
            "--registry=https://registry.npmjs.org/",
        ]);
    }
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
                return Err(format!(
                    "CLI installation failed ({}). Diagnostic log: {}",
                    status,
                    log_path.display()
                ));
            }
            break;
        }
        if started.elapsed() > std::time::Duration::from_secs(600) {
            let _ = child.kill();
            let _ = child.wait();
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
    if provider == "freebuff" {
        // The npm package lazily downloads its native binary. Do that during
        // installation so the first version probe/terminal launch is ready.
        let log = fs::OpenOptions::new()
            .append(true)
            .open(&log_path)
            .map_err(|e| e.to_string())?;
        let mut cmd = Command::new(node(&app)?);
        cmd.arg(prefix.join("node_modules/freebuff/index.js"))
            .arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
            .stderr(Stdio::from(log));
        apply_network(&mut cmd);
        apply_path(&mut cmd);
        crate::hide_window_console(&mut cmd);
        let mut child = cmd.spawn().map_err(|e| e.to_string())?;
        let start = std::time::Instant::now();
        loop {
            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                if !status.success() {
                    return Err(format!(
                        "Freebuff runtime download failed. Log: {}",
                        log_path.display()
                    ));
                }
                break;
            }
            if start.elapsed() > std::time::Duration::from_secs(600) {
                let _ = child.kill();
                let _ = child.wait();
                return Err("CLI installation timed out".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
    }
    Ok(path.to_string_lossy().into())
}

#[cfg(windows)]
fn install_hermes(app: &AppHandle) -> Result<String, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cli/hermes");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let source = download_agent()
        .get("https://hermes-agent.nousresearch.com/install.ps1")
        .call()
        .map_err(|_| "Could not download the official Hermes installer")?
        .into_string()
        .map_err(|e| e.to_string())?;
    // Keep the upstream launcher, but scope PATH to this installer process.
    // Fail closed if upstream changes its entry point instead of modifying the
    // user's global command lookup from an application-local installation.
    let marker = "    Set-LauncherUserPath $binDir";
    if source.matches(marker).count() != 1 {
        return Err(
            "The Hermes installer changed; application-local installation needs an adapter update."
                .into(),
        );
    }
    let source = source.replace(marker, "    $env:Path = \"$binDir;$env:Path\"");
    let script = root.join("install-app.ps1");
    fs::write(&script, source).map_err(|e| e.to_string())?;
    let log_path = root.join("install.log");
    let log = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let mut command = Command::new("powershell.exe");
    command
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(script)
        .args([
            "-NonInteractive",
            "-SkipBrowser",
            "-SkipComputerUse",
            "-HermesHome",
        ])
        .arg(root.join("data"))
        .arg("-InstallDir")
        .arg(root.join("source"))
        .env("HERMES_HOME", root.join("data"))
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log));
    apply_network(&mut command);
    apply_path(&mut command);
    crate::hide_window_console(&mut command);
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let start = std::time::Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                return Err(format!(
                    "Hermes installation failed. Log: {}",
                    log_path.display()
                ));
            }
            break;
        }
        if start.elapsed() > std::time::Duration::from_secs(1800) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("CLI installation timed out".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    for name in ["hermes.exe", "hermes.cmd"] {
        let launcher = root.join("data/bin").join(name);
        if launcher.is_file() {
            return Ok(launcher.to_string_lossy().into());
        }
    }
    Err("Installed CLI executable was not found".into())
}
#[cfg(all(test, windows))]
mod runtime_path_tests {
    use super::*;
    #[test]
    fn node_receives_regular_drive_and_unc_paths() {
        assert_eq!(
            external_runtime_path(PathBuf::from(r"\\?\C:\MyCode/runtime")),
            PathBuf::from(r"C:\MyCode\runtime")
        );
        assert_eq!(
            external_runtime_path(PathBuf::from(r"\\?\UNC\server\share\runtime")),
            PathBuf::from(r"\\server\share\runtime")
        );
    }
}
