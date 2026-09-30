use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
static MEMORY_TOKEN: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);
fn path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("gitcode-token.json"))
}
#[tauri::command(async)]
pub fn gitcode_config(app: AppHandle, token: Option<String>) -> Result<bool, String> {
    if !cfg!(windows) {
        let mut saved = MEMORY_TOKEN.lock().map_err(|_| "Credential lock failed")?;
        if let Some(token) = token {
            *saved = (!token.trim().is_empty()).then(|| token.trim().to_owned());
        }
        return Ok(saved.is_some());
    }
    let path = path(&app)?;
    if let Some(token) = token {
        if token.trim().is_empty() {
            if path.exists() {
                std::fs::remove_file(path).map_err(|e| e.to_string())?;
            }
            return Ok(false);
        }
        let secret = crate::local_ai::protect(token.trim(), false)?;
        let temporary = path.with_extension("pending");
        std::fs::write(&temporary, secret).map_err(|e| e.to_string())?;
        std::fs::rename(temporary, path).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(path.is_file())
}
#[tauri::command(async)]
pub fn gitcode_items(
    app: AppHandle,
    repo: String,
    kind: String,
    page: u32,
    token_override: Option<String>,
) -> Result<Value, String> {
    let parts: Vec<_> = repo.split('/').collect();
    if parts.len() != 2
        || parts.iter().any(|s| {
            s.is_empty()
                || !s
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
        })
    {
        return Err("Enter a repository as owner/name".into());
    }
    if !["issues", "pulls"].contains(&kind.as_str()) {
        return Err("Invalid item type".into());
    }
    let token = if let Some(token) = token_override.filter(|token| !token.trim().is_empty()) {
        token
    } else if cfg!(windows) {
        let secret = std::fs::read_to_string(path(&app)?)
            .map_err(|_| "Connect GitCode with a personal access token first")?;
        crate::local_ai::protect(&secret, true)?
    } else {
        MEMORY_TOKEN
            .lock()
            .map_err(|_| "Credential lock failed")?
            .clone()
            .ok_or("Connect GitCode with a personal access token first")?
    };
    let endpoint = format!("https://api.gitcode.com/api/v5/repos/{repo}/{kind}");
    let response = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(25))
        .redirects(0)
        .build()
        .get(&endpoint)
        .query("access_token", &token)
        .query("state", "all")
        .query("per_page", "20")
        .query("page", &page.max(1).to_string())
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("GitCode HTTP {code}"),
            _ => "GitCode connection failed".into(),
        })?;
    let value: Value = serde_json::from_str(
        &response
            .into_string()
            .map_err(|_| "Invalid GitCode response")?,
    )
    .map_err(|_| "Invalid GitCode response")?;
    let items=value.as_array().ok_or("Invalid GitCode list")?.iter().map(|v|json!({"number":v["number"],"title":v["title"],"body":v["body"],"state":v["state"],"updatedAt":v["updated_at"]})).collect::<Vec<_>>();
    Ok(json!(items))
}
