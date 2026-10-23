import Foundation
import FoundationModels

// Ask: on-device model + Tools that read the Siri snapshot (JS computed every total). The tools
// only look things up and add month totals; no budget or recurrence maths happens here.

struct AskOutcome {
  var text: String
  var needsStrongerModel: Bool
}

enum SuitoAsk {
  static let historyTurns = 6
  static let historyTurnTokens = 200
  static let historyTokens = 500
  static let responseTokens = 600
  static let findLimit = 30

  static func run(_ req: AskRequestIn, onText: @escaping (String) -> Void) async throws -> AskOutcome {
    try SuitoAiModule.requireAvailable()
    let question = req.question.trimmingCharacters(in: .whitespacesAndNewlines)
    if question.isEmpty { return AskOutcome(text: "", needsStrongerModel: false) }

    // 1. Cheap guided classification: is this advice / planning the small model can't do well?
    let needsStronger = (try? await classify(question)) == .advice
    try Task.checkCancellation()

    // 2. History: last N turns, each and in total capped (koemori pattern).
    var history: [(role: String, text: String)] = []
    var budget = historyTokens
    for turn in req.history.suffix(historyTurns).reversed() {
      let text = TokenEstimator.truncate(turn.text, toTokens: min(historyTurnTokens, budget))
      if text.isEmpty { break }
      budget -= TokenEstimator.estimate(text)
      history.insert((role: turn.role, text: text), at: 0)
      if budget <= 0 { break }
    }

    // 3. Tools over the live snapshot (snapshot + Siri inbox not merged yet).
    let data = AskData(snapshot: SuitoSiriStore.liveSnapshot())
    let snapshot = data.snapshot
    let today = snapshot?.today ?? SuitoSiriStore.dayString(Date())
    let instructions = SuitoPrompts.askInstructions(
      locale: req.locale,
      today: today,
      thisMonth: String(today.prefix(7)),
      expCats: Array((snapshot?.expCats ?? []).prefix(60)),
      incCats: Array((snapshot?.incCats ?? []).prefix(30)),
      currency: snapshot.map { "\($0.currency.code) (\($0.currency.symbol))" } ?? "JPY (¥)")
    let tools: [any Tool] = [PeriodSummaryTool(data: data), CategorySpendingTool(data: data), FindEntriesTool(data: data)]
    let session = LanguageModelSession(model: .default, tools: tools, instructions: instructions)
    let options = GenerationOptions(temperature: 0.3, maximumResponseTokens: responseTokens)
    let prompt = SuitoPrompts.askPrompt(question: TokenEstimator.truncate(question, toTokens: 400), history: history)

    var latest = ""
    // Snapshot.content is the cumulative text so far (String.PartiallyGenerated == String).
    for try await snapshot in session.streamResponse(to: prompt, options: options) {
      try Task.checkCancellation()
      latest = SuitoPostProcess.noDashes(snapshot.content, locale: req.locale)
      onText(latest)
    }
    return AskOutcome(text: latest.trimmingCharacters(in: .whitespacesAndNewlines), needsStrongerModel: needsStronger)
  }

  static func classify(_ question: String) async throws -> GenAskKind {
    let session = LanguageModelSession(model: .default, instructions: SuitoPrompts.askRouteInstructions())
    let options = GenerationOptions(temperature: 0.0, maximumResponseTokens: 40)
    let prompt = "Question: \(TokenEstimator.truncate(question, toTokens: 300))"
    return try await session.respond(to: prompt, generating: GenAskRoute.self, options: options).content.kind
  }
}

/// Immutable view of the snapshot shared by the tools.
struct AskData: Sendable {
  let snapshot: SuitoSiriSnapshot?

  var symbol: String { snapshot?.currency.symbol ?? "¥" }

  func money(_ amount: Double) -> String { SuitoSiriStore.formatAmount(amount, symbol: symbol) }

  func range(_ raw: String) -> SuitoMonthRange? {
    guard let snapshot else { return nil }
    return SuitoSiriStore.parsePeriod(raw, today: snapshot.today)
  }

  static let noData = "No data: the app has not shared any entries yet."
}

