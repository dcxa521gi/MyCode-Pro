use crate::session_store::{SessionStore, SessionUpsert};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    id: String,
    source: String,
    title: String,
    cwd: String,
    turns: usize,
    existing: bool,
}

fn sources() -> Vec<(String, PathBuf)> {
    let Some(home) = crate::dirs_home() else {
        return vec![];
    };
    let home = PathBuf::from(home);
    vec![
        ("claude".into(), home.join(".claude/projects")),
        ("workbuddy".into(), home.join(".workbuddy/projects")),
        ("codex".into(), home.join(".codex/sessions")),
        ("codex".into(), home.join(".codex/archived_sessions")),
    ]
}
fn files(root: &Path, depth: usize, output: &mut Vec<PathBuf>) {
    if depth == 0 || output.len() >= 3000 {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        if output.len() >= 3000 {
            break;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            files(&entry.path(), depth - 1, output)
        } else if entry.path().extension().is_some_and(|e| e == "jsonl") {
            output.push(entry.path())
        }
    }
}
fn id_for(source: &str, path: &Path) -> String {
    format!(
        "import-{:x}",
        Sha256::digest(format!("{source}:{}", path.to_string_lossy()).as_bytes())
    )
}
fn text_content(value: &Value) -> String {
    if let Some(text) = value.as_str() {
        return text.to_string();
    }
    value
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter_map(|p| p.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}
fn parse(source: &str, id: &str, content: &str) -> Option<SessionUpsert> {
    let mut cwd = String::new();
    let mut native_id = None;
    let mut model = String::new();
    let mut blocks = vec![];
    for line in content.lines() {
        let Ok(v) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if let Some(value) = v.get("cwd").and_then(Value::as_str) {
            cwd = value.into()
        }
        if source == "codex" && v.get("type").and_then(Value::as_str) == Some("session_meta") {
            let p = &v["payload"];
            cwd = p["cwd"].as_str().unwrap_or(&cwd).into();
            native_id = p["id"].as_str().map(str::to_owned);
            continue;
        }
        if source == "claude" {
            if let Some(s) = v["sessionId"].as_str() {
                native_id = Some(s.into())
            }
        }
        let message = if source == "workbuddy" && v["type"] == "message" {
            &v
        } else if source == "claude" {
            &v["message"]
        } else if v["type"] == "response_item" && v["payload"]["type"] == "message" {
            &v["payload"]
        } else {
            continue;
        };
        let role = message["role"].as_str().unwrap_or("");
        if role != "user" && role != "assistant" {
            continue;
        }
        let text = text_content(&message["content"]);
        if text.trim().is_empty() {
            continue;
        }
        if let Some(m) = message["model"].as_str() {
            model = m.into()
        }
        blocks.push(json!({"id":format!("{id}-{}",blocks.len()),"role":role,"text":text}));
    }
    if blocks.is_empty() || cwd.is_empty() {
        return None;
    }
    let title = blocks
        .iter()
        .find(|b| b["role"] == "user")
        .and_then(|b| b["text"].as_str())
        .unwrap_or("Imported task")
        .chars()
        .take(100)
        .collect::<String>();
    // WorkBuddy transcripts are portable history, not Claude resumable sessions.
    let harness = if source == "workbuddy" {
        model.clear();
        "claude"
    } else {
        source
    };
    serde_json::from_value(json!({"id":id,"cwd":cwd,"harness":harness,"model":model,"modelSettings":{},"runtimeMode":"supervised","title":title,"providerSessionId":native_id,"blocks":blocks})).ok()
}
fn read(source: &str, path: &Path) -> Option<SessionUpsert> {
    if fs::symlink_metadata(path).ok()?.file_type().is_symlink()
        || fs::metadata(path).ok()?.len() > 20 * 1024 * 1024
    {
        return None;
    }
    parse(
        source,
        &id_for(source, path),
        &fs::read_to_string(path).ok()?,
    )
}

#[tauri::command(async)]
pub fn task_import_scan(store: State<'_, SessionStore>) -> Result<Vec<Candidate>, String> {
    let existing: std::collections::HashSet<String> = {
        let conn = store.lock_conn()?;
        let mut stmt = conn
            .prepare("SELECT id FROM sessions")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(Result::ok).collect()
    };
    let mut result = vec![];
    for session in crate::task_import_external::scan() {
        result.push(Candidate {
            id: session.id.clone(),
            source: session.harness.clone(),
            title: session.title,
            cwd: session.cwd,
            turns: session.blocks.as_array().map(Vec::len).unwrap_or(0),
            existing: existing.contains(&session.id),
        });
    }
    for (source, root) in sources() {
        let mut paths = vec![];
        files(&root, 6, &mut paths);
        for path in paths {
            if let Some(session) = read(&source, &path) {
                result.push(Candidate {
                    id: session.id.clone(),
                    source: source.clone(),
                    title: session.title,
                    cwd: session.cwd,
                    turns: session.blocks.as_array().map(Vec::len).unwrap_or(0),
                    existing: existing.contains(&session.id),
                })
            }
        }
    }
    Ok(result)
}
#[tauri::command(async)]
pub fn task_import_read(id: String) -> Result<SessionUpsert, String> {
    if let Some(session) = crate::task_import_external::scan()
        .into_iter()
        .find(|s| s.id == id)
    {
        return Ok(session);
    }
    for (source, root) in sources() {
        let mut paths = vec![];
        files(&root, 6, &mut paths);
        for path in paths {
            if id_for(&source, &path) == id {
                return read(&source, &path).ok_or("Could not read this conversation".into());
            }
        }
    }
    Err("Conversation no longer exists".into())
}

#[tauri::command(async)]
pub fn task_import_commit(
    store: State<'_, SessionStore>,
    id: String,
) -> Result<crate::session_store::SessionSummary, String> {
    let session = task_import_read(id)?;
    let conn = store.lock_conn()?;
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sessions WHERE id=?1 OR (harness=?2 AND provider_session_id=?3))",
            rusqlite::params![session.id, session.harness, session.provider_session_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists {
        return Err("This task has already been imported. Refresh the list.".into());
    }
    crate::session_store::upsert_session(&conn, &session).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn workbuddy_imports_messages_without_resuming_foreign_sessions() {
        let text = r#"{"cwd":"/office","sessionId":"foreign","type":"message","role":"user","content":[{"type":"text","text":"write report"}]}
{"cwd":"/office","type":"reasoning","content":[{"text":"private thought"}]}
{"cwd":"/office","type":"message","role":"assistant","content":[{"type":"text","text":"report"}]}"#;
        let session = parse("workbuddy", "import-test", text).unwrap();
        assert_eq!(session.blocks.as_array().unwrap().len(), 2);
        assert_eq!(session.harness, "claude");
        assert!(session.provider_session_id.is_none());
    }
    #[test]
    fn codex_import_ignores_tool_and_system_instructions() {
        let text="{\"type\":\"session_meta\",\"payload\":{\"id\":\"abc\",\"cwd\":\"/repo\"}}\n{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"text\":\"hello\"}]}}\n{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"system\",\"content\":[{\"text\":\"secret\"}]}}";
        let s = parse("codex", "import-test", text).unwrap();
        assert_eq!(s.blocks.as_array().unwrap().len(), 1);
        assert_eq!(s.title, "hello");
        assert_eq!(s.runtime_mode, "supervised");
    }
    #[test]
    fn source_paths_have_distinct_receipts() {
        assert_ne!(
            id_for("claude", Path::new("/a")),
            id_for("codex", Path::new("/a"))
        );
    }
}
