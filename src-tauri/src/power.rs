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
    #[cfg(windows)]
    lid_plan: Option<LidPlan>,
}
#[derive(Default)]
pub struct PowerHost(Arc<Mutex<Inner>>);
pub fn init(app: &AppHandle) {
    let state = app.state::<PowerHost>().0.clone();
    #[cfg(windows)]
    let recovery = app
        .path()
        .app_data_dir()
        .ok()
        .map(|p| p.join("power-plan-recovery.json"));
    #[cfg(windows)]
    if let Some(path) = &recovery {
        restore_stale_plan(path);
    }
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
                    #[cfg(windows)]
                    if needed && held && s.lid_plan.is_none() {
                        if let Some(path) = &recovery {
                            match LidPlan::create(path) {
                                Ok(plan) => s.lid_plan = Some(plan),
                                Err(error) => s.error = Some(error),
                            }
                        }
                    } else if !needed {
                        if let Some(plan) = s.lid_plan.take() {
                            plan.restore();
                        }
                    }
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

/// Restore the previous scheme only if our own scheme is still active. A user
/// selecting another power plan always wins. The journal handles abnormal exits.
#[cfg(windows)]
#[derive(serde::Serialize, serde::Deserialize)]
struct LidPlan {
    original: String,
    temporary: String,
    journal: std::path::PathBuf,
}
#[cfg(windows)]
fn powercfg(args: &[&str]) -> Result<String, String> {
    let mut command = std::process::Command::new("powercfg.exe");
    command.args(args);
    crate::hide_window_console(&mut command);
    let out = command
        .output()
        .map_err(|_| "Lid power policy is unavailable".to_string())?;
    if !out.status.success() {
        return Err("Windows denied the temporary lid power policy. Configure lid behavior in Windows Power Options.".into());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}
#[cfg(windows)]
fn scheme_id(text: &str) -> Result<String, String> {
    text.split_whitespace()
        .find_map(|word| uuid::Uuid::parse_str(word).ok().map(|id| id.to_string()))
        .ok_or_else(|| "Windows did not report a power scheme".into())
}
#[cfg(windows)]
impl LidPlan {
    fn create(journal: &std::path::Path) -> Result<Self, String> {
        let original = scheme_id(&powercfg(&["/getactivescheme"])?)?;
        let temporary = uuid::Uuid::new_v4().to_string();
        let plan = Self {
            original,
            temporary,
            journal: journal.to_owned(),
        };
        if let Some(parent) = journal.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        // Journal before activating any modified scheme, retaining crash recovery.
        std::fs::write(
            journal,
            serde_json::to_vec(&plan).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        let result = (|| {
            powercfg(&["/duplicatescheme", &plan.original, &plan.temporary])?;
            powercfg(&["/changename", &plan.temporary, "MyCode runtime"])?;
            powercfg(&[
                "/setacvalueindex",
                &plan.temporary,
                "SUB_BUTTONS",
                "LIDACTION",
                "0",
            ])?;
            powercfg(&[
                "/setdcvalueindex",
                &plan.temporary,
                "SUB_BUTTONS",
                "LIDACTION",
                "0",
            ])?;
            powercfg(&["/setactive", &plan.temporary])?;
            // A separate, hidden watcher restores lid policy even if MyCode crashes.
            // It only touches our own scheme and matching recovery journal.
            let journal = plan.journal.to_string_lossy().replace('\'', "''");
            let script=format!("$p=Get-Process -Id {} -ErrorAction SilentlyContinue; if($p){{$p.WaitForExit()}}; $c=(& powercfg.exe /getactivescheme) -join ' '; if($c -match '{}'){{& powercfg.exe /setactive '{}'; if($LASTEXITCODE -ne 0){{exit 1}}}}; & powercfg.exe /delete '{}'; if($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath '{}')){{$j=Get-Content -LiteralPath '{}' -Raw | ConvertFrom-Json; if($j.temporary -eq '{}'){{Remove-Item -LiteralPath '{}'}}}}",std::process::id(),plan.temporary,plan.original,plan.temporary,journal,journal,plan.temporary,journal);
            let powershell = std::path::PathBuf::from(
                std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
            )
            .join("System32/WindowsPowerShell/v1.0/powershell.exe");
            let mut watcher = std::process::Command::new(powershell);
            watcher
                .env_remove("PSModulePath")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            crate::hide_window_console(&mut watcher);
            watcher.spawn().map_err(|e| e.to_string())?;
            Ok::<_, String>(())
        })();
        if let Err(error) = result {
            plan.restore();
            return Err(error);
        }
        Ok(plan)
    }
    fn restore(self) {
        let current = powercfg(&["/getactivescheme"]).and_then(|s| scheme_id(&s));
        if current.as_deref() == Ok(self.temporary.as_str())
            && powercfg(&["/setactive", &self.original]).is_err()
        {
            return;
        }
        if current.is_err() {
            return;
        }
        if powercfg(&["/delete", &self.temporary]).is_ok() {
            let _ = std::fs::remove_file(&self.journal);
        }
    }
}
#[cfg(windows)]
fn restore_stale_plan(path: &std::path::Path) {
    if let Ok(data) = std::fs::read(path) {
        if let Ok(mut plan) = serde_json::from_slice::<LidPlan>(&data) {
            if uuid::Uuid::parse_str(&plan.original).is_ok()
                && uuid::Uuid::parse_str(&plan.temporary).is_ok()
                && plan.original != plan.temporary
            {
                plan.journal = path.to_owned();
                plan.restore();
            }
        }
    }
}
pub fn shutdown(app: &AppHandle) {
    if let Ok(mut s) = app.state::<PowerHost>().0.lock() {
        s.windows.clear();
        #[cfg(windows)]
        if let Some(plan) = s.lid_plan.take() {
            plan.restore();
        }
    }
}
pub fn window_closed(app: &AppHandle, label: &str) {
    if let Ok(mut s) = app.state::<PowerHost>().0.lock() {
        s.windows.remove(label);
    }
}
#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn scheme_ids_are_parsed_independently_of_console_language() {
        let id = "381b4222-f694-41f0-9685-ff5bb260df2e";
        assert_eq!(
            scheme_id(&format!("电源方案 GUID: {id} (平衡)")),
            Ok(id.into())
        );
        assert!(scheme_id("No scheme").is_err());
    }
}
