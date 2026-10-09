use std::sync::atomic::{AtomicBool, Ordering};
static CHINESE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn app_set_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    CHINESE.store(locale == "zh-CN", Ordering::Relaxed);
    #[cfg(windows)]
    crate::tray::refresh_language(&app).map_err(|e| e.to_string())?;
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    crate::mono_chat::refresh_language(&app).map_err(|e| e.to_string())?;
    let _ = app;
    Ok(())
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn text(en: &'static str, zh: &'static str) -> &'static str {
    if CHINESE.load(Ordering::Relaxed) {
        zh
    } else {
        en
    }
}
