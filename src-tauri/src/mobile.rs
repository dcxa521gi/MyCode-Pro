//! Opt-in direct and encrypted remote bridge. No arbitrary Tauri or filesystem access.
#[path = "mobile_relay.rs"]
mod relay;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream, UdpSocket},
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

#[derive(Default)]
struct Inner {
    enabled: bool,
    pairing_info: Option<Value>,
    relay_status: String,
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
    if ![
        "snapshot", "session", "send", "stop", "approve", "question", "model", "message",
    ]
    .contains(&action)
    {
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
    if action == "model"
        && (v["model"].as_str().unwrap_or("").is_empty()
            || v["model"].as_str().unwrap_or("").len() > 512
            || v["harness"].as_str().unwrap_or("").is_empty())
    {
        return Err("Invalid model choice".into());
    }
    if action == "message"
        && (v["blockId"].as_str().unwrap_or("").is_empty()
            || v["blockId"].as_str().unwrap_or("").len() > 128)
    {
        return Err("Invalid message identifier".into());
    }
    if action == "session" && v.get("before").is_some_and(|b| !b.is_u64()) {
        return Err("Invalid history offset".into());
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
        && !["snapshot", "session", "message"].contains(&value["action"].as_str().unwrap_or(""))
    {
        return Err("Reconnect from desktop to renew the bridge".into());
    }
    // Read-only polls do not exhaust the replay budget of mutating operations.
    if !["snapshot", "session", "message"].contains(&value["action"].as_str().unwrap_or("")) {
        inner.receipts.insert(receipt);
    }
    Ok(None)
}

#[tauri::command]
pub async fn mobile_start(
    app: AppHandle,
    window: WebviewWindow,
    host: State<'_, MobileHost>,
    relay_url: Option<String>,
    registration_key: Option<String>,
) -> Result<Value, String> {
    let state = host.0.clone();
    let label = window.label().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        start_bridge(app, label, state, relay_url, registration_key)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn start_bridge(
    app: AppHandle,
    label: String,
    state: Arc<Mutex<Inner>>,
    relay_url: Option<String>,
    registration_key: Option<String>,
) -> Result<Value, String> {
    if let Some(url) = relay_url.filter(|v| !v.trim().is_empty()) {
        return relay::start(
            app,
            label,
            state,
            &url,
            registration_key.as_deref().unwrap_or(""),
        );
    }
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
        let mut inner = state.lock().map_err(|e| e.to_string())?;
        inner.enabled = true;
        inner.generation += 1;
        inner.devices.clear();
        inner.receipts.clear();
        inner.pending.clear();
        inner.pairing = pairing.clone();
        inner.expires = Some(Instant::now() + Duration::from_secs(600));
        inner.window = label;
        inner.relay_status.clear();
        inner.pairing_info = None;
        inner.generation
    };
    let thread_state = state.clone();
    let tls = Arc::new(config);
    std::thread::spawn(move || {
        let state = thread_state;
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
    let mut addresses = local_addresses();
    if !addresses.iter().any(|a| a["address"] == address) {
        addresses.push(json!({"address":address,"name":address}))
    }
    let address = preferred_direct_address(&addresses).unwrap_or(address);
    let info = json!({"mode":"direct","url":format!("https://{address}:{port}/mycode/v1"),"fingerprint":fingerprint,"pairing":pairing,"expiresIn":600,"addresses":addresses});
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        if s.generation != generation {
            return Err("Connection replaced".into());
        }
        s.pairing_info = Some(info.clone());
    }
    Ok(info)
}

fn serve(
    socket: TcpStream,
    app: &AppHandle,
    state: &Arc<Mutex<Inner>>,
    generation: u64,
    tls: Arc<rustls::ServerConfig>,
) {
    serve_transport(socket, tls, |value| dispatch(value, app, state, generation));
}
fn serve_transport(
    socket: TcpStream,
    tls: Arc<rustls::ServerConfig>,
    handler: impl FnOnce(Value) -> Result<Value, String>,
) {
    let _ = socket.set_read_timeout(Some(Duration::from_secs(4)));
    let _ = socket.set_write_timeout(Some(Duration::from_secs(4)));
    let Ok(connection) = rustls::ServerConnection::new(tls) else {
        return;
    };
    let mut stream = rustls::StreamOwned::new(connection, socket);
    let result = (|| -> Result<Value, String> {
        let mut reader = BufReader::new(&mut stream);
        let value = read_http(&mut reader)?;
        handler(value)
    })();
    let body = wrap_response(result).to_string();
    let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",body.len(),body);
    stream.conn.send_close_notify();
    let _ = stream.flush();
}
fn wrap_response(result: Result<Value, String>) -> Value {
    let body = match result {
        Ok(value) => json!({"ok":true,"result":value}),
        Err(error) => json!({"ok":false,"error":error}),
    };
    if serde_json::to_vec(&body).is_ok_and(|data| data.len() > 4_000_000) {
        json!({"ok":false,"error":"Response too large. Load history in smaller pages."})
    } else {
        body
    }
}
fn read_http(reader: &mut impl BufRead) -> Result<Value, String> {
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
    serde_json::from_slice(&bytes).map_err(|_| "Invalid JSON".into())
}

fn dispatch(
    value: Value,
    app: &AppHandle,
    state: &Arc<Mutex<Inner>>,
    generation: u64,
) -> Result<Value, String> {
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
}
fn local_addresses() -> Vec<Value> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let powershell = std::path::PathBuf::from(
            std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
        )
        .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let result=std::process::Command::new(powershell).env_remove("PSModulePath").args(["-NoProfile","-NonInteractive","-Command","[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $mycodeAdapters=@{}; Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue | ForEach-Object { $mycodeAdapters[$_.ifIndex]=$_.HardwareInterface }; Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object @{n='address';e={$_.IPAddress}},@{n='name';e={$_.InterfaceAlias}},@{n='physical';e={$mycodeAdapters[$_.InterfaceIndex]}} | ConvertTo-Json -Compress"]).creation_flags(0x08000000).output();
        if let Ok(output) = result {
            if let Ok(value) = serde_json::from_slice::<Value>(&output.stdout) {
                return match value {
                    Value::Array(v) => v,
                    Value::Object(_) => vec![value],
                    _ => vec![],
                };
            }
        }
    }
    vec![]
}
fn preferred_direct_address(addresses: &[Value]) -> Option<String> {
    addresses
        .iter()
        .filter(|v| v["physical"] == true)
        .chain(addresses.iter().filter(|v| v["physical"].is_null()))
        .find_map(|value| {
            let name = value["name"].as_str().unwrap_or("").to_lowercase();
            if [
                "vpn",
                "wintun",
                "wireguard",
                "tap",
                "vethernet",
                "vmware",
                "virtual",
                "loopback",
            ]
            .iter()
            .any(|part| name.contains(part))
            {
                return None;
            }
            let address = value["address"].as_str()?;
            let ip = address.parse::<std::net::Ipv4Addr>().ok()?;
            ip.is_private().then(|| address.to_owned())
        })
}
#[tauri::command]
pub async fn mobile_allow_firewall(
    window: WebviewWindow,
    host: State<'_, MobileHost>,
) -> Result<(), String> {
    {
        let state = host.0.lock().map_err(|e| e.to_string())?;
        if !state.enabled
            || state.window != window.label()
            || state
                .pairing_info
                .as_ref()
                .is_none_or(|p| p["mode"] != "direct")
        {
            return Err("Enable direct connection first".into());
        }
    }
    #[cfg(not(windows))]
    return Err("Configure direct connection permissions in your system firewall".into());
    #[cfg(windows)]
    tauri::async_runtime::spawn_blocking(|| {
        use windows_sys::Win32::{Foundation::CloseHandle,System::Threading::{WaitForSingleObject,GetExitCodeProcess},UI::Shell::{ShellExecuteExW,SHELLEXECUTEINFOW,SEE_MASK_NOCLOSEPROCESS}};
        let executable=std::env::current_exe().map_err(|e|e.to_string())?;
        let rule=format!("MyCode Mobile Direct {}",&digest(&executable.to_string_lossy())[..12]);
        let mut check=std::process::Command::new("netsh.exe");check.args(["advfirewall","firewall","show","rule",&format!("name={rule}")]);crate::hide_window_console(&mut check);
        if check.output().is_ok_and(|o|o.status.success()) { return Ok(()); }
        let wide=|s:&str|s.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        let verb=wide("runas");let file=wide("netsh.exe");let parameters=wide(&format!("advfirewall firewall add rule name=\"{rule}\" dir=in action=allow program=\"{}\" enable=yes profile=private,domain remoteip=localsubnet protocol=TCP",executable.display()));
        let mut info:SHELLEXECUTEINFOW=unsafe{std::mem::zeroed()};info.cbSize=std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;info.fMask=SEE_MASK_NOCLOSEPROCESS;info.lpVerb=verb.as_ptr();info.lpFile=file.as_ptr();info.lpParameters=parameters.as_ptr();info.nShow=0;
        if unsafe{ShellExecuteExW(&mut info)}==0 { return Err("Firewall permission was not granted".into()); }
        if info.hProcess.is_null() { return Err("Could not check firewall result".into()); }
        let mut exit=259;unsafe{WaitForSingleObject(info.hProcess,30000);GetExitCodeProcess(info.hProcess,&mut exit);CloseHandle(info.hProcess);}
        if exit==0 {Ok(())}else{Err("Firewall permission was not granted".into())}
    }).await.map_err(|e|e.to_string())?
}
pub fn window_closed(app: &AppHandle, label: &str) {
    if let Ok(mut s) = app.state::<MobileHost>().0.lock() {
        if s.window == label {
            s.enabled = false;
            s.generation += 1;
            s.devices.clear();
            s.pairing.clear();
            s.pairing_info = None;
            s.pending.clear();
        }
    }
}
#[tauri::command]
pub fn mobile_renew(window: WebviewWindow, host: State<'_, MobileHost>) -> Result<Value, String> {
    let mut s = host.0.lock().map_err(|e| e.to_string())?;
    if !s.enabled || s.window != window.label() {
        return Err("Connection unavailable".into());
    }
    s.pairing = secret();
    s.expires = Some(Instant::now() + Duration::from_secs(600));
    let key = s.pairing.clone();
    let info = s.pairing_info.as_mut().ok_or("Connection unavailable")?;
    info["pairing"] = json!(key);
    info["expiresIn"] = json!(600);
    Ok(info.clone())
}
#[tauri::command]
pub fn mobile_revoke(
    window: WebviewWindow,
    host: State<'_, MobileHost>,
    device_id: String,
) -> Result<(), String> {
    let mut s = host.0.lock().map_err(|e| e.to_string())?;
    if s.window != window.label() {
        return Err("Wrong window".into());
    }
    s.devices.remove(&device_id);
    Ok(())
}

#[tauri::command]
pub fn mobile_status(window: WebviewWindow, host: State<'_, MobileHost>) -> Result<Value, String> {
    let s = host.0.lock().map_err(|e| e.to_string())?;
    let owner = s.window == window.label();
    let mut info = if owner { s.pairing_info.clone() } else { None };
    if let Some(ref mut info) = info {
        info["expiresIn"] = json!(s
            .expires
            .map(|d| d.saturating_duration_since(Instant::now()).as_secs())
            .unwrap_or(0));
        if s.pairing.is_empty() {
            info["pairing"] = json!("")
        }
    }
    Ok(
        json!({"enabled":s.enabled,"devices":s.devices.iter().map(|(id,name)|json!({"id":id,"name":name})).collect::<Vec<_>>(),"pairing":info,"relayStatus":s.relay_status}),
    )
}
#[tauri::command]
pub fn mobile_stop(host: State<'_, MobileHost>) -> Result<(), String> {
    let mut s = host.0.lock().map_err(|e| e.to_string())?;
    s.enabled = false;
    s.generation += 1;
    s.pairing_info = None;
    s.relay_status.clear();
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
    fn direct_address_prefers_physical_lan_over_vpn_and_virtual_interfaces() {
        let addresses = vec![
            json!({"address":"10.8.0.2","name":"WireGuard VPN"}),
            json!({"address":"172.16.0.1","name":"vEthernet"}),
            json!({"address":"192.168.1.20","name":"Wi-Fi"}),
        ];
        assert_eq!(
            preferred_direct_address(&addresses),
            Some("192.168.1.20".into())
        );
        assert_eq!(preferred_direct_address(&addresses[..2]), None);
        let adapters = vec![
            json!({"address":"10.8.0.2","name":"Meta","physical":false}),
            json!({"address":"192.168.9.20","name":"Ethernet","physical":true}),
        ];
        assert_eq!(
            preferred_direct_address(&adapters),
            Some("192.168.9.20".into())
        );
        assert_eq!(preferred_direct_address(&adapters[..1]), None);
    }
    #[test]
    fn direct_tls_pairing_has_complete_json_and_clean_tls_shutdown() {
        let issued = rcgen::generate_simple_self_signed(vec!["localhost".into()]).unwrap();
        let certificate = issued.cert.der().clone();
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let server = rustls::ServerConfig::builder_with_provider(provider.clone())
            .with_safe_default_protocol_versions()
            .unwrap()
            .with_no_client_auth()
            .with_single_cert(
                vec![certificate.clone()],
                rustls::pki_types::PrivatePkcs8KeyDer::from(issued.signing_key.serialize_der())
                    .into(),
            )
            .unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let thread = std::thread::spawn(move || {
            let mut inner = Inner {
                enabled: true,
                generation: 1,
                pairing: "known-test-code".into(),
                expires: Some(Instant::now() + Duration::from_secs(10)),
                ..Default::default()
            };
            let (socket, _) = listener.accept().unwrap();
            serve_transport(socket, Arc::new(server), |value| {
                authorize(&mut inner, 1, &value)?.ok_or("Unexpected action".into())
            });
        });
        let mut roots = rustls::RootCertStore::empty();
        roots.add(certificate).unwrap();
        let client = rustls::ClientConfig::builder_with_provider(provider)
            .with_safe_default_protocol_versions()
            .unwrap()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let connection = rustls::ClientConnection::new(
            Arc::new(client),
            rustls::pki_types::ServerName::try_from("localhost").unwrap(),
        )
        .unwrap();
        let socket = TcpStream::connect(address).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut stream = rustls::StreamOwned::new(connection, socket);
        let body = json!({"action":"pair","pairing":"known-test-code","name":"安卓"}).to_string();
        write!(stream,"POST /mycode/v1 HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",body.len(),body).unwrap();
        stream.flush().unwrap();
        let mut reply = String::new();
        stream.read_to_string(&mut reply).unwrap();
        let (_, body) = reply.split_once("\r\n\r\n").unwrap();
        let result: Value = serde_json::from_str(body).unwrap();
        assert_eq!(result["ok"], true);
        assert_eq!(result["result"]["deviceToken"].as_str().unwrap().len(), 64);
        thread.join().unwrap();
    }
    #[test]
    fn malformed_http_and_ambiguous_lengths_are_rejected() {
        for request in ["GET /mycode/v1 HTTP/1.1\r\n\r\n","POST /mycode/v1 HTTP/1.1\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\n{}","POST /mycode/v1 HTTP/1.1\r\nOrigin: https://example.com\r\nContent-Length: 2\r\n\r\n{}","POST /mycode/v1 HTTP/1.1\r\nContent-Length: 999999\r\n\r\n{}"] {
            assert!(read_http(&mut std::io::Cursor::new(request.as_bytes())).is_err());
        }
    }
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
