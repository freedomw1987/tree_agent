pub mod relay;

use relay::{RelayConfig, RelayState};
use serde_json::json;
use std::path::PathBuf;
use tauri::{Manager, State};

/// 執行時讀嘅 relay 設定檔（放喺 App 資料目錄，改設定唔使重新編譯）
/// 格式：{ "api_url": "https://…", "token": "va_live_…", "selftest": false }
fn relay_config_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(d) = app.path().app_config_dir() {
        candidates.push(d.join("relay.json"));
    }
    if let Ok(d) = app.path().app_data_dir() {
        candidates.push(d.join("relay.json"));
    }
    candidates.into_iter().find(|p| p.exists())
}

/// 設定 relay（API URL ＋ token）
#[tauri::command]
async fn relay_configure(
    state: State<'_, RelayState>,
    api_url: String,
    token: String,
) -> Result<serde_json::Value, String> {
    state.set_config(RelayConfig { api_url, token });
    Ok(json!({ "ok": true }))
}

/// 派任務（落 tasks queue → Mac sidecar 執行）
#[tauri::command]
async fn relay_send(
    state: State<'_, RelayState>,
    text: String,
    request_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = state.send_task(&text, request_id).await?;
    Ok(json!({ "requestId": id }))
}

/// 查任務結果
#[tauri::command]
async fn relay_poll(
    state: State<'_, RelayState>,
    request_id: String,
) -> Result<serde_json::Value, String> {
    let task = state.get_task(&request_id).await?;
    Ok(serde_json::to_value(task).map_err(|e| e.to_string())?)
}

/// 拉 transcript（增量）
#[tauri::command]
async fn relay_transcript(
    state: State<'_, RelayState>,
    cursor: Option<String>,
) -> Result<serde_json::Value, String> {
    let page = state.transcript(cursor).await?;
    Ok(serde_json::to_value(page).map_err(|e| e.to_string())?)
}

/// 回覆確認卡（批／唔批）
#[tauri::command]
async fn relay_confirm(
    state: State<'_, RelayState>,
    request_id: String,
    approved: bool,
) -> Result<serde_json::Value, String> {
    state.confirm_task(&request_id, approved).await?;
    Ok(json!({ "ok": true }))
}

/// App 資訊（版號 ＋ 有冇設定 relay）
#[tauri::command]
fn app_info(state: State<'_, RelayState>) -> serde_json::Value {
    json!({
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "relayConfigured": state.get_config().is_some(),
    })
}

/// 自檢 log（寫入 App 資料目錄，simulator 上面可以直接讀）
fn selftest_log(app: &tauri::AppHandle, line: &str) {
    if let Ok(dir) = app.path().app_data_dir() {
        let path = dir.join("selftest.log");
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
        {
            use std::io::Write;
            let _ = writeln!(f, "{line}");
            let _ = f.flush();
        }
    }
    println!("{line}");
}

/// 自檢：派一個真任務去 relay，等 Mac 上面嘅 sidecar 做完再攞返結果
async fn relay_selftest(state: RelayState, app: tauri::AppHandle) {
    selftest_log(&app, "[selftest] 開始：派任務去 relay");
    let request_id = match state.send_task("用一句話話我知：今日要做咩？", None).await {
        Ok(id) => id,
        Err(e) => {
            selftest_log(&app, &format!("[selftest] 派任務失敗：{e}"));
            return;
        }
    };
    selftest_log(&app, &format!("[selftest] 已派任務：{request_id}"));
    let mut approved_cards: Vec<String> = Vec::new();
    for i in 0..40 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        match state.get_task(&request_id).await {
            Ok(task) => {
                selftest_log(&app, &format!("[selftest] 狀態：{}", task.status));
                // 見到確認卡 → 自動批核（模擬用戶喺手機撳「確認」）
                // ⚠️ Agent 可能再調多次工具 → 每張新卡都要批（唔可以只批第一張）
                if let Some(c) = &task.confirm {
                    if c.decision.is_none() && !approved_cards.contains(&c.id) {
                            selftest_log(
                                &app,
                                &format!("[selftest] 收到確認卡：{}（{}）", c.tool_label, c.risk_level),
                            );
                            selftest_log(&app, &format!("[selftest] 預覽：{}", c.preview.replace('\n', " / ")));
                            // 批 3 次之後改為取消（模擬用戶覺得夠喇，Agent 就會收手）
                            let approve = approved_cards.len() < 3;
                            match state
                                .confirm_task(&request_id, approve)
                                .await
                            {
                                Ok(()) => {
                                    if approve {
                                        selftest_log(&app, &format!("[selftest] 已批核：{}", c.id));
                                    } else {
                                        selftest_log(&app, &format!("[selftest] 已取消：{}", c.id));
                                    }
                                    approved_cards.push(c.id.clone());
                                }
                                Err(e) => selftest_log(&app, &format!("[selftest] 批核失敗：{e}")),
                            }
                    }
                }
                if matches!(task.status.as_str(), "completed" | "failed" | "partial") {
                    selftest_log(&app, &format!("[selftest] 結果：{}", task.result.clone().unwrap_or_default()));
                    return;
                }
            }
            Err(e) => selftest_log(&app, &format!("[selftest] 查詢失敗（第 {i} 次）：{e}")),
        }
    }
    selftest_log(&app, "[selftest] 超時，未收到結果");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(RelayState::new())
        .setup(|app| {
            // 1) 執行時 config 檔（優先）
            if let Some(path) = relay_config_file(app.handle()) {
                if let Ok(text) = std::fs::read_to_string(&path) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                        let api_url = v.get("api_url").and_then(|s| s.as_str());
                        let token = v.get("token").and_then(|s| s.as_str());
                        if let (Some(api_url), Some(token)) = (api_url, token) {
                            app.state::<RelayState>().set_config(RelayConfig {
                                api_url: api_url.to_string(),
                                token: token.to_string(),
                            });
                            println!("[relay] 已由 {} 載入設定", path.display());
                        }
                        if v.get("selftest").and_then(|b| b.as_bool()).unwrap_or(false) {
                            let state = app.state::<RelayState>().inner().clone();
                            let handle = app.handle().clone();
                            tauri::async_runtime::spawn(async move {
                                relay_selftest(state, handle).await;
                            });
                        }
                    }
                }
            }
            // 2) 編譯時燒入嘅預設（冇 config 檔時用）
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            relay_configure,
            relay_send,
            relay_poll,
            relay_transcript,
            relay_confirm,
            app_info
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
