use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, io::Read, path::Path, time::Duration};
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub connection_id: String,
    pub model: String,
    pub kind: String,
    pub prompt: String,
    pub cwd: String,
    pub reference: Option<String>,
    pub job_id: String,
    pub remote_id: Option<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultView {
    pub job_id: String,
    pub status: String,
    pub paths: Vec<String>,
    pub text: String,
    pub remote_id: Option<String>,
}
fn grant_result(app: &AppHandle, dir: &Path, result: ResultView) -> Result<ResultView, String> {
    for file in &result.paths {
        let path = fs::canonicalize(file).map_err(|e| e.to_string())?;
        if !path.starts_with(dir) || !path.is_file() {
            return Err("Invalid output file / 输出文件无效".into());
        }
        app.asset_protocol_scope()
            .allow_file(path)
            .map_err(|e| e.to_string())?;
    }
    Ok(result)
}
#[tauri::command]
pub fn workbench_result(
    app: AppHandle,
    cwd: String,
    job_id: String,
) -> Result<Option<ResultView>, String> {
    if job_id.is_empty()
        || job_id.len() > 64
        || !job_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
    {
        return Err("Invalid job ID / 任务编号无效".into());
    }
    let cwd = fs::canonicalize(cwd).map_err(|e| e.to_string())?;
    let directory = cwd.join(".mycode").join("workbench").join(job_id);
    if !directory.join("result.json").is_file() {
        return Ok(None);
    }
    let directory = fs::canonicalize(directory).map_err(|e| e.to_string())?;
    if !directory.starts_with(&cwd) {
        return Err("Output folder escapes the project / 输出目录位于项目之外".into());
    }
    let result = serde_json::from_slice(
        &fs::read(directory.join("result.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    grant_result(&app, &directory, result).map(Some)
}
fn bounded(response: ureq::Response, max: u64) -> Result<Vec<u8>, String> {
    let mut data = Vec::new();
    response
        .into_reader()
        .take(max + 1)
        .read_to_end(&mut data)
        .map_err(|e| e.to_string())?;
    if data.len() as u64 > max {
        return Err("Generated file is too large / 生成文件超过大小限制".into());
    }
    Ok(data)
}
fn response_error(error: ureq::Error) -> String {
    match error {
        ureq::Error::Status(code, response) => {
            let data = bounded(response, 8192).unwrap_or_default();
            let parsed = serde_json::from_slice::<Value>(&data).unwrap_or(Value::Null);
            let message = parsed
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("Provider rejected the request / 服务商拒绝了请求");
            format!("HTTP {code}: {message}")
        }
        _ => "Could not reach the model provider / 无法连接模型服务商".into(),
    }
}
#[tauri::command(async)]
pub fn workbench_request(app: AppHandle, request: Request) -> Result<ResultView, String> {
    let (connection, key) =
        crate::local_ai::workbench_connection(&app, &request.connection_id, &request.model)?;
    let directory = Path::new(&request.cwd)
        .join(".mycode")
        .join("workbench")
        .join(&request.job_id);
    let result = execute(&connection, &key, request)?;
    grant_result(
        &app,
        &fs::canonicalize(directory).map_err(|e| e.to_string())?,
        result,
    )
}
fn execute(
    connection: &crate::local_ai::Connection,
    key: &str,
    request: Request,
) -> Result<ResultView, String> {
    if !["image", "image-edit", "video", "video-status"].contains(&request.kind.as_str())
        || request.prompt.len() > 100_000
        || !request
            .job_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
        || request.job_id.is_empty()
        || request.job_id.len() > 64
    {
        return Err("Invalid workbench request / 工作台请求无效".into());
    }
    if request.kind == "image-edit" && request.reference.as_deref().is_none_or(str::is_empty) {
        return Err("Choose a reference image / 请选择参考图片".into());
    }
    if request.kind == "image" && request.reference.is_some() {
        return Err("Use image-to-image for reference images / 使用参考图片时请选择图生图".into());
    }

    let cwd = fs::canonicalize(&request.cwd).map_err(|e| e.to_string())?;
    if !cwd.is_dir() {
        return Err("Choose an output folder / 请选择输出文件夹".into());
    }
    let mut dir = cwd.clone();
    for part in [".mycode", "workbench", &request.job_id] {
        let next = dir.join(part);
        if !next.exists() {
            fs::create_dir(&next).map_err(|e| e.to_string())?;
        }
        dir = fs::canonicalize(next).map_err(|e| e.to_string())?;
        if !dir.starts_with(&cwd) {
            return Err("Output folder escapes the project / 输出目录位于项目之外".into());
        }
    }
    let completed = dir.join("result.json");
    if dir.join("intent.json").exists() {
        let intent: Value =
            serde_json::from_slice(&fs::read(dir.join("intent.json")).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if intent["connectionId"] != request.connection_id
            || intent["model"] != request.model
            || intent["prompt"] != request.prompt
            || intent["baseUrl"] != connection.base_url
            || (request.kind != "video-status"
                && (intent["kind"] != request.kind
                    || intent["reference"] != json!(request.reference)))
        {
            return Err("Job configuration changed / 任务配置已变更，请查看原任务结果".into());
        }
        if completed.exists() {
            let saved: ResultView =
                serde_json::from_slice(&fs::read(&completed).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            if saved.status == "completed"
                || saved.status == "failed"
                || request.kind != "video-status"
            {
                return Ok(saved);
            }
            if saved.remote_id != request.remote_id {
                return Err("Video task does not match this job / 视频任务与当前记录不匹配".into());
            }
        } else if request.kind == "video-status" {
            return Err("Video task state is unavailable / 视频任务状态尚不可用".into());
        }
    } else if request.kind == "video-status" {
        return Err("Video task was not submitted here / 此目录没有该视频任务的提交记录".into());
    }
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(180))
        .redirects(0)
        .build();
    let base = connection.base_url.trim_end_matches('/');
    let mut payload = json!({"model": request.model, "prompt": request.prompt});
    let endpoint = match request.kind.as_str() {
        "image" => {
            payload["n"] = json!(1);
            format!("{base}/images/generations")
        }
        "image-edit" => format!("{base}/images/edits"),
        "video" => format!("{base}/videos"),
        _ => {
            let id = request
                .remote_id
                .as_deref()
                .ok_or("Missing video task ID / 缺少视频任务编号")?;
            if id.is_empty() || id.len() > 500 || id.chars().any(char::is_control) {
                return Err("Invalid video task ID / 视频任务编号无效".into());
            }
            let mut url = url::Url::parse(&format!("{base}/videos/")).map_err(|e| e.to_string())?;
            url.path_segments_mut()
                .map_err(|_| "Invalid video URL")?
                .pop_if_empty()
                .push(id);
            url.to_string()
        }
    };
    let mut http = if request.kind == "video-status" {
        agent.get(&endpoint)
    } else {
        agent.post(&endpoint)
    };
    http = http.set("Authorization", &format!("Bearer {key}"));
    if crate::tokendance::is_endpoint(base) {
        http = http.set("X-App-URL", crate::tokendance::APP_URL);
    }
    // Persist an intent before a billable call. A crash never silently resubmits it.
    if request.kind != "video-status" {
        let intent = dir.join("intent.json");
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(intent)
            .map_err(|_| "Job already submitted; check its status / 任务已提交，请检查状态")?;
        file.write_all(serde_json::to_string(&json!({"connectionId":request.connection_id,"model":request.model,"kind":request.kind,"prompt":request.prompt,"reference":request.reference,"baseUrl":connection.base_url})).map_err(|e| e.to_string())?.as_bytes()).map_err(|e| e.to_string())?;
    }
    let response = if request.kind == "video-status" { http.call() } else if let Some(reference) = &request.reference {
        let path = Path::new(reference);
        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let mime = match extension.as_str() { "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "webp" => "image/webp", _ => return Err("Use PNG, JPEG or WebP references / 参考图请使用 PNG、JPEG 或 WebP".into()) };
        if fs::metadata(path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 { return Err("Reference image exceeds 20 MB / 参考图不能超过 20 MB".into()); }
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let boundary = format!("mycode-{}", request.job_id);
        let mut body = Vec::new();
        for (name, value) in [("model", request.model.as_str()), ("prompt", request.prompt.as_str())] {
            body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n").as_bytes());
        }
        let field = if request.kind == "video" { "input_reference" } else { "image" };
        body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"reference.{extension}\"\r\nContent-Type: {mime}\r\n\r\n").as_bytes());
        body.extend_from_slice(&bytes); body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        http.set("Content-Type", &format!("multipart/form-data; boundary={boundary}")).send_bytes(&body)
    } else { http.set("Content-Type", "application/json").send_string(&payload.to_string()) }.map_err(response_error)?;
    let raw = bounded(response, 64 * 1024 * 1024)?;
    let value: Value = serde_json::from_slice(&raw)
        .map_err(|_| "Invalid provider response / 服务商返回的数据格式无效")?;
    fs::write(dir.join("response.json"), &raw).map_err(|e| e.to_string())?;
    let mut result = ResultView {
        job_id: request.job_id,
        status: "completed".into(),
        paths: vec![],
        text: String::new(),
        remote_id: None,
    };
    if request.kind.starts_with("video") {
        result.remote_id = value
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .or(request.remote_id);
        result.status = value
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("queued")
            .into();
        if result.status == "failed" {
            result.text = value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("Video generation failed / 视频生成失败")
                .into();
        }
        if result.status == "completed" {
            let id = result.remote_id.as_deref().ok_or("Missing video task ID")?;
            let mut url = url::Url::parse(&format!("{base}/videos/")).map_err(|e| e.to_string())?;
            url.path_segments_mut()
                .map_err(|_| "Invalid video URL")?
                .pop_if_empty()
                .push(id)
                .push("content");
            let response = agent
                .get(url.as_str())
                .set("Authorization", &format!("Bearer {key}"))
                .call()
                .map_err(response_error)?;
            let path = dir.join("video.mp4");
            let pending = dir.join("video.download");
            let mut output = fs::File::create(&pending).map_err(|e| e.to_string())?;
            let size = std::io::copy(
                &mut response.into_reader().take(512 * 1024 * 1024 + 1),
                &mut output,
            )
            .map_err(|e| e.to_string())?;
            drop(output);
            if size > 512 * 1024 * 1024 {
                let _ = fs::remove_file(&pending);
                return Err("Generated file is too large / 生成文件超过大小限制".into());
            }
            fs::rename(pending, &path).map_err(|e| e.to_string())?;
            result.paths.push(path.to_string_lossy().into());
        }
    } else if let Some(images) = value.get("data").and_then(Value::as_array) {
        for (index, image) in images.iter().take(8).enumerate() {
            let bytes = if let Some(encoded) = image.get("b64_json").and_then(Value::as_str) {
                base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|_| "Invalid generated image / 生成图片无效")?
            } else if let Some(source) = image.get("url").and_then(Value::as_str) {
                let url = url::Url::parse(source).map_err(|_| "Invalid generated image URL")?;
                let origin = url::Url::parse(base).map_err(|_| "Invalid provider URL")?;
                let same = url.origin() == origin.origin();
                if !same && url.scheme() != "https" {
                    return Err("Image download requires HTTPS / 图片下载需要 HTTPS".into());
                }
                let fetch = agent.get(url.as_str());
                bounded(
                    if same {
                        fetch.set("Authorization", &format!("Bearer {key}"))
                    } else {
                        fetch
                    }
                    .call()
                    .map_err(response_error)?,
                    64 * 1024 * 1024,
                )?
            } else {
                continue;
            };
            let extension = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                "png"
            } else if bytes.starts_with(b"\xff\xd8\xff") {
                "jpg"
            } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
                "webp"
            } else {
                return Err(
                    "Provider returned an unsupported image file / 服务商返回的图片格式不受支持"
                        .into(),
                );
            };
            let path = dir.join(format!("image-{}.{}", index + 1, extension));
            fs::write(&path, bytes).map_err(|e| e.to_string())?;
            result.paths.push(path.to_string_lossy().into());
        }
        if result.paths.is_empty() {
            return Err("Provider returned no generated image / 服务商未返回生成图片".into());
        }
    } else {
        return Err("Provider does not support this media API / 服务商未提供此媒体接口".into());
    }
    fs::write(
        completed,
        serde_json::to_vec_pretty(&result).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufRead, BufReader, Write},
        net::TcpListener,
        thread,
    };
    struct Folder(std::path::PathBuf);
    impl Folder {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("mycode-media-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Folder {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn request(folder: &Folder, kind: &str, remote: Option<&str>) -> Request {
        Request {
            connection_id: "fixture".into(),
            model: "vendor/model".into(),
            kind: kind.into(),
            prompt: "a test".into(),
            cwd: folder.0.to_string_lossy().into(),
            reference: None,
            job_id: "job-1".into(),
            remote_id: remote.map(str::to_owned),
        }
    }
    fn server(
        responses: Vec<(&'static str, Vec<u8>)>,
    ) -> (crate::local_ai::Connection, thread::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        let worker = thread::spawn(move || {
            let mut requests = Vec::new();
            for (mime, response) in responses {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut reader = BufReader::new(socket.try_clone().unwrap());
                let mut headers = String::new();
                let mut length = 0;
                loop {
                    let mut line = String::new();
                    reader.read_line(&mut line).unwrap();
                    if line == "\r\n" || line.is_empty() {
                        break;
                    }
                    if let Some(value) = line.to_lowercase().strip_prefix("content-length:") {
                        length = value.trim().parse().unwrap();
                    }
                    headers.push_str(&line);
                }
                let mut body = vec![0; length];
                reader.read_exact(&mut body).unwrap();
                assert!(headers
                    .to_lowercase()
                    .contains("authorization: bearer fixture-key"));
                requests.push(format!("{headers}{}", String::from_utf8_lossy(&body)));
                write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", response.len()).unwrap();
                socket.write_all(&response).unwrap();
            }
            requests
        });
        let mut connection = crate::local_ai::Connection::default();
        connection.base_url = base;
        (connection, worker)
    }
    #[test]
    fn image_is_saved_under_project_and_retry_does_not_generate_twice() {
        let folder = Folder::new();
        let bytes = b"\x89PNG\r\n\x1a\nfixture";
        let body =
            json!({"data":[{"b64_json":base64::engine::general_purpose::STANDARD.encode(bytes)}]})
                .to_string()
                .into_bytes();
        let (connection, worker) = server(vec![("application/json", body)]);
        let first = execute(&connection, "fixture-key", request(&folder, "image", None)).unwrap();
        let messages = worker.join().unwrap();
        assert!(messages[0].starts_with("POST /v1/images/generations"));
        assert!(messages[0].contains("vendor/model"));
        assert_eq!(fs::read(&first.paths[0]).unwrap(), bytes);
        assert_eq!(
            execute(&connection, "fixture-key", request(&folder, "image", None))
                .unwrap()
                .paths,
            first.paths
        );
        let mut different = request(&folder, "image", None);
        different.prompt = "changed".into();
        assert!(execute(&connection, "fixture-key", different).is_err());
    }
    #[test]
    fn video_poll_is_bound_to_original_job_and_downloads_without_resubmitting() {
        let folder = Folder::new();
        let (connection, worker) = server(vec![
            (
                "application/json",
                br#"{"id":"video-1","status":"queued"}"#.to_vec(),
            ),
            (
                "application/json",
                br#"{"id":"video-1","status":"completed"}"#.to_vec(),
            ),
            ("video/mp4", b"video-content".to_vec()),
        ]);
        assert_eq!(
            execute(&connection, "fixture-key", request(&folder, "video", None))
                .unwrap()
                .remote_id
                .as_deref(),
            Some("video-1")
        );
        assert!(execute(
            &connection,
            "fixture-key",
            request(&folder, "video-status", Some("other"))
        )
        .is_err());
        let result = execute(
            &connection,
            "fixture-key",
            request(&folder, "video-status", Some("video-1")),
        )
        .unwrap();
        assert_eq!(result.status, "completed");
        assert_eq!(fs::read(&result.paths[0]).unwrap(), b"video-content");
        let messages = worker.join().unwrap();
        assert_eq!(messages.iter().filter(|m| m.starts_with("POST")).count(), 1);
        assert!(messages[2].starts_with("GET /v1/videos/video-1/content"));
    }
    #[test]
    fn missing_reference_and_directory_traversal_fail_before_submitting() {
        let folder = Folder::new();
        let connection = crate::local_ai::Connection::default();
        assert!(execute(&connection, "", request(&folder, "image-edit", None)).is_err());
        let mut invalid = request(&folder, "image", None);
        invalid.job_id = "../escape".into();
        assert!(execute(&connection, "", invalid).is_err());
        assert!(!folder.0.join(".mycode").exists());
    }
}
