//! Keep the system awake during tasks, without forcing the display to stay on.
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Manager, State, WebviewWindow};
#[derive(Default)]
struct Inner {
    windows: HashMap<String, bool>,
    error: Option<String>,
}
#[derive(Default)]
pub struct PowerHost(Arc<Mutex<Inner>>);
pub fn init(app: &AppHandle) {
    let state = app.state::<PowerHost>().0.clone();
    std::thread::spawn(move || {
        let mut held = false;
        let mut retry_at = std::time::Instant::now();
        #[cfg(not(windows))]
        let mut child: Option<std::process::Child> = None;
        loop {
            #[cfg(not(windows))]
            if child
                .as_mut()
                .is_some_and(|p| p.try_wait().ok().flatten().is_some())
            {
                child = None;
                held = false;
                retry_at = std::time::Instant::now() + Duration::from_secs(30);
                if let Ok(mut s) = state.lock() {
                    s.error = Some("System wake lock is unavailable".into());
                }
            }
            let needed = state.lock().is_ok_and(|s| s.windows.values().any(|v| *v));
            if needed != held && (!needed || std::time::Instant::now() >= retry_at) {
                #[cfg(windows)]
                let outcome = {
                    use windows_sys::Win32::System::Power::{
                        SetThreadExecutionState, ES_CONTINUOUS, ES_SYSTEM_REQUIRED,
                    };
                    let flags = ES_CONTINUOUS | if needed { ES_SYSTEM_REQUIRED } else { 0 };
                    if unsafe { SetThreadExecutionState(flags) } == 0 {
                        Err("System wake lock could not be acquired".to_string())
                    } else {
                        Ok(())
                    }
                };
                #[cfg(not(windows))]
                let outcome: Result<(), String> = {
                    if needed {
                        #[cfg(target_os = "macos")]
                        let result = std::process::Command::new("/usr/bin/caffeinate")
                            .args(["-i", "-w", &std::process::id().to_string()])
                            .stdout(std::process::Stdio::null())
                            .stderr(std::process::Stdio::null())
                            .spawn();
                        #[cfg(not(target_os = "macos"))]
                        let result = std::process::Command::new("systemd-inhibit")
                            .args([
                                "--what=sleep",
                                "--mode=block",
                                "--who=MyCode",
                                "--why=Agent task",
                                "/bin/sh",
                                "-c",
                                "while kill -0 \"$1\" 2>/dev/null; do sleep 10; done",
                                "mycode",
                                &std::process::id().to_string(),
                            ])
                            .stdout(std::process::Stdio::null())
                            .stderr(std::process::Stdio::null())
                            .spawn();
                        result.map(|p| child = Some(p)).map_err(|e| e.to_string())
                    } else {
                        if let Some(mut p) = child.take() {
                            let _ = p.kill();
                            let _ = p.wait();
                        }
                        Ok(())
                    }
                };
                held = needed && outcome.is_ok();
                if outcome.is_err() {
                    retry_at = std::time::Instant::now() + Duration::from_secs(30);
                }
                if let Ok(mut s) = state.lock() {
                    s.error = outcome.err();
                }
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
#[tauri::command]
pub fn power_sync(
    window: WebviewWindow,
    host: State<'_, PowerHost>,
    enabled: bool,
    busy: bool,
) -> Result<Option<String>, String> {
    let mut s = host.0.lock().map_err(|e| e.to_string())?;
    s.windows.insert(window.label().into(), enabled && busy);
    Ok(s.error.clone())
}
pub fn window_closed(app: &AppHandle, label: &str) {
    if let Ok(mut s) = app.state::<PowerHost>().0.lock() {
        s.windows.remove(label);
    }
}
