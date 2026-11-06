import Foundation

// Deterministic post-processing (no FoundationModels types): dash removal, fact-token hygiene,
// relative-date resolution and amount extraction for parseEntry.

enum SuitoPostProcess {
  // MARK: dashes

  /// Em dashes / horizontal bars are never allowed in user-facing text (PRD story 65).
  static func noDashes(_ raw: String, locale: String) -> String {
    var text = raw
    if locale == "ja" {
      for dash in ["\u{2014}\u{2014}", "\u{2015}\u{2015}", "\u{2014}", "\u{2015}"] {
        text = text.replacingOccurrences(of: dash, with: "、")
      }
      while text.contains("、、") { text = text.replacingOccurrences(of: "、、", with: "、") }
      text = text.replacingOccurrences(of: "、。", with: "。")
    } else {
      for dash in ["\u{2014}\u{2014}", "\u{2015}\u{2015}", "\u{2014}", "\u{2015}"] {
        text = text.replacingOccurrences(of: dash, with: ", ")
      }
      while text.contains(" ,") { text = text.replacingOccurrences(of: " ,", with: ",") }
      while text.contains(",,") { text = text.replacingOccurrences(of: ",,", with: ",") }
      while text.contains("  ") { text = text.replacingOccurrences(of: "  ", with: " ") }
      text = text.replacingOccurrences(of: ", .", with: ".")
    }
    text = text.trimmingCharacters(in: .whitespacesAndNewlines)
    while text.hasPrefix("、") || text.hasPrefix(",") { text.removeFirst(); text = text.trimmingCharacters(in: .whitespaces) }
    while text.hasSuffix("、") || text.hasSuffix(",") { text.removeLast() }
    return text
  }

  // MARK: fact tokens

  private static let looseToken = try! NSRegularExpression(pattern: "\\{\\{?\\s*f\\s*[:：]\\s*([^{}]+?)\\s*\\}\\}?")
  private static let bareBraces = try! NSRegularExpression(pattern: "\\{\\s*([^{}:：]+?)\\s*\\}")
  private static let strictToken = try! NSRegularExpression(pattern: "\\{f:([^{}]+)\\}")

  /// Rewrites near-miss tokens ({ f: id }, {{f:id}}, {id} for a known id) to `{f:id}`.
  static func normalizeTokens(_ text: String, known: Set<String>) -> String {
    var out = replace(looseToken, in: text) { "{f:\($0)}" }
    out = replace(bareBraces, in: out) { inner in known.contains(inner) ? "{f:\(inner)}" : "{\(inner)}" }
    return out
  }

  static func citedIds(_ text: String) -> [String] {
    let ns = text as NSString
    return strictToken.matches(in: text, range: NSRange(location: 0, length: ns.length)).map {
      ns.substring(with: $0.range(at: 1))
    }
  }

  /// True when the text has a digit (ASCII or full-width) outside `{f:...}` tokens, or a brace
  /// that isn't part of a token.
  static func hasStrayNumbers(_ text: String) -> Bool {
    let stripped = replace(strictToken, in: text) { _ in "" }
    if stripped.contains("{") || stripped.contains("}") { return true }
    return stripped.unicodeScalars.contains { (0x30...0x39).contains($0.value) || (0xFF10...0xFF19).contains($0.value) }
  }

  /// Keeps a sentence only if every token is known and no number is written outside tokens.
  static func cleanCitedSentence(_ sentence: String, known: Set<String>) -> String? {
    let ids = citedIds(sentence)
    if ids.contains(where: { !known.contains($0) }) { return nil }
    if hasStrayNumbers(sentence) { return nil }
    return sentence
  }

  static func sentences(_ text: String) -> [String] {
    var result: [String] = []
    var current = ""
    var depth = 0
    let chars = Array(text)
    for (index, character) in chars.enumerated() {
      current.append(character)
      if character == "{" { depth += 1 }
      if character == "}" { depth = max(0, depth - 1) }
      guard depth == 0 else { continue }
      let isEnd: Bool
      switch character {
      case "。", "！", "？", "!", "?": isEnd = true
      case ".": isEnd = index + 1 >= chars.count || chars[index + 1] == " " || chars[index + 1] == "\n"
      default: isEnd = false
      }
      if isEnd {
        let sentence = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !sentence.isEmpty { result.append(sentence) }
        current = ""
      }
    }
    let tail = current.trimmingCharacters(in: .whitespacesAndNewlines)
    if !tail.isEmpty { result.append(tail) }
    return result
  }

