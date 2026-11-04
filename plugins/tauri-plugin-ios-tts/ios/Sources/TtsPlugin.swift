import AVFoundation
import Foundation
import Tauri

/// 讀出文字嘅參數
struct SpeakArgs: Decodable {
  let text: String?
  let locale: String?
  /// 0.0 - 1.0（相對預設速度）
  let rate: Float?
}

/// iOS 本地語音輸出（TTS）
///
/// - 用 `AVSpeechSynthesizer`（裝置本機，零延遲、零成本、離線可用）
/// - 優先搵粵語 voice（`yue-HK` / `zh-HK`），冇就用系統預設
/// - 音訊階段用 `.playback` + `.spokenAudio` → 靜音掣都出聲（符合「走路時聽」嘅場景）
class TtsPlugin: Plugin {
  private let synthesizer = AVSpeechSynthesizer()

  @objc public func speak(_ invoke: Invoke) throws {
    let args = (try? invoke.parseArgs(SpeakArgs.self)) ?? nil
    let text = (args?.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else {
      invoke.reject("冇文字可讀")
      return
    }

    // 粵語優先：yue-HK → zh-HK → 系統預設
    let locale = args?.locale ?? "yue-HK"
    var voice = AVSpeechSynthesisVoice(language: locale)
    if voice == nil && locale != "zh-HK" {
      voice = AVSpeechSynthesisVoice(language: "zh-HK")
    }
    if voice == nil {
      voice = AVSpeechSynthesisVoice(language: "zh-TW")
    }
    if voice == nil {
      voice = AVSpeechSynthesisVoice(language: "en-US")
    }

    // 音訊階段：playback ＋ spokenAudio（靜音掣都出聲）
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try session.setActive(true, options: [])
    } catch {
      invoke.reject("開唔到音訊輸出：\(error.localizedDescription)")
      return
    }

    if self.synthesizer.isSpeaking {
      self.synthesizer.stopSpeaking(at: .immediate)
    }

    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = voice
    utterance.rate = args?.rate ?? AVSpeechUtteranceDefaultSpeechRate
    utterance.pitchMultiplier = 1.0
    utterance.postUtteranceDelay = 0.05
    self.synthesizer.speak(utterance)

    invoke.resolve([
      "ok": true,
      "voice": voice?.name ?? "",
      "language": voice?.language ?? locale,
    ])
  }

  @objc public func stop(_ invoke: Invoke) throws {
    self.synthesizer.stopSpeaking(at: .immediate)
    invoke.resolve(["ok": true])
  }

  /// 狀態 ＋ 裝置有咩中文/粵語 voice（用嚟診斷）
  @objc public func status(_ invoke: Invoke) throws {
    let zhVoices = AVSpeechSynthesisVoice.speechVoices()
      .filter { $0.language.hasPrefix("zh") || $0.language.hasPrefix("yue") }
      .map { "\($0.name) [\($0.language)]" }
    invoke.resolve([
      "speaking": self.synthesizer.isSpeaking,
      "zhVoices": zhVoices,
      "count": zhVoices.count,
    ])
  }
}

@_cdecl("init_plugin_ios_tts")
public func initPlugin() -> Plugin {
  return TtsPlugin()
}
