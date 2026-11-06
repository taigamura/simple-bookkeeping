import Foundation

// Siri bridge files in the app's own Documents dir (ADR-0006 amendment: no App Group; the App
// Intents run in the main app target, so they share this container).
//
//   suito-siri-snapshot.json  written by JS after every save (SiriSnapshot in ai/contract.ts)
//   suito-siri-inbox.json     JSON array of InboxEntry, appended by the Siri AddEntry intent,
//                             merged + cleared by the store on launch/foreground
//
// PUBLIC: the App Intents in plugins/app-intents/ `import SuitoAi` and use this directly.
// Swift only looks things up and adds; JS does all budget / recurrence maths.

public struct SuitoCurrency: Codable, Sendable {
  public var symbol: String
  public var code: String
}

public struct SuitoSnapshotEntry: Codable, Sendable {
  public var id: String
  public var date: String // YYYY-MM-DD
  public var type: String // 'income' | 'expense'
  public var amount: Double
  public var category: String
  public var note: String
  public var `repeat`: Bool?
  public var inbox: Bool?
}

public struct SuitoMonthTotals: Codable, Sendable {
  public var income: Double
  public var expense: Double
  public var net: Double
  public var byCategory: [String: Double]
  public var budget: Double?
  public var budgetLeft: Double?
  public var noSpendDays: Int
}

public struct SuitoSiriSnapshot: Codable, Sendable {
  public var version: Int
  public var generatedAt: String
  public var locale: String
  public var currency: SuitoCurrency
  public var today: String
  public var expCats: [String]
  public var incCats: [String]
  public var entries: [SuitoSnapshotEntry]
  public var months: [String: SuitoMonthTotals]
}

public struct SuitoInboxEntry: Codable, Sendable {
  public var id: String
  public var createdAt: String
  public var date: String
  public var type: String
  public var amount: Double
  public var category: String
  public var note: String

  public init(id: String, createdAt: String, date: String, type: String, amount: Double, category: String, note: String) {
    self.id = id
    self.createdAt = createdAt
    self.date = date
    self.type = type
    self.amount = amount
    self.category = category
    self.note = note
  }
}

/// An inclusive range of month keys ('YYYY-MM', 1-based month).
public struct SuitoMonthRange: Sendable, Equatable {
  public var start: String
  public var end: String

  public init(start: String, end: String) {
    if start <= end {
      self.start = start
      self.end = end
    } else {
      self.start = end
      self.end = start
    }
  }

  public func contains(monthKey: String) -> Bool { monthKey >= start && monthKey <= end }
  public func contains(date: String) -> Bool { contains(monthKey: String(date.prefix(7))) }

  public var label: String { start == end ? start : "\(start)..\(end)" }

  public var monthKeys: [String] {
    var keys: [String] = []
    guard let s = SuitoSiriStore.splitMonthKey(start), let e = SuitoSiriStore.splitMonthKey(end) else { return [] }
    var (y, m) = s
    while (y, m) <= e && keys.count < 600 {
      keys.append(SuitoSiriStore.monthKey(y, m))
      m += 1
      if m > 12 { m = 1; y += 1 }
    }
    return keys
  }
}

public struct SuitoPeriodSummary: Sendable {
  public var range: SuitoMonthRange
  public var income: Double
  public var expense: Double
  public var net: Double
  public var budget: Double?
  public var budgetLeft: Double?
  public var noSpendDays: Int
  public var byCategory: [(name: String, amount: Double)]
  /// Months in the range that the snapshot has no totals for (outside its ±12 month window).
  public var missingMonths: [String]
}

public enum SuitoSiriStore {
  public static let snapshotFileName = "suito-siri-snapshot.json"
  public static let inboxFileName = "suito-siri-inbox.json"

  private static let lock = NSLock()

