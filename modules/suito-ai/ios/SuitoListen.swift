import AVFoundation
import Foundation
import Speech

// Hold-to-talk speech for the Calendar orb (PRD #145). ON-DEVICE recognition only:
// SFSpeechRecognizer with `requiresOnDeviceRecognition = true`. A locale without an on-device
// recognizer reports "unavailable"; server recognition is never used.
//
// One listening session at a time. Every session gets an id; stop / cancel / a new start bump
// it, so late recognizer callbacks and a start that was cancelled while it awaited permissions
// are ignored. The audio session and the input tap are always released.

final class SuitoListen {
  typealias Emit = (_ level: Double, _ text: String) -> Void

  /// ~15 events a second (the contract allows 10 to 20).
  static let emitInterval: TimeInterval = 1.0 / 15.0
  /// How long stop waits for the recognizer's final result after the audio ends.
  static let finalTimeout: TimeInterval = 2.0

  private let lock = NSLock()
  private var session = 0
  private var engine: AVAudioEngine?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var recognizer: SFSpeechRecognizer?
  private var emit: Emit?
  private var transcript = ""
  private var finished = false
  private var waiter: CheckedContinuation<Void, Never>?
  private var level = 0.0
  private var lastEmit: TimeInterval = 0
  private var audioActive = false

  static func localeIdentifier(_ locale: String) -> String {
    locale == "en" ? "en-US" : "ja-JP"
  }

  // MARK: start

