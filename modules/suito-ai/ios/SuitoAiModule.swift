import ExpoModulesCore
import Foundation
import FoundationModels

// Native side of the `SuitoAi` seam (ai/contract.ts). Complex inputs arrive as JSON strings
// (decoded with Codable) so the Swift shapes mirror the TS contract one to one.
// Minimum iOS is 26 (plugins/withSuitoAppIntents.js), so no #available guards are needed.

// MARK: - JSON inputs

struct YMDIn: Codable {
  var y: Int
  var m: Int // 0-based, the ledger's convention
  var day: Int
}

struct ParseContextIn: Decodable {
  var expCats: [String]
  var incCats: [String]
  var today: YMDIn
  var locale: String
}

struct FactIn: Decodable {
  var id: String
  var label: String
  var display: String
  var value: Double
  var tone: String
}

struct LetterRequestIn: Decodable {
  var y: Int
  var m: Int
  var facts: [FactIn]
  var locale: String
}

struct NudgeRequestIn: Decodable {
  var facts: [FactIn]
  var locale: String
}

struct AskTurnIn: Decodable {
  var role: String
  var text: String
}

struct AskRequestIn: Decodable {
  var requestId: String
  var question: String
  var history: [AskTurnIn]
  var locale: String
}

private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
  do {
    return try JSONDecoder().decode(type, from: Data(json.utf8))
  } catch {
    throw suitoException(.input, "Malformed \(T.self): \(error)")
  }
}

// MARK: - Module

public class SuitoAiModule: Module {
  static let askTextEvent = "onAskText"

  private let tasksLock = NSLock()
  private var askTasks: [String: Task<Void, Never>] = [:]

  public func definition() -> ModuleDefinition {
    Name("SuitoAi")

    Events(SuitoAiModule.askTextEvent)

    AsyncFunction("availability") { () -> [String: String] in
      ["onDevice": SuitoAiModule.onDeviceAvailability(), "system": "available"]
    }

    AsyncFunction("parseEntry") { (text: String, ctxJson: String, promise: Promise) in
      Task {
        do {
          let ctx = try decode(ParseContextIn.self, ctxJson)
          promise.resolve(try await SuitoAiModule.parseEntry(text, ctx))
        } catch {
          promise.reject(mapSuitoError(error))
        }
      }
    }

    AsyncFunction("writeLetter") { (json: String, promise: Promise) in
      Task {
        do {
          let req = try decode(LetterRequestIn.self, json)
          promise.resolve(try await SuitoAiModule.writeLetter(req))
        } catch {
          promise.reject(mapSuitoError(error))
        }
      }
    }

    AsyncFunction("pickNudge") { (json: String, promise: Promise) in
      Task {
        do {
          let req = try decode(NudgeRequestIn.self, json)
          promise.resolve(try await SuitoAiModule.pickNudge(req))
        } catch {
          promise.reject(mapSuitoError(error))
        }
      }
    }

    AsyncFunction("ask") { (json: String, promise: Promise) in
      let req: AskRequestIn
      do {
        req = try decode(AskRequestIn.self, json)
      } catch {
        promise.reject(mapSuitoError(error))
        return
      }
      let requestId = req.requestId
      let task = Task { [weak self] in
        do {
          let result = try await SuitoAsk.run(req) { text in
            self?.sendEvent(SuitoAiModule.askTextEvent, ["requestId": requestId, "text": text])
          }
          promise.resolve(["text": result.text, "needsStrongerModel": result.needsStrongerModel])
        } catch {
          promise.reject(mapSuitoError(error))
        }
        self?.finishTask(requestId)
      }
      self.storeTask(requestId, task)
    }

    Function("cancelAsk") { (requestId: String) -> Void in
      self.cancelTask(requestId)
    }

    AsyncFunction("writeSiriSnapshot") { (json: String) throws -> Void in
      do {
        try SuitoSiriStore.writeSnapshot(json: json)
      } catch {
        throw suitoException(.io, "writeSiriSnapshot: \(error.localizedDescription)")
      }
      SuitoAiModule.refreshAppShortcutParameters()
    }

    AsyncFunction("readSiriInbox") { () -> String in
      SuitoSiriStore.readInboxJSON()
    }

    AsyncFunction("clearSiriInbox") { (ids: [String]) throws -> Void in
      do {
        try SuitoSiriStore.clearInbox(ids: ids)
      } catch {
        throw suitoException(.io, "clearSiriInbox: \(error.localizedDescription)")
      }
    }

    AsyncFunction("setSpotlight") { (enabled: Bool, entriesJson: String, promise: Promise) in
      Task {
        do {
          try await SuitoSpotlight.apply(enabled: enabled, entriesJson: entriesJson)
          promise.resolve(nil)
        } catch {
          promise.reject(error as? Exception ?? suitoException(.io, "setSpotlight: \(error.localizedDescription)"))
        }
      }
    }
  }

