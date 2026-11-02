import AVFoundation
import Foundation
import Tauri
import UIKit

/// iOS 相機 QR 掃描（用嚟掃「手機配對」QR）
class QrScanPlugin: Plugin {
  private var session: AVCaptureSession?
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private var settled = false
  /// 當前嘅 invoke（delegate 回調要用）
  private var currentInvoke: Invoke?
  /// 相機 modal 視圖（清理時要收起）
  private var scannerVC: UIViewController?

  @objc public func scan(_ invoke: Invoke) throws {
    self.settled = false

    // 相機權限
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      self.startScanning(invoke)
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { granted in
        DispatchQueue.main.async {
          if granted {
            self.startScanning(invoke)
          } else {
            invoke.reject("相機權限被拒：去 設定 → 隱私權與安全性 → 相機 開返")
          }
        }
      }
    default:
      invoke.reject("相機權限被拒：去 設定 → 隱私權與安全性 → 相機 開返")
    }
  }

  private func startScanning(_ invoke: Invoke) {
    self.currentInvoke = invoke
    guard let device = AVCaptureDevice.default(for: .video),
          let input = try? AVCaptureDeviceInput(device: device),
          let container = self.manager.viewController?.view
    else {
      invoke.reject("開唔到相機（simulator 冇相機；請用真機）")
      return
    }

    let session = AVCaptureSession()
    session.beginConfiguration()
    session.sessionPreset = .high
    guard session.canAddInput(input) else {
      session.commitConfiguration()
      invoke.reject("加唔到相機輸入")
      return
    }
    session.addInput(input)

    let output = AVCaptureMetadataOutput()
    guard session.canAddOutput(output) else {
      session.commitConfiguration()
      invoke.reject("加唔到掃描輸出")
      return
    }
    session.addOutput(output)
    session.commitConfiguration()

    output.setMetadataObjectsDelegate(self, queue: .main)
    output.metadataObjectTypes = [.qr]

    // ⚠️ 一定要用 modal view controller 呈現：Tauri 嘅 webview 係全屏，
    //    直接 addSublayer 落 viewController.view 會被 webview 蓋住（用戶見唔到相機）
    let scannerVC = UIViewController()
    scannerVC.view.backgroundColor = .black
    let preview = AVCaptureVideoPreviewLayer(session: session)
    preview.videoGravity = .resizeAspectFill
    preview.frame = scannerVC.view.bounds
    scannerVC.view.layer.addSublayer(preview)
    self.previewLayer = preview
    self.session = session
    self.scannerVC = scannerVC

    // 取消掣
    let cancel = UIButton(type: .system)
    cancel.setTitle("取消", for: .normal)
    cancel.setTitleColor(.white, for: .normal)
    cancel.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
    cancel.backgroundColor = UIColor.black.withAlphaComponent(0.45)
    cancel.layer.cornerRadius = 10
    cancel.frame = CGRect(x: 16, y: 60, width: 84, height: 44)
    cancel.addTarget(self, action: #selector(self.cancelScan), for: .touchUpInside)
    scannerVC.view.addSubview(cancel)

    // 提示文字
    let hint = UILabel()
    hint.text = "對住 Mac 上面嘅配對 QR 掃描"
    hint.textColor = .white
    hint.font = UIFont.systemFont(ofSize: 15, weight: .medium)
    hint.textAlignment = .center
    hint.frame = CGRect(x: 0, y: 120, width: scannerVC.view.bounds.width, height: 24)
    scannerVC.view.addSubview(hint)

    guard let root = self.manager.viewController else {
      invoke.reject("攞唔到畫面")
      return
    }
    root.present(scannerVC, animated: true) { [weak self] in
      self?.session?.startRunning()
    }

    // 45 秒 timeout（掃唔到就唔好 hang 住）
    DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
      guard let self = self, !self.settled else { return }
      self.finish(invoke, text: nil, error: "掃描超時（45 秒），再撳多次試下")
    }
  }

  /// 掃到 QR
  fileprivate func handle(_ metadataObjects: [AVMetadataObject], for invoke: Invoke) {
    guard !self.settled else { return }
    for case let code as AVMetadataMachineReadableCodeObject in metadataObjects {
      guard let value = code.stringValue, !value.isEmpty else { continue }
      self.finish(invoke, text: value, error: nil)
      return
    }
  }

  /// 取消
  @objc fileprivate func cancelScan() {
    self.settled = true
    self.cleanup()
  }

  private func finish(_ invoke: Invoke, text: String?, error: String?) {
    guard !self.settled else { return }
    self.settled = true
    self.cleanup()
    if let text = text {
      invoke.resolve(["text": text])
    } else {
      invoke.reject(error ?? "掃描失敗")
    }
  }

  private func cleanup() {
    self.currentInvoke = nil
    self.session?.stopRunning()
    self.session = nil
    self.previewLayer?.removeFromSuperlayer()
    self.previewLayer = nil
    if let vc = self.scannerVC {
      vc.dismiss(animated: true)
      self.scannerVC = nil
    }
  }
}

extension QrScanPlugin: AVCaptureMetadataOutputObjectsDelegate {
  func metadataOutput(
    _ output: AVCaptureMetadataOutput,
    didOutput metadataObjects: [AVMetadataObject],
    from connection: AVCaptureConnection
  ) {
    // 搵返 invoke（由 plugin 記住最新嗰個）
    if let inv = self.currentInvoke {
      self.handle(metadataObjects, for: inv)
    }
  }
}

@_cdecl("init_plugin_ios_qrscan")
public func initPlugin() -> Plugin {
  return QrScanPlugin()
}
