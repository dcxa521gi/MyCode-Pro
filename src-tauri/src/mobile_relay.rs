use super::*;
use crate::mobile_crypto;

fn endpoint(text: &str) -> Result<String, String> {
    let url = url::Url::parse(text.trim()).map_err(|_| "Invalid relay address")?;
    if url.scheme() != "https"
        && !(url.scheme() == "http"
            && matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1")))
    {
        return Err("Remote relay requires HTTPS".into());
    }
    if url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return Err("Use the relay origin address, without a path or credentials".into());
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}
pub(super) fn start(
    app: AppHandle,
    label: String,
    state: Arc<Mutex<Inner>>,
    text: &str,
    registration_key: &str,
) -> Result<Value, String> {
    let base = endpoint(text)?;
    if registration_key.len() > 512 || registration_key.chars().any(char::is_control) {
        return Err("Invalid relay registration key".into());
    }
    let host_key = secret();
    let transport_key = secret();
    let pairing = secret();
    let client = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(30))
        .redirects(0)
        .build();
    let mut create = client
        .post(&format!("{base}/v1/rooms"))
        .set("Content-Type", "application/json");
    if !registration_key.is_empty() {
        create = create.set("Authorization", &format!("Bearer {registration_key}"))
    }
    let response = create
        .send_string(&json!({"hostKey":host_key}).to_string())
        .map_err(|_| {
            "Could not register remote relay. Check HTTPS address and registration key."
        })?;
    let registered: Value = serde_json::from_reader(response.into_reader().take(4096))
        .map_err(|_| "Invalid relay response")?;
    let room = registered["room"]
        .as_str()
        .filter(|v| uuid::Uuid::parse_str(v).is_ok())
        .ok_or("Invalid relay room")?
        .to_string();
    let info = json!({"mode":"relay","url":format!("{base}/v1/rooms/{room}/request"),"room":room,"transportKey":transport_key,"pairing":pairing,"expiresIn":600});
    let generation = {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.enabled = true;
        s.generation += 1;
        s.pairing = pairing;
        s.expires = Some(Instant::now() + Duration::from_secs(600));
        s.window = label;
        s.devices.clear();
        s.receipts.clear();
        s.pending.clear();
        s.pairing_info = Some(info.clone());
        s.relay_status = "connected".into();
        s.generation
    };
    std::thread::spawn(move || {
        let current = || {
            state
                .lock()
                .is_ok_and(|s| s.enabled && s.generation == generation)
        };
        let status = |text: &str| {
            if let Ok(mut s) = state.lock() {
                if s.generation == generation {
                    s.relay_status = text.into()
                }
            }
        };
        while current() {
            let request = client
                .get(&format!("{base}/v1/rooms/{room}/poll"))
                .set("Authorization", &format!("Bearer {host_key}"));
            let jobs = match request.call() {
                Ok(response) => {
                    serde_json::from_reader::<_, Value>(response.into_reader().take(512 * 1024))
                        .ok()
                        .and_then(|v| v["jobs"].as_array().cloned())
                }
                Err(ureq::Error::Status(410, _)) => {
                    status("expired");
                    break;
                }
                Err(_) => None,
            };
            if !current() {
                break;
            }
            let Some(jobs) = jobs else {
                status("reconnecting");
                std::thread::sleep(Duration::from_secs(2));
                continue;
            };
            status("connected");
            std::thread::scope(|scope| {
                for job in jobs.into_iter().take(4) {
                    let app = &app;
                    let state = &state;
                    let client = &client;
                    let base = &base;
                    let room = &room;
                    let transport_key = &transport_key;
                    let host_key = &host_key;
                    scope.spawn(move || {
                        let Some(id) = job["id"]
                            .as_str()
                            .filter(|v| uuid::Uuid::parse_str(v).is_ok())
                        else {
                            return;
                        };
                        let nonce = job["envelope"]["nonce"].as_str().unwrap_or("");
                        let result = mobile_crypto::open(
                            transport_key,
                            &job["envelope"],
                            &format!("mycode:request:{room}"),
                        )
                        .and_then(|value| dispatch(value, app, state, generation));
                        let body = wrap_response(result);
                        let Ok(mut sealed) = mobile_crypto::seal(
                            transport_key,
                            &body,
                            &format!("mycode:response:{room}:{nonce}"),
                        ) else {
                            return;
                        };
                        sealed["requestNonce"] = json!(nonce);
                        let _ = client
                            .post(&format!("{base}/v1/rooms/{room}/answer"))
                            .set("Authorization", &format!("Bearer {host_key}"))
                            .set("Content-Type", "application/json")
                            .send_string(&json!({"id":id,"envelope":sealed}).to_string());
                    });
                }
            });
        }
        let _ = client
            .delete(&format!("{base}/v1/rooms/{room}"))
            .set("Authorization", &format!("Bearer {host_key}"))
            .call();
    });
    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn remote_origins_require_https_and_do_not_contain_credentials() {
        assert_eq!(
            endpoint("https://relay.example.com").unwrap(),
            "https://relay.example.com"
        );
        for value in [
            "http://public.example.com",
            "https://user:password@example.com",
            "https://example.com/path",
            "https://example.com/?token=secret",
        ] {
            assert!(endpoint(value).is_err());
        }
        assert!(endpoint("http://127.0.0.1:8787").is_ok());
    }
}