  // MARK: ask task bookkeeping

  private func storeTask(_ id: String, _ task: Task<Void, Never>) {
    tasksLock.lock()
    askTasks[id] = task
    tasksLock.unlock()
  }

  private func finishTask(_ id: String) {
    tasksLock.lock()
    askTasks[id] = nil
    tasksLock.unlock()
  }

  private func cancelTask(_ id: String) {
    tasksLock.lock()
    let task = askTasks.removeValue(forKey: id)
    tasksLock.unlock()
    task?.cancel()
  }

  // MARK: availability

  static func onDeviceAvailability() -> String {
    switch SystemLanguageModel.default.availability {
    case .available:
      return "available"
    case .unavailable(let reason):
      switch reason {
      case .deviceNotEligible: return "unsupported"
      case .appleIntelligenceNotEnabled: return "disabled"
      case .modelNotReady: return "notReady"
      @unknown default: return "notReady"
      }
    }
  }

  static func requireAvailable() throws {
    let state = onDeviceAvailability()
    if state != "available" {
      throw suitoException(.unavailable, "Foundation Models unavailable: \(state)")
    }
  }

  /// The App Shortcuts phrases with a category parameter need the category list; the provider
  /// lives in the app target (plugins/app-intents), so reach it through the ObjC runtime.
  static func refreshAppShortcutParameters() {
    guard let updater = NSClassFromString("SuitoShortcutsUpdater") as? NSObject.Type else { return }
    _ = (updater as AnyObject).perform(NSSelectorFromString("update"))
  }

  // MARK: parseEntry

  static func parseEntry(_ rawText: String, _ ctx: ParseContextIn) async throws -> [String: Any]? {
    let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { return nil }
    try requireAvailable()
    let today = SuitoPostProcess.Day(y: ctx.today.y, m: ctx.today.m + 1, d: ctx.today.day)
    let todayString = String(format: "%04d-%02d-%02d", today.y, today.m, today.d)

    let session = LanguageModelSession(model: .default, instructions: SuitoPrompts.parseInstructions(locale: ctx.locale))
    let options = GenerationOptions(temperature: 0.2, maximumResponseTokens: 200)
    let prompt = SuitoPrompts.parsePrompt(
      text: TokenEstimator.truncate(text, toTokens: 300),
      expCats: Array(ctx.expCats.prefix(60)), incCats: Array(ctx.incCats.prefix(30)), today: todayString)
    let gen = try await session.respond(to: prompt, generating: GenParsedEntry.self, options: options).content

    var out: [String: Any] = [:]

    // Category: must be one of the passed cats; it also decides the type.
    var type: String = gen.type == .income ? "income" : "expense"
    if let raw = gen.category {
      let preferred = type == "income" ? ctx.incCats : ctx.expCats
      let other = type == "income" ? ctx.expCats : ctx.incCats
      if let hit = SuitoSiriStore.matchCategory(raw, candidates: preferred) {
        out["category"] = hit
      } else if let hit = SuitoSiriStore.matchCategory(raw, candidates: other) {
        out["category"] = hit
        type = type == "income" ? "expense" : "income"
      }
    }

    // Amount: trust the model unless it's clearly a date number; fall back to the phrase.
    let candidates = SuitoPostProcess.amountCandidates(text)
    if let amount = gen.amount, amount > 0, candidates.isEmpty || candidates.contains(amount) {
      out["amount"] = amount
    } else if let last = candidates.last {
      out["amount"] = last
    } else if let amount = gen.amount, amount > 0 {
      out["amount"] = amount // e.g. 「千円」 with no digits
    }

    if out["amount"] == nil && out["category"] == nil { return nil }
    out["type"] = type

    if let day = SuitoPostProcess.resolveDate(gen.dateText, today: today) ?? SuitoPostProcess.resolveDate(text, today: today) {
      out["date"] = ["y": day.y, "m": day.m - 1, "day": day.d]
    }

    var note = SuitoPostProcess.noDashes(gen.note, locale: ctx.locale)
      .trimmingCharacters(in: CharacterSet(charactersIn: "「」\"'。、, ").union(.whitespacesAndNewlines))
    if let category = out["category"] as? String, SuitoSiriStore.normalize(note) == SuitoSiriStore.normalize(category) { note = "" }
    if SuitoPostProcess.hasStrayNumbers(note) && SuitoPostProcess.amountCandidates(note).contains(where: { $0 == out["amount"] as? Int }) {
      note = "" // the model echoed the amount
    }
    if note.count > 60 { note = String(note.prefix(60)) }
    if !note.isEmpty { out["note"] = note }
    return out
  }

