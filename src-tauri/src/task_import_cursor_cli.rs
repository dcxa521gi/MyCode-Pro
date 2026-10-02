//! Read-only Cursor CLI history. Follow ordered content hashes, never scan unordered secret blobs.
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

fn decode_hex(value: &str) -> Option<Vec<u8>> {
    if value.len() > 40 * 1024 * 1024 || !value.len().is_multiple_of(2) {
        return None;
    }
    value
        .as_bytes()
        .as_chunks::<2>()
        .0
        .iter()
        .map(|pair| {
            Some((((pair[0] as char).to_digit(16)? << 4) | (pair[1] as char).to_digit(16)?) as u8)
        })
        .collect()
}
fn varint(data: &[u8], index: &mut usize) -> Option<u64> {
    let mut value = 0;
    for shift in (0..64).step_by(7) {
        let byte = *data.get(*index)?;
        *index += 1;
        if shift == 63 && byte > 1 {
            return None;
        }
        value |= u64::from(byte & 127) << shift;
        if byte < 128 {
            return Some(value);
        }
    }
    None
}
fn fields(data: &[u8]) -> Option<Vec<(u32, &[u8])>> {
    let mut index = 0;
    let mut result = vec![];
    while index < data.len() && result.len() < 10_000 {
        let key = varint(data, &mut index)?;
        let number = u32::try_from(key >> 3).ok()?;
        if number == 0 {
            return None;
        }
        let length = match key & 7 {
            0 => {
                varint(data, &mut index)?;
                continue;
            }
            1 => 8,
            2 => usize::try_from(varint(data, &mut index)?).ok()?,
            5 => 4,
            _ => return None,
        };
        let end = index.checked_add(length)?;
        let value = data.get(index..end)?;
        if key & 7 == 2 {
            result.push((number, value));
        }
        index = end;
    }
    if index != data.len() {
        return None;
    }
    Some(result)
}
fn blob(conn: &Connection, id: &str) -> Option<Vec<u8>> {
    if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let data = conn
        .query_row(
            "SELECT data FROM blobs WHERE id=?1 AND length(data)<=20971520",
            [id],
            |r| r.get::<_, Vec<u8>>(0),
        )
        .ok()?;
    (format!("{:x}", Sha256::digest(&data)) == id).then_some(data)
}
pub fn read(path: &Path) -> Option<(String, String, String, Vec<Value>)> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    conn.busy_timeout(std::time::Duration::from_secs(2)).ok()?;
    let sidecar_path = path.parent()?.join("meta.json");
    if fs::metadata(&sidecar_path).ok()?.len() > 1024 * 1024 {
        return None;
    }
    let sidecar: Value = serde_json::from_slice(&fs::read(sidecar_path).ok()?).ok()?;
    if sidecar["isSubagent"] == true || sidecar["hasConversation"] == false {
        return None;
    }
    let cwd = sidecar["cwd"].as_str()?.to_owned();
    let raw = conn
        .query_row(
            "SELECT value FROM meta WHERE key='0' AND length(value)<=41943040",
            [],
            |r| r.get::<_, String>(0),
        )
        .ok()?;
    let meta: Value = serde_json::from_slice(&decode_hex(&raw)?).ok()?;
    let root = blob(&conn, meta["latestRootBlobId"].as_str()?)?;
    let root = fields(&root)?;
    let mut blocks = vec![];
    let mut bytes = 0;
    for (field, reference) in root {
        if blocks.len() >= 2000 || bytes >= 20 * 1024 * 1024 {
            break;
        }
        if field != 1 || reference.len() != 32 {
            continue;
        }
        let id = reference
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>();
        let Some(data) = blob(&conn, &id) else {
            continue;
        };
        let Ok(value) = serde_json::from_slice::<Value>(&data) else {
            continue;
        };
        let role = value["role"].as_str().unwrap_or("");
        if !matches!(role, "user" | "assistant") {
            continue;
        }
        let text = if let Some(text) = value["content"].as_str() {
            text.to_owned()
        } else {
            value["content"]
                .as_array()
                .map(|parts| {
                    parts
                        .iter()
                        .filter(|p| p["type"] == "text")
                        .filter_map(|p| p["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default()
        };
        // Cursor injects environment context as user messages; retain only explicit user queries.
        let text = if role == "user" {
            let Some((_, tail)) = text.split_once("<user_query>") else {
                continue;
            };
            let Some((query, _)) = tail.split_once("</user_query>") else {
                continue;
            };
            query.to_owned()
        } else {
            text
        };
        if text.trim().is_empty() || bytes + text.len() > 20 * 1024 * 1024 {
            continue;
        }
        bytes += text.len();
        blocks.push(json!({"role":role,"text":text}));
    }
    let id = path.parent()?.file_name()?.to_string_lossy().into_owned();
    let title = sidecar["title"]
        .as_str()
        .or(meta["name"].as_str())
        .unwrap_or("")
        .to_owned();
    (!blocks.is_empty()).then_some((id, cwd, title, blocks))
}
pub fn paths(home: &Path) -> Vec<PathBuf> {
    fn walk(root: &Path, depth: usize, result: &mut Vec<PathBuf>) {
        if depth == 0 || result.len() >= 3000 {
            return;
        }
        let Ok(entries) = fs::read_dir(root) else {
            return;
        };
        for entry in entries.flatten() {
            if result.len() >= 3000 {
                break;
            }
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                walk(&entry.path(), depth - 1, result);
            } else if entry.file_name() == "store.db" {
                result.push(entry.path());
            }
        }
    }
    let mut roots = vec![home.join(".cursor"), home.join(".config/cursor")];
    if let Some(root) = std::env::var_os("CURSOR_CONFIG_DIR") {
        roots.push(root.into());
    }
    if let Some(root) = std::env::var_os("XDG_CONFIG_HOME") {
        roots.push(PathBuf::from(root).join("cursor"));
    }
    let mut visited = HashSet::new();
    let mut result = vec![];
    for root in roots {
        if visited.insert(root.clone()) {
            walk(&root.join("chats"), 3, &mut result);
            walk(&root.join("acp-sessions"), 2, &mut result);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ordered_cursor_cli_blobs_exclude_reasoning_and_leave_database_unchanged() {
        let root = std::env::temp_dir().join(format!("mycode-cursor-cli-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("store.db");
        fs::write(
            root.join("meta.json"),
            r#"{"cwd":"/repo","title":"CLI task","hasConversation":true}"#,
        )
        .unwrap();
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch("CREATE TABLE blobs(id TEXT PRIMARY KEY,data BLOB);CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);").unwrap();
        let mut root_blob = vec![];
        for data in [
            r#"{"role":"user","content":"<user_info>private</user_info><user_query>question</user_query>"}"#,
            r#"{"role":"assistant","content":[{"type":"reasoning","text":"private"},{"type":"text","text":"answer"}]}"#,
        ] {
            let hash = Sha256::digest(data.as_bytes());
            let id = format!("{hash:x}");
            conn.execute(
                "INSERT INTO blobs VALUES(?1,?2)",
                rusqlite::params![id, data.as_bytes()],
            )
            .unwrap();
            root_blob.extend([10, 32]);
            root_blob.extend_from_slice(&hash);
        }
        let id = format!("{:x}", Sha256::digest(&root_blob));
        conn.execute(
            "INSERT INTO blobs VALUES(?1,?2)",
            rusqlite::params![id, root_blob],
        )
        .unwrap();
        let meta = json!({"latestRootBlobId":id}).to_string();
        let encoded = meta
            .as_bytes()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>();
        conn.execute("INSERT INTO meta VALUES('0',?1)", [encoded])
            .unwrap();
        drop(conn);
        let before = fs::read(&path).unwrap();
        let (_, cwd, _, blocks) = read(&path).unwrap();
        assert_eq!(cwd, "/repo");
        assert_eq!(blocks[0]["text"], "question");
        assert_eq!(blocks[1]["text"], "answer");
        assert!(!json!(blocks).to_string().contains("private"));
        assert_eq!(fs::read(&path).unwrap(), before);
        assert!(fields(&[10, 255]).is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
