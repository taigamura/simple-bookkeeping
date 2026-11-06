// Compiled into the MAIN APP TARGET only (copied by plugins/withSuitoAppIntents.js).
// Siri / Shortcuts actions over the Siri snapshot + inbox files (ADR-0006). They work on any
// iOS 26 iPhone: no Foundation Models needed. Swift only looks up and adds; JS did the maths.

import AppIntents
import Foundation
internal import SuitoAi

// MARK: - Add entry

struct AddEntryIntent: AppIntent {
  static let title: LocalizedStringResource = "Add Entry"
  static let description: IntentDescription? = IntentDescription("Records an expense or income in Suito. It shows up in the app the next time you open it.")
  static let openAppWhenRun = false

  @Parameter(title: "Amount", requestValueDialog: "How much?")
  var amount: Int

  @Parameter(title: "Category", requestValueDialog: "Which category?")
  var category: CategoryEntity

  @Parameter(title: "Note")
  var note: String?

  @Parameter(title: "Date")
  var date: Date?

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$amount) to \(\.$category)") {
      \.$note
      \.$date
    }
  }

  init() {}

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let ja = SuitoSiriStore.prefersJapanese
    guard amount > 0 else {
      return .result(dialog: IntentDialog(stringLiteral: ja ? "金額は1以上にしてください。" : "The amount must be more than zero."))
    }
    let snapshot = SuitoSiriStore.loadSnapshot()
    let symbol = snapshot?.currency.symbol ?? "¥"
    let isIncome = snapshot.map { $0.incCats.contains(category.id) && !$0.expCats.contains(category.id) } ?? category.isIncome
    let entry = SuitoInboxEntry(
      id: UUID().uuidString.lowercased(),
      createdAt: ISO8601DateFormatter().string(from: Date()),
      date: SuitoSiriStore.dayString(date ?? Date()),
      type: isIncome ? "income" : "expense",
      amount: Double(amount),
      category: category.id,
      note: (note ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
    try SuitoSiriStore.appendInbox(entry)
    let money = SuitoSiriStore.formatAmount(Double(amount), symbol: symbol)
    let text = ja ? "\(category.id)に\(money)を記録しました" : "Recorded \(money) in \(category.id)."
    return .result(dialog: IntentDialog(stringLiteral: text))
  }
}

// MARK: - Period summary

struct PeriodSummaryIntent: AppIntent {
  static let title: LocalizedStringResource = "Summary"
  static let description: IntentDescription? = IntentDescription("Income, spending, net, budget left and no-spend days for a month or a range of months.")
  static let openAppWhenRun = false

  @Parameter(title: "Period", default: .thisMonth)
  var period: PeriodPreset

  @Parameter(title: "From month", description: "Overrides Period when set (any day in the month).")
  var startMonth: Date?

  @Parameter(title: "To month", description: "Last month of the range (any day in it).")
  var endMonth: Date?

  static var parameterSummary: some ParameterSummary {
    Summary("Summary for \(\.$period)") {
      \.$startMonth
      \.$endMonth
    }
  }

  init() {}

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let ja = SuitoSiriStore.prefersJapanese
    guard let snapshot = SuitoSiriStore.liveSnapshot(),
          let range = SuitoIntentSupport.range(preset: period, start: startMonth, end: endMonth, today: snapshot.today)
    else {
      let text = ja ? SuitoIntentSupport.noDataJa : SuitoIntentSupport.noDataEn
      return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
    let s = SuitoSiriStore.summary(snapshot, range: range)
    let money = { (v: Double) in SuitoSiriStore.formatAmount(v, symbol: snapshot.currency.symbol) }
    let label = SuitoIntentSupport.periodLabel(range, preset: period, explicit: startMonth != nil, ja: ja)

    var spoken: String
    if ja {
      spoken = "\(label)の支出は\(money(s.expense))、収入は\(money(s.income))、収支は\(money(s.net))です。"
      if let left = s.budgetLeft { spoken += "予算の残りは\(money(left))です。" }
      spoken += "支出ゼロの日は\(s.noSpendDays)日でした。"
    } else {
      spoken = "In \(label) you spent \(money(s.expense)) and received \(money(s.income)), net \(money(s.net))."
      if let left = s.budgetLeft { spoken += " Budget left: \(money(left))." }
      spoken += " No-spend days: \(s.noSpendDays)."
    }
    // The value is richer than the dialog so Shortcuts "Use Model" / ChatGPT can reason over it.
    var lines = [
      "Period: \(range.label)",
      "Income: \(money(s.income))",
      "Spending: \(money(s.expense))",
      "Net: \(money(s.net))",
    ]
    if let budget = s.budget { lines.append("Budget: \(money(budget))") }
    if let left = s.budgetLeft { lines.append("Budget left: \(money(left))") }
    lines.append("No-spend days: \(s.noSpendDays)")
    for item in s.byCategory { lines.append("\(item.name): \(money(item.amount))") }
    if !s.missingMonths.isEmpty { lines.append("No data for: \(s.missingMonths.joined(separator: ", "))") }
    return .result(value: lines.joined(separator: "\n"), dialog: IntentDialog(stringLiteral: spoken))
  }
}

