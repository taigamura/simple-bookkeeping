// Compiled into the MAIN APP TARGET only (copied by plugins/withSuitoAppIntents.js): App Intents
// metadata is only extracted from the app target, never from a CocoaPods static library.
// Data access goes through SuitoSiriStore in the SuitoAi pod (public API).

import AppIntents
import Foundation
import SuitoAi

// MARK: - Category

struct CategoryEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Category"
  static let defaultQuery = CategoryQuery()

  let id: String
  let isIncome: Bool

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(id)")
  }
}

struct CategoryQuery: EntityStringQuery {
  private func all() -> [CategoryEntity] {
    guard let snapshot = SuitoSiriStore.loadSnapshot() else { return [] }
    let expense = snapshot.expCats.map { CategoryEntity(id: $0, isIncome: false) }
    let income = snapshot.incCats.filter { !snapshot.expCats.contains($0) }.map { CategoryEntity(id: $0, isIncome: true) }
    return expense + income
  }

  func entities(for identifiers: [String]) async throws -> [CategoryEntity] {
    let cats = all()
    return identifiers.compactMap { id in cats.first { $0.id == id } }
  }

  func entities(matching string: String) async throws -> [CategoryEntity] {
    let cats = all()
    guard let hit = SuitoSiriStore.matchCategory(string, candidates: cats.map { $0.id }) else { return [] }
    return cats.filter { $0.id == hit }
  }

  func suggestedEntities() async throws -> [CategoryEntity] {
    all()
  }
}

// MARK: - Entry

struct EntryEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Suito Entry"
  static let defaultQuery = EntryQuery()

  let id: String

  @Property(title: "Date")
  var date: Date

  @Property(title: "Type")
  var kind: String

  @Property(title: "Amount")
  var amount: Int

  @Property(title: "Category")
  var category: String

  @Property(title: "Note")
  var note: String

  @Property(title: "Repeating")
  var repeating: Bool

  let amountText: String

  init(entry: SuitoSnapshotEntry, symbol: String) {
    id = entry.id
    amountText = (entry.type == "income" ? "+" : "") + SuitoSiriStore.formatAmount(entry.amount, symbol: symbol)
    date = SuitoSiriStore.date(fromDay: entry.date) ?? Date()
    kind = entry.type
    amount = Int(entry.amount.rounded())
    category = entry.category
    note = entry.note
    repeating = entry.repeat ?? false
  }

  var displayRepresentation: DisplayRepresentation {
    let day = SuitoSiriStore.dayString(date)
    let subtitle = note.isEmpty ? day : "\(note)  \(day)"
    return DisplayRepresentation(title: "\(category) \(amountText)", subtitle: "\(subtitle)")
  }
}

struct EntryQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [EntryEntity] {
    guard let snapshot = SuitoSiriStore.liveSnapshot() else { return [] }
    let wanted = Set(identifiers)
    return snapshot.entries.filter { wanted.contains($0.id) }.map { EntryEntity(entry: $0, symbol: snapshot.currency.symbol) }
  }

  func suggestedEntities() async throws -> [EntryEntity] {
    guard let snapshot = SuitoSiriStore.liveSnapshot() else { return [] }
    return SuitoSiriStore.findEntries(snapshot, range: nil, category: nil, text: nil, limit: 20)
      .map { EntryEntity(entry: $0, symbol: snapshot.currency.symbol) }
  }
}

// MARK: - Period

enum PeriodPreset: String, AppEnum {
  case thisMonth
  case lastMonth
  case thisYear
  case lastYear

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Period"
  static let caseDisplayRepresentations: [PeriodPreset: DisplayRepresentation] = [
    .thisMonth: DisplayRepresentation(title: "This month", synonyms: ["今月", "this month"]),
    .lastMonth: DisplayRepresentation(title: "Last month", synonyms: ["先月", "last month"]),
    .thisYear: DisplayRepresentation(title: "This year", synonyms: ["今年", "this year"]),
    .lastYear: DisplayRepresentation(title: "Last year", synonyms: ["去年", "昨年", "last year"]),
  ]

  var key: String {
    switch self {
    case .thisMonth: return "this-month"
    case .lastMonth: return "last-month"
    case .thisYear: return "this-year"
    case .lastYear: return "last-year"
    }
  }
}

enum SuitoIntentSupport {
  /// The preset, overridden by explicit start / end months when given (Shortcuts).
  static func range(preset: PeriodPreset?, start: Date?, end: Date?, today: String) -> SuitoMonthRange? {
    if let start {
      let startKey = SuitoSiriStore.monthKey(of: start)
      let endKey = end.map { SuitoSiriStore.monthKey(of: $0) } ?? startKey
      return SuitoMonthRange(start: startKey, end: endKey)
    }
    return SuitoSiriStore.parsePeriod((preset ?? .thisMonth).key, today: today)
  }

  static func periodLabel(_ range: SuitoMonthRange, preset: PeriodPreset?, explicit: Bool, ja: Bool) -> String {
    if !explicit, let preset {
      switch preset {
      case .thisMonth: return ja ? "今月" : "this month"
      case .lastMonth: return ja ? "先月" : "last month"
      case .thisYear: return ja ? "今年" : "this year"
      case .lastYear: return ja ? "去年" : "last year"
      }
    }
    func month(_ key: String) -> String {
      guard let ym = SuitoSiriStore.splitMonthKey(key) else { return key }
      let (y, m) = ym
      if ja { return "\(y)年\(m)月" }
      let names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      return "\(names[max(0, min(11, m - 1))]) \(y)"
    }
    if range.start == range.end { return month(range.start) }
    return ja ? "\(month(range.start))〜\(month(range.end))" : "\(month(range.start)) to \(month(range.end))"
  }

  static let noDataJa = "まだSuitoのデータがありません。アプリを一度開いてください。"
  static let noDataEn = "Suito has no data yet. Open the app once first."
}

/// Called from the SuitoAi pod (via the ObjC runtime) after each snapshot write, so App Shortcut
/// phrases with a category parameter learn the current category list.
@objc(SuitoShortcutsUpdater)
final class SuitoShortcutsUpdater: NSObject {
  @objc static func update() {
    SuitoAppShortcuts.updateAppShortcutParameters()
  }
}