  /// Letter paragraphs: dashes removed, tokens normalised, sentences citing unknown ids or writing
  /// literal numbers dropped, empty paragraphs dropped.
  static func letterParagraphs(_ raw: [String], known: Set<String>, locale: String) -> [String] {
    let joiner = locale == "ja" ? "" : " "
    var out: [String] = []
    for paragraph in raw {
      let text = normalizeTokens(noDashes(paragraph.replacingOccurrences(of: "\n", with: " "), locale: locale), known: known)
      let kept = sentences(text).compactMap { cleanCitedSentence($0, known: known) }
      let joined = kept.joined(separator: joiner).trimmingCharacters(in: .whitespacesAndNewlines)
      if !joined.isEmpty { out.append(joined) }
    }
    return out
  }

  /// Nudge: first sentence only; must cite at least one known fact and nothing unknown.
  static func nudgeText(_ raw: String, known: Set<String>, locale: String) -> String? {
    let text = normalizeTokens(noDashes(raw.replacingOccurrences(of: "\n", with: " "), locale: locale), known: known)
    guard let first = sentences(text).first, let clean = cleanCitedSentence(first, known: known) else { return nil }
    if citedIds(clean).isEmpty { return nil }
    return clean
  }

  // MARK: kindness (mirrors ai/cite.ts, which re-checks in JS)

  private static let jaBlock = ["使いすぎ", "無駄遣い", "浪費", "ダメ", "反省しましょう", "我慢"]
  private static let enBlock = try! NSRegularExpression(
    pattern: "\\b(overspent|wasteful|waste|bad|should have|failed)\\b", options: [.caseInsensitive])

  /// False when the prose outside the tokens scolds.
  static func isKind(_ text: String) -> Bool {
    let prose = replace(strictToken, in: text) { _ in " " }
    if jaBlock.contains(where: { prose.contains($0) }) { return false }
    let ns = prose as NSString
    return enBlock.firstMatch(in: prose, range: NSRange(location: 0, length: ns.length)) == nil
  }

  /// wordLine: the nudge rules (one sentence, >= 1 known fact, no digits, no dashes) plus kindness.
  static func lineText(_ raw: String, known: Set<String>, locale: String) -> String? {
    guard let text = nudgeText(raw, known: known, locale: locale), isKind(text) else { return nil }
    return text
  }

  // MARK: receipts

  private static let totalWords = ["合計", "総計", "税込", "お買上", "お買い上げ", "ご請求", "お支払", "total", "amount due"]
  private static let notTotalWords = [
    "小計", "消費税", "内税", "外税", "税額", "対象", "点数", "お預", "預り", "釣", "ポイント", "残高",
    "subtotal", "sub total", "tax", "change", "cash", "points",
  ]

  /// Amounts printed on total lines (合計 / 税込 / TOTAL ...), excluding subtotal, tax, cash and
  /// change lines. Used to check or replace the model's amount.
  static func receiptTotals(_ text: String) -> [Int] {
    var out: [Int] = []
    for rawLine in text.split(whereSeparator: { $0.isNewline }) {
      let line = (String(rawLine).applyingTransform(.fullwidthToHalfwidth, reverse: false) ?? String(rawLine)).lowercased()
      guard totalWords.contains(where: { line.contains($0) }) else { continue }
      if notTotalWords.contains(where: { line.contains($0) }) { continue }
      out.append(contentsOf: amountCandidates(line))
    }
    return out
  }

