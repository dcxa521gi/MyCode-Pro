//! Experimental application identity. Never gates local work or grants tool permissions.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, WebviewWindow};
const CLIENT: &str = "01a0f06b-1e07-730e-a343-333c48c9f77d";
const REDIRECT: &str = "http://127.0.0.1:43821/callback";
const TOKEN: &str = "https://oauth.778.ink/oauth/token";
static TOKENS: Mutex<Option<Tokens>> = Mutex::new(None);
static LOGIN: Mutex<()> = Mutex::new(());
static RETRY_UNTIL: AtomicU64 = AtomicU64::new(0);
static GENERATION: AtomicU64 = AtomicU64::new(0);
#[derive(Clone, Serialize, Deserialize)]
struct Tokens {
    access: String,
    refresh: String,
    expires: u64,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn trusted(window: &WebviewWindow) -> Result<(), String> {
    let url = window.url().map_err(|_| "Invalid caller")?;
    if url.scheme() == "tauri"
        || url.host_str() == Some("tauri.localhost")
        || (cfg!(debug_assertions) && matches!(url.host_str(), Some("localhost" | "127.0.0.1")))
    {
        Ok(())
    } else {
        Err("Untrusted caller".into())
    }
}
fn vault(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("account-center.dpapi"))
}
fn persist(app: &AppHandle, value: Option<&Tokens>) -> Result<(), String> {
    let path = vault(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if let Some(value) = value {
        // Windows delivery uses account-bound DPAPI. Other platforms keep tokens
        // only in native memory until their OS credential-store adapter is added.
        if cfg!(windows) {
            let data = crate::local_ai::protect(
                &serde_json::to_string(value).map_err(|e| e.to_string())?,
                false,
            )?;
            let temporary = path.with_extension("pending");
            fs::write(&temporary, data).map_err(|e| e.to_string())?;
            fs::rename(temporary, path).map_err(|e| e.to_string())?;
        }
    } else if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn check_backoff() -> Result<(), String> {
    if now() < RETRY_UNTIL.load(Ordering::SeqCst) {
        return Err("Account service is rate limited. Please retry later.".into());
    }
    Ok(())
}
fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(25))
        .redirects(0)
        .build()
}
fn response(result: Result<ureq::Response, ureq::Error>) -> Result<Value, String> {
    let response = result.map_err(|e| match e {
        ureq::Error::Status(code, r) => {
            if code == 429 {
                let delay = r
                    .header("Retry-After")
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(60)
                    .clamp(1, 86400);
                RETRY_UNTIL.store(now().saturating_add(delay), Ordering::SeqCst);
                "Account service is rate limited. Please retry later.".into()
            } else if code == 401 || code == 403 {
                "ACCOUNT_REVOKED".into()
            } else if code == 400 {
                let body = r.into_string().unwrap_or_default();
                if body.contains("invalid_grant") {
                    "ACCOUNT_REVOKED".into()
                } else {
                    "Authorization request rejected".into()
                }
            } else {
                format!("Account service HTTP {code}")
            }
        }
        _ => "Account service connection failed".into(),
    })?;
    serde_json::from_str(
        &response
            .into_string()
            .map_err(|_| "Invalid account response")?,
    )
    .map_err(|_| "Invalid account response".into())
}
fn tokens(value: Value) -> Result<Tokens, String> {
    if !value["token_type"]
        .as_str()
        .is_some_and(|s| s.eq_ignore_ascii_case("bearer"))
    {
        return Err("Invalid token type".into());
    }
    Ok(Tokens {
        access: value["access_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("Missing access token")?
            .into(),
        refresh: value["refresh_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("Missing refresh token")?
            .into(),
        expires: now().saturating_add(
            value["expires_in"]
                .as_u64()
                .filter(|n| *n > 0)
                .ok_or("Missing expiry")?,
        ),
    })
}
fn identity(value: &Tokens) -> Result<Value, String> {
    let info = response(
        agent()
            .get("https://oauth.778.ink/api/userinfo")
            .set("Authorization", &format!("Bearer {}", value.access))
            .call(),
    )?;
    let sub = info["sub"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("Missing account identity")?;
    Ok(json!({"sub":sub,"name":info["name"].as_str().unwrap_or("MyCode user")}))
}
fn callback(target: &str, state: &str) -> Result<String, String> {
    let url = url::Url::parse(&format!("http://127.0.0.1:43821{target}"))
        .map_err(|_| "Invalid callback")?;
    if url.path() != "/callback" {
        return Err("Invalid callback path".into());
    }
    let params: Vec<_> = url.query_pairs().collect();
    if params.iter().filter(|(k, _)| k == "state").count() != 1
        || !params.iter().any(|(k, v)| k == "state" && v == state)
    {
        return Err("Invalid authorization state".into());
    }
    if params.iter().any(|(k, _)| k == "error") {
        return Err("Authorization declined".into());
    }
    if params.iter().filter(|(k, _)| k == "code").count() != 1 {
        return Err("Missing authorization code".into());
    }
    params
        .iter()
        .find(|(k, v)| k == "code" && !v.is_empty())
        .map(|(_, v)| v.to_string())
        .ok_or("Missing authorization code".into())
}
#[tauri::command(async)]
pub fn account_center_status(app: AppHandle, window: WebviewWindow) -> Result<Value, String> {
    trusted(&window)?;
    let mut state = TOKENS.lock().map_err(|_| "Account lock failed")?;
    if state.is_none() && cfg!(windows) {
        if let Ok(data) = fs::read_to_string(vault(&app)?) {
            *state = crate::local_ai::protect(&data, true)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok());
        }
    }
    let Some(value) = state.as_mut() else {
        return Ok(Value::Null);
    };
    let result = (|| {
        check_backoff()?;
        if value.expires <= now() + 30 {
            let refreshed = tokens(response(agent().post(TOKEN).send_form(&[
                ("grant_type", "refresh_token"),
                ("client_id", CLIENT),
                ("refresh_token", &value.refresh),
            ]))?)?;
            // Rotation is serialized under TOKENS and persisted before reuse.
            if persist(&app, Some(&refreshed)).is_err() {
                let _ = persist(&app, None);
                return Err("ACCOUNT_STORAGE_FAILED".into());
            }
            *value = refreshed;
        }
        identity(value)
    })();
    if result
        .as_ref()
        .is_err_and(|e| e == "ACCOUNT_STORAGE_FAILED")
    {
        *state = None;
        return Err("Could not securely save rotated credentials. Sign in again.".into());
    }
    if result.as_ref().is_err_and(|e| e == "ACCOUNT_REVOKED") {
        *state = None;
        persist(&app, None)?;
        return Ok(Value::Null);
    }
    result
}
#[tauri::command(async)]
pub fn account_center_login(app: AppHandle, window: WebviewWindow) -> Result<Value, String> {
    trusted(&window)?;
    check_backoff()?;
    let _login = LOGIN
        .try_lock()
        .map_err(|_| "A sign-in is already running")?;
    let generation = GENERATION.load(Ordering::SeqCst);
    let listener = TcpListener::bind("127.0.0.1:43821")
        .map_err(|_| "Login callback port 43821 is busy. Close the other sign-in and retry.")?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let state = uuid::Uuid::new_v4().to_string();
    let verifier = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = url::Url::parse("https://oauth.778.ink/oauth/authorize").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("response_type", "code"),
        ("client_id", CLIENT),
        ("redirect_uri", REDIRECT),
        ("scope", "profile"),
        ("state", &state),
        ("code_challenge", &challenge),
        ("code_challenge_method", "S256"),
    ]);
    open::that(url.as_str()).map_err(|_| "Could not open sign-in browser")?;
    let start = Instant::now();
    let code = loop {
        if GENERATION.load(Ordering::SeqCst) != generation {
            return Err("Sign-in cancelled".into());
        }
        if start.elapsed() > Duration::from_secs(600) {
            return Err("Sign-in timed out".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_read_timeout(Some(Duration::from_secs(3))).ok();
                let mut buf = [0u8; 8192];
                let mut n = 0;
                while n < buf.len() && !buf[..n].windows(4).any(|w| w == b"\r\n\r\n") {
                    let count = stream
                        .read(&mut buf[n..])
                        .map_err(|_| "Invalid callback request")?;
                    if count == 0 {
                        break;
                    }
                    n += count;
                }
                if !buf[..n].windows(4).any(|w| w == b"\r\n\r\n") {
                    return Err("Invalid callback request".into());
                }
                let request = String::from_utf8_lossy(&buf[..n]);
                let mut line = request
                    .lines()
                    .next()
                    .unwrap_or_default()
                    .split_whitespace();
                let method = line.next();
                let target = line.next().unwrap_or_default();
                let valid_host = request
                    .lines()
                    .any(|l| l.eq_ignore_ascii_case("host: 127.0.0.1:43821"));
                let result = if method == Some("GET") && valid_host {
                    callback(target, &state)
                } else {
                    Err("Invalid callback request".into())
                };
                let message = if result.is_ok() {
                    "Authorization received. Return to MyCode to complete sign-in."
                } else {
                    "Authorization rejected. Return to MyCode and retry."
                };
                let status = if result.is_ok() {
                    "200 OK"
                } else {
                    "400 Bad Request"
                };
                let _=write!(stream,"HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{message}",message.len());
                break result?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100))
            }
            Err(_) => return Err("Callback listener failed".into()),
        }
    };
    drop(listener);
    let token = tokens(response(agent().post(TOKEN).send_form(&[
        ("grant_type", "authorization_code"),
        ("client_id", CLIENT),
        ("redirect_uri", REDIRECT),
        ("code", &code),
        ("code_verifier", &verifier),
    ]))?)?;
    let user = identity(&token)?;
    let mut current = TOKENS.lock().map_err(|_| "Account lock failed")?;
    if GENERATION.load(Ordering::SeqCst) != generation {
        return Err("Sign-in cancelled".into());
    }
    persist(&app, Some(&token))?;
    *current = Some(token);
    Ok(user)
}
#[tauri::command(async)]
pub fn account_center_logout(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    trusted(&window)?;
    GENERATION.fetch_add(1, Ordering::SeqCst);
    *TOKENS.lock().map_err(|_| "Account lock failed")? = None;
    persist(&app, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn callback_requires_exact_state_and_path() {
        assert_eq!(
            callback("/callback?state=abc&code=one", "abc").unwrap(),
            "one"
        );
        for path in [
            "/callback?code=one",
            "/callback?state=wrong&code=one",
            "/other?state=abc&code=one",
            "/callback?state=abc&state=abc&code=one",
            "/callback?state=abc&error=denied",
        ] {
            assert!(callback(path, "abc").is_err());
        }
    }
}
