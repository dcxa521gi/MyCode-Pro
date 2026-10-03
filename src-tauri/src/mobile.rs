//! Opt-in, certificate-pinned LAN bridge. No arbitrary Tauri or filesystem access.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream, UdpSocket},
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State, WebviewWindow};

#[derive(Default)]
struct Inner {
    enabled: bool,
    generation: u64,
    pairing: String,
    expires: Option<Instant>,
    window: String,
    devices: HashMap<String, String>,
    receipts: HashSet<String>,
    pending: HashMap<String, mpsc::Sender<Value>>,
}
#[derive(Default)]
pub struct MobileHost(Arc<Mutex<Inner>>);
fn secret() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}
fn digest(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}
fn validate_action(v: &Value) -> Result<&str, String> {
    let action = v["action"].as_str().ok_or("Missing action")?;
    if !["snapshot", "session", "send", "stop", "approve", "question"].contains(&action) {
        return Err("Unsupported mobile action".into());
    }
    if action != "snapshot"
        && (v["sessionId"].as_str().unwrap_or("").is_empty()
            || v["sessionId"].as_str().unwrap_or("").len() > 128)
    {
        return Err("Missing session".into());
    }
    if action == "send"
        && (v["text"].as_str().unwrap_or("").trim().is_empty()
            || v["text"].as_str().unwrap_or("").len() > 32000)
    {
        return Err("Invalid message".into());
    }
    if action == "approve" && !["allow", "deny"].contains(&v["decision"].as_str().unwrap_or("")) {
        return Err("Invalid approval".into());
    }
    Ok(action)
}

fn authorize(inner: &mut Inner, generation: u64, value: &Value) -> Result<Option<Value>, String> {
    if !inner.enabled || inner.generation != generation {
        return Err("Bridge disabled".into());
    }
    if value["action"] == "pair" {
        let key = value["pairing"].as_str().unwrap_or("");
        if inner.pairing.is_empty()
            || digest(key) != digest(&inner.pairing)
            || inner.expires.is_none_or(|d| d <= Instant::now())
        {
            return Err("Pairing expired or invalid".into());
        }
        let token = secret();
        let name = value["name"]
            .as_str()
            .unwrap_or("Android")
            .chars()
            .take(80)
            .collect::<String>();
        inner.devices.insert(digest(&token), name);
        inner.pairing.clear();
        return Ok(Some(json!({"deviceToken":token})));
    }
    let token = value["deviceToken"].as_str().unwrap_or("");
    let device = digest(token);
    if !inner.devices.contains_key(&device) {
        return Err("Device is not authorized".into());
    }
    validate_action(value)?;
    let id = value["id"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 128)
        .ok_or("Missing request ID")?;
    let receipt = format!("{device}:{id}");
    if inner.receipts.contains(&receipt) {
        return Err("Request already received".into());
    }
    if inner.receipts.len() >= 10000
        && !["snapshot", "session"].contains(&value["action"].as_str().unwrap_or(""))
    {
        return Err("Reconnect from desktop to renew the bridge".into());
    }
    // Read-only polls do not exhaust the replay budget of mutating operations.
    if !["snapshot", "session"].contains(&value["action"].as_str().unwrap_or("")) {
        inner.receipts.insert(receipt);
    }
    Ok(None)
}

