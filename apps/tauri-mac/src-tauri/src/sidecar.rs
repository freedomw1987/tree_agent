use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};

/// M03 sidecar 事件（Rust 端 → 前端）
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarEvent {
    Ready {
        session_id: Option<String>,
        session_title: Option<String>,
        workspace: Option<String>,
    },
    Chunk {
        id: Option<String>,
        text: String,
    },
    Done {
        id: Option<String>,
        text: String,
    },
    Partial {
        id: Option<String>,
        message: String,
        text: Option<String>,
    },
    Error {
        id: Option<String>,
        message: String,
    },
    /// M04 確認卡：要前端問用戶批唔批（5 分鐘有效）
    ConfirmRequest {
        id: Option<String>,
        tool_name: Option<String>,
        tool_label: Option<String>,
        risk_level: Option<String>,
        preview: Option<String>,
        expires_at: Option<u64>,
    },
    /// sidecar 崩潰 → 已重啟
    Restarted { attempt: u32 },
    Stopped,
}

/// Rust 端點解 sidecar 出嘅 JSON（protocol.ts 嘅對面）
fn parse_line(line: &str) -> Option<SidecarEvent> {
    let v: Value = serde_json::from_str(line).ok()?;
    let t = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
    let id = v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string());
    let text = v.get("text").and_then(|x| x.as_str()).unwrap_or("").to_string();
    match t {
        "ready" => Some(SidecarEvent::Ready {
            session_id: v.get("sessionId").and_then(|x| x.as_str()).map(|s| s.to_string()),
            session_title: v.get("sessionTitle").and_then(|x| x.as_str()).map(|s| s.to_string()),
            workspace: v.get("workspace").and_then(|x| x.as_str()).map(|s| s.to_string()),
        }),
        "chunk" => Some(SidecarEvent::Chunk { id, text }),
        "done" => Some(SidecarEvent::Done { id, text }),
        "partial" => Some(SidecarEvent::Partial {
            id,
            message: v
                .get("message")
                .and_then(|x| x.as_str())
                .unwrap_or("任務被中止")
                .to_string(),
            text: v.get("text").and_then(|x| x.as_str()).map(|s| s.to_string()),
        }),
        "error" => Some(SidecarEvent::Error {
            id,
            message: v
                .get("message")
                .and_then(|x| x.as_str())
                .unwrap_or("sidecar 錯誤")
                .to_string(),
        }),
        "confirm_request" => Some(SidecarEvent::ConfirmRequest {
            id,
            tool_name: v.get("toolName").and_then(|x| x.as_str()).map(|s| s.to_string()),
            tool_label: v.get("toolLabel").and_then(|x| x.as_str()).map(|s| s.to_string()),
            risk_level: v.get("riskLevel").and_then(|x| x.as_str()).map(|s| s.to_string()),
            preview: v.get("preview").and_then(|x| x.as_str()).map(|s| s.to_string()),
            expires_at: v.get("expiresAt").and_then(|x| x.as_u64()),
        }),
        _ => None,
    }
}

/// 對 sidecar 發一條 request（JSON line）
pub fn encode_request(req: &Value) -> String {
    format!("{}\n", req)
}

/// Sidecar supervisor：spawn ＋ 重啟 ＋ stdio JSON lines
pub struct Sidecar {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<std::process::ChildStdin>>,
    /// sidecar → Rust 嘅事件通道（Sender；Receiver 交畀 pump thread，
    /// 因為 mpsc::Receiver 係 !Sync，放喺 managed state 度會令 Arc<AppState> 唔 Send）
    tx: Sender<SidecarEvent>,
    restart_delay: Duration,
    max_restarts: u32,
    restart_count: Arc<Mutex<u32>>,
}

impl Sidecar {
    pub fn new(restart_delay: Duration, max_restarts: u32) -> (Self, Receiver<SidecarEvent>) {
        let (tx, events) = mpsc::channel();
        (
            Self {
                child: Mutex::new(None),
                stdin: Mutex::new(None),
                tx,
                restart_delay,
                max_restarts,
                restart_count: Arc::new(Mutex::new(0)),
            },
            events,
        )
    }

    pub fn restart_count(&self) -> u32 {
        *self.restart_count.lock().unwrap()
    }

    /// 啟動 sidecar（node <main.js>），並開一個 thread 讀佢嘅 stdout
    pub fn start(&self, program: &str, args: &[String], env: &[(&str, &str)]) -> Result<(), String> {
        let mut cmd = Command::new(program);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        for (k, v) in env {
            cmd.env(k, v);
        }
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("起 sidecar 失敗（{program}）：{e}"))?;