  public static var documentsURL: URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
  }
  public static var snapshotURL: URL { documentsURL.appendingPathComponent(snapshotFileName) }
  public static var inboxURL: URL { documentsURL.appendingPathComponent(inboxFileName) }

  // MARK: snapshot

  /// Atomic write of the JSON JS built. Rejects text that isn't a decodable snapshot.
  public static func writeSnapshot(json: String) throws {
    let data = Data(json.utf8)
    _ = try JSONDecoder().decode(SuitoSiriSnapshot.self, from: data)
    try coordinatedWrite(data, to: snapshotURL)
  }

  public static func loadSnapshot() -> SuitoSiriSnapshot? {
    guard let data = coordinatedRead(snapshotURL) else { return nil }
    return try? JSONDecoder().decode(SuitoSiriSnapshot.self, from: data)
  }

  /// The snapshot plus inbox entries added since it was written (Siri answers must count them).
  /// Adds each new inbox entry to its month's totals; nothing else is recomputed.
  public static func liveSnapshot() -> SuitoSiriSnapshot? {
    guard var snapshot = loadSnapshot() else { return nil }
    let known = Set(snapshot.entries.map { $0.id })
    for item in readInbox() where !known.contains(item.id) {
      snapshot.entries.append(SuitoSnapshotEntry(
        id: item.id, date: item.date, type: item.type, amount: item.amount, category: item.category,
        note: item.note, repeat: false, inbox: true))
      let key = String(item.date.prefix(7))
      guard var month = snapshot.months[key] else { continue }
      if item.type == "income" {
        month.income += item.amount
        month.net += item.amount
      } else {
        month.expense += item.amount
        month.net -= item.amount
        month.byCategory[item.category, default: 0] += item.amount
        if let left = month.budgetLeft { month.budgetLeft = left - item.amount }
      }
      snapshot.months[key] = month
    }
    snapshot.entries.sort { $0.date < $1.date }
    return snapshot
  }

  // MARK: inbox

  public static func readInbox() -> [SuitoInboxEntry] {
    guard let data = coordinatedRead(inboxURL) else { return [] }
    return (try? JSONDecoder().decode([SuitoInboxEntry].self, from: data)) ?? []
  }

  public static func readInboxJSON() -> String {
    let entries = readInbox()
    guard let data = try? JSONEncoder().encode(entries) else { return "[]" }
    return String(decoding: data, as: UTF8.self)
  }

  public static func appendInbox(_ entry: SuitoInboxEntry) throws {
    try mutateInbox { entries in
      if !entries.contains(where: { $0.id == entry.id }) { entries.append(entry) }
    }
  }

  /// Removes only the given ids (an entry Siri adds while JS merges survives).
  public static func clearInbox(ids: [String]) throws {
    let drop = Set(ids)
    try mutateInbox { entries in entries.removeAll { drop.contains($0.id) } }
  }

  private static func mutateInbox(_ change: (inout [SuitoInboxEntry]) -> Void) throws {
    lock.lock()
    defer { lock.unlock() }
    var coordinationError: NSError?
    var thrown: Error?
    NSFileCoordinator().coordinate(writingItemAt: inboxURL, options: .forMerging, error: &coordinationError) { url in
      do {
        var entries: [SuitoInboxEntry] = []
        if let data = try? Data(contentsOf: url) {
          entries = (try? JSONDecoder().decode([SuitoInboxEntry].self, from: data)) ?? []
        }
        change(&entries)
        try JSONEncoder().encode(entries).write(to: url, options: .atomic)
      } catch {
        thrown = error
      }
    }
    if let error = coordinationError ?? thrown { throw error }
  }

  private static func coordinatedWrite(_ data: Data, to target: URL) throws {
    lock.lock()
    defer { lock.unlock() }
    var coordinationError: NSError?
    var thrown: Error?
    NSFileCoordinator().coordinate(writingItemAt: target, options: .forReplacing, error: &coordinationError) { url in
      do { try data.write(to: url, options: .atomic) } catch { thrown = error }
    }
    if let error = coordinationError ?? thrown { throw error }
  }

  private static func coordinatedRead(_ target: URL) -> Data? {
    guard FileManager.default.fileExists(atPath: target.path) else { return nil }
    var result: Data?
    var coordinationError: NSError?
    NSFileCoordinator().coordinate(readingItemAt: target, options: [], error: &coordinationError) { url in
      result = try? Data(contentsOf: url)
    }
    return result
  }

  // MARK: lookups (look up and add only)

  public static func summary(_ snapshot: SuitoSiriSnapshot, range: SuitoMonthRange) -> SuitoPeriodSummary {
    var income = 0.0, expense = 0.0, net = 0.0, noSpend = 0
    var budget: Double?, left: Double?
    var byCategory: [String: Double] = [:]
    var missing: [String] = []
    for key in range.monthKeys {
      guard let month = snapshot.months[key] else {
        missing.append(key)
        continue
      }
      income += month.income
      expense += month.expense
      net += month.net
      noSpend += month.noSpendDays
      if let b = month.budget { budget = (budget ?? 0) + b }
      if let l = month.budgetLeft { left = (left ?? 0) + l }
      for (name, amount) in month.byCategory { byCategory[name, default: 0] += amount }
    }
    let sorted = byCategory.filter { $0.value != 0 }.sorted { $0.value > $1.value }.map { (name: $0.key, amount: $0.value) }
    return SuitoPeriodSummary(
      range: range, income: income, expense: expense, net: net, budget: budget, budgetLeft: left,
      noSpendDays: noSpend, byCategory: sorted, missingMonths: missing)
  }

  /// Total for one category over the range. Expense categories sum the precomputed
  /// `byCategory`; income categories sum their entries.
  public static func categoryTotal(_ snapshot: SuitoSiriSnapshot, category: String, range: SuitoMonthRange) -> Double {
    if snapshot.incCats.contains(category) && !snapshot.expCats.contains(category) {
      return snapshot.entries
        .filter { $0.type == "income" && $0.category == category && range.contains(date: $0.date) }
        .reduce(0) { $0 + $1.amount }
    }
    return range.monthKeys.reduce(0) { $0 + (snapshot.months[$1]?.byCategory[category] ?? 0) }
  }

  /// Newest first, capped at `limit`.
  public static func findEntries(
    _ snapshot: SuitoSiriSnapshot, range: SuitoMonthRange?, category: String?, text: String?, limit: Int
  ) -> [SuitoSnapshotEntry] {
    let needle = text.map(normalize).flatMap { $0.isEmpty ? nil : $0 }
    let today = snapshot.today
    var result: [SuitoSnapshotEntry] = []
    for entry in snapshot.entries.reversed() {
      // Projected repeats beyond today aren't "entries" yet unless a range asks for them.
      if range == nil && entry.date > today { continue }
      if let range, !range.contains(date: entry.date) { continue }
      if let category, entry.category != category { continue }
      if let needle, !normalize(entry.note).contains(needle) && !normalize(entry.category).contains(needle) { continue }
      result.append(entry)
      if result.count >= limit { break }
    }
    return result
  }

  /// Resolves a spoken / typed category to one of the snapshot's categories.
  public static func matchCategory(_ raw: String, in snapshot: SuitoSiriSnapshot) -> String? {
    matchCategory(raw, candidates: snapshot.expCats + snapshot.incCats)
  }

  public static func matchCategory(_ raw: String, candidates: [String]) -> String? {
    let key = normalize(raw)
    if key.isEmpty { return nil }
    if let exact = candidates.first(where: { $0 == raw }) { return exact }
    if let loose = candidates.first(where: { normalize($0) == key }) { return loose }
    return candidates.first(where: { normalize($0).contains(key) || key.contains(normalize($0)) && !normalize($0).isEmpty })
  }

  // MARK: periods

  /// Parses 'YYYY-MM', 'YYYY-MM..YYYY-MM', 'YYYY', 'YYYY-MM-DD' (its month), or
  /// this-month / last-month / this-year / last-year.
  public static func parsePeriod(_ raw: String, today: String) -> SuitoMonthRange? {
    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      .replacingOccurrences(of: "/", with: "-")
    guard let todayMonth = splitMonthKey(String(today.prefix(7))) ?? splitMonthKey(monthKey(of: Date())) else { return nil }
    let (ty, tm) = todayMonth
    switch text.replacingOccurrences(of: "_", with: "-").replacingOccurrences(of: " ", with: "-") {
    case "this-month", "current-month", "今月": return SuitoMonthRange(start: monthKey(ty, tm), end: monthKey(ty, tm))
    case "last-month", "previous-month", "先月":
      let (y, m) = tm == 1 ? (ty - 1, 12) : (ty, tm - 1)
      return SuitoMonthRange(start: monthKey(y, m), end: monthKey(y, m))
    case "this-year", "今年": return SuitoMonthRange(start: monthKey(ty, 1), end: monthKey(ty, 12))
    case "last-year", "去年", "昨年": return SuitoMonthRange(start: monthKey(ty - 1, 1), end: monthKey(ty - 1, 12))
    default: break
    }
    for separator in ["..", "~", "〜", " to "] where text.contains(separator) {
      let parts = text.components(separatedBy: separator)
      if parts.count == 2, let a = parsePeriod(parts[0], today: today), let b = parsePeriod(parts[1], today: today) {
        return SuitoMonthRange(start: min(a.start, b.start), end: max(a.end, b.end))
      }
      return nil
    }
    let digits = text.split(separator: "-").map(String.init)
    if digits.count == 1, let y = Int(digits[0]), (1900...2999).contains(y) {
      return SuitoMonthRange(start: monthKey(y, 1), end: monthKey(y, 12))
    }
    if digits.count >= 2, let y = Int(digits[0]), let m = Int(digits[1]), (1900...2999).contains(y), (1...12).contains(m) {
      return SuitoMonthRange(start: monthKey(y, m), end: monthKey(y, m))
    }
    return nil
  }

  public static func monthKey(_ y: Int, _ m: Int) -> String { String(format: "%04d-%02d", y, m) }

  public static func splitMonthKey(_ key: String) -> (Int, Int)? {
    let parts = key.split(separator: "-")
    guard parts.count >= 2, let y = Int(parts[0]), let m = Int(parts[1]) else { return nil }
    return (y, m)
  }

  public static func monthKey(of date: Date) -> String {
    let c = calendar.dateComponents([.year, .month], from: date)
    return monthKey(c.year ?? 2000, c.month ?? 1)
  }

  // MARK: formatting

  public static var calendar: Calendar {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone.current
    return cal
  }

  public static func dayString(_ date: Date) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
  }

  public static func date(fromDay day: String) -> Date? {
    let parts = day.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
  }

  /// "¥1,234" (whole units; the ledger has no minor units).
  public static func formatAmount(_ amount: Double, symbol: String) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.usesGroupingSeparator = true
    formatter.groupingSeparator = ","
    formatter.groupingSize = 3
    formatter.maximumFractionDigits = 0
    let rounded = amount.rounded()
    let body = formatter.string(from: NSNumber(value: abs(rounded))) ?? String(Int(abs(rounded)))
    return (rounded < 0 ? "-" : "") + symbol + body
  }

  public static var currencySymbol: String { loadSnapshot()?.currency.symbol ?? "¥" }

  /// Japanese when the snapshot says so, else the device's first preferred language.
  public static var prefersJapanese: Bool {
    if let locale = loadSnapshot()?.locale { return locale == "ja" }
    return Locale.preferredLanguages.first?.hasPrefix("ja") ?? false
  }

  public static func normalize(_ text: String) -> String {
    let half = text.applyingTransform(.fullwidthToHalfwidth, reverse: false) ?? text
    return half.lowercased()
      .replacingOccurrences(of: " ", with: "")
      .replacingOccurrences(of: "\u{3000}", with: "")
  }
}
