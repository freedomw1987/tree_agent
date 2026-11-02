//! iOS 裝置原生語音辨識（STT）plugin
//!
//! - Swift 端用 `SFSpeechRecognizer`（預設 locale `zh-HK`，即粵語）
//! - Rust 端用 `run_mobile_plugin` 代理去 Swift
//! - 音訊**唔會離開裝置**（符合私隱要求：唔上傳）
//!
//! 用法（Rust）：
//! ```no_run
//! use tauri_plugin_ios_stt::SttExt;
//!
//! let app = tauri::Builder::default()
//!   .plugin(tauri_plugin_ios_stt::init())
//!   .setup(|app| {
//!     app.stt().start(Some("zh-HK".to_string()))?;
//!     let outcome = app.stt().stop()?;
//!     println!("{}", outcome.text);
//!     Ok(())
//!   });
//! ```

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{Manager, Runtime};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ios_stt);

/// plugin 名（Swift 端註冊時用）
pub const PLUGIN_NAME: &str = "ios-stt";

/// 預設語言：粵語
pub const DEFAULT_LOCALE: &str = "zh-HK";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("STT 只支援 iOS（其他平台未實作）")]
    UnsupportedPlatform,
    #[error("STT plugin 未初始化")]
    NotInitialised,
    #[error("STT 出錯：{0}")]
    Swift(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// 停止時嘅結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SttOutcome {
    /// 辨識到嘅文字（可能係空：如果冇講嘢）
    pub text: String,
    /// 係咪最終結果
    pub is_final: bool,
}

/// plugin 狀態
pub struct Stt<R: Runtime> {
    #[allow(dead_code)]
    handle: Option<PluginHandle<R>>,
}

impl<R: Runtime> Stt<R> {
    /// 開始錄音 + 辨識
    pub fn start(&self, locale: Option<String>) -> Result<()> {
        #[cfg(target_os = "ios")]
        {
            let handle = self
                .handle
                .as_ref()
                .ok_or(Error::NotInitialised)?;
            let _ack: serde_json::Value = handle
                .run_mobile_plugin(
                    "start",
                    serde_json::json!({
                        "locale": locale.unwrap_or_else(|| DEFAULT_LOCALE.to_string())
                    }),
                )
                .map_err(|e| Error::Swift(e.to_string()))?;
            Ok(())
        }
        #[cfg(not(target_os = "ios"))]
        {
            let _ = locale;
            Err(Error::UnsupportedPlatform)
        }
    }

    /// 查狀態（權限 ＋ recognizer 可用性）
    pub fn status(&self) -> Result<serde_json::Value> {
        #[cfg(target_os = "ios")]
        {
            let handle = self.handle.as_ref().ok_or(Error::NotInitialised)?;
            let value: serde_json::Value = handle
                .run_mobile_plugin("status", serde_json::json!({}))
                .map_err(|e| Error::Swift(e.to_string()))?;
            Ok(value)
        }
        #[cfg(not(target_os = "ios"))]
        {
            Ok(serde_json::json!({ "auth": "unsupported" }))
        }
    }

    /// 停止 + 拎返最終文字
    pub fn stop(&self) -> Result<SttOutcome> {
        #[cfg(target_os = "ios")]
        {
            let handle = self.handle.as_ref().ok_or(Error::NotInitialised)?;
            let value: serde_json::Value = handle
                .run_mobile_plugin("stop", serde_json::json!({}))
                .map_err(|e| Error::Swift(e.to_string()))?;
            let outcome: SttOutcome = serde_json::from_value(value)
                .map_err(|e| Error::Swift(format!("壞回應：{e}")))?;
            Ok(outcome)
        }
        #[cfg(not(target_os = "ios"))]
        {
            Err(Error::UnsupportedPlatform)
        }
    }
}

/// 取得 plugin 實例
pub trait SttExt<R: Runtime> {
    fn stt(&self) -> &Stt<R>;
}

impl<R: Runtime, T: Manager<R>> SttExt<R> for T {
    fn stt(&self) -> &Stt<R> {
        self.state::<Stt<R>>().inner()
    }
}

/// plugin 入口
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new(PLUGIN_NAME)
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            let handle = Some(api.register_ios_plugin(init_plugin_ios_stt)?);
            #[cfg(not(target_os = "ios"))]
            let handle = None::<PluginHandle<R>>;
            let _ = &api;
            app.manage(Stt::<R> { handle });
            Ok(())
        })
        .build()
}
