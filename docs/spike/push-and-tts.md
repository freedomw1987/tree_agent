# SPIKE-003 — 完成推播（APNs/FCM）＋ Polly 語音通知可行性

> 產出：dav-developer 批次 0（2026-11-01）｜對應 backlog: `SPIKE-003`（Module `M01-M02`）｜區域: `ap-southeast-1`
> 狀態：**部分完成**（Polly ✅ 實測完；APNs/FCM ⛔ 需用戶憑證）

---

## 1. 結論

| 項目 | 結論 |
|---|---|
| **Polly 粵語** | ✅ **有！** voice `Hiujin`（女聲），需 `--engine neural`（standard engine 會報 `This voice does not support the selected engine`） |
| **TTS 延遲** | ~**1.0 秒基線 ＋ ~12ms/字**（168 字 → 2.1 秒；504 字 → 4.8 秒） |
| **音檔大小** | mp3 48kbps mono：168 字 → 212 KB；**opus（ogg_opus）≈ 一半**：168 字 → 109 KB |
| **通知音頻** | ⛔ **唔可以內嵌 push payload**（APNs 上限 4KB）→ 必須 **S3 URL ＋ notification service extension 下載** |
| **iOS 附件長度** | ⛔ 通知音頻 **≤ 30 秒**（iOS 限制）→ 通知只播**短摘要**（≤ 30 字 ≈ 5 秒 / 31 KB mp3） |
| **App 內播報** | 只讀**前 150 字**（≈ 2.5 秒內開始播完）；全文照顯示 |
| **APNs / FCM** | ⛔ **未能實測** —— 需要 Apple Developer 帳戶 ＋ FCM 專案 ＋ AWS 憑證（見 §4） |

---

## 2. Polly 實測數據（`ap-southeast-1`，voice `Hiujin`，engine `neural`）

| 文本 | 字數 | 延遲 | mp3 | opus | mp3 時長（推算）|
|---|---|---|---|---|---|
| 「任務搞掂咗，email 草稿已經寫好…」 | 29 | 1,059 ms | 31.4 KB | 16.3 KB | ≈ 5.4 秒 |
| 「陳先生你好，就今次專案嘅交付日期…」 | 56 | 1,161 ms | 69.7 KB | 35.8 KB | ≈ 11.9 秒 |
| 同上 ×3 | 168 | 2,128 ms | 212.5 KB | 108.6 KB | ≈ 35 秒 |
| 同上 ×9 | 504 | 4,761 ms | 641.2 KB | — | ≈ 107 秒 |

**格式支援**（neural engine）：`mp3` ✅、`ogg_opus` ✅、`pcm` ✅｜`ogg_vorbis`/`ogg`（錯名）✗、`alaw`/`mulaw` ✗
**engine 限制**：`Hiujin` 只支援 **neural**；用 standard engine 會直接 `ValidationException`。

---

## 3. 對設計嘅硬約束（已同步入 PRD / AC）

1. **TTS voice 固定 `Hiujin`（yue-CN neural）**；繁體粵語發音（唔用普通話 voice 硬讀）。
2. **App 內播報只讀前 150 字**（≈ 2.5 秒內完成）；回覆全文照顯示 —— 避免長回覆要等 5 秒先有聲。
3. **通知音頻用短摘要**（≤ 30 字 / ≤ 5 秒 / mp3 ≤ 31 KB）：iOS 通知附件 **≤ 30 秒**，而 mp3 內嵌唔落 4KB payload。
4. **音檔一律經 S3 URL 交付**（App 內播放同通知附件都係），唔內嵌 payload；快取 24 小時。
5. **通知附件格式用 mp3**（唔用 opus）：iOS `UNNotificationAttachment` 對 ogg/opus 支援唔穩。
6. **冇 app 開住時嘅語音通知**：靠 iOS notification service extension 落載 mp3（Android 用 FCM 附件／data payload）。

---

## 4. 仍然 blocked 嘅部分（要你提供）

| 需要 | 用途 | 影響 |
|---|---|---|
| **Apple Developer Program 帳戶**（$99/年 或已擁有）+ APNs auth key（`.p8`） | iOS 推播 ＋ 發佈路徑（OQ-7） | US-131 嘅 iOS 側 ＋ 手機實機測試 |
| **Firebase 專案**（`google-services.json` ＋ service account） | Android 推播 | US-131 嘅 Android 側 |
| **真機**：至少一部 Android（+ Android Studio SDK） | 粵語 STT 實測、APNs/FCM 實測 | SPIKE-002 嘅 Android 部分 |
| **iOS 模擬器/真機**（本機已有 Xcode 27.2） | iOS STT 實測 | SPIKE-002 嘅 iOS 部分 |

**AWS 側已就緒**：Polly ✅、S3 ✅（存 mp3）、Lambda ✅（發推播）、Secrets Manager（放憑證）。

---

## 5. 可重現指令

```bash
# 睇粵語 voice
aws polly describe-voices --language-code yue-CN

# 合成（注意 neural engine + ogg_opus 格式名）
aws polly synthesize-speech --engine neural --voice-id Hiujin \
  --language-code yue-CN --text "任務搞掂咗" --output-format mp3 /tmp/tts.mp3
```

---

## 6. 已知風險

- **Polly 粵語只有一個 voice（Hiujin，女聲）** → 想有男聲／多音色要另搵方案（例如 device TTS 做備援）。
- **TTS 成本**：neural 引擎按字數計費（粵語同其他語言同價），10,000 次 × 100 字 ≈ 1M 字 → 量級約 US$16；單用戶量好低，但要有預算上限（M02 成本守衛）。
- **語音通知要網絡**（落載 mp3）；flight mode 收唔到語音（但文字通知照收）。