  /// The purchase date printed on a receipt: YYYY年M月D日, YYYY/M/D, YYYY-MM-DD, YYYY.M.D.
  /// Dates after today (OCR misreads) are rejected.
  static func receiptDate(_ raw: String, today: Day) -> Day? {
    let text = raw.applyingTransform(.fullwidthToHalfwidth, reverse: false) ?? raw
    guard let groups = match(text, pattern: "(20\\d{2})\\s*[年/.-]\\s*(\\d{1,2})\\s*[月/.-]\\s*(\\d{1,2})"), groups.count == 3 else {
      return nil
    }
    let day = Day(y: groups[0], m: groups[1], d: groups[2])
    if !isValid(day) { return nil }
    if (day.y, day.m, day.d) > (today.y, today.m, today.d) { return nil }
    return day
  }

  // MARK: parseEntry: dates

  struct Day: Equatable {
    var y: Int
    var m: Int // 1-based
    var d: Int
  }

  private static var calendar: Calendar {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    return cal
  }

  private static func toDate(_ day: Day) -> Date? {
    calendar.date(from: DateComponents(year: day.y, month: day.m, day: day.d, hour: 12))
  }

  private static func toDay(_ date: Date) -> Day {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return Day(y: c.year ?? 2000, m: c.month ?? 1, d: c.day ?? 1)
  }

  private static func shift(_ day: Day, days: Int) -> Day? {
    guard let date = toDate(day), let moved = calendar.date(byAdding: .day, value: days, to: date) else { return nil }
    return toDay(moved)
  }

  private static func isValid(_ day: Day) -> Bool {
    guard let date = toDate(day) else { return false }
    return toDay(date) == day
  }

  private static let jaWeekdays: [Character: Int] = ["日": 1, "月": 2, "火": 3, "水": 4, "木": 5, "金": 6, "土": 7]
  private static let enWeekdays: [(String, Int)] = [
    ("sunday", 1), ("monday", 2), ("tuesday", 3), ("wednesday", 4), ("thursday", 5), ("friday", 6), ("saturday", 7),
    ("sun", 1), ("mon", 2), ("tue", 3), ("wed", 4), ("thu", 5), ("fri", 6), ("sat", 7),
  ]

  private static func weekday(_ day: Day) -> Int {
    guard let date = toDate(day) else { return 1 }
    return calendar.component(.weekday, from: date)
  }

  /// Weekday (1 = Sun ... 7 = Sat) in the week before `today`'s week (weeks start on Monday).
  private static func lastWeek(_ target: Int, today: Day) -> Day? {
    let todayIndex = (weekday(today) + 5) % 7 // Mon = 0 ... Sun = 6
    let targetIndex = (target + 5) % 7
    return shift(today, days: -todayIndex - 7 + targetIndex)
  }

  /// Most recent `target` weekday on or before today.
  private static func recentWeekday(_ target: Int, today: Day) -> Day? {
    let back = (weekday(today) - target + 7) % 7
    return shift(today, days: -back)
  }

  /// Resolves relative / short date words against `today`. Returns nil when nothing matches.
  static func resolveDate(_ raw: String, today: Day) -> Day? {
    let text = (raw.applyingTransform(.fullwidthToHalfwidth, reverse: false) ?? raw).lowercased()
    if text.trimmingCharacters(in: .whitespaces).isEmpty { return nil }

    if text.contains("おととい") || text.contains("一昨日") || text.contains("day before yesterday") {
      return shift(today, days: -2)
    }
    if text.contains("昨日") || text.contains("きのう") || text.contains("yesterday") { return shift(today, days: -1) }
    if text.contains("今日") || text.contains("きょう") || text.contains("today") || text.contains("本日") { return today }

    if let n = firstInt(text, pattern: "(\\d{1,3})\\s*日前") ?? firstInt(text, pattern: "(\\d{1,3})\\s*days?\\s+ago") {
      return shift(today, days: -n)
    }

    // Explicit dates: YYYY-MM-DD, YYYY/M/D, M/D, M月D日.
    if let groups = match(text, pattern: "(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})"), groups.count == 3 {
      let day = Day(y: groups[0], m: groups[1], d: groups[2])
      if isValid(day) { return day }
    }
    if let groups = match(text, pattern: "(\\d{1,2})\\s*(?:/|月)\\s*(\\d{1,2})"), groups.count == 2 {
      var day = Day(y: today.y, m: groups[0], d: groups[1])
      if isValid(day) {
        if (day.m, day.d) > (today.m, today.d) { day.y -= 1 }
        return isValid(day) ? day : nil
      }
    }

    // 先週の金曜 / last friday
    let lastWeekWords = text.contains("先週") || text.contains("last week") || text.contains("last ")
    if let target = jaWeekday(text) ?? enWeekday(text) {
      if lastWeekWords { return lastWeek(target, today: today) }
      return recentWeekday(target, today: today)
    }

    // 3日 (this month, or last month when that day hasn't come yet)
    if let d = firstInt(text, pattern: "(?<![\\d/])(\\d{1,2})\\s*日(?!前)") {
      var day = Day(y: today.y, m: today.m, d: d)
      if d > today.d {
        day.m -= 1
        if day.m == 0 { day.m = 12; day.y -= 1 }
      }
      return isValid(day) ? day : nil
    }
    return nil
  }