  // MARK: letter / nudge

  static func writeLetter(_ req: LetterRequestIn) async throws -> [String: Any]? {
    let facts = Array(req.facts.prefix(24))
    if facts.isEmpty { return nil }
    try requireAvailable()
    let session = LanguageModelSession(model: .default, instructions: SuitoPrompts.letterInstructions(locale: req.locale))
    let options = GenerationOptions(temperature: 0.4, maximumResponseTokens: 600)
    let prompt = SuitoPrompts.letterPrompt(monthName: SuitoPrompts.monthName(m0: req.m), facts: facts)
    let gen = try await session.respond(to: prompt, generating: GenLetter.self, options: options).content
    let known = Set(facts.map { $0.id })
    let paragraphs = SuitoPostProcess.letterParagraphs(gen.paragraphs, known: known, locale: req.locale)
    if paragraphs.isEmpty { return nil }
    return ["paragraphs": Array(paragraphs.prefix(3))]
  }

  static func pickNudge(_ req: NudgeRequestIn) async throws -> [String: Any]? {
    let facts = Array(req.facts.prefix(24))
    if facts.isEmpty { return nil }
    try requireAvailable()
    let session = LanguageModelSession(model: .default, instructions: SuitoPrompts.nudgeInstructions(locale: req.locale))
    let options = GenerationOptions(temperature: 0.4, maximumResponseTokens: 160)
    let gen = try await session.respond(to: SuitoPrompts.nudgePrompt(facts: facts), generating: GenNudge.self, options: options).content
    if gen.skip { return nil }
    guard let text = SuitoPostProcess.nudgeText(gen.text, known: Set(facts.map { $0.id }), locale: req.locale) else { return nil }
    return ["text": text]
  }
}

// MARK: - Token budget (heuristic; the iOS 26.2 SDK has no tokenizer API). From koemori-ai.

enum TokenEstimator {
  static let contextWindow = 4096

  static func isWide(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x3000...0x30FF, 0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF, 0xFF00...0xFFEF, 0x1F300...0x1FAFF:
      return true
    default:
      return false
    }
  }

  static func estimate(_ text: String) -> Int {
    var wide = 0
    var narrow = 0
    for scalar in text.unicodeScalars {
      if isWide(scalar) { wide += 1 } else { narrow += 1 }
    }
    return wide + Int((Double(narrow) / 3.5).rounded(.up))
  }

  /// Longest prefix whose estimate fits `maxTokens`; appends "…" when truncated.
  static func truncate(_ text: String, toTokens maxTokens: Int) -> String {
    if maxTokens <= 0 { return "" }
    if estimate(text) <= maxTokens { return text }
    var cost = 0.0
    var end = text.startIndex
    for index in text.indices {
      var charCost = 0.0
      for scalar in text[index].unicodeScalars {
        charCost += isWide(scalar) ? 1.0 : 1.0 / 3.5
      }
      if cost + charCost > Double(maxTokens - 1) { break }
      cost += charCost
      end = text.index(after: index)
    }
    return String(text[text.startIndex..<end]) + "…"
  }
}
