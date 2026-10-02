//! Read-only portable history import. Never import auth tables, tool arguments or hidden prompts.
use crate::session_store::SessionUpsert;
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

fn open(path: &Path) -> Option<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    conn.busy_timeout(Duration::from_secs(2)).ok()?;
    Some(conn)
}
fn parse(text: &str) -> Value {
    if text.len() > 20 * 1024 * 1024 {
        return Value::Null;
    }
    serde_json::from_str(text).unwrap_or(Value::Null)
}
fn text(value: &Value) -> String {
    if let Some(s) = value.as_str() {
        return s.to_owned();
    }
    value
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter(|p| p["type"].is_null() || p["type"] == "text")
                .filter_map(|p| p["text"].as_str())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}
fn block(role: &str, content: String, blocks: &mut Vec<Value>) {
    if matches!(role, "user" | "assistant")
        && !content.trim().is_empty()
        && blocks.len() < 2_000
        && content.len()
            + blocks
                .iter()
                .filter_map(|b| b["text"].as_str())
                .map(str::len)
                .sum::<usize>()
            <= 20 * 1024 * 1024
    {
        blocks.push(json!({"id":format!("external-{}",blocks.len()),"role":role,"text":content}));
    }
}
fn session(
    source: &str,
    path: &Path,
    native: &str,
    cwd: &str,
    title: &str,
    blocks: Vec<Value>,
) -> Option<SessionUpsert> {
    if cwd.is_empty() || blocks.is_empty() {
        return None;
    }
    let id = format!(
        "import-{:x}",
        Sha256::digest(format!("{source}:{}:{native}", path.to_string_lossy()).as_bytes())
    );
    let title = if title.trim().is_empty() {
        blocks
            .iter()
            .find(|b| b["role"] == "user")
            .and_then(|b| b["text"].as_str())
            .unwrap_or("Imported task")
    } else {
        title
    }
    .chars()
    .take(100)
    .collect::<String>();
    let blocks: Vec<_> = blocks
        .into_iter()
        .enumerate()
        .map(|(i, mut b)| {
            b["id"] = json!(format!("{id}-{i}"));
            b
        })
        .collect();
    serde_json::from_value(json!({"id":id,"cwd":cwd,"harness":source,"model":format!("{source}:default"),"modelSettings":{},"runtimeMode":"supervised","title":title,"blocks":blocks})).ok()
}
fn opencode(path: &Path) -> Vec<SessionUpsert> {
    let Some(conn) = open(path) else {
        return vec![];
    };
    let Ok(mut stmt)=conn.prepare("SELECT id,directory,title FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC LIMIT 1000")else{return vec![]};
    let Ok(rows) = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    }) else {
        return vec![];
    };
    let mut result = vec![];
    for (id, cwd, title) in rows.flatten() {
        let Ok(mut messages)=conn.prepare("SELECT message.data,part.data FROM message JOIN part ON part.message_id=message.id WHERE message.session_id=?1 ORDER BY message.time_created,message.id,part.time_created,part.id LIMIT 20000")else{continue};
        let Ok(parts) = messages.query_map([&id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        }) else {
            continue;
        };
        let mut blocks = vec![];
        for (message, part) in parts.flatten() {
            let m = parse(&message);
            let p = parse(&part);
            if p["type"] == "text" && p["synthetic"] != true {
                block(
                    m["role"].as_str().unwrap_or(""),
                    text(&p["text"]),
                    &mut blocks,
                );
            }
        }
        if let Some(s) = session("opencode", path, &id, &cwd, &title, blocks) {
            if result
                .iter()
                .map(|s: &SessionUpsert| s.blocks.to_string().len())
                .sum::<usize>()
                + s.blocks.to_string().len()
                > 64 * 1024 * 1024
            {
                break;
            }
            result.push(s)
        }
    }
    result
}
fn minimax(path: &Path) -> Vec<SessionUpsert> {
    let Some(conn) = open(path) else {
        return vec![];
    };
    let Ok(mut stmt)=conn.prepare("SELECT session_id,COALESCE(project_workspace_dir,workspace_dir,''),COALESCE(title,''),record_json FROM local_runtime_sessions WHERE parent_session_id IS NULL ORDER BY updated_at_ms DESC LIMIT 1000")else{return vec![]};
    let Ok(rows) = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
        ))
    }) else {
        return vec![];
    };
    let mut result = vec![];
    for (id, mut cwd, title, record) in rows.flatten() {
        if cwd.is_empty() {
            let v = parse(&record);
            cwd = v["workspaceDir"]
                .as_str()
                .or(v["projectWorkspaceDir"].as_str())
                .unwrap_or("")
                .to_owned();
        }
        let mut blocks = vec![];
        if let Ok(mut messages)=conn.prepare("SELECT data_json FROM local_runtime_message_rows WHERE session_id=?1 ORDER BY created_at_ms,id LIMIT 2000"){
            if let Ok(rows)=messages.query_map([&id],|r|r.get::<_,String>(0)){for data in rows.flatten(){let v=parse(&data);block(v["role"].as_str().unwrap_or(""),text(&v["content"]),&mut blocks);}}
        }
        if blocks.is_empty() {
            if let Ok(data) = conn.query_row(
                "SELECT pi_history_json FROM local_runtime_messages WHERE session_id=?1",
                [&id],
                |r| r.get::<_, String>(0),
            ) {
                if let Some(messages) = parse(&data).as_array() {
                    for m in messages {
                        block(
                            m["role"].as_str().unwrap_or(""),
                            text(&m["content"]),
                            &mut blocks,
                        );
                    }
                }
            }
        }
        if let Some(s) = session("minimax", path, &id, &cwd, &title, blocks) {
            if result
                .iter()
                .map(|s: &SessionUpsert| s.blocks.to_string().len())
                .sum::<usize>()
                + s.blocks.to_string().len()
                > 64 * 1024 * 1024
            {
                break;
            }
            result.push(s)
        }
    }
    result
}
fn file_uri(value: &str) -> Option<String> {
    url::Url::parse(value)
        .ok()?
        .to_file_path()
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}
fn cursor(path: &Path, workspace_root: &Path) -> Vec<SessionUpsert> {
    let Some(conn) = open(path) else {
        return vec![];
    };
    let mut workspaces = HashMap::new();
    if let Ok(entries) = fs::read_dir(workspace_root) {
        for entry in entries.flatten().take(3000) {
            let file = entry.path().join("workspace.json");
            if let Ok(data) = fs::read_to_string(file) {
                let v = parse(&data);
                if let Some(folder) = v["folder"].as_str().and_then(file_uri) {
                    workspaces.insert(entry.file_name().to_string_lossy().into_owned(), folder);
                }
            }
        }
    }
    let Ok(mut stmt)=conn.prepare("SELECT key,CAST(value AS TEXT) FROM cursorDiskKV WHERE key LIKE 'composerData:%' LIMIT 1000")else{return vec![]};
    let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
    else {
        return vec![];
    };
    let mut result = vec![];
    for (key, data) in rows.flatten() {
        let v = parse(&data);
        if v["isDraft"] == true {
            continue;
        }
        let id = key.trim_start_matches("composerData:");
        let workspace = conn
            .query_row(
                "SELECT workspaceId FROM composerHeaders WHERE composerId=?1",
                [id],
                |r| r.get::<_, String>(0),
            )
            .unwrap_or_default();
        let cwd = workspaces
            .get(&workspace)
            .cloned()
            .or_else(|| {
                v["workspaceUris"]
                    .as_array()?
                    .first()?
                    .as_str()
                    .and_then(file_uri)
            })
            .or_else(|| {
                v["context"]["folderSelections"]
                    .as_array()?
                    .first()?
                    .get("uri")?
                    .as_str()
                    .and_then(file_uri)
            })
            .unwrap_or_default();
        let mut blocks = vec![];
        if let Some(headers) = v["fullConversationHeadersOnly"].as_array() {
            for header in headers.iter().take(2_000) {
                let Some(bubble) = header["bubbleId"].as_str() else {
                    continue;
                };
                let data = conn
                    .query_row(
                        "SELECT CAST(value AS TEXT) FROM cursorDiskKV WHERE key=?1",
                        [format!("bubbleId:{id}:{bubble}")],
                        |r| r.get::<_, String>(0),
                    )
                    .unwrap_or_default();
                let m = if data.is_empty() {
                    v["conversationMap"][bubble].clone()
                } else {
                    parse(&data)
                };
                let role = match m["type"].as_i64().or(header["type"].as_i64()) {
                    Some(1) => "user",
                    Some(2) => "assistant",
                    _ => "",
                };
                block(role, text(&m["text"]), &mut blocks);
            }
        }
        if let Some(s) = session(
            "cursor",
            path,
            id,
            &cwd,
            v["name"].as_str().unwrap_or(""),
            blocks,
        ) {
            if result
                .iter()
                .map(|s: &SessionUpsert| s.blocks.to_string().len())
                .sum::<usize>()
                + s.blocks.to_string().len()
                > 64 * 1024 * 1024
            {
                break;
            }
            result.push(s)
        }
    }
    result
}
pub fn scan() -> Vec<SessionUpsert> {
    let Some(home) = crate::dirs_home().map(PathBuf::from) else {
        return vec![];
    };
    let mut result = opencode(&home.join(".local/share/opencode/opencode.db"));
    for path in crate::task_import_cursor_cli::paths(&home) {
        if let Some((id, cwd, title, blocks)) = crate::task_import_cursor_cli::read(&path) {
            if let Some(imported) = session("cursor", &path, &id, &cwd, &title, blocks) {
                if result
                    .iter()
                    .map(|s| s.blocks.to_string().len())
                    .sum::<usize>()
                    + imported.blocks.to_string().len()
                    > 64 * 1024 * 1024
                {
                    break;
                }
                result.push(imported);
            }
        }
    }
    let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    if let Some(local) = local {
        result.extend(opencode(&local.join("opencode/opencode.db")));
    }
    result.extend(minimax(
        &home.join(".minimax/v2/sqlite/runtime-state.sqlite"),
    ));
    for root in [
        home.join("AppData/Roaming/Cursor/User"),
        home.join(".config/Cursor/User"),
        home.join("Library/Application Support/Cursor/User"),
    ] {
        result.extend(cursor(
            &root.join("globalStorage/state.vscdb"),
            &root.join("workspaceStorage"),
        ));
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn minimax_and_cursor_read_only_fixtures_preserve_database_bytes() {
        let root =
            std::env::temp_dir().join(format!("mycode-history-fixture-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let mini = root.join("minimax.db");
        let c = Connection::open(&mini).unwrap();
        c.execute_batch("CREATE TABLE local_runtime_sessions(session_id TEXT,project_workspace_dir TEXT,workspace_dir TEXT,title TEXT,record_json TEXT,parent_session_id TEXT,updated_at_ms INT);CREATE TABLE local_runtime_message_rows(session_id TEXT,data_json TEXT,created_at_ms INT,id TEXT);").unwrap();
        c.execute(
            "INSERT INTO local_runtime_sessions VALUES('s','/repo',NULL,'Demo','{}',NULL,1)",
            [],
        )
        .unwrap();
        c.execute(
            "INSERT INTO local_runtime_message_rows VALUES('s',?1,1,'u')",
            [r#"{"role":"user","content":[{"type":"text","text":"hello"}]}"#],
        )
        .unwrap();
        c.execute(
            "INSERT INTO local_runtime_message_rows VALUES('s',?1,2,'system')",
            [r#"{"role":"system","content":"private"}"#],
        )
        .unwrap();
        drop(c);
        let before = fs::read(&mini).unwrap();
        let imported = minimax(&mini);
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].blocks[0]["text"], "hello");
        assert_eq!(fs::read(&mini).unwrap(), before);
        let cursor_db = root.join("cursor.db");
        let c = Connection::open(&cursor_db).unwrap();
        c.execute_batch("CREATE TABLE cursorDiskKV(key TEXT,value TEXT);")
            .unwrap();
        let repo = url::Url::from_directory_path(&root).unwrap().to_string();
        c.execute("INSERT INTO cursorDiskKV VALUES('composerData:demo',?1)",[json!({"name":"Cursor demo","workspaceUris":[repo],"fullConversationHeadersOnly":[{"bubbleId":"u","type":1},{"bubbleId":"a","type":2}]}).to_string()]).unwrap();
        c.execute(
            "INSERT INTO cursorDiskKV VALUES('bubbleId:demo:u',?1)",
            [r#"{"type":1,"text":"question"}"#],
        )
        .unwrap();
        c.execute(
            "INSERT INTO cursorDiskKV VALUES('bubbleId:demo:a',?1)",
            [r#"{"type":2,"text":"answer","hidden":"private"}"#],
        )
        .unwrap();
        drop(c);
        let before = fs::read(&cursor_db).unwrap();
        let imported = cursor(&cursor_db, &root.join("missing"));
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].blocks.as_array().unwrap().len(), 2);
        assert!(!imported[0].blocks.to_string().contains("private"));
        assert_eq!(fs::read(&cursor_db).unwrap(), before);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn portable_history_filters_system_and_never_binds_foreign_sessions() {
        let mut blocks = vec![];
        block("system", "secret".into(), &mut blocks);
        block("tool", "secret".into(), &mut blocks);
        block("user", "hello".into(), &mut blocks);
        let s = session(
            "minimax",
            Path::new("history.sqlite"),
            "foreign",
            "/repo",
            "",
            blocks,
        )
        .unwrap();
        assert!(s.provider_session_id.is_none());
        assert_eq!(s.blocks.as_array().unwrap().len(), 1);
        assert_eq!(s.harness, "minimax");
    }
    #[test]
    fn opencode_sqlite_imports_only_visible_text() {
        let path = std::env::temp_dir().join(format!("mycode-import-{}.db", uuid::Uuid::new_v4()));
        let c = Connection::open(&path).unwrap();
        c.execute_batch("CREATE TABLE session(id TEXT,directory TEXT,title TEXT,parent_id TEXT,time_updated INT);CREATE TABLE message(id TEXT,session_id TEXT,data TEXT,time_created INT);CREATE TABLE part(id TEXT,message_id TEXT,data TEXT,time_created INT);INSERT INTO session VALUES('s','/repo','Demo',NULL,1);INSERT INTO message VALUES('m','s','{\"role\":\"user\"}',1);INSERT INTO part VALUES('p','m','{\"type\":\"text\",\"text\":\"hello\"}',1);INSERT INTO part VALUES('q','m','{\"type\":\"tool\",\"input\":\"secret\"}',2);").unwrap();
        drop(c);
        let imported = opencode(&path);
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].blocks.as_array().unwrap().len(), 1);
        fs::remove_file(path).unwrap();
    }
}