  private static func jaWeekday(_ text: String) -> Int? {
    guard let regex = try? NSRegularExpression(pattern: "([日月火水木金土])曜") else { return nil }
    let ns = text as NSString
    guard let m = regex.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
    return ns.substring(with: m.range(at: 1)).first.flatMap { jaWeekdays[$0] }
  }

  private static func enWeekday(_ text: String) -> Int? {
    let words = Set(text.split(whereSeparator: { !$0.isLetter }).map(String.init))
    return enWeekdays.first(where: { words.contains($0.0) })?.1
  }

  // MARK: parseEntry: amounts

  /// Amount candidates in the phrase, with date-looking numbers removed. 1.2万 = 12000, 3千 = 3000.
  static func amountCandidates(_ raw: String) -> [Int] {
    var text = raw.applyingTransform(.fullwidthToHalfwidth, reverse: false) ?? raw
    for pattern in [
      "\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}", "\\d{1,2}\\s*/\\s*\\d{1,2}", "\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日?",
      "\\d{1,3}\\s*日前", "\\d{1,2}\\s*日(?![\\d])", "\\d{1,2}\\s*月", "\\d{1,3}\\s*days?\\s+ago", "\\d{1,2}:\\d{2}",
    ] {
      if let regex = try? NSRegularExpression(pattern: pattern) {
        text = replace(regex, in: text) { _ in " " }
      }
    }
    guard let regex = try? NSRegularExpression(pattern: "(\\d[\\d,]*(?:\\.\\d+)?)\\s*(万|千)?") else { return [] }
    let ns = text as NSString
    var out: [Int] = []
    for m in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
      let numberText = ns.substring(with: m.range(at: 1)).replacingOccurrences(of: ",", with: "")
      guard var value = Double(numberText) else { continue }
      if m.range(at: 2).location != NSNotFound {
        value *= ns.substring(with: m.range(at: 2)) == "万" ? 10000 : 1000
      }
      let rounded = Int(value.rounded())
      if rounded > 0 { out.append(rounded) }
    }
    return out
  }

  // MARK: helpers

  private static func match(_ text: String, pattern: String) -> [Int]? {
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
    let ns = text as NSString
    guard let m = regex.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
    var groups: [Int] = []
    for i in 1..<m.numberOfRanges {
      guard m.range(at: i).location != NSNotFound, let v = Int(ns.substring(with: m.range(at: i))) else { return nil }
      groups.append(v)
    }
    return groups
  }

  private static func firstInt(_ text: String, pattern: String) -> Int? {
    match(text, pattern: pattern)?.first
  }

  static func replace(_ regex: NSRegularExpression, in text: String, with transform: (String) -> String) -> String {
    let ns = text as NSString
    var result = ""
    var cursor = 0
    for m in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
      result += ns.substring(with: NSRange(location: cursor, length: m.range.location - cursor))
      let group = m.numberOfRanges > 1 && m.range(at: 1).location != NSNotFound ? ns.substring(with: m.range(at: 1)) : ns.substring(with: m.range)
      result += transform(group)
      cursor = m.range.location + m.range.length
    }
    result += ns.substring(from: cursor)
    return result
  }
}