// MARK: - Category spending

struct CategorySpendingIntent: AppIntent {
  static let title: LocalizedStringResource = "Spending by Category"
  static let description: IntentDescription? = IntentDescription("How much went to one category in a month or a range of months.")
  static let openAppWhenRun = false

  @Parameter(title: "Category", requestValueDialog: "Which category?")
  var category: CategoryEntity

  @Parameter(title: "Period", default: .thisMonth)
  var period: PeriodPreset

  @Parameter(title: "From month", description: "Overrides Period when set (any day in the month).")
  var startMonth: Date?

  @Parameter(title: "To month", description: "Last month of the range (any day in it).")
  var endMonth: Date?

  static var parameterSummary: some ParameterSummary {
    Summary("\(\.$category) spending for \(\.$period)") {
      \.$startMonth
      \.$endMonth
    }
  }

  init() {}

  func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
    let ja = SuitoSiriStore.prefersJapanese
    guard let snapshot = SuitoSiriStore.liveSnapshot(),
          let range = SuitoIntentSupport.range(preset: period, start: startMonth, end: endMonth, today: snapshot.today)
    else {
      let text = ja ? SuitoIntentSupport.noDataJa : SuitoIntentSupport.noDataEn
      return .result(value: 0, dialog: IntentDialog(stringLiteral: text))
    }
    let name = SuitoSiriStore.matchCategory(category.id, in: snapshot) ?? category.id
    let total = SuitoSiriStore.categoryTotal(snapshot, category: name, range: range)
    let money = SuitoSiriStore.formatAmount(total, symbol: snapshot.currency.symbol)
    let label = SuitoIntentSupport.periodLabel(range, preset: period, explicit: startMonth != nil, ja: ja)
    let text = ja ? "\(label)の\(name)は\(money)です。" : "\(name) for \(label): \(money)."
    return .result(value: Int(total.rounded()), dialog: IntentDialog(stringLiteral: text))
  }
}

// MARK: - Find entries

struct FindEntriesIntent: AppIntent {
  static let title: LocalizedStringResource = "Find Entries"
  static let description: IntentDescription? = IntentDescription("Returns Suito entries for a period, a category or words in the note, newest first.")
  static let openAppWhenRun = false

  @Parameter(title: "Period")
  var period: PeriodPreset?

  @Parameter(title: "From month", description: "Overrides Period when set (any day in the month).")
  var startMonth: Date?

  @Parameter(title: "To month", description: "Last month of the range (any day in it).")
  var endMonth: Date?

  @Parameter(title: "Category")
  var category: CategoryEntity?

  @Parameter(title: "Text in note")
  var text: String?

  @Parameter(title: "Limit", description: "Maximum number of entries (1 to 500).", default: 100)
  var limit: Int

  static var parameterSummary: some ParameterSummary {
    Summary("Find entries") {
      \.$period
      \.$startMonth
      \.$endMonth
      \.$category
      \.$text
      \.$limit
    }
  }

  init() {}

  func perform() async throws -> some IntentResult & ReturnsValue<[EntryEntity]> & ProvidesDialog {
    let ja = SuitoSiriStore.prefersJapanese
    guard let snapshot = SuitoSiriStore.liveSnapshot() else {
      let text = ja ? SuitoIntentSupport.noDataJa : SuitoIntentSupport.noDataEn
      return .result(value: [], dialog: IntentDialog(stringLiteral: text))
    }
    let range: SuitoMonthRange? = (period != nil || startMonth != nil)
      ? SuitoIntentSupport.range(preset: period, start: startMonth, end: endMonth, today: snapshot.today)
      : nil
    let name = category.map { SuitoSiriStore.matchCategory($0.id, in: snapshot) ?? $0.id }
    let found = SuitoSiriStore.findEntries(snapshot, range: range, category: name, text: text, limit: max(1, min(500, limit)))
    let entities = found.map { EntryEntity(entry: $0, symbol: snapshot.currency.symbol) }
    let dialog = ja ? "\(entities.count)件見つかりました。" : "Found \(entities.count) entries."
    return .result(value: entities, dialog: IntentDialog(stringLiteral: dialog))
  }
}
