use base64::Engine;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    time::Duration,
};
use tauri::{AppHandle, Manager};

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct VoiceConfig {
    pub endpoint: String,
    pub model: String,
    pub protocol: String,
    pub commands: bool,
    pub has_key: bool,
    #[serde(skip_serializing_if = "String::is_empty")]
    secret: String,
}
fn path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root.join("voice.json"))
}
fn load(app: &AppHandle) -> Result<VoiceConfig, String> {
    match fs::read(path(app)?) {
        Ok(data) => serde_json::from_slice(&data).map_err(|_| "Invalid voice configuration".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(VoiceConfig::default()),
        Err(e) => Err(e.to_string()),
    }
}
fn validate(config: &VoiceConfig) -> Result<(), String> {
    if !matches!(config.protocol.as_str(), "" | "transcription" | "mimo") {
        return Err("Unknown speech protocol".into());
    }
    let url = url::Url::parse(&config.endpoint).map_err(|_| "Invalid speech endpoint")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if (url.scheme() != "https" && !(local && url.scheme() == "http"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Use HTTPS, or HTTP for a local model".into());
    }
    if config.model.trim().is_empty()
        || config.model.len() > 200
        || config.model.chars().any(char::is_control)
    {
        return Err("Enter a speech model ID".into());
    }
    Ok(())
}
#[tauri::command]
pub fn voice_config(app: AppHandle) -> Result<VoiceConfig, String> {
    let mut config = load(&app)?;
    config.has_key = !config.secret.is_empty();
    config.secret.clear();
    Ok(config)
}
#[tauri::command]
pub fn voice_save(
    app: AppHandle,
    mut config: VoiceConfig,
    api_key: Option<String>,
) -> Result<(), String> {
    validate(&config)?;
    let old = load(&app)?;
    config.secret = match api_key {
        Some(key) if !key.is_empty() => crate::local_ai::protect(&key, false)?,
        Some(_) => String::new(),
        None if old.endpoint == config.endpoint => old.secret,
        None => String::new(),
    };
    let target = path(&app)?;
    let temporary = target.with_extension("pending.json");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options
        .open(&temporary)
        .and_then(|mut file| file.write_all(&serde_json::to_vec(&config)?))
        .map_err(|e| e.to_string())?;
    fs::rename(temporary, target).map_err(|e| e.to_string())
}
#[tauri::command(async)]
pub fn voice_transcribe(app: AppHandle, audio: Vec<u8>) -> Result<String, String> {
    transcribe(&load(&app)?, audio)
}
fn transcribe(config: &VoiceConfig, audio: Vec<u8>) -> Result<String, String> {
    if audio.len() < 44
        || audio.len() > 24 * 1024 * 1024
        || &audio[..4] != b"RIFF"
        || &audio[8..12] != b"WAVE"
    {
        return Err("Invalid or oversized recording".into());
    }
    validate(config)?;
    let boundary = format!("mycode-{}", uuid::Uuid::new_v4());
    let (body, content_type) = speech_request(config, &audio, &boundary)?;
    let mut builder = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(90))
        .redirects(0);
    let endpoint = url::Url::parse(&config.endpoint).map_err(|_| "Invalid speech endpoint")?;
    if !matches!(
        endpoint.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]")
    ) {
        if let Some(proxy) =
            crate::managed_cli::system_proxy().and_then(|p| ureq::Proxy::new(p).ok())
        {
            builder = builder.proxy(proxy);
        }
    }
    let agent = builder.build();
    let mut request = agent
        .post(&config.endpoint)
        .set("Content-Type", &content_type);
    if !config.secret.is_empty() {
        request = request.set(
            "Authorization",
            &format!("Bearer {}", crate::local_ai::protect(&config.secret, true)?),
        );
    }
    let response = request.send_bytes(&body).map_err(|e| match e {
        ureq::Error::Status(code, _) => format!("Speech service returned HTTP {code}"),
        _ => "Could not connect to speech service".into(),
    })?;
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read speech response")?;
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid speech response")?;
    let text = if config.protocol == "mimo" {
        &value["choices"][0]["message"]["content"]
    } else {
        &value["text"]
    };
    text.as_str()
        .map(str::to_owned)
        .ok_or("Speech response has no text".into())
}

fn speech_request(
    config: &VoiceConfig,
    audio: &[u8],
    boundary: &str,
) -> Result<(Vec<u8>, String), String> {
    if config.protocol == "mimo" {
        let encoded = base64::engine::general_purpose::STANDARD.encode(audio);
        if encoded.len() > 10 * 1024 * 1024 {
            return Err("Recording exceeds the MiMo audio limit".into());
        }
        let body = serde_json::json!({"model":config.model,"stream":false,"messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":format!("data:audio/wav;base64,{encoded}")}}]}],"asr_options":{"language":"auto"}});
        Ok((
            serde_json::to_vec(&body).map_err(|e| e.to_string())?,
            "application/json".into(),
        ))
    } else {
        let mut body = format!("--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{}\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"speech.wav\"\r\nContent-Type: audio/wav\r\n\r\n", config.model).into_bytes();
        body.extend_from_slice(audio);
        body.extend(format!("\r\n--{boundary}--\r\n").as_bytes());
        Ok((body, format!("multipart/form-data; boundary={boundary}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mimo_uses_audio_chat_protocol() {
        let config = VoiceConfig {
            model: "mimo-v2.5-asr".into(),
            protocol: "mimo".into(),
            ..Default::default()
        };
        let (bytes, kind) = speech_request(&config, b"RIFF", "ignored").unwrap();
        let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(kind, "application/json");
        assert_eq!(
            value["messages"][0]["content"][0]["input_audio"]["data"],
            "data:audio/wav;base64,UklGRg=="
        );
        assert_eq!(value["model"], "mimo-v2.5-asr");
    }
    #[test]
    fn speech_service_receives_wav_and_returns_transcription() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!(
            "http://{}/v1/audio/transcriptions",
            listener.local_addr().unwrap()
        );
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            let mut chunk = [0; 4096];
            loop {
                let count = socket.read(&mut chunk).unwrap();
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..count]);
                if let Some(end) = request.windows(4).position(|s| s == b"\r\n\r\n") {
                    let header = String::from_utf8_lossy(&request[..end]).to_lowercase();
                    let length: usize = header
                        .lines()
                        .find_map(|line| {
                            line.strip_prefix("content-length:")
                                .and_then(|n| n.trim().parse().ok())
                        })
                        .unwrap();
                    if request.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let text = String::from_utf8_lossy(&request);
            assert!(text.contains("audio/wav"));
            assert!(text.contains("qa-speech-model"));
            assert!(request.windows(4).any(|s| s == b"RIFF"));
            let body = r#"{"text":"recognized speech"}"#;
            write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        });
        let mut audio = vec![0; 46];
        audio[..4].copy_from_slice(b"RIFF");
        audio[8..12].copy_from_slice(b"WAVE");
        let config = VoiceConfig {
            endpoint,
            model: "qa-speech-model".into(),
            ..Default::default()
        };
        assert_eq!(transcribe(&config, audio).unwrap(), "recognized speech");
        server.join().unwrap();
    }
    #[test]
    fn rejects_plaintext_remote_endpoints_and_non_audio() {
        let config = VoiceConfig {
            endpoint: "http://example.com/transcribe".into(),
            model: "model".into(),
            ..Default::default()
        };
        assert!(validate(&config).is_err());
        assert!(transcribe(&config, vec![0; 44]).is_err());
    }
}