#[tauri::command]
pub fn mobile_start(
    app: AppHandle,
    window: WebviewWindow,
    host: State<'_, MobileHost>,
) -> Result<Value, String> {
    let issued =
        rcgen::generate_simple_self_signed(vec!["localhost".into()]).map_err(|e| e.to_string())?;
    let fingerprint = format!("{:x}", Sha256::digest(issued.cert.der().as_ref()));
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|e| e.to_string())?
        .with_no_client_auth()
        .with_single_cert(
            vec![issued.cert.der().clone()],
            rustls::pki_types::PrivatePkcs8KeyDer::from(issued.signing_key.serialize_der()).into(),
        )
        .map_err(|e| e.to_string())?;
    let listener = TcpListener::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let pairing = secret();
    let generation = {
        let mut inner = host.0.lock().map_err(|e| e.to_string())?;
        inner.enabled = true;
        inner.generation += 1;
        inner.devices.clear();
        inner.receipts.clear();
        inner.pending.clear();
        inner.pairing = pairing.clone();
        inner.expires = Some(Instant::now() + Duration::from_secs(600));
        inner.window = window.label().into();
        inner.generation
    };
    let state = host.0.clone();
    let tls = Arc::new(config);
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::sync_channel::<TcpStream>(16);
        let rx = Arc::new(Mutex::new(rx));
        for _ in 0..4 {
            let rx = rx.clone();
            let state = state.clone();
            let app = app.clone();
            let tls = tls.clone();
            std::thread::spawn(move || loop {
                let stream = match rx.lock() {
                    Ok(rx) => rx.recv(),
                    Err(_) => return,
                };
                let Ok(stream) = stream else { return };
                serve(stream, &app, &state, generation, tls.clone());
            });
        }
        loop {
            if !state
                .lock()
                .is_ok_and(|s| s.enabled && s.generation == generation)
            {
                break;
            }
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = tx.try_send(stream);
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(100))
                }
                Err(_) => break,
            }
        }
    });
    let address = UdpSocket::bind("0.0.0.0:0")
        .ok()
        .and_then(|s| {
            s.connect("8.8.8.8:80").ok()?;
            s.local_addr().ok()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".into());
    Ok(
        json!({"url":format!("https://{address}:{port}/mycode/v1"),"fingerprint":fingerprint,"pairing":pairing,"expiresIn":600}),
    )
}

fn serve(
    socket: TcpStream,
    app: &AppHandle,
    state: &Arc<Mutex<Inner>>,
    generation: u64,
    tls: Arc<rustls::ServerConfig>,
) {
    let _ = socket.set_read_timeout(Some(Duration::from_secs(4)));
    let _ = socket.set_write_timeout(Some(Duration::from_secs(4)));
    let Ok(connection) = rustls::ServerConnection::new(tls) else {
        return;
    };
    let mut stream = rustls::StreamOwned::new(connection, socket);
    let result = (|| -> Result<Value, String> {
        let mut reader = BufReader::new(&mut stream);
        let mut line = String::new();
        reader
            .by_ref()
            .take(4097)
            .read_line(&mut line)
            .map_err(|_| "Read failed")?;
        if line != "POST /mycode/v1 HTTP/1.1\r\n" {
            return Err("Unsupported endpoint".into());
        }
        let mut length = None;
        let mut headers = 0;
        loop {
            line.clear();
            reader
                .by_ref()
                .take(4097)
                .read_line(&mut line)
                .map_err(|_| "Read failed")?;
            headers += line.len();
            if headers > 8192 || line.is_empty() {
                return Err("Invalid headers".into());
            }
            if line == "\r\n" {
                break;
            }
            let lower = line.to_lowercase();
            if lower.starts_with("origin:") || lower.starts_with("transfer-encoding:") {
                return Err("Browser and chunked requests are not supported".into());
            }
            if let Some(v) = lower.strip_prefix("content-length:") {
                if length.is_some() {
                    return Err("Duplicate length".into());
                }
                length = Some(v.trim().parse::<usize>().map_err(|_| "Invalid length")?);
            }
        }
        let length = length.filter(|v| *v <= 65536).ok_or("Request too large")?;
        let mut bytes = vec![0; length];
        reader.read_exact(&mut bytes).map_err(|_| "Read failed")?;
        let value: Value = serde_json::from_slice(&bytes).map_err(|_| "Invalid JSON")?;
        let mut inner = state.lock().map_err(|_| "Bridge unavailable")?;
        if let Some(response) = authorize(&mut inner, generation, &value)? {
            return Ok(response);
        }
        let request_id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = mpsc::channel();
        inner.pending.insert(request_id.clone(), tx);
        let window = inner.window.clone();
        drop(inner);
        let mut forwarded = value;
        if let Some(map) = forwarded.as_object_mut() {
            map.remove("deviceToken");
            map.remove("pairing");
        }
        if app
            .emit_to(
                &window,
                "mycode-mobile-request",
                json!({"requestId":request_id,"input":forwarded}),
            )
            .is_err()
        {
            state.lock().ok().map(|mut s| s.pending.remove(&request_id));
            return Err("Desktop unavailable".into());
        }
        let answer = rx
            .recv_timeout(Duration::from_secs(20))
            .map_err(|_| "Desktop request timed out");
        if let Ok(mut s) = state.lock() {
            s.pending.remove(&request_id);
        }
        answer.map_err(str::to_string)
    })();
    let body = match result {
        Ok(v) => json!({"ok":true,"result":v}),
        Err(e) => json!({"ok":false,"error":e}),
    }
    .to_string();
    let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",body.len(),body);
    let _ = stream.flush();
}
#[tauri::command]
pub fn mobile_status(host: State<'_, MobileHost>) -> Result<Value, String> {
    let s = host.0.lock().map_err(|e| e.to_string())?;
    Ok(json!({"enabled":s.enabled,"devices":s.devices.values().collect::<Vec<_>>()}))
}
#[tauri::command]
pub fn mobile_stop(host: State<'_, MobileHost>) -> Result<(), String> {
    let mut s = host.0.lock().map_err(|e| e.to_string())?;
    s.enabled = false;
    s.devices.clear();
    s.pairing.clear();
    s.pending.clear();
    Ok(())
}
#[tauri::command]
pub fn mobile_reply(
    window: WebviewWindow,
    host: State<'_, MobileHost>,
    request_id: String,
    result: Value,
) -> Result<(), String> {
    let mut s = host.0.lock().map_err(|e| e.to_string())?;
    if s.window != window.label() {
        return Err("Wrong window".into());
    }
    if let Some(tx) = s.pending.remove(&request_id) {
        let _ = tx.send(result);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pairing_is_single_use_and_revocation_and_generation_fail_closed() {
        let mut inner = Inner {
            enabled: true,
            generation: 1,
            pairing: "one-time-secret".into(),
            expires: Some(Instant::now() + Duration::from_secs(600)),
            ..Default::default()
        };
        assert!(authorize(&mut inner, 1, &json!({"action":"pair","pairing":"wrong"})).is_err());
        let result = authorize(
            &mut inner,
            1,
            &json!({"action":"pair","pairing":"one-time-secret","name":"Phone"}),
        )
        .unwrap()
        .unwrap();
        assert!(authorize(
            &mut inner,
            1,
            &json!({"action":"pair","pairing":"one-time-secret"})
        )
        .is_err());
        let token = result["deviceToken"].as_str().unwrap();
        let send = json!({"action":"send","sessionId":"a","text":"hello","deviceToken":token,"id":"unique"});
        assert!(authorize(&mut inner, 1, &send).is_ok());
        assert!(authorize(&mut inner, 1, &send).is_err());
        let read = json!({"action":"snapshot","deviceToken":token,"id":"poll"});
        for _ in 0..100 {
            assert!(authorize(&mut inner, 1, &read).is_ok());
        }
        assert_eq!(inner.receipts.len(), 1);
        assert!(authorize(&mut inner, 2, &read).is_err());
        inner.devices.clear();
        assert!(authorize(&mut inner, 1, &read).is_err());
        inner.enabled = false;
        assert!(authorize(&mut inner, 1, &read).is_err());
    }
    #[test]
    fn expired_pairing_is_rejected() {
        let mut inner = Inner {
            enabled: true,
            generation: 1,
            pairing: "secret".into(),
            expires: Some(Instant::now()),
            ..Default::default()
        };
        assert!(authorize(&mut inner, 1, &json!({"action":"pair","pairing":"secret"})).is_err());
    }
    #[test]
    fn only_explicit_session_actions_are_allowed() {
        assert!(validate_action(&json!({"action":"snapshot"})).is_ok());
        for action in ["invoke", "readFile", "run", "configure"] {
            assert!(validate_action(&json!({"action":action,"sessionId":"a"})).is_err());
        }
        assert!(validate_action(&json!({"action":"send","text":"hello"})).is_err());
        assert!(validate_action(
            &json!({"action":"approve","sessionId":"a","decision":"full-access"})
        )
        .is_err());
        assert!(validate_action(&json!({"action":"send","sessionId":"a","text":"hello"})).is_ok());
    }
}