  /// "started" | "denied" | "unavailable". Never throws.
  func start(locale: String, emit: @escaping Emit) async -> String {
    cancel()
    lock.lock()
    let id = session
    lock.unlock()

    let micGranted = await Self.microphoneGranted()
    if !micGranted { return "denied" }
    let speechGranted = await Self.speechGranted()
    if !speechGranted { return "denied" }

    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: Self.localeIdentifier(locale))),
          recognizer.supportsOnDeviceRecognition,
          recognizer.isAvailable
    else { return "unavailable" }
    if !isCurrent(id) { return "unavailable" } // stopped / cancelled while asking for permission

    let audio = AVAudioSession.sharedInstance()
    do {
      try audio.setCategory(.record, mode: .measurement, options: [.duckOthers])
      try? audio.setAllowHapticsAndSystemSoundsDuringRecording(true)
      try audio.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      Self.deactivateAudio()
      return "unavailable"
    }

    let engine = AVAudioEngine()
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      Self.deactivateAudio()
      return "unavailable"
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.requiresOnDeviceRecognition = true
    request.addsPunctuation = true
    request.taskHint = .dictation

    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      request.append(buffer)
      self?.meter(buffer, session: id)
    }

    let task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      self?.handle(result: result, error: error, session: id)
    }

    lock.lock()
    let stillCurrent = id == session
    if stillCurrent {
      self.engine = engine
      self.request = request
      self.task = task
      self.recognizer = recognizer
      self.emit = emit
      self.transcript = ""
      self.finished = false
      self.level = 0
      self.lastEmit = 0
      self.audioActive = true
    }
    lock.unlock()

    if !stillCurrent {
      input.removeTap(onBus: 0)
      request.endAudio()
      task.cancel()
      Self.deactivateAudio()
      return "unavailable"
    }

    do {
      engine.prepare()
      try engine.start()
    } catch {
      teardown(session: id)
      return "unavailable"
    }
    return "started"
  }

  // MARK: stop / cancel

  /// Ends the audio, waits briefly for the final result, releases everything. nil = nothing heard.
  func stop() async -> String? {
    lock.lock()
    let id = session
    let active = task != nil
    let request = self.request
    let engine = self.engine
    self.engine = nil
    if !active { session += 1 } // a start still awaiting permission must not go live
    lock.unlock()
    guard active else { return nil }

    Self.stopEngine(engine)
    request?.endAudio()
    await waitForFinal(session: id)

    lock.lock()
    let text = id == session ? transcript : ""
    lock.unlock()
    teardown(session: id)
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  /// Stops and discards. Safe to call when idle.
  func cancel() {
    lock.lock()
    let id = session
    lock.unlock()
    teardown(session: id)
  }

  private func isCurrent(_ id: Int) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return id == session
  }

  private func teardown(session id: Int) {
    lock.lock()
    guard id == session else {
      lock.unlock()
      return
    }
    let engine = self.engine
    let request = self.request
    let task = self.task
    let pending = waiter
    let wasActive = audioActive
    self.engine = nil
    self.request = nil
    self.task = nil
    self.recognizer = nil
    self.emit = nil
    self.waiter = nil
    self.transcript = ""
    self.finished = false
    self.level = 0
    self.audioActive = false
    session += 1
    lock.unlock()

    Self.stopEngine(engine)
    request?.endAudio()
    task?.cancel()
    pending?.resume()
    if wasActive { Self.deactivateAudio() }
  }

  private func waitForFinal(session id: Int) async {
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      lock.lock()
      if id != session || finished {
        lock.unlock()
        continuation.resume()
        return
      }
      waiter = continuation
      lock.unlock()
      DispatchQueue.global().asyncAfter(deadline: .now() + Self.finalTimeout) { [weak self] in
        self?.releaseWaiter(session: id)
      }
    }
  }

  private func releaseWaiter(session id: Int) {
    lock.lock()
    guard id == session, let pending = waiter else {
      lock.unlock()
      return
    }
    waiter = nil
    lock.unlock()
    pending.resume()
  }

  // MARK: callbacks

  private func handle(result: SFSpeechRecognitionResult?, error: Error?, session id: Int) {
    lock.lock()
    guard id == session else {
      lock.unlock()
      return
    }
    if let result { transcript = result.bestTranscription.formattedString }
    let done = (result?.isFinal ?? false) || error != nil
    var pending: CheckedContinuation<Void, Never>?
    if done {
      finished = true
      pending = waiter
      waiter = nil
    }
    lock.unlock()
    pending?.resume()
  }

  /// Audio thread: smoothed RMS level (fast attack, slow release), throttled event with the
  /// latest partial transcript.
  private func meter(_ buffer: AVAudioPCMBuffer, session id: Int) {
    guard let channel = buffer.floatChannelData?[0] else { return }
    let count = Int(buffer.frameLength)
    if count == 0 { return }
    var sum: Float = 0
    for index in 0..<count {
      let sample = channel[index]
      sum += sample * sample
    }
    let rms = (sum / Float(count)).squareRoot()
    let decibels = 20 * log10(max(rms, 0.000_000_1))
    let raw = Double(min(1, max(0, (decibels + 50) / 50))) // -50 dB ... 0 dB -> 0 ... 1

    lock.lock()
    guard id == session else {
      lock.unlock()
      return
    }
    level = raw > level ? level * 0.4 + raw * 0.6 : level * 0.85 + raw * 0.15
    let now = ProcessInfo.processInfo.systemUptime
    var send: Emit?
    if now - lastEmit >= Self.emitInterval {
      lastEmit = now
      send = emit
    }
    let currentLevel = level
    let text = transcript
    lock.unlock()
    send?(currentLevel, text)
  }

  // MARK: system

  private static func stopEngine(_ engine: AVAudioEngine?) {
    guard let engine else { return }
    if engine.isRunning { engine.stop() }
    engine.inputNode.removeTap(onBus: 0)
  }

  private static func deactivateAudio() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  static func microphoneGranted() async -> Bool {
    switch AVAudioApplication.shared.recordPermission {
    case .granted: return true
    case .denied: return false
    case .undetermined: return await AVAudioApplication.requestRecordPermission()
    @unknown default: return false
    }
  }

  static func speechGranted() async -> Bool {
    switch SFSpeechRecognizer.authorizationStatus() {
    case .authorized: return true
    case .denied, .restricted: return false
    case .notDetermined:
      return await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
        SFSpeechRecognizer.requestAuthorization { status in
          continuation.resume(returning: status == .authorized)
        }
      }
    @unknown default: return false
    }
  }
}