        let stdin = child.stdin.take();
        *self.stdin.lock().unwrap() = stdin;
        *self.child.lock().unwrap() = Some(child);

        // 讀 stdout → 轉成 event；行完（sidecar 死咗）就發一個 Stopped 俾上面決定重啟
        let stdout = self.child.lock().unwrap().as_mut().and_then(|c| c.stdout.take());
        if let Some(out) = stdout {
            let tx = self.tx.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().map_while(Result::ok) {
                    if let Some(ev) = parse_line(&line) {
                        let _ = tx.send(ev);
                    }
                }
                let _ = tx.send(SidecarEvent::Stopped);
            });
        }
        Ok(())
    }

    /// 送一條 request 俾 sidecar
    pub fn send(&self, req: &Value) -> Result<(), String> {
        let mut guard = self.stdin.lock().unwrap();
        let stdin = guard
            .as_mut()
            .ok_or_else(|| "sidecar 未啟動：先 start()".to_string())?;
        stdin
            .write_all(encode_request(req).as_bytes())
            .map_err(|e| format!("寫 sidecar 失敗：{e}"))
    }

    /// 停 sidecar（跟 App 生死）
    pub fn stop(&self) {
        let _ = self.send(&json!({"type": "shutdown"}));
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *self.stdin.lock().unwrap() = None;
    }

    /// 崩潰後重啟（≤ restart_delay 內）；成功返回重啟次數
    pub fn restart(&self, program: &str, args: &[String], env: &[(&str, &str)]) -> Result<u32, String> {
        {
            let mut count = self.restart_count.lock().unwrap();
            if *count >= self.max_restarts {
                return Err(format!(
                    "重啟次數用完（{} 次）—— 唔再自動重啟",
                    self.max_restarts
                ));
            }
            *count += 1;
        }
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *self.stdin.lock().unwrap() = None;
        std::thread::sleep(self.restart_delay);
        self.start(program, args, env)?;
        Ok(self.restart_count())
    }

    /// 重啟延遲（供測試查）
    pub fn restart_delay(&self) -> Duration {
        self.restart_delay
    }
}

/// 測試用：起一個會即刻死嘅假 sidecar
#[cfg(test)]
mod tests {
    use super::*;

    fn node_available() -> bool {
        Command::new("node")
            .arg("--version")
            .stdout(Stdio::null())
            .status()
            .is_ok()
    }

    #[test]
    fn parses_confirm_request_event() {
        let v: Value = serde_json::from_str(
            r#"{"type":"confirm_request","id":"cf-1","toolName":"fs.write","toolLabel":"寫檔案","riskLevel":"write","preview":"+ 1 行","expiresAt":123}"#,
        )
        .unwrap();
        match parse_line(&v.to_string()) {
            Some(SidecarEvent::ConfirmRequest {
                id,
                tool_name,
                tool_label,
                risk_level,
                preview,
                expires_at,
            }) => {
                assert_eq!(id.as_deref(), Some("cf-1"));
                assert_eq!(tool_name.as_deref(), Some("fs.write"));
                assert_eq!(tool_label.as_deref(), Some("寫檔案"));
                assert_eq!(risk_level.as_deref(), Some("write"));
                assert_eq!(preview.as_deref(), Some("+ 1 行"));
                assert_eq!(expires_at, Some(123));
            }
            other => panic!("應該係 ConfirmRequest，實際係 {:?}", other),
        }
    }

