use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};
static SERVERS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
fn resolve(root: &Path, raw: &str) -> Option<PathBuf> {
    let raw = raw.split('?').next()?.split('#').next()?;
    let mut bytes = Vec::new();
    let mut chars = raw.as_bytes().iter().copied();
    while let Some(c) = chars.next() {
        if c == b'%' {
            let hi = (chars.next()? as char).to_digit(16)?;
            let lo = (chars.next()? as char).to_digit(16)?;
            bytes.push((hi * 16 + lo) as u8);
        } else {
            bytes.push(c);
        }
    }
    let relative = String::from_utf8(bytes).ok()?;
    if relative.contains('\\') || relative.contains('\0') {
        return None;
    }
    let path = root
        .join(relative.trim_start_matches('/'))
        .canonicalize()
        .ok()?;
    if path.starts_with(root) && path.is_file() {
        Some(path)
    } else {
        None
    }
}
#[tauri::command]
pub fn local_preview_start(path: String) -> Result<serde_json::Value, String> {
    let file = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !file.is_file()
        || !matches!(
            file.extension()
                .and_then(|x| x.to_str())
                .unwrap_or("")
                .to_ascii_lowercase()
                .as_str(),
            "html" | "htm" | "svg"
        )
    {
        return Err("Choose an HTML or SVG file".into());
    }
    let root = file.parent().ok_or("Invalid preview folder")?.to_path_buf();
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let host = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let prefix = format!("/{id}/");
    let mut url = url::Url::parse(&format!("http://{host}{prefix}")).map_err(|e| e.to_string())?;
    url.path_segments_mut()
        .map_err(|_| "Invalid URL")?
        .pop_if_empty()
        .push(
            file.file_name()
                .unwrap()
                .to_str()
                .ok_or("Invalid filename")?,
        );
    let stop = Arc::new(AtomicBool::new(false));
    SERVERS
        .get_or_init(Default::default)
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), stop.clone());
    std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + Duration::from_secs(3600);
        while !stop.load(Ordering::Relaxed) && std::time::Instant::now() < deadline {
            let Ok((mut stream, _)) = listener.accept() else {
                std::thread::sleep(Duration::from_millis(30));
                continue;
            };
            let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
            let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));
            let mut request = [0; 8192];
            let Ok(n) = stream.read(&mut request) else {
                continue;
            };
            let request = String::from_utf8_lossy(&request[..n]);
            let mut parts = request.lines().next().unwrap_or("").split_whitespace();
            let method = parts.next().unwrap_or("");
            let target = parts.next().unwrap_or("");
            let valid_host = request.lines().any(|l| {
                l.split_once(':')
                    .is_some_and(|(k, v)| k.eq_ignore_ascii_case("host") && v.trim() == host)
            });
            let candidate = if valid_host && matches!(method, "GET" | "HEAD") {
                target.strip_prefix(&prefix).and_then(|p| resolve(&root, p))
            } else {
                None
            };
            let response = candidate
                .filter(|p| fs::metadata(p).is_ok_and(|m| m.len() <= 32 * 1024 * 1024))
                .and_then(|p| fs::read(&p).ok().map(|data| (p, data)));
            if let Some((path, data)) = response {
                let mime = match path
                    .extension()
                    .and_then(|x| x.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase()
                    .as_str()
                {
                    "html" | "htm" => "text/html; charset=utf-8",
                    "js" | "mjs" => "text/javascript; charset=utf-8",
                    "css" => "text/css; charset=utf-8",
                    "json" => "application/json",
                    "svg" => "image/svg+xml",
                    "png" => "image/png",
                    "jpg" | "jpeg" => "image/jpeg",
                    "webp" => "image/webp",
                    "woff2" => "font/woff2",
                    _ => "application/octet-stream",
                };
                let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nX-Content-Type-Options: nosniff\r\nAccess-Control-Allow-Origin: null\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",data.len());
                if method != "HEAD" {
                    let _ = stream.write_all(&data);
                }
            } else {
                let _ = stream.write_all(
                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
            }
        }
    });
    Ok(serde_json::json!({"id":id,"url":url.as_str()}))
}
#[tauri::command]
pub fn local_preview_stop(id: String) {
    if let Some(servers) = SERVERS.get() {
        if let Ok(mut entries) = servers.lock() {
            if let Some(stop) = entries.remove(&id) {
                stop.store(true, Ordering::Relaxed);
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preview_serves_local_assets_and_rejects_untrusted_host() {
        let root = std::env::temp_dir().join(format!("preview-http-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let file = root.join("index.html");
        fs::write(&file, "<h1>local preview</h1>").unwrap();
        let server = local_preview_start(file.to_string_lossy().into_owned()).unwrap();
        let url = url::Url::parse(server["url"].as_str().unwrap()).unwrap();
        let host = format!("127.0.0.1:{}", url.port().unwrap());
        let request = |request_host: &str, request_path: &str| {
            let mut socket = std::net::TcpStream::connect(&host).unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            write!(
                socket,
                "GET {request_path} HTTP/1.1\r\nHost: {request_host}\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
            let mut response = String::new();
            socket.read_to_string(&mut response).unwrap();
            response
        };
        let response = request(&host, url.path());
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(response.contains("<h1>local preview</h1>"));
        assert!(!request("attacker.example", url.path()).contains("local preview"));
        assert!(!request(&host, "/index.html").contains("local preview"));
        local_preview_stop(server["id"].as_str().unwrap().into());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn preview_rejects_traversal_and_encoded_escape() {
        let root = std::env::temp_dir().join(format!("preview-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("site")).unwrap();
        fs::write(root.join("secret"), "private").unwrap();
        fs::write(root.join("site/index.html"), "hello").unwrap();
        let site = root.join("site").canonicalize().unwrap();
        assert!(resolve(&site, "index.html").is_some());
        assert!(resolve(&site, "../secret").is_none());
        assert!(resolve(&site, "%2e%2e/secret").is_none());
        assert!(resolve(&site, "..%5csecret").is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
