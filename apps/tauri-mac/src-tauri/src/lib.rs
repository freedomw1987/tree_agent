pub mod sidecar;

use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::Duration;

use serde_json::json;
use tauri::{Emitter, Manager, State};

use crate::sidecar::{Sidecar, SidecarEvent};

/// App 全域狀態：sidecar supervisor
pub struct AppState {
    pub sidecar: Sidecar,
    pub node_program: String,
    pub sidecar_args: Vec<String>,
    pub sidecar_env: Vec<(String, String)>,
}

/// 讀 sidecar 事件 → 轉成 Tauri event 畀前端；sidecar 死咗就自動重啟（≤ 5 秒內）
fn spawn_event_pump(app: tauri::AppHandle, events: Receiver<SidecarEvent>) {
    std::thread::spawn(move || {
        let state = app.state::<Arc<AppState>>();
        loop {
            let ev = match events.recv() {
                Ok(ev) => ev,
                Err(_) => break,
            };
            let payload = serde_json::to_value(&ev).unwrap_or(json!({}));
            let _ = app.emit("sidecar-event", payload);

            if matches!(ev, SidecarEvent::Stopped) {
                let sc = &state.sidecar;
                let program = state.node_program.clone();
                let args = state.sidecar_args.clone();
                let env: Vec<(&str, &str)> = state
                    .sidecar_env
                    .iter()
                    .map(|(k, v)| (k.as_str(), v.as_str()))
                    .collect();
                match sc.restart(&program, &args, &env) {
                    Ok(n) => {
                        let _ = app.emit(
                            "sidecar-event",
                            json!({"type": "restarted", "attempt": n}),
                        );
                    }
                    Err(e) => {
                        let _ = app.emit("sidecar-event", json!({"type": "error", "message": e}));
                    }
                }
            }
        }
    });
}

#[tauri::command]
fn agent_status(state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    state
        .sidecar
        .send(&json!({"type": "status", "id": "status-1"}))
        .map_err(|e| e.to_string())?;
    Ok(json!({"ok": true}))
}

#[tauri::command]
fn agent_prompt(
    state: State<'_, Arc<AppState>>,
    text: String,
    request_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = request_id.unwrap_or_else(|| format!("req-{}", now_millis()));
    state
        .sidecar
        .send(&json!({"type": "prompt", "id": id, "text": text}))
        .map_err(|e| e.to_string())?;
    Ok(json!({"requestId": id}))
}

#[tauri::command]
fn agent_shutdown(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.sidecar.stop();
    Ok(())
}

/// 搵 sidecar 入口：環境變數 → cwd 相對 → exe 相對（打包後嘅 .app 都搵到）
fn resolve_sidecar_main() -> String {
    if let Ok(p) = std::env::var("VOICE_AGENT_SIDECAR") {
        return p;
    }
    let mut candidates = vec![
        "../../../runtime/sidecar/dist/main.mjs".to_string(),
        "runtime/sidecar/dist/main.mjs".to_string(),
    ];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("../../../runtime/sidecar/dist/main.mjs").to_string_lossy().to_string());
            candidates.push(dir.join("sidecar/main.mjs").to_string_lossy().to_string());
        }
    }
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return c.clone();
        }
    }
    candidates.remove(0)
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let node_program =
                std::env::var("VOICE_AGENT_NODE").unwrap_or_else(|_| "node".to_string());
            let sidecar_main = resolve_sidecar_main();
            let workspace = std::env::var("VOICE_AGENT_WORKSPACE")
                .unwrap_or_else(|_| "~/agent-workspace".to_string());

            let (sidecar, events) = Sidecar::new(Duration::from_millis(500), 20);
            let args = vec![sidecar_main.clone()];
            let env = vec![("VOICE_AGENT_WORKSPACE".to_string(), workspace.clone())];

            let state = Arc::new(AppState {
                sidecar,
                node_program: node_program.clone(),
                sidecar_args: args.clone(),
                sidecar_env: env.clone(),
            });
            app.manage(state.clone());

            let env_pairs: Vec<(&str, &str)> = env
                .iter()
                .map(|(k, v)| (k.as_str(), v.as_str()))
                .collect();
            if let Err(e) = state.sidecar.start(&node_program, &args, &env_pairs) {
                eprintln!("[voice-agent] 起 sidecar 失敗：{e}");
            }

            spawn_event_pump(app.handle().clone(), events);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![agent_status, agent_prompt, agent_shutdown])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
