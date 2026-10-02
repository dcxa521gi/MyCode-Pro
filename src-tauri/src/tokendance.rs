use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::AppHandle;

type Pending = HashMap<String, (String, Instant, bool)>;
static PENDING: OnceLock<Mutex<Pending>> = OnceLock::new();
pub const APP_URL: &str = "app://example-desktop";
pub fn is_endpoint(base: &str) -> bool {
    url::Url::parse(base)
        .is_ok_and(|u| u.scheme() == "https" && u.host_str() == Some("tokendance.space"))
}
pub fn recovery(response: &ureq::Response) -> String {
    match response.header("TokenDance-Recovery-Action") {
        Some("top_up_balance") => {
            "TokenDance: 账户余额不足，请前往 TokenDance 充值后重试（当前 Key 仍有效）。".into()
        }
        Some("reauthorize_api_key") => "TokenDance: 授权已失效，请在模型服务商中重新授权。".into(),
        Some("api_key_quota") => "TokenDance: 已达到周期额度，请等待刷新或重新授权。".into(),
        _ => format!("HTTP {}", response.status()),
    }
}
#[tauri::command]
pub fn tokendance_authorize(provider: Option<String>) -> Result<Value, String> {
    let openrouter = provider.as_deref() == Some("openrouter");
    if provider
        .as_deref()
        .is_some_and(|p| p != "openrouter" && p != "tokendance")
    {
        return Err("Unsupported authorization provider".into());
    }
    let verifier = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let id = uuid::Uuid::new_v4().to_string();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut pending = PENDING
        .get_or_init(Default::default)
        .lock()
        .map_err(|e| e.to_string())?;
    pending.retain(|_, (_, time, _)| time.elapsed() < Duration::from_secs(600));
    if pending.len() >= 8 {
        return Err("Finish the existing authorization first".into());
    }
    pending.insert(id.clone(), (verifier, Instant::now(), openrouter));
    let mut url = url::Url::parse(if openrouter {
        "https://openrouter.ai/auth"
    } else {
        "https://tokendance.space/auth"
    })
    .unwrap();
    url.query_pairs_mut()
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    if openrouter {
        url.query_pairs_mut().append_pair("key_label", "MyCode");
    } else {
        url.query_pairs_mut()
            .append_pair("app_url", APP_URL)
            .append_pair("key_name", "MyCode");
    }
    Ok(json!({"id":id,"url":url.as_str()}))
}
#[tauri::command(async)]
pub fn tokendance_exchange(
    app: AppHandle,
    id: String,
    code: String,
    mut connection: crate::local_ai::Connection,
) -> Result<(), String> {
    let (verifier, openrouter) = {
        let mut pending = PENDING
            .get_or_init(Default::default)
            .lock()
            .map_err(|e| e.to_string())?;
        let (verifier, time, openrouter) = pending
            .remove(&id)
            .ok_or("Authorization expired; start again")?;
        if time.elapsed() > Duration::from_secs(600) {
            return Err("Authorization expired; start again".into());
        }
        (verifier, openrouter)
    };
    if (openrouter && connection.base_url.trim_end_matches('/') != "https://openrouter.ai/api/v1")
        || (!openrouter && !is_endpoint(&connection.base_url))
    {
        return Err("Invalid authorization endpoint".into());
    }
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(30))
        .redirects(0)
        .build();
    let response = agent
        .post(if openrouter {
            "https://openrouter.ai/api/v1/auth/keys"
        } else {
            "https://tokendance.space/portal/api/v1/auth/keys"
        })
        .set("Content-Type", "application/json")
        .send_string(
            &json!({"code":code.trim(),"code_verifier":verifier,"code_challenge_method":"S256"})
                .to_string(),
        )
        .map_err(|e| match e {
            ureq::Error::Status(_, r) if !openrouter => recovery(&r),
            _ => "Provider authorization failed; restart authorization and check network access"
                .into(),
        })?;
    let value: Value = serde_json::from_str(
        &response
            .into_string()
            .map_err(|_| "Invalid authorization response")?,
    )
    .map_err(|_| "Invalid authorization response")?;
    let key = value["key"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("No API Key returned")?;
    if connection.models.is_empty() {
        connection.enabled = false;
    }
    crate::local_ai::local_ai_save_connection(app, connection, Some(key.to_owned()))
}