    #[test]
    fn parses_ready_and_chunk_events() {
        let ev = parse_line(r#"{"type":"ready","sessionId":"s-1","workspace":"~/ws"}"#).unwrap();
        match ev {
            SidecarEvent::Ready {
                session_id,
                workspace,
                ..
            } => {
                assert_eq!(session_id.as_deref(), Some("s-1"));
                assert_eq!(workspace.as_deref(), Some("~/ws"));
            }
            _ => panic!("應該係 ready"),
        }

        let ev = parse_line(r#"{"type":"chunk","text":"你好"}"#).unwrap();
        match ev {
            SidecarEvent::Chunk { text, .. } => assert_eq!(text, "你好"),
            _ => panic!("應該係 chunk"),
        }
    }

    #[test]
    fn parses_partial_and_error_with_messages() {
        let ev = parse_line(r#"{"type":"partial","message":"任務超時"}"#).unwrap();
        match ev {
            SidecarEvent::Partial { message, .. } => assert!(message.contains("超時")),
            _ => panic!("應該係 partial"),
        }

        let ev = parse_line(r#"{"type":"error","message":"壞 request"}"#).unwrap();
        match ev {
            SidecarEvent::Error { message, .. } => assert!(message.contains("壞 request")),
            _ => panic!("應該係 error"),
        }
    }

    #[test]
    fn ignores_unknown_and_malformed_lines() {
        assert!(parse_line("not json").is_none());
        assert!(parse_line(r#"{"type":"whatever"}"#).is_none());
    }

    #[test]
    fn encodes_request_as_single_line() {
        let line = encode_request(&json!({"type": "prompt", "id": "r1"}));
        assert!(line.ends_with('\n'));
        assert_eq!(line.matches('\n').count(), 1);
    }

    #[test]
    fn sends_request_to_sidecar_and_receives_events() {
        if !node_available() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("fake.mjs");
        std::fs::write(
            &script,
            r#"import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const req = JSON.parse(line);
  if (req.type === "prompt") {
    process.stdout.write(JSON.stringify({ type: "chunk", id: req.id, text: "做緊" }) + "\n");
    process.stdout.write(JSON.stringify({ type: "done", id: req.id, text: "搞掂" }) + "\n");
  } else if (req.type === "status") {
    process.stdout.write(JSON.stringify({ type: "ready", sessionId: "s-1" }) + "\n");
  }
});
"#,
        )
        .unwrap();

        let (sc, events) = Sidecar::new(Duration::from_millis(50), 3);
        sc.start(
            "node",
            &[script.to_string_lossy().to_string()],
            &[],
        )
        .unwrap();

        // 收到 ready（sidecar 收到 status 指令先會回）
        sc.send(&json!({"type": "status", "id": "r0"})).unwrap();
        let ev = events.recv_timeout(Duration::from_secs(5)).unwrap();
        assert!(matches!(ev, SidecarEvent::Ready { .. }));

        // prompt → chunk → done
        sc.send(&json!({"type": "prompt", "id": "r1", "text": "測試"})).unwrap();
        let ev = events.recv_timeout(Duration::from_secs(5)).unwrap();
        match ev {
            SidecarEvent::Chunk { text, .. } => assert_eq!(text, "做緊"),
            other => panic!("應該係 chunk：{other:?}"),
        }
        let ev = events.recv_timeout(Duration::from_secs(5)).unwrap();
        match ev {
            SidecarEvent::Done { text, .. } => assert_eq!(text, "搞掂"),
            other => panic!("應該係 done：{other:?}"),
        }
        sc.stop();
    }

    #[test]
    fn restarts_crashed_sidecar_within_delay() {
        if !node_available() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("crash.mjs");
        std::fs::write(&script, "process.exit(3);").unwrap();

        let (sc, events) = Sidecar::new(Duration::from_millis(100), 3);
        sc.start(
            "node",
            &[script.to_string_lossy().to_string()],
            &[],
        )
        .unwrap();

        // 等 sidecar 死 → Stopped
        let ev = events.recv_timeout(Duration::from_secs(5)).unwrap();
        assert!(matches!(ev, SidecarEvent::Stopped));

        let t0 = std::time::Instant::now();
        let count = sc
            .restart(
                "node",
                &[script.to_string_lossy().to_string()],
                &[],
            )
            .unwrap();
        assert_eq!(count, 1);
        assert!(t0.elapsed() < Duration::from_secs(5), "重啟要 ≤ 5 秒");
        sc.stop();
    }

    #[test]
    fn refuses_to_restart_beyond_max() {
        let (sc, _events) = Sidecar::new(Duration::from_millis(10), 1);
        // 第一次重啟：喺上限內 → 應該成功
        sc.restart("node", &["-e".to_string(), "0".to_string()], &[])
            .unwrap();
        // 第二次：已用完上限 → 應該拒絕（唔再自動重啟）
        let err = sc
            .restart("node", &["-e".to_string(), "0".to_string()], &[])
            .unwrap_err();
        assert!(err.contains("重啟次數用完"));
    }

    #[test]
    fn send_without_start_fails_with_clear_error() {
        let (sc, _events) = Sidecar::new(Duration::from_millis(10), 1);
        let err = sc.send(&json!({"type": "status"})).unwrap_err();
        assert!(err.contains("未啟動"));
    }
}
