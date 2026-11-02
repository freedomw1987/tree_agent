import AVFoundation
import Foundation
import Speech
import Tauri

/// 開始辨識嘅參數
struct SttStartArgs: Decodable {
  let locale: String?
}

/// iOS 裝置原生語音辨識（STT）
///
/// - 用 `SFSpeechRecognizer`（預設 `zh-HK` 粵語）
/// - 用 `AVAudioEngine` 攞音訊 buffer 喂落 recognition request
/// - 音訊**只喺裝置本機**處理，唔會上傳
class SttPlugin: Plugin {
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var engine: AVAudioEngine?

  /// 已經回覆咗（避免兩次 resolve/reject）
  private var settled = false
  /// 辨識真係開始咗
  private var recognitionStarted = false

  /// 最新嘅部分／最終結果
  private var transcript: String = ""
  /// 最終結果（task 話 final 嗰陣會填）
  private var finalTranscript: String?
  private var lastError: String?

  @objc public func start(_ invoke: Invoke) throws {
    // 如果之前仲錄緊，先收乾淨
    self.teardown()
    self.transcript = ""
    self.finalTranscript = nil
    self.lastError = nil
    self.settled = false
    self.recognitionStarted = false

    let args = try? invoke.parseArgs(SttStartArgs.self)
    let localeId = args?.locale ?? "zh-HK"

    // 1) 語音辨識權限（如果已經批咗就直接開始；批唔到就 10 秒後放棄，唔會永久卡住）
    if SFSpeechRecognizer.authorizationStatus() == .authorized {
      self.requestMicrophoneThenStart(invoke, localeId: localeId)
      return
    }
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        switch status {
        case .authorized:
          self.requestMicrophoneThenStart(invoke, localeId: localeId)
        case .denied:
          invoke.reject("語音辨識權限被拒：去 設定 → 隱私權與安全性 → 語音辨識 開返")
        case .restricted:
          invoke.reject("語音辨識被系統限制（唔可以喺呢部裝置用）")
        default:
          invoke.reject("語音辨識權限未確認")
        }
      }
    }
    // 保險：權限請求 10 秒都冇回應 → 當拒絕，唔好 hang 住個 App
    DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
      guard let self = self, !self.recognitionStarted, !self.settled else { return }
      self.settled = true
      invoke.reject("語音辨識權限請求超時（可能系統權限視窗冇出現）")
    }
  }

  /// 2) 麥克風權限 → 真正開始
  private func requestMicrophoneThenStart(_ invoke: Invoke, localeId: String) {
    let session = AVAudioSession.sharedInstance()
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission { granted in
        DispatchQueue.main.async {
          if granted {
            self.beginRecognition(invoke, localeId: localeId)
          } else {
            invoke.reject("麥克風權限被拒：去 設定 → 隱私權與安全性 → 麥克風 開返")
          }
        }
      }
    } else {
      session.requestRecordPermission { granted in
        DispatchQueue.main.async {
          if granted {
            self.beginRecognition(invoke, localeId: localeId)
          } else {
            invoke.reject("麥克風權限被拒：去 設定 → 隱私權與安全性 → 麥克風 開返")
          }
        }
      }
    }
  }

  /// 3) 開始辨識
  private func beginRecognition(_ invoke: Invoke, localeId: String) {
    self.recognitionStarted = true
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId)) else {
      invoke.reject("唔支援 \(localeId) 呢個語言")
      return
    }
    guard recognizer.isAvailable else {
      invoke.reject("\(localeId) 語音辨識暫時唔用得（可能網絡或語言包未就緒）")
      return
    }

    let session = AVAudioSession.sharedInstance()
    do {
      // 用 .playAndRecord + .defaultToSpeaker：simulator 同真機都穩陣
      try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      invoke.reject("開唔到麥克風工作階段：\(error.localizedDescription)")
      return
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.taskHint = .dictation

    let engine = AVAudioEngine()
    let inputNode = engine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      invoke.reject("攞唔到麥克風輸入（simulator 或者冇授權？）")
      return
    }

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
      request.append(buffer)
    }

    engine.prepare()
    do {
      try engine.start()
    } catch {
      invoke.reject("開唔到錄音引擎：\(error.localizedDescription)")
      return
    }

    self.recognizer = recognizer
    self.request = request
    self.engine = engine
    self.task = recognizer.recognitionTask(with: request) { result, error in
      DispatchQueue.main.async {
        if let result = result {
          self.transcript = result.bestTranscription.formattedString
          if result.isFinal {
            self.finalTranscript = self.transcript
          }
        }
        if let error = error {
          // 有權限／網絡錯誤都要講清楚，唔好靜靜哋死掉
          self.lastError = error.localizedDescription
          // Simulator 嘅 speech recognizer 通常初始化唔到 → 講清楚俾用戶知
          #if targetEnvironment(simulator)
          self.lastError = "\(error.localizedDescription)（iOS Simulator 嘅語音辨識通常唔支援，要用真機試）"
          #endif
        }
      }
    }

    self.settled = true
    invoke.resolve(["ok": true, "locale": localeId])
  }

  /// 狀態查詢（權限 ＋ recognizer 可用性）
  @objc public func status(_ invoke: Invoke) throws {
    let auth = SFSpeechRecognizer.authorizationStatus()
    let authText: String
    switch auth {
    case .authorized: authText = "authorized"
    case .denied: authText = "denied"
    case .restricted: authText = "restricted"
    default: authText = "notDetermined"
    }
    let zh = SFSpeechRecognizer(locale: Locale(identifier: "zh-HK"))
    let en = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    invoke.resolve([
      "auth": authText,
      "zhHKAvailable": zh?.isAvailable ?? false,
      "enUSAvailable": en?.isAvailable ?? false,
      "supportsOnDevice": zh?.supportsOnDeviceRecognition ?? false,
      "recording": self.task != nil,
    ])
  }

  /// 停止 + 拎最終文字
  @objc public func stop(_ invoke: Invoke) throws {
    guard self.task != nil else {
      // 根本冇開始過
      invoke.resolve(["text": "", "isFinal": true])
      return
    }

    self.request?.endAudio()
    self.engine?.stop()
    self.engine?.inputNode.removeTap(onBus: 0)

    // 等最終結果（最多 2 秒）；等到就用 final，唔到就用部分結果
    var waited: Int = 0
    func finish() {
      let text = self.finalTranscript ?? self.transcript
      let err = self.lastError
      self.teardown()
      if let err = err, text.isEmpty {
        invoke.reject("語音辨識出錯：\(err)")
      } else {
        invoke.resolve(["text": text, "isFinal": true])
      }
      self.settled = true
    }
    func poll() {
      if self.finalTranscript != nil || waited >= 40 {
        finish()
      } else {
        waited += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { poll() }
      }
    }
    poll()
  }

  /// 收乾淨（停引擎 ＋ 清狀態）
  private func teardown() {
    self.request?.endAudio()
    self.engine?.stop()
    self.engine?.inputNode.removeTap(onBus: 0)
    self.task?.cancel()
    self.task = nil
    self.request = nil
    self.engine = nil
    self.recognizer = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}

@_cdecl("init_plugin_ios_stt")
public func initPlugin() -> Plugin {
  return SttPlugin()
}
