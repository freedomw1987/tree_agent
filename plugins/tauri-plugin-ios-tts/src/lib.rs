//! iOS 本地語音輸出（TTS）plugin
//!
//! 用 `AVSpeechSynthesizer` 喺裝置本機讀出文字（零延遲、零成本、離線可用）。
//! 優先用粵語 voice（`yue-HK` → `zh-HK`）。
//!
//! ```no_run
//! use tauri_plugin_ios_tts::TtsExt;
//! let app = tauri::Builder::default().plugin(tauri_plugin_ios_tts::init());
//! ```

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{Manager, Runtime};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ios_tts);

pub const PLUGIN_NAME: &str = "ios-tts";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("TTS 只支援 iOS（其他平台未實作）")]
    UnsupportedPlatform,
    #[error("TTS plugin 未初始化")]
    NotInitialised,
    #[error("TTS 出錯：{0}")]
    Swift(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// 讀出結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakResult {
    pub ok: bool,
    /// 用咗邊個 voice
    pub voice: String,
    /// voice 嘅語言
    pub language: String,
}

pub struct Tts<R: Runtime> {
    #[allow(dead_code)]
    handle: Option<PluginHandle<R>>,
}

impl<R: Runtime> Tts<R> {
    /// 讀出一段文字
    pub fn speak(&self, text: &str, locale: Option<String>, rate: Option<f32>) -> Result<SpeakResult> {
        #[cfg(target_os = "ios")]
        {
            let handle = self.handle.as_ref().ok_or(Error::NotInitialised)?;
            let mut payload = serde_json::json!({ "text": text });
            if let Some(l) = locale {
                payload["locale"] = serde_json::json!(l);
            }
            if let Some(r) = rate {
                payload["rate"] = serde_json::json!(r);
            }
            let value: serde_json::Value = handle
                .run_mobile_plugin("speak", payload)
                .map_err(|e| Error::Swift(e.to_string()))?;
            Ok(SpeakResult {
                ok: value.get("ok").and_then(|v| v.as_bool()).unwrap_or(true),
                voice: value
                    .get("voice")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                language: value
                    .get("language")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            })
        }
        #[cfg(not(target_os = "ios"))]
        {
            let _ = (text, locale, rate);
            Err(Error::UnsupportedPlatform)
        }
    }

    /// 停低
    pub fn stop(&self) -> Result<()> {
        #[cfg(target_os = "ios")]
        {
            let handle = self.handle.as_ref().ok_or(Error::NotInitialised)?;
            let _value: serde_json::Value = handle
                .run_mobile_plugin("stop", serde_json::json!({}))
                .map_err(|e| Error::Swift(e.to_string()))?;
            Ok(())
        }
        #[cfg(not(target_os = "ios"))]
        {
            Err(Error::UnsupportedPlatform)
        }
    }

    /// 狀態（裝置有咩粵語 voice）
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
            Ok(serde_json::json!({ "speaking": false, "zhVoices": [] }))
        }
    }
}

pub trait TtsExt<R: Runtime> {
    fn tts(&self) -> &Tts<R>;
}

impl<R: Runtime, T: Manager<R>> TtsExt<R> for T {
    fn tts(&self) -> &Tts<R> {
        self.state::<Tts<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new(PLUGIN_NAME)
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            let handle = Some(api.register_ios_plugin(init_plugin_ios_tts)?);
            #[cfg(not(target_os = "ios"))]
            let handle = None::<PluginHandle<R>>;
            let _ = &api;
            app.manage(Tts::<R> { handle });
            Ok(())
        })
        .build()
}
