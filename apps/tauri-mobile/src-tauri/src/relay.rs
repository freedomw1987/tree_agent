//! 手機 App 嘅 relay 客戶端（M02 HTTP API）
//!
//! 手機唔會直接跑 Node sidecar（iOS/Android 行唔到 Node），
//! 所以手機 → relay-api（HTTP）→ SQS → Mac 上面嘅 sidecar 執行 → 結果返手機。

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayConfig {
    pub api_url: String,
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskState {
    pub request_id: String,
    #[serde(default)]
    pub user_id: String,
    pub status: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    /// 待批核嘅確認卡（跨機確認流程）
    #[serde(default)]
    pub confirm: Option<TaskConfirm>,
    #[serde(default)]
    pub updated_at: i64,
}

/// 跨機確認卡（手機見到嘅嗰張卡）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskConfirm {
    pub id: String,
    pub tool_name: String,
    pub tool_label: String,
    pub risk_level: String,
    pub preview: String,
    pub expires_at: i64,
    #[serde(default)]
    pub decision: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEntry {
    pub user_id: String,
    pub request_id: String,
    pub role: String,
    pub kind: String,
    pub content: String,
    pub ts: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptPage {
    pub entries: Vec<TranscriptEntry>,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SendTaskResponse {
    pub request_id: String,
}

/// Relay 設定（API URL ＋ token）；喺手機設定頁改，存喺記憶體（v1 唔持久化）
#[derive(Clone)]
pub struct RelayState {
    config: std::sync::Arc<Mutex<Option<RelayConfig>>>,
    http: reqwest::Client,
}

impl RelayState {
    pub fn new() -> Self {
        // 編譯時可以燒入預設 relay（v1：單用戶 token 存喺 App 度）
        let default = match (
            option_env!("VA_RELAY_API_URL"),
            option_env!("VA_RELAY_TOKEN"),
        ) {
            (Some(url), Some(token)) => Some(RelayConfig {
                api_url: url.to_string(),
                token: token.to_string(),
            }),
            _ => None,
        };
        Self {
            config: std::sync::Arc::new(Mutex::new(default)),
            http: reqwest::Client::new(),
        }
    }

    pub fn set_config(&self, cfg: RelayConfig) {
        *self.config.lock().unwrap() = Some(cfg);
    }

    pub fn get_config(&self) -> Option<RelayConfig> {
        self.config.lock().unwrap().clone()
    }

    fn require(&self) -> Result<RelayConfig, String> {
        self.get_config().ok_or_else(|| "未設定 relay（API URL／token）".to_string())
    }

    /// 派任務 → 落 tasks queue（sidecar 會輪詢到）
    pub async fn send_task(&self, text: &str, request_id: Option<String>) -> Result<String, String> {
        let cfg = self.require()?;
        let id = request_id.unwrap_or_else(|| format!("m-{}", now_millis()));
        let url = format!("{}/tasks", cfg.api_url.trim_end_matches('/'));
        let body = serde_json::json!({ "text": text, "requestId": id });
        let resp = self
            .http
            .post(&url)
            .bearer_auth(&cfg.token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("派任務失敗：{e}"))?;
        let status = resp.status();
        let text_body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("relay API 回 {status}：{text_body}"));
        }
        let parsed: serde_json::Value =
            serde_json::from_str(&text_body).map_err(|e| format!("壞回應：{e}"))?;
        Ok(parsed
            .get("requestId")
            .and_then(|v| v.as_str())
            .unwrap_or(&id)
            .to_string())
    }

    /// 查任務狀態（結果）
    pub async fn get_task(&self, request_id: &str) -> Result<TaskState, String> {
        let cfg = self.require()?;
        let url = format!(
            "{}/tasks/{}",
            cfg.api_url.trim_end_matches('/'),
            urlencoding(request_id)
        );
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&cfg.token)
            .send()
            .await
            .map_err(|e| format!("查任務失敗：{e}"))?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if status.as_u16() == 404 {
            return Ok(TaskState {
                request_id: request_id.to_string(),
                user_id: String::new(),
                status: "unknown".into(),
                title: None,
                result: None,
                error: None,
                confirm: None,
                updated_at: 0,
            });
        }
        if !status.is_success() {
            return Err(format!("relay API 回 {status}：{body}"));
        }
        serde_json::from_str(&body).map_err(|e| format!("壞回應：{e}"))
    }

    /// 回覆確認卡（批／唔批）
    pub async fn confirm_task(&self, request_id: &str, approved: bool) -> Result<(), String> {
        let cfg = self.require()?;
        let url = format!(
            "{}/tasks/{}/confirm",
            cfg.api_url.trim_end_matches('/'),
            urlencoding(request_id)
        );
        let resp = self
            .http
            .post(&url)
            .bearer_auth(&cfg.token)
            .json(&serde_json::json!({ "approved": approved }))
            .send()
            .await
            .map_err(|e| format!("回覆確認失敗：{e}"))?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("relay API 回 {status}：{body}"));
        }
        Ok(())
    }

    /// 拉 transcript（增量）
    pub async fn transcript(&self, cursor: Option<String>) -> Result<TranscriptPage, String> {
        let cfg = self.require()?;
        let mut url = format!("{}/transcript", cfg.api_url.trim_end_matches('/'));
        if let Some(c) = cursor {
            url.push_str(&format!("?cursor={}", urlencoding(&c)));
        }
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&cfg.token)
            .send()
            .await
            .map_err(|e| format!("拉 transcript 失敗：{e}"))?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("relay API 回 {status}：{body}"));
        }
        serde_json::from_str(&body).map_err(|e| format!("壞回應：{e}"))
    }
}

/// 極簡 URL 編碼（query 同 path 都用得）
fn urlencoding(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            other => format!("%{:02X}", other as u32),
        })
        .collect()
}

pub fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}
