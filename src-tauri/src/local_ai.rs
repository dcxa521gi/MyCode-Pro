//! Local-only configuration. No Cindy account, catalog or cloud dependency.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::PathBuf, process::Command, sync::Mutex, time::Duration};
use tauri::{AppHandle, Manager};

static CONFIG_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api: String,
    pub models: Vec<String>,
    pub enabled: bool,
    pub has_key: bool,
    pub primary_model: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    secret: String,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalConfig {
    connections: Vec<Connection>,
    memory: String,
    project_memories: std::collections::BTreeMap<String, String>,
    mcp_servers: Value,
}

fn directory(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("local-ai");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn load(app: &AppHandle) -> Result<LocalConfig, String> {
    let path = directory(app)?.join("config.json");
    match fs::read(path) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|_| "Invalid local AI configuration".into())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(LocalConfig::default()),
        Err(e) => Err(e.to_string()),
    }
}

fn write_private(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options
        .open(path)
        .and_then(|mut file| {
            file.write_all(bytes)?;
            file.sync_all()
        })
        .map_err(|e| e.to_string())
}

fn save(app: &AppHandle, config: &LocalConfig) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?;
    let dir = directory(app)?;
    let temporary = dir.join("config.pending.json");
    write_private(&temporary, &bytes)?;
    fs::rename(temporary, dir.join("config.json")).map_err(|e| e.to_string())
}

fn project_key(cwd: &str) -> String {
    let key = cwd.replace('\\', "/");
    if cfg!(windows) {
        key.to_lowercase()
    } else {
        key
    }
}

