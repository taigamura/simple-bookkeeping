import AVFoundation
import Foundation
import FoundationModels
import UIKit
import Vision
import VisionKit

// Receipt scan (PRD #145): VisionKit document camera -> Vision OCR (accurate, ja-JP + en-US) ->
// the on-device parse with receipt guidance. Images stay in memory only and are never written
// to disk. Never throws: every outcome is a status ("ok" / "cancelled" / "denied" / "none").

enum SuitoReceipt {
  /// Pages read per scan; a receipt is one page, a long one maybe two or three.
  static let maxPages = 3
  static let ocrTokens = 1500

  private static let busyLock = NSLock()
  private static var busy = false

  static func scan(_ ctx: ParseContextIn) async -> [String: Any] {
    // Model first: no point scanning if nothing can read the result.
    if SuitoAiModule.onDeviceAvailability() != "available" { return ["status": "none"] }
    let supported = await MainActor.run { VNDocumentCameraViewController.isSupported }
    if !supported { return ["status": "none"] }
    let granted = await cameraGranted()
    if !granted { return ["status": "denied"] }

    busyLock.lock()
    if busy {
      busyLock.unlock()
      return ["status": "cancelled"]
    }
    busy = true
    busyLock.unlock()
    defer {
      busyLock.lock()
      busy = false
      busyLock.unlock()
    }

    guard let images = await SuitoReceiptCamera.present() else { return ["status": "cancelled"] }
    if images.isEmpty { return ["status": "none"] }

    let text = await Task.detached(priority: .userInitiated) { SuitoReceipt.recognizeText(images) }.value
    if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return ["status": "none"] }

    do {
      guard let entry = try await SuitoAiModule.parseReceipt(text, ctx) else { return ["status": "none"] }
      return ["status": "ok", "entry": entry]
    } catch {
      return ["status": "none"]
    }
  }

  static func cameraGranted() async -> Bool {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: return true
    case .denied, .restricted: return false
    case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
    @unknown default: return false
    }
  }

  // MARK: OCR

  /// Text of every page, rows top to bottom; observations on the same row (a label and its
  /// amount, e.g. 「合計」 and 「¥1,280」) are joined with a space.
  static func recognizeText(_ images: [CGImage]) -> String {
    var pages: [String] = []
    for image in images {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["ja-JP", "en-US"]
      request.usesLanguageCorrection = true
      let handler = VNImageRequestHandler(cgImage: image, options: [:])
      do {
        try handler.perform([request])
      } catch {
        continue
      }
      let observations = request.results ?? []
      let lines: [(box: CGRect, text: String)] = observations.compactMap { (observation: VNRecognizedTextObservation) -> (box: CGRect, text: String)? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : (observation.boundingBox, text)
      }
      let rows = groupRows(lines)
      if !rows.isEmpty { pages.append(rows.joined(separator: "\n")) }
    }
    return pages.joined(separator: "\n\n")
  }

  /// Vision boxes are normalised with the origin at the bottom left.
  static func groupRows(_ lines: [(box: CGRect, text: String)]) -> [String] {
    let sorted = lines.sorted { $0.box.midY > $1.box.midY }
    var rows: [[(box: CGRect, text: String)]] = []
    for line in sorted {
      if let last = rows.last?.first, abs(last.box.midY - line.box.midY) < max(last.box.height, line.box.height) * 0.5 {
        rows[rows.count - 1].append(line)
      } else {
        rows.append([line])
      }
    }
    return rows.map { row in row.sorted { $0.box.minX < $1.box.minX }.map { $0.text }.joined(separator: " ") }
  }
}

// MARK: - Document camera

/// Presents VNDocumentCameraViewController over the top view controller and resolves once:
/// the page images (in memory), or nil when the user cancelled / the camera failed.
@MainActor
final class SuitoReceiptCamera: NSObject, VNDocumentCameraViewControllerDelegate {
  private var continuation: CheckedContinuation<[CGImage]?, Never>?
  /// The camera's delegate is weak; the presenter keeps itself alive until it resolves.
  private var keepAlive: SuitoReceiptCamera?

  static func present() async -> [CGImage]? {
    let camera = SuitoReceiptCamera()
    return await camera.run()
  }

  private func run() async -> [CGImage]? {
    guard let presenter = Self.topViewController() else { return nil }
    return await withCheckedContinuation { (continuation: CheckedContinuation<[CGImage]?, Never>) in
      self.continuation = continuation
      self.keepAlive = self
      let controller = VNDocumentCameraViewController()
      controller.delegate = self
      presenter.present(controller, animated: true)
    }
  }

  private func finish(_ controller: VNDocumentCameraViewController, _ images: [CGImage]?) {
    let pending = continuation
    continuation = nil
    controller.dismiss(animated: true)
    pending?.resume(returning: images)
    keepAlive = nil
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    var images: [CGImage] = []
    for index in 0..<min(scan.pageCount, SuitoReceipt.maxPages) {
      if let image = scan.imageOfPage(at: index).cgImage { images.append(image) }
    }
    finish(controller, images)
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    finish(controller, nil)
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    finish(controller, nil)
  }

  static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let foreground = scenes.filter { $0.activationState == .foregroundActive }
    let windows = (foreground.isEmpty ? scenes : foreground).flatMap { $0.windows }
    let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first
    var top = window?.rootViewController
    while let presented = top?.presentedViewController, !presented.isBeingDismissed {
      top = presented
    }
    return top
  }
}