struct PeriodSummaryTool: Tool {
  let name = "periodSummary"
  let description = "Income, spending, net, budget left, no-spend days and spending per category for a month or a range of months."
  let data: AskData

  func call(arguments: GenPeriodArgs) async throws -> String {
    guard let snapshot = data.snapshot else { return AskData.noData }
    guard let range = data.range(arguments.period) else {
      return "Unknown period \"\(arguments.period)\". Use YYYY-MM or YYYY-MM..YYYY-MM."
    }
    let s = SuitoSiriStore.summary(snapshot, range: range)
    if s.missingMonths.count == range.monthKeys.count { return "No data for \(range.label)." }
    var lines = [
      "Period: \(range.label)",
      "Income: \(data.money(s.income))",
      "Spending: \(data.money(s.expense))",
      "Net: \(data.money(s.net))",
    ]
    if let budget = s.budget { lines.append("Budget: \(data.money(budget))") }
    if let left = s.budgetLeft { lines.append("Budget left: \(data.money(left))") }
    lines.append("No-spend days: \(s.noSpendDays)")
    if !s.byCategory.isEmpty {
      lines.append("Spending by category: " + s.byCategory.prefix(12).map { "\($0.name) \(data.money($0.amount))" }.joined(separator: ", "))
    }
    if !s.missingMonths.isEmpty { lines.append("No data for: \(s.missingMonths.joined(separator: ", "))") }
    return lines.joined(separator: "\n")
  }
}

struct CategorySpendingTool: Tool {
  let name = "categorySpending"
  let description = "Total amount for one category in a month or a range of months."
  let data: AskData

  func call(arguments: GenCategoryArgs) async throws -> String {
    guard let snapshot = data.snapshot else { return AskData.noData }
    guard let category = SuitoSiriStore.matchCategory(arguments.category, in: snapshot) else {
      return "Unknown category \"\(arguments.category)\". Categories: \((snapshot.expCats + snapshot.incCats).joined(separator: ", "))"
    }
    guard let range = data.range(arguments.period) else {
      return "Unknown period \"\(arguments.period)\". Use YYYY-MM or YYYY-MM..YYYY-MM."
    }
    let total = SuitoSiriStore.categoryTotal(snapshot, category: category, range: range)
    let count = SuitoSiriStore.findEntries(snapshot, range: range, category: category, text: nil, limit: 10_000).count
    return "\(category), \(range.label): \(data.money(total)) (\(count) entries)"
  }
}

struct FindEntriesTool: Tool {
  let name = "findEntries"
  let description = "Lists individual entries (newest first, at most 30), filtered by period, category and/or words in the note."
  let data: AskData

  func call(arguments: GenFindArgs) async throws -> String {
    guard let snapshot = data.snapshot else { return AskData.noData }
    let period = arguments.period.trimmingCharacters(in: .whitespaces)
    var range: SuitoMonthRange?
    if !period.isEmpty {
      guard let parsed = data.range(period) else {
        return "Unknown period \"\(period)\". Use YYYY-MM or YYYY-MM..YYYY-MM, or leave it empty."
      }
      range = parsed
    }
    var category: String?
    let rawCategory = arguments.category.trimmingCharacters(in: .whitespaces)
    if !rawCategory.isEmpty {
      guard let hit = SuitoSiriStore.matchCategory(rawCategory, in: snapshot) else {
        return "Unknown category \"\(rawCategory)\"."
      }
      category = hit
    }
    let text = arguments.text.trimmingCharacters(in: .whitespaces)
    let entries = SuitoSiriStore.findEntries(
      snapshot, range: range, category: category, text: text.isEmpty ? nil : text, limit: SuitoAsk.findLimit)
    if entries.isEmpty { return "No matching entries." }
    let lines = entries.map { e -> String in
      let sign = e.type == "income" ? "+" : ""
      let note = e.note.isEmpty ? "" : " \"\(e.note)\""
      let tags = (e.repeat == true ? " (repeating)" : "") + (e.inbox == true ? " (added via Siri)" : "")
      return "\(e.date) \(e.category) \(sign)\(data.money(e.amount))\(note)\(tags)"
    }
    return "\(entries.count) entries:\n" + lines.joined(separator: "\n")
  }
}