#[cfg(windows)]
pub(crate) fn protect(value: &str, decrypt: bool) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let mut bytes = if decrypt {
        STANDARD
            .decode(value)
            .map_err(|_| "Invalid protected key")?
    } else {
        value.as_bytes().to_vec()
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_mut_ptr(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // DPAPI binds the encrypted credential to the current Windows account.
    let ok = unsafe {
        if decrypt {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if ok == 0 {
        return Err("Windows credential protection failed".into());
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData.cast());
    }
    if decrypt {
        String::from_utf8(result).map_err(|_| "Invalid protected key".into())
    } else {
        Ok(STANDARD.encode(result))
    }
}

#[cfg(not(windows))]
pub(crate) fn protect(value: &str, _decrypt: bool) -> Result<String, String> {
    Ok(value.to_owned())
}

fn validate(connection: &Connection) -> Result<(), String> {
    if connection.id.is_empty()
        || connection.id.len() > 80
        || !connection
            .id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
    {
        return Err("Invalid connection ID".into());
    }
    let url = url::Url::parse(&connection.base_url).map_err(|_| "Invalid API URL")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if url.scheme() != "https" && !(local && url.scheme() == "http") {
        return Err("Use HTTPS, or HTTP for a local model".into());
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("API URL cannot contain credentials, query or fragment".into());
    }
    if !matches!(
        connection.api.as_str(),
        "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai"
    ) {
        return Err("Unsupported API protocol".into());
    }
    if connection.name.trim().is_empty()
        || connection.models.is_empty()
        || connection
            .models
            .iter()
            .any(|m| m.trim().is_empty() || m.len() > 200 || m.chars().any(char::is_control))
    {
        return Err("Enter a name and at least one model ID".into());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn local_ai_config(app: AppHandle) -> Result<LocalConfig, String> {
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load(&app)?;
    for connection in &mut config.connections {
        connection.has_key = !connection.secret.is_empty();
        connection.secret.clear();
    }
    Ok(config)
}

#[tauri::command(async)]
pub fn local_ai_save_connection(
    app: AppHandle,
    mut connection: Connection,
    api_key: Option<String>,
) -> Result<(), String> {
    validate(&connection)?;
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load(&app)?;
    connection.secret = match api_key {
        Some(key) if !key.is_empty() => protect(&key, false)?,
        Some(_) => String::new(),
        None => config
            .connections
            .iter()
            .find(|c| {
                c.id == connection.id
                    && c.base_url == connection.base_url
                    && c.api == connection.api
            })
            .map(|c| c.secret.clone())
            .unwrap_or_default(),
    };
    if !connection.primary_model.is_empty() {
        if !connection.models.contains(&connection.primary_model) {
            return Err("Primary model must be selected in the model list".into());
        }
        for c in &mut config.connections {
            c.primary_model.clear();
        }
    }
    config.connections.retain(|c| c.id != connection.id);
    config.connections.push(connection);
    save(&app, &config)
}

#[tauri::command(async)]
pub fn local_ai_remove_connection(app: AppHandle, id: String) -> Result<(), String> {
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load(&app)?;
    config.connections.retain(|c| c.id != id);
    save(&app, &config)
}

#[tauri::command(async)]
pub fn local_ai_save_context(
    app: AppHandle,
    memory: String,
    cwd: String,
    project_memory: String,
    mcp_servers: Value,
) -> Result<(), String> {
    if memory.len() + project_memory.len() > 64000 {
        return Err("Memory exceeds 64 KB".into());
    }
    let servers = mcp_servers
        .as_object()
        .ok_or("MCP servers must be a JSON object")?;
    for (name, server) in servers {
        if name.is_empty() || server.get("command").and_then(Value::as_str).is_none() {
            return Err("Local MCP servers require a name and command".into());
        }
        if let Some(args) = server.get("args") {
            if !args
                .as_array()
                .is_some_and(|args| args.iter().all(Value::is_string))
            {
                return Err("MCP args must be an array of strings".into());
            }
        }
    }
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load(&app)?;
    config.memory = memory;
    if !cwd.is_empty() {
        config
            .project_memories
            .insert(project_key(&cwd), project_memory);
    }
    config.mcp_servers = mcp_servers;
    save(&app, &config)
}

#[tauri::command(async)]
pub fn local_ai_memory(app: AppHandle, cwd: String) -> Result<String, String> {
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let config = load(&app)?;
    let project = config
        .project_memories
        .get(&project_key(&cwd))
        .cloned()
        .unwrap_or_default();
    Ok([config.memory, project]
        .into_iter()
        .filter(|s| !s.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n"))
}

/// Extend only the Pi/Claude children created by this app, never user CLI files.
pub fn configure_child(
    app: &AppHandle,
    cmd: &mut Command,
    provider: Option<&str>,
    selected_connection: Option<&str>,
    isolated: bool,
) -> Result<(), String> {
    if !matches!(
        provider,
        Some("pi" | "claude" | "codex" | "opencode" | "mimo")
    ) {
        return Ok(());
    }
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let config = load(app)?;
    let dir = directory(app)?;
    if let Some(id) = selected_connection {
        let connection = config
            .connections
            .iter()
            .find(|c| c.id == id && c.enabled)
            .ok_or("Model connection is missing or disabled")?;
        let key = if connection.secret.is_empty() {
            "local".to_string()
        } else {
            protect(&connection.secret, true)?
        };
        match provider {
            Some("claude") if connection.api == "anthropic-messages" => {
                cmd.env(
                    "ANTHROPIC_BASE_URL",
                    connection.base_url.trim_end_matches("/v1"),
                )
                .env("ANTHROPIC_API_KEY", key)
                .env_remove("ANTHROPIC_AUTH_TOKEN");
            }
            Some("codex") if connection.api == "openai-responses" => {
                cmd.env("MYCODE_MODEL_API_KEY", key);
                for value in [
                    "model_provider=\"mycode\"".to_string(),
                    "model_providers.mycode.name=\"MyCode\"".into(),
                    format!(
                        "model_providers.mycode.base_url={}",
                        serde_json::to_string(&connection.base_url).map_err(|e| e.to_string())?
                    ),
                    "model_providers.mycode.env_key=\"MYCODE_MODEL_API_KEY\"".into(),
                    "model_providers.mycode.wire_api=\"responses\"".into(),
                ] {
                    cmd.arg("-c").arg(value);
                }
            }
            _ => return Err("This agent does not support the selected model protocol".into()),
        }
    }
    if matches!(provider, Some("opencode" | "mimo")) {
        let mut providers = serde_json::Map::new();
        for c in config.connections.iter().filter(|c| c.enabled) {
            validate(c)?;
            let key = if c.secret.is_empty() {
                "local".to_owned()
            } else {
                protect(&c.secret, true)?
            };
            let npm = match c.api.as_str() {
                "anthropic-messages" => "@ai-sdk/anthropic",
                "google-generative-ai" => "@ai-sdk/google",
                "openai-responses" => "@ai-sdk/openai",
                _ => "@ai-sdk/openai-compatible",
            };
            let models: serde_json::Map<String, Value> = c
                .models
                .iter()
                .map(|id| (id.clone(), json!({"name":id})))
                .collect();
            providers.insert(format!("mycode-{}", c.id), json!({"npm":npm,"name":c.name,"options":{"baseURL":c.base_url,"apiKey":key},"models":models}));
        }
        if !providers.is_empty() {
            let value =
                serde_json::to_string(&json!({"provider":providers})).map_err(|e| e.to_string())?;
            cmd.env("OPENCODE_CONFIG_CONTENT", &value)
                .env("MIMOCODE_CONFIG_CONTENT", value);
        }
    }
    if provider == Some("claude")
        && !isolated
        && config
            .mcp_servers
            .as_object()
            .is_some_and(|s| !s.is_empty())
    {
        let path = dir.join("mcp.json");
        write_private(
            &path,
            serde_json::to_string(&json!({"mcpServers": config.mcp_servers}))
                .unwrap()
                .as_bytes(),
        )?;
        cmd.arg("--mcp-config").arg(path);
    }
    if provider == Some("pi") {
        let mut entries = Vec::new();
        for c in config.connections.iter().filter(|c| c.enabled) {
            validate(c)?;
            let key = if c.secret.is_empty() {
                "local".to_owned()
            } else {
                protect(&c.secret, true)?
            };
            let env = format!("MYCODE_KEY_{}", c.id.replace('-', "_").to_uppercase());
            cmd.env(&env, key);
            entries.push(json!({"id": format!("mycode-{}", c.id), "name": c.name, "baseUrl": c.base_url, "api": c.api, "env": env, "models": c.models}));
        }
        if !entries.is_empty() {
            let script = include_str!("local_ai_provider.mjs");
            cmd.env(
                "MYCODE_CONNECTIONS",
                serde_json::to_string(&entries).map_err(|e| e.to_string())?,
            );
            let path = dir.join("providers.mjs");
            write_private(&path, script.as_bytes())?;
            cmd.arg("--extension").arg(path);
        }
    }
    Ok(())
}

#[tauri::command(async)]
pub fn local_ai_test_connection(app: AppHandle, id: String) -> Result<usize, String> {
    let connection = {
        let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
        load(&app)?
            .connections
            .into_iter()
            .find(|c| c.id == id)
            .ok_or("Connection not found")?
    };
    Ok(fetch_models(&connection, None)?.len())
}

#[tauri::command(async)]
pub fn local_ai_discover_models(
    app: AppHandle,
    mut connection: Connection,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    // Discovery precedes model selection. Validate the endpoint without requiring a model yet.
    connection.models = vec!["discovery".into()];
    validate(&connection)?;
    if api_key.is_none() {
        let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
        connection.secret = load(&app)?
            .connections
            .iter()
            .find(|c| {
                c.id == connection.id
                    && c.base_url == connection.base_url
                    && c.api == connection.api
            })
            .map(|c| c.secret.clone())
            .unwrap_or_default();
    }
    fetch_models(&connection, api_key)
}

fn fetch_models(connection: &Connection, api_key: Option<String>) -> Result<Vec<String>, String> {
    validate(connection)?;
    let key = if let Some(key) = api_key {
        key
    } else if connection.secret.is_empty() {
        String::new()
    } else {
        protect(&connection.secret, true)?
    };
    let endpoint = if connection.api == "anthropic-messages"
        && !connection.base_url.trim_end_matches('/').ends_with("/v1")
    {
        format!("{}/v1/models", connection.base_url.trim_end_matches('/'))
    } else {
        format!("{}/models", connection.base_url.trim_end_matches('/'))
    };
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(20))
        .redirects(0)
        .build();
    let mut all = std::collections::BTreeSet::new();
    let mut cursor = String::new();
    for _ in 0..50 {
        let mut request = agent.get(&endpoint);
        if connection.api == "anthropic-messages" {
            request = request
                .set("x-api-key", &key)
                .set("anthropic-version", "2023-06-01")
                .query("limit", "1000");
            if !cursor.is_empty() {
                request = request.query("after_id", &cursor);
            }
        } else if connection.api == "google-generative-ai" {
            request = request
                .set("x-goog-api-key", &key)
                .query("pageSize", "1000");
            if !cursor.is_empty() {
                request = request.query("pageToken", &cursor);
            }
        } else if !key.is_empty() {
            request = request.set("Authorization", &format!("Bearer {key}"));
        }
        let response = request.call().map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("HTTP {code}"),
            _ => "Connection failed".into(),
        })?;
        let text = response
            .into_string()
            .map_err(|_| "Invalid model response")?;
        let value: Value = serde_json::from_str(&text).map_err(|_| "Invalid model response")?;
        all.extend(parse_model_ids(&value)?);
        let next = if connection.api == "google-generative-ai" {
            value["nextPageToken"].as_str()
        } else if connection.api == "anthropic-messages"
            && value["has_more"].as_bool() == Some(true)
        {
            value["last_id"].as_str()
        } else {
            None
        };
        match next.filter(|v| !v.is_empty()) {
            None => return Ok(all.into_iter().collect()),
            Some(next) if next != cursor => cursor = next.to_string(),
            _ => return Err("Invalid model pagination".into()),
        }
    }
    Err("Model list exceeds pagination limit".into())
}

fn parse_model_ids(value: &Value) -> Result<Vec<String>, String> {
    let list = value
        .as_array()
        .or_else(|| value.get("data").and_then(Value::as_array))
        .or_else(|| value.get("models").and_then(Value::as_array))
        .ok_or("Invalid model list")?;
    let mut models = Vec::new();
    for item in list {
        if let Some(methods) = item
            .get("supportedGenerationMethods")
            .and_then(Value::as_array)
        {
            if !methods
                .iter()
                .any(|m| m.as_str() == Some("generateContent"))
            {
                continue;
            }
        }
        let id = item
            .as_str()
            .or_else(|| item.get("id").and_then(Value::as_str))
            .or_else(|| item.get("slug").and_then(Value::as_str))
            .or_else(|| item.get("name").and_then(Value::as_str));
        if let Some(id) = id {
            let id = id.strip_prefix("models/").unwrap_or(id).trim();
            if !id.is_empty()
                && id.len() <= 200
                && !id.chars().any(char::is_control)
                && !models.iter().any(|m| m == id)
            {
                models.push(id.to_string());
            }
        }
    }
    models.sort();
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn connection(url: &str) -> Connection {
        Connection {
            id: "test-connection".into(),
            name: "Test".into(),
            base_url: url.into(),
            api: "openai-completions".into(),
            models: vec!["model-one".into()],
            enabled: true,
            ..Default::default()
        }
    }
    #[test]
    fn only_secure_remote_or_local_http_endpoints_are_accepted() {
        assert!(validate(&connection("https://api.example.com/v1")).is_ok());
        assert!(validate(&connection("http://127.0.0.1:11434/v1")).is_ok());
        for url in [
            "http://api.example.com/v1",
            "file:///config",
            "https://user:password@api.example.com/v1",
            "https://api.example.com/v1?key=secret",
        ] {
            assert!(validate(&connection(url)).is_err());
        }
    }
    #[test]
    fn invalid_identifiers_and_protocols_are_rejected() {
        let mut value = connection("https://api.example.com/v1");
        value.id = "../outside".into();
        assert!(validate(&value).is_err());
        value.id = "valid".into();
        value.api = "unknown".into();
        assert!(validate(&value).is_err());
    }
    #[test]
    fn model_discovery_normalizes_deduplicates_and_filters_generation() {
        assert_eq!(
            parse_model_ids(&json!({"data":[{"id":"b"},{"id":"a"},{"id":"b"}]})).unwrap(),
            vec!["a", "b"]
        );
        assert_eq!(parse_model_ids(&json!({"models":[{"name":"models/gemini","supportedGenerationMethods":["generateContent"]},{"name":"models/embed","supportedGenerationMethods":["embedContent"]}]})).unwrap(),vec!["gemini"]);
        assert!(parse_model_ids(&json!({"error":"unauthorized"})).is_err());
    }
    #[cfg(windows)]
    #[test]
    fn windows_keys_are_encrypted_and_roundtrip() {
        let plaintext = "mycode-unit-test-key";
        let ciphertext = protect(plaintext, false).unwrap();
        assert!(!ciphertext.contains(plaintext));
        assert_eq!(protect(&ciphertext, true).unwrap(), plaintext);
        assert!(protect("invalid protected value", true).is_err());
    }
    #[test]
    fn extension_reads_credentials_from_environment_not_generated_code() {
        let script = include_str!("local_ai_provider.mjs");
        assert!(script.contains("MYCODE_CONNECTIONS"));
        assert!(script.contains("apiKey: `$${c.env}`"));
        assert!(!script.contains("cindy"));
    }
}
