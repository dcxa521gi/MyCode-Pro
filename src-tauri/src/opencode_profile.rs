//! Adapt app-owned configuration to OpenCode 2 without rewriting user CLI files.
use serde_json::{json, Value};

pub fn config_v2(mut value: Value) -> Value {
    let Some(root) = value.as_object_mut() else {
        return value;
    };
    root.remove("small_model");
    if let Some(mut providers) = root.remove("provider") {
        if let Some(entries) = providers.as_object_mut() {
            for provider in entries.values_mut() {
                let Some(provider) = provider.as_object_mut() else {
                    continue;
                };
                if let Some(npm) = provider.remove("npm") {
                    let package = match npm.as_str().unwrap_or_default() {
                        "@ai-sdk/anthropic" => "@opencode/ai/providers/anthropic-compatible",
                        "@ai-sdk/google" => "@opencode/ai/providers/google",
                        "@ai-sdk/openai" => "@opencode/ai/providers/openai/responses",
                        _ => "@opencode/ai/providers/openai-compatible",
                    };
                    provider.insert("package".into(), json!(package));
                }
                if let Some(mut options) = provider.remove("options") {
                    if let Some(headers) = options.as_object_mut().and_then(|v| v.remove("headers"))
                    {
                        provider.insert("headers".into(), headers);
                    }
                    provider.insert("settings".into(), options);
                }
                if let Some(models) = provider.get_mut("models").and_then(Value::as_object_mut) {
                    for (id, model) in models {
                        let Some(model) = model.as_object_mut() else {
                            continue;
                        };
                        model.entry("modelID").or_insert_with(|| json!(id));
                        if let Some(variants) = model.get_mut("variants") {
                            if let Some(entries) = variants.as_object() {
                                *variants = json!(entries
                                    .iter()
                                    .map(|(id, settings)| json!({"id":id,"settings":settings}))
                                    .collect::<Vec<_>>());
                            }
                        }
                    }
                }
            }
        }
        root.insert("providers".into(), providers);
    }
    if let Some(mcp) = root.get_mut("mcp") {
        if !mcp.get("servers").is_some_and(Value::is_object) {
            *mcp = json!({"servers":mcp.take()});
        }
        if let Some(servers) = mcp.get_mut("servers").and_then(Value::as_object_mut) {
            for server in servers.values_mut() {
                let Some(server) = server.as_object_mut() else {
                    continue;
                };
                if let Some(enabled) = server.remove("enabled").and_then(|v| v.as_bool()) {
                    server.insert("disabled".into(), json!(!enabled));
                }
                if let Some(timeout) = server.get_mut("timeout") {
                    if timeout.is_number() {
                        *timeout = json!({"startup":timeout.clone(),"catalog":timeout.clone(),"execution":timeout.clone()});
                    }
                }
            }
        }
    }
    value
}

pub fn merge(base: &mut Value, overlay: Value) {
    if let (Some(base), Some(overlay)) = (base.as_object_mut(), overlay.as_object()) {
        for (key, value) in overlay {
            merge(base.entry(key).or_insert(Value::Null), value.clone());
        }
    } else {
        *base = overlay;
    }
}

/// Keep app-managed API credentials in the child's environment, rather than
/// duplicating them in a project configuration file.
pub fn environment_secrets(value: &mut Value, cmd: &mut std::process::Command, path: &str) {
    use sha2::{Digest, Sha256};
    if let Some(object) = value.as_object_mut() {
        for (key, value) in object {
            let next = format!("{path}/{key}");
            let lower = key.to_ascii_lowercase();
            if ["key", "token", "secret", "password", "authorization"]
                .iter()
                .any(|word| lower.contains(word))
            {
                if let Some(secret) = value
                    .as_str()
                    .filter(|secret| !secret.is_empty() && !secret.starts_with("{env:"))
                {
                    let name = format!(
                        "MYCODE_OPENCODE_SECRET_{:x}",
                        Sha256::digest(next.as_bytes())
                    );
                    cmd.env(&name, secret);
                    *value = json!(format!("{{env:{name}}}"));
                    continue;
                }
            }
            environment_secrets(value, cmd, &next);
        }
    } else if let Some(array) = value.as_array_mut() {
        for (index, value) in array.iter_mut().enumerate() {
            environment_secrets(value, cmd, &format!("{path}/{index}"));
        }
    }
}

/// Only a database already using V2's credential schema may be shared for
/// installed login accounts. A V1 database must never be migrated by this app.
pub fn is_v2_database(path: &std::path::Path) -> bool {
    let Ok(db) =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
    else {
        return false;
    };
    db.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='credential')",
        [],
        |row| row.get::<_, bool>(0),
    )
    .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn adapts_protocol_packages_headers_variants_and_mcp_without_changing_routes() {
        let input = json!({"model":"mycode-example/model","small_model":"same",
            "provider":{"mycode-example":{"npm":"@ai-sdk/openai","options":{"baseURL":"http://localhost/v1","apiKey":"fixture","headers":{"X-App-URL":"mycode"}},"models":{"model":{"variants":{"high":{"reasoningEffort":"high"}},"limit":{"context":65536,"output":4096}}}}},
            "mcp":{"browser":{"type":"local","command":["node","browser.cjs"],"enabled":true,"timeout":30000}}});
        let next = config_v2(input.clone());
        assert_eq!(next["model"], input["model"]);
        assert_eq!(
            next["providers"]["mycode-example"]["package"],
            "@opencode/ai/providers/openai/responses"
        );
        assert_eq!(
            next["providers"]["mycode-example"]["settings"]["apiKey"],
            "fixture"
        );
        assert_eq!(
            next["providers"]["mycode-example"]["headers"]["X-App-URL"],
            "mycode"
        );
        assert_eq!(
            next["providers"]["mycode-example"]["models"]["model"]["variants"][0]["id"],
            "high"
        );
        assert_eq!(next["mcp"]["servers"]["browser"]["disabled"], false);
        assert_eq!(
            next["mcp"]["servers"]["browser"]["timeout"]["execution"],
            30000
        );
        assert!(next.get("small_model").is_none());
    }
    #[test]
    fn detects_v2_credentials_without_migrating_a_v1_database() {
        let root = std::env::temp_dir().join(format!("mycode-opencode-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("opencode.db");
        let db = rusqlite::Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE session(id TEXT)").unwrap();
        assert!(!is_v2_database(&path));
        db.execute_batch("CREATE TABLE credential(id TEXT)")
            .unwrap();
        assert!(is_v2_database(&path));
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }
}
