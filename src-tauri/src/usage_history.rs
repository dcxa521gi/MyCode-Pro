use crate::session_store::SessionStore;
use serde::Serialize;
use serde_json::Value;
use tauri::State;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageRow {
    session_id: String,
    title: String,
    harness: String,
    model: String,
    connection_id: String,
    cwd: String,
    updated_at: i64,
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_write_tokens: u64,
    cache_eligible_tokens: f64,
    cache_measured_read_tokens: u64,
    measured_turns: usize,
    turns: usize,
}

#[tauri::command(async)]
pub fn usage_history(store: State<'_, SessionStore>) -> Result<Vec<UsageRow>, String> {
    read_history(&store, false)
}

#[tauri::command(async)]
pub fn usage_history_turns(store: State<'_, SessionStore>) -> Result<Vec<UsageRow>, String> {
    read_history(&store, true)
}

fn read_history(store: &SessionStore, per_turn: bool) -> Result<Vec<UsageRow>, String> {
    let conn = store.lock_conn()?;
    let mut stmt = conn.prepare("SELECT id,title,harness,model,cwd,updated_at,blocks_json FROM sessions ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        let (session_id, title, harness, model, cwd, updated_at, blocks) =
            row.map_err(|e| e.to_string())?;
        let base = UsageRow {
            session_id,
            title,
            harness,
            model,
            connection_id: String::new(),
            cwd,
            updated_at,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            cache_eligible_tokens: 0.0,
            cache_measured_read_tokens: 0,
            measured_turns: 0,
            turns: 0,
        };
        let blocks: Vec<Value> = serde_json::from_str(&blocks).unwrap_or_default();
        if per_turn {
            for block in &blocks {
                let mut turn = base.clone();
                turn.updated_at = usage_date(block);
                result.extend(group_usage(&turn, std::slice::from_ref(block)));
            }
        } else {
            result.extend(group_usage(&base, &blocks));
        }
    }
    Ok(result)
}

// Historical turns have no report timestamp. Use their completion date when
// available, never the session update time (renames and unrelated turns alter it).
fn usage_date(block: &Value) -> i64 {
    if let Some(at) = block["turnMetricsAt"].as_i64().filter(|at| *at > 0) {
        return at;
    }
    let start = block["startedAt"].as_i64().unwrap_or(0);
    if start <= 0 {
        return 0;
    }
    start.saturating_add(block["durationMs"].as_i64().unwrap_or(0).max(0))
}

