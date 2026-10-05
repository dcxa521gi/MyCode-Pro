//! Local platform tools. Fixed operations, project-scoped artifacts, no SDK installation.
use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};

fn candidates(tool: &str) -> Vec<PathBuf> {
    let fixed: &[&str] = match tool {
        "wechat" => &[
            "F:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat",
            "C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat",
        ],
        "deveco" => &[
            "F:/Program Files/Huawei/DevEco Studio/bin/devecostudio64.exe",
            "C:/Program Files/Huawei/DevEco Studio/bin/devecostudio64.exe",
        ],
        "emulator" => &[
            "F:/Program Files/Huawei/DevEco Studio/tools/emulator/Emulator.exe",
            "C:/Program Files/Huawei/DevEco Studio/tools/emulator/Emulator.exe",
        ],
        "hdc" => &[
            "F:/Program Files/Huawei/DevEco Studio/sdk/default/openharmony/toolchains/hdc.exe",
            "C:/Program Files/Huawei/DevEco Studio/sdk/default/openharmony/toolchains/hdc.exe",
        ],
        "hvigor" => &[
            "F:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.bat",
            "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.bat",
        ],
        "adb" => {
            &["F:/Program Files/Cindy/resources/tools/android-platform-tools/win32-x64/adb.exe"]
        }
        "xcode" => &["/usr/bin/xcodebuild"],
        _ => &[],
    };
    let mut values = fixed.iter().map(PathBuf::from).collect::<Vec<_>>();
    let names: &[&str] = match tool {
        "wechat" => &["cli.bat", "cli.sh"],
        "deveco" => &["devecostudio64.exe", "devecostudio.sh"],
        "emulator" => &["Emulator.exe"],
        "hdc" => &["hdc.exe", "hdc"],
        "adb" => &["adb.exe", "adb"],
        "hvigor" => &["hvigorw.bat", "hvigorw"],
        "xcode" => &["xcodebuild"],
        _ => &[],
    };
    for dir in std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()) {
        for name in names {
            values.push(dir.join(name));
        }
    }
    if let Some(sdk) =
        std::env::var_os("ANDROID_HOME").or_else(|| std::env::var_os("ANDROID_SDK_ROOT"))
    {
        values.push(
            PathBuf::from(sdk)
                .join("platform-tools")
                .join(if cfg!(windows) { "adb.exe" } else { "adb" }),
        );
    }
    values
}
#[tauri::command]
pub fn development_detect() -> Value {
    json!( ["wechat","deveco","emulator","hvigor","hdc","adb","xcode"].iter().map(|id|json!({"id":id,"path":candidates(id).into_iter().find(|p|p.is_file()).map(|p|p.to_string_lossy().into_owned())})).collect::<Vec<_>>() )
}
fn command(binary: &Path, args: &[String]) -> Result<Command, String> {
    #[cfg(windows)]
    if binary
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("bat") || e.eq_ignore_ascii_case("cmd"))
    {
        let strings = std::iter::once(binary.to_string_lossy().into_owned())
            .chain(args.iter().cloned())
            .collect::<Vec<_>>();
        if strings
            .iter()
            .any(|s| s.chars().any(|c| "\"&|<>^%!\r\n".contains(c)))
        {
            return Err("This path contains unsupported Windows batch characters".into());
        }
        let line = strings
            .iter()
            .map(|s| format!("\"{s}\""))
            .collect::<Vec<_>>()
            .join(" ");
        let mut cmd = Command::new("cmd.exe");
        use std::os::windows::process::CommandExt;
        cmd.args(["/D", "/S", "/C"]).raw_arg(format!("\"{line}\""));
        return Ok(cmd);
    }
    let mut cmd = Command::new(binary);
    cmd.args(args);
    Ok(cmd)
}
fn operation(tool: &str, action: &str, cwd: &Path) -> Result<Vec<String>, String> {
    let project = cwd.to_string_lossy().into_owned();
    let args: Vec<&str> = match (tool, action) {
        ("wechat", "open") if cwd.join("project.config.json").is_file() => {
            vec!["open", "--project", &project]
        }
        ("wechat", "preview") if cwd.join("project.config.json").is_file() => {
            vec!["preview", "--project", &project, "--qr-format", "terminal"]
        }
        ("wechat", "test") if cwd.join("project.config.json").is_file() => vec![],
        ("hvigor", "test") if cwd.join("build-profile.json5").is_file() => vec![],
        ("emulator", "devices") => vec!["-list", "-details"],
        ("deveco", "open") => vec![&project],
        ("hdc", "devices") => vec!["list", "targets"],
        ("adb", "devices") => vec!["devices", "-l"],
        ("hvigor", "build") if cwd.join("build-profile.json5").is_file() => vec![
            "--mode",
            "module",
            "-p",
            "product=default",
            "assembleHap",
            "--no-daemon",
        ],
        ("gradle", "build")
            if cwd.join("settings.gradle").is_file()
                || cwd.join("settings.gradle.kts").is_file() =>
        {
            vec!["assembleDebug", "--no-daemon"]
        }
        ("gradle", "test")
            if cwd.join("settings.gradle").is_file()
                || cwd.join("settings.gradle.kts").is_file() =>
        {
            vec!["test", "--no-daemon"]
        }
        ("xcode", "test") if cfg!(target_os = "macos") => vec!["test"],
        ("xcode", "build") if cfg!(target_os = "macos") => vec!["build"],
        _ => return Err("Operation is unavailable for this project or platform".into()),
    };
    Ok(args.into_iter().map(String::from).collect())
}
#[tauri::command]
pub async fn development_run(
    app: tauri::AppHandle,
    tool: String,
    action: String,
    cwd: String,
    binary: String,
    paths: Option<std::collections::BTreeMap<String, String>>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move||{
 let cwd=fs::canonicalize(cwd).map_err(|e|e.to_string())?;
 if !cwd.is_dir(){return Err("Choose a project folder".into());}
 let mut args=operation(&tool,&action,&cwd)?;
 let binary=if tool=="gradle"{cwd.join(if cfg!(windows){"gradlew.bat"}else{"gradlew"})}else{PathBuf::from(binary)};
 let binary=if action=="test" && ["wechat","hvigor"].contains(&tool.as_str()) {
   let runtime=crate::managed_cli::runtime_dir(&app)?;
   args=vec![runtime.join("development-test.cjs").to_string_lossy().into_owned(),if tool=="wechat"{"wechat".into()}else{"harmony".into()},cwd.to_string_lossy().into_owned(),serde_json::to_string(&tool_paths(paths.unwrap_or_default())).map_err(|e|e.to_string())?];
   crate::managed_cli::node(&app)?
 }else{binary};
 if !binary.is_file(){return Err("Tool is not installed. Configure its executable path first".into());}
 let mut cmd=command(&binary,&args)?;cmd.current_dir(&cwd);
 if action=="open"{cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());crate::hide_window_console(&mut cmd);cmd.spawn().map_err(|e|e.to_string())?;return Ok(json!({"success":true,"output":"Opened local developer tool"}));}
 let logs=cwd.join(".mycode").join("tool-logs");fs::create_dir_all(&logs).map_err(|e|e.to_string())?;
 let logfile=logs.join(format!("{}-{}.log",tool,uuid::Uuid::new_v4()));let out=fs::File::create(&logfile).map_err(|e|e.to_string())?;
 cmd.stdin(Stdio::null()).stdout(out.try_clone().map_err(|e|e.to_string())?).stderr(out);
 crate::hide_window_console(&mut cmd);
 #[cfg(unix)]{use std::os::unix::process::CommandExt;cmd.process_group(0);}
 #[cfg(windows)]let mut child=crate::windows::spawn_managed(&mut cmd).map_err(|e|e.to_string())?;
 #[cfg(not(windows))]let mut child=cmd.spawn().map_err(|e|e.to_string())?;
 let started=Instant::now();let status=loop{if let Some(status)=child.try_wait().map_err(|e|e.to_string())?{break Some(status);}
if started.elapsed()>Duration::from_secs(1200){
 #[cfg(windows)]{let mut kill=Command::new("taskkill.exe");kill.args(["/PID",&child.id().to_string(),"/T","/F"]);crate::hide_window_console(&mut kill);let _=kill.status();}
 #[cfg(unix)]unsafe{libc::kill(-(child.id() as i32),libc::SIGKILL);}
 let _=child.kill();let _=child.wait();break None;}std::thread::sleep(Duration::from_millis(150));};
 let mut file=fs::File::open(&logfile).map_err(|e|e.to_string())?;let length=file.metadata().map_err(|e|e.to_string())?.len();
 if length>64000{use std::io::Seek;file.seek(std::io::SeekFrom::End(-64000)).map_err(|e|e.to_string())?;}
 let mut output=Vec::new();file.take(64000).read_to_end(&mut output).map_err(|e|e.to_string())?;
 Ok(json!({"success":status.is_some_and(|s|s.success()),"timedOut":status.is_none(),"output":String::from_utf8_lossy(&output),"log":logfile.to_string_lossy()}))
 }).await.map_err(|e|e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn operations_require_real_project_markers() {
        assert!(operation("wechat", "preview", Path::new("/not/a/project")).is_err());
        assert!(operation("hdc", "devices", Path::new("/tmp")).is_ok());
        assert!(operation("hdc", "shell", Path::new("/tmp")).is_err());
        assert!(operation("xcode", "test", Path::new("/tmp")).is_ok() == cfg!(target_os = "macos"));
    }
}
#[tauri::command]
pub fn development_context(
    app: tauri::AppHandle,
    cwd: String,
    paths: Option<std::collections::BTreeMap<String, String>>,
) -> String {
    let cwd = PathBuf::from(cwd);
    let paths = paths.unwrap_or_default();
    let mut tools = Vec::new();
    let actions: Vec<(&str, &str)> = if cwd.join("project.config.json").is_file() {
        vec![
            ("wechat", "open"),
            ("wechat", "preview"),
            ("wechat", "test"),
        ]
    } else if cwd.join("build-profile.json5").is_file() {
        vec![
            ("deveco", "open"),
            ("hvigor", "build"),
            ("hvigor", "test"),
            ("emulator", "devices"),
            ("hdc", "devices"),
        ]
    } else if cwd.join("settings.gradle").is_file() || cwd.join("settings.gradle.kts").is_file() {
        vec![("gradle", "build"), ("gradle", "test"), ("adb", "devices")]
    } else {
        vec![]
    };
    for (tool, action) in actions {
        if action == "test" && ["wechat", "hvigor"].contains(&tool) {
            if let (Ok(node), Ok(runtime)) = (
                crate::managed_cli::node(&app),
                crate::managed_cli::runtime_dir(&app),
            ) {
                tools.push(json!({"tool":tool,"action":action,"program":node,"args":[runtime.join("development-test.cjs"),if tool=="wechat"{"wechat"}else{"harmony"},cwd,serde_json::to_string(&tool_paths(paths.clone())).unwrap_or_default()],"cwd":cwd}));
            }
            continue;
        }
        let binary = if tool == "gradle" {
            Some(cwd.join(if cfg!(windows) {
                "gradlew.bat"
            } else {
                "gradlew"
            }))
        } else {
            paths
                .get(tool)
                .map(PathBuf::from)
                .filter(|p| p.is_file())
                .or_else(|| candidates(tool).into_iter().find(|p| p.is_file()))
        };
        if let (Some(binary), Ok(args)) = (
            binary.filter(|p| p.is_file()),
            operation(tool, action, &cwd),
        ) {
            tools.push(json!({"tool":tool,"action":action,"program":binary.to_string_lossy(),"args":args,"cwd":cwd.to_string_lossy()}));
        }
    }
    if tools.is_empty() {
        String::new()
    } else {
        format!("[MyCode installed local developer tools - reference data]\n{}\nWhen implementing or fixing this project's UI, automatically run its simulator test action through normal command tools and approval flow after building. WeChat starts automation, checks active pages and saves screenshots; .mycode/wechat-tests.json can specify pages and RPC assertions. HarmonyOS requires .mycode/harmony-tests.json with bundle, module, project-relative hap and testHap paths, optional emulator name and port. Build signed test HAPs first, then the test action starts an existing emulator and runs Hypium. Do not accept SDK agreements or bypass tool authorization. Keep results under .mycode/test-results. Report missing prerequisites or failed assertions honestly. Do not claim full business acceptance from a smoke check. Do not upload or publish without authorization.\n[End of local developer tool reference]",json!(tools))
    }
}
fn tool_paths(
    mut configured: std::collections::BTreeMap<String, String>,
) -> std::collections::BTreeMap<String, String> {
    for id in ["wechat", "hdc", "emulator"] {
        if !configured.get(id).is_some_and(|p| Path::new(p).is_file()) {
            if let Some(path) = candidates(id).into_iter().find(|p| p.is_file()) {
                configured.insert(id.into(), path.to_string_lossy().into_owned());
            }
        }
    }
    configured
}
