use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
type Reply = Result<Value, String>;
struct Process {
    child: Child,
    input: ChildStdin,
}
#[derive(Default)]
pub struct ImBridge {
    process: Mutex<Option<Process>>,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<Reply>>>>,
}
impl Drop for ImBridge {
    fn drop(&mut self) {
        if let Ok(Some(process)) = self.process.get_mut() {
            let _ = process.child.kill();
        }
    }
}
fn secret_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("im-secrets.dat"))
}
fn save_secrets(app: &AppHandle, value: &Value) -> Result<(), String> {
    let protected = crate::local_ai::protect(&value.to_string(), false)?;
    let path = secret_path(app)?;
    let temporary = path.with_extension("pending");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary).map_err(|e| e.to_string())?;
    file.write_all(protected.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temporary, path).map_err(|e| e.to_string())
}
fn ensure(app: &AppHandle, bridge: &ImBridge) -> Result<(), String> {
    let mut process = bridge.process.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = process.as_mut() {
        if existing
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .is_none()
        {
            return Ok(());
        }
    }
    let runtime = crate::managed_cli::runtime_dir(app)?;
    let mut command = Command::new(crate::managed_cli::node(app)?);
    command
        .arg(runtime.join("im-bridge.cjs"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    crate::hide_window_console(&mut command);
    let mut child = command
        .spawn()
        .map_err(|_| "Could not start the local IM runtime")?;
    let mut input = child.stdin.take().ok_or("IM stdin unavailable")?;
    let output = child.stdout.take().ok_or("IM stdout unavailable")?;
    let secrets = match fs::read_to_string(secret_path(app)?) {
        Ok(s) => serde_json::from_str::<Value>(&crate::local_ai::protect(&s, true)?)
            .map_err(|_| "Invalid IM credentials")?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(e) => return Err(e.to_string()),
    };
    writeln!(input,"{}",json!({"id":"bootstrap","action":"bootstrap","secrets":secrets,"directory":app.path().app_data_dir().map_err(|e|e.to_string())?})).map_err(|_|"Could not initialize IM runtime")?;
    let pending = bridge.pending.clone();
    let app = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(output).lines().map_while(Result::ok) {
            let Ok(message) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            match message["kind"].as_str() {
                Some("response") => {
                    if let Some(id) = message["id"].as_str() {
                        if let Ok(mut pending) = pending.lock() {
                            if let Some(tx) = pending.remove(id) {
                                let result = if let Some(error) = message["error"].as_str() {
                                    Err(error.into())
                                } else {
                                    Ok(message["value"].clone())
                                };
                                let _ = tx.send(result);
                            }
                        }
                    }
                }
                Some("secrets") => {
                    if save_secrets(&app, &message["value"]).is_err() {
                        let _ =
                            app.emit_to("main", "mycode-im-error", "Could not save IM credentials");
                    }
                }
                Some("message") => {
                    let _ = app.emit_to("main", "mycode-im-message", message["value"].clone());
                }
                Some("status") => {
                    let _ = app.emit("mycode-im-status", message["value"].clone());
                }
                _ => {}
            }
        }
        if let Ok(mut pending) = pending.lock() {
            for (_, sender) in pending.drain() {
                let _ = sender.send(Err("IM runtime stopped".into()));
            }
        }
    });
    *process = Some(Process { child, input });
    Ok(())
}
#[tauri::command(async)]
pub fn im_bridge_request(app: AppHandle, bridge: State<'_, ImBridge>, mut request: Value) -> Reply {
    if ![
        "status",
        "configure",
        "start",
        "stop",
        "reply",
        "wechat-authorize",
        "wechat-verify",
    ]
    .contains(&request["action"].as_str().unwrap_or(""))
    {
        return Err("Unsupported IM action".into());
    }
    ensure(&app, &bridge)?;
    let id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel();
    request["id"] = json!(id);
    bridge
        .pending
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), tx);
    {
        let mut guard = bridge.process.lock().map_err(|e| e.to_string())?;
        let process = guard.as_mut().ok_or("IM runtime unavailable")?;
        writeln!(process.input, "{request}").map_err(|_| "IM runtime is not responding")?;
    }
    let result = rx
        .recv_timeout(Duration::from_secs(90))
        .map_err(|_| "IM request timed out".to_string());
    if let Ok(mut pending) = bridge.pending.lock() {
        pending.remove(&id);
    }
    result?
}