fn group_usage(base: &UsageRow, blocks: &[Value]) -> Vec<UsageRow> {
    let mut grouped = std::collections::BTreeMap::<(String, String, String), UsageRow>::new();
    for block in blocks.iter().filter(|b| {
        b.get("role").and_then(Value::as_str) == Some("user")
            && b.get("draft") != Some(&Value::Bool(true))
    }) {
        let harness = block["turnModel"]["harness"]
            .as_str()
            .unwrap_or(&base.harness)
            .to_string();
        let model = block["turnModel"]["name"]
            .as_str()
            .unwrap_or(&base.model)
            .to_string();
        let connection_id = block["turnModel"]["id"]
            .as_str()
            .and_then(|id| id.split_once(":mycode-").map(|(_, rest)| rest))
            .and_then(|rest| rest.split_once('/').map(|(id, _)| id))
            .unwrap_or("")
            .to_string();
        let usage = grouped
            .entry((harness.clone(), model.clone(), connection_id.clone()))
            .or_insert_with(|| UsageRow {
                harness,
                model,
                connection_id,
                ..base.clone()
            });
        usage.turns += 1;
        if let Some(metrics) = block.get("turnMetrics").and_then(Value::as_object) {
            let read = metrics
                .get("cacheReadTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let percent = metrics.get("cacheHitPercent").and_then(Value::as_f64);
            if percent.is_some() || metrics.contains_key("cacheReadTokens") {
                let input = metrics
                    .get("inputTokens")
                    .and_then(Value::as_u64)
                    .unwrap_or(0);
                let write = metrics
                    .get("cacheWriteTokens")
                    .and_then(Value::as_u64)
                    .unwrap_or(0);
                let denominator = match percent {
                    Some(p) if p > 0.0 && p <= 100.0 && read > 0 => read as f64 * 100.0 / p,
                    _ if usage.harness == "codex" => input as f64,
                    _ => (input + read + write) as f64,
                };
                if denominator > 0.0 {
                    usage.cache_eligible_tokens += denominator;
                    usage.cache_measured_read_tokens += read;
                }
            }
            if [
                "inputTokens",
                "outputTokens",
                "cacheReadTokens",
                "cacheWriteTokens",
            ]
            .iter()
            .any(|key| metrics.get(*key).and_then(Value::as_u64).is_some())
            {
                usage.measured_turns += 1;
            }
            usage.input_tokens += metrics
                .get("inputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            usage.output_tokens += metrics
                .get("outputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            usage.cache_read_tokens += metrics
                .get("cacheReadTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            usage.cache_write_tokens += metrics
                .get("cacheWriteTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
        }
    }
    grouped.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn cross_day_usage_uses_report_or_completion_without_inventing_dates() {
        let start = 1_790_783_940_000_i64;
        assert_eq!(
            usage_date(&json!({"startedAt": start, "durationMs":120_000})),
            start + 120_000
        );
        assert_eq!(
            usage_date(
                &json!({"startedAt": start, "durationMs":120_000,"turnMetricsAt":start+90_000})
            ),
            start + 90_000
        );
        assert_eq!(usage_date(&json!({"durationMs":120_000})), 0);
        assert_eq!(
            usage_date(&json!({"startedAt":start,"durationMs":-100})),
            start
        );
    }
    #[test]
    fn attributes_each_turn_and_excludes_drafts_and_assistant_metrics() {
        let base = UsageRow {
            session_id: "s".into(),
            title: "task".into(),
            harness: "codex".into(),
            model: "fallback".into(),
            connection_id: String::new(),
            cwd: "/repo".into(),
            updated_at: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            cache_eligible_tokens: 0.0,
            cache_measured_read_tokens: 0,
            measured_turns: 0,
            turns: 0,
        };
        let blocks = vec![
            json!({"role":"user","turnModel":{"harness":"claude","name":"model-a"},"turnMetrics":{"inputTokens":100,"outputTokens":20}}),
            json!({"role":"user"}),
            json!({"role":"user","draft":true,"turnMetrics":{"inputTokens":900}}),
            json!({"role":"assistant","turnMetrics":{"outputTokens":999}}),
        ];
        let rows = group_usage(&base, &blocks);
        assert_eq!(rows.len(), 2);
        let measured = rows.iter().find(|r| r.harness == "claude").unwrap();
        assert_eq!(
            (
                measured.input_tokens,
                measured.output_tokens,
                measured.measured_turns
            ),
            (100, 20, 1)
        );
        let unknown = rows.iter().find(|r| r.harness == "codex").unwrap();
        assert_eq!(
            (unknown.input_tokens, unknown.measured_turns, unknown.turns),
            (0, 0, 1)
        );
        let cache = group_usage(
            &base,
            &[
                json!({"role":"user","turnMetrics":{"inputTokens":400,"cacheReadTokens":300,"cacheHitPercent":75}}),
                json!({"role":"user","turnMetrics":{"inputTokens":600,"cacheHitPercent":0}}),
                json!({"role":"user","turnMetrics":{"inputTokens":9000}}),
            ],
        );
        assert_eq!(cache[0].cache_eligible_tokens, 1000.0);
        assert_eq!(cache[0].cache_measured_read_tokens, 300);
        let claude = group_usage(
            &base,
            &[
                json!({"role":"user","turnModel":{"harness":"claude"},"turnMetrics":{"inputTokens":2,"cacheReadTokens":300,"cacheWriteTokens":98,"cacheHitPercent":75}}),
            ],
        );
        assert_eq!(claude[0].cache_eligible_tokens, 400.0);
    }
}
