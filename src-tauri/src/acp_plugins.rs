//! Locally approved ACP engines. Renderer input never chooses the process at launch.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

static WRITE: Mutex<()> = Mutex::new(());
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Engine {
    pub id: String,
    pub name: String,
    pub name_zh: String,
    pub version: String,
    pub command: String,
    pub args: Vec<String>,
    pub models: Vec<Model>,
    #[serde(default)]
    pub auth_method_id: Option<String>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub accounts: Vec<String>,
    #[serde(default)]
    pub revision: String,
    #[serde(default)]
    pub integrity: BTreeMap<String, String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Model {
    pub id: String,
    pub name: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Launch {
    pub id: String,
    pub revision: String,
    pub account_id: String,
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("acp-plugins"))
}
fn hash(path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    Ok(format!("{:x}", digest.finalize()))
}
fn validate(engine: &Engine) -> Result<(), String> {
    if !valid_id(&engine.id)
        || engine.name.trim().is_empty()
        || engine.name.len() > 200
        || engine.name_zh.trim().is_empty()
        || engine.name_zh.len() > 300
        || engine.version.len() > 64
        || engine.args.len() > 64
        || engine
            .args
            .iter()
            .any(|s| s.len() > 8192 || s.contains('\0'))
        || engine.models.is_empty()
        || engine.models.len() > 200
        || engine.accounts.is_empty()
        || engine.accounts.len() > 32
        || engine.accounts.iter().any(|a| !valid_id(a))
    {
        return Err("Invalid ACP engine manifest / ACP 引擎清单无效".into());
    }
    let command = Path::new(&engine.command);
    if !command.is_absolute() || !command.is_file() {
        return Err(
            "ACP executable must be an existing absolute path / ACP 程序须为已存在的绝对路径"
                .into(),
        );
    }
    let mut ids = std::collections::HashSet::new();
    for model in &engine.models {
        if model.id.is_empty()
            || model.id.len() > 256
            || model.id.contains('\0')
            || model.name.is_empty()
            || model.name.len() > 200
            || !ids.insert(&model.id)
        {
            return Err("Invalid ACP model catalog / ACP 模型目录无效".into());
        }
    }
    Ok(())
}
#[tauri::command]
pub fn acp_plugins_list(app: AppHandle) -> Result<Vec<Engine>, String> {
    let dir = root(&app)?;
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut result = Vec::new();
    for item in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = item.map_err(|e| e.to_string())?.path();
        if path.extension().is_some_and(|s| s == "json") {
            let value: Engine = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            result.push(value);
        }
    }
    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}
#[tauri::command]
pub fn acp_plugin_save(app: AppHandle, mut engine: Engine) -> Result<Engine, String> {
    let _guard = WRITE.lock().map_err(|e| e.to_string())?;
    validate(&engine)?;
    engine.integrity.clear();
    for item in std::iter::once(&engine.command).chain(engine.args.iter()) {
        let path = Path::new(item);
        if path.is_absolute() && path.is_file() {
            engine.integrity.insert(item.clone(), hash(path)?);
        }
    }
    engine.revision.clear();
    engine.revision = format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&engine).map_err(|e| e.to_string())?)
    );
    let dir = root(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", engine.id));
    let temp = dir.join(format!("{}.pending", engine.id));
    fs::write(
        &temp,
        serde_json::to_vec_pretty(&engine).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(temp, path).map_err(|e| e.to_string())?;
    Ok(engine)
}
#[tauri::command]
pub fn acp_plugin_remove(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("Invalid ACP engine ID / ACP 引擎标识无效".into());
    }
    let _guard = WRITE.lock().map_err(|e| e.to_string())?;
    let path = root(&app)?.join(format!("{id}.json"));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    // Credentials and native session history deliberately survive removal.
    Ok(())
}
/// Toggling availability never approves changed executable bytes.
#[tauri::command]
pub fn acp_plugin_set_enabled(app: AppHandle, id: String, enabled: bool) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("Invalid ACP engine ID / ACP 引擎标识无效".into());
    }
    let _guard = WRITE.lock().map_err(|e| e.to_string())?;
    let path = root(&app)?.join(format!("{id}.json"));
    let mut engine: Engine = serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    if enabled {
        validate(&engine)?;
        if !engine.integrity.contains_key(&engine.command) {
            return Err("ACP program was not approved / ACP 程序未获批准".into());
        }
        for (file, expected) in &engine.integrity {
            if hash(Path::new(file))? != *expected {
                return Err(
                    "ACP program changed; approve the update first / ACP 程序已变更，请先批准更新"
                        .into(),
                );
            }
        }
    }
    engine.enabled = enabled;
    let temp = path.with_extension("pending");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(&engine).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(temp, path).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn resolve(app: &AppHandle, launch: &Launch) -> Result<Engine, String> {
    if !valid_id(&launch.id) || !valid_id(&launch.account_id) {
        return Err("Invalid ACP account / ACP 账号无效".into());
    }
    let engine: Engine = serde_json::from_slice(
        &fs::read(root(app)?.join(format!("{}.json", launch.id))).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    validate(&engine)?;
    if !engine.enabled
        || engine.revision != launch.revision
        || !engine.accounts.contains(&launch.account_id)
    {
        return Err(
            "ACP authorization changed; refresh the engine / ACP 授权已变更，请刷新引擎".into(),
        );
    }
    for (file, expected) in &engine.integrity {
        if hash(Path::new(file))? != *expected {
            return Err(
                "ACP program changed; approve the update first / ACP 程序已变更，请先批准更新"
                    .into(),
            );
        }
    }
    if !engine.integrity.contains_key(&engine.command) {
        return Err("ACP program was not approved / ACP 程序未获批准".into());
    }
    Ok(engine)
}
pub fn configure(app: &AppHandle, cmd: &mut Command, launch: &Launch) -> Result<(), String> {
    let dir = root(app)?
        .join("accounts")
        .join(&launch.id)
        .join(&launch.account_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for key in [
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "XDG_CACHE_HOME",
        "MYCODE_ACCOUNT_DIR",
    ] {
        cmd.env(key, &dir);
    }
    for key in [
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "CLAUDE_CODE_OAUTH_TOKEN",
        "CODEX_ACCESS_TOKEN",
        "CODEX_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "OPENROUTER_API_KEY",
        "DEEPSEEK_API_KEY",
    ] {
        cmd.env_remove(key);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn account_ids_cannot_escape_profile() {
        for id in ["..", "../other", "C:\\secret", "a/b", ""] {
            assert!(!valid_id(id));
        }
        assert!(valid_id("work-1"));
    }
}
