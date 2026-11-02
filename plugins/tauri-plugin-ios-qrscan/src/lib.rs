//! iOS 相機 QR 掃描 plugin
//!
//! 用嚟掃「手機配對」QR（入面係 relay API URL + token），
//! 令用戶唔使喺手機上手打 60 個字。
//!
//! ```no_run
//! use tauri_plugin_ios_qrscan::QrScanExt;
//! let app = tauri::Builder::default().plugin(tauri_plugin_ios_qrscan::init());
//! ```

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{Manager, Runtime};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ios_qrscan);

pub const PLUGIN_NAME: &str = "ios-qrscan";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("QR 掃描只支援 iOS")]
    UnsupportedPlatform,
    #[error("QR 掃描 plugin 未初始化")]
    NotInitialised,
    #[error("QR 掃描出錯：{0}")]
    Swift(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// 掃描結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    /// QR 入面嘅原始文字（JSON payload）
    pub text: String,
}

pub struct QrScan<R: Runtime> {
    #[allow(dead_code)]
    handle: Option<PluginHandle<R>>,
}

impl<R: Runtime> QrScan<R> {
    /// 取消掃描
    pub fn cancel(&self) -> Result<()> {
        #[cfg(target_os = "ios")]
        {
            let handle = self.handle.as_ref().ok_or(Error::NotInitialised)?;
            let _value: serde_json::Value = handle
                .run_mobile_plugin("cancel", serde_json::json!({}))
                .map_err(|e| Error::Swift(e.to_string()))?;
            Ok(())
        }
        #[cfg(not(target_os = "ios"))]
        {
            Err(Error::UnsupportedPlatform)
        }
    }

    /// 查相機權限 ＋ 裝置狀態
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

    /// 開始掃描（會彈相機畫面；掃到或者取消就返結果）
    pub fn scan(&self) -> Result<ScanResult> {
        #[cfg(target_os = "ios")]
        {
            let handle = self.handle.as_ref().ok_or(Error::NotInitialised)?;
            let value: serde_json::Value = handle
                .run_mobile_plugin("scan", serde_json::json!({}))
                .map_err(|e| Error::Swift(e.to_string()))?;
            let text = value
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            Ok(ScanResult { text })
        }
        #[cfg(not(target_os = "ios"))]
        {
            Err(Error::UnsupportedPlatform)
        }
    }
}

pub trait QrScanExt<R: Runtime> {
    fn qrscan(&self) -> &QrScan<R>;
}

impl<R: Runtime, T: Manager<R>> QrScanExt<R> for T {
    fn qrscan(&self) -> &QrScan<R> {
        self.state::<QrScan<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new(PLUGIN_NAME)
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            let handle = Some(api.register_ios_plugin(init_plugin_ios_qrscan)?);
            #[cfg(not(target_os = "ios"))]
            let handle = None::<PluginHandle<R>>;
            let _ = &api;
            app.manage(QrScan::<R> { handle });
            Ok(())
        })
        .build()
}
