import CoreSpotlight
import Foundation
import UniformTypeIdentifiers

// Spotlight index of concrete entries (PRD stories 56-59). Each call replaces the whole domain,
// so deleted / edited entries never linger. Tapping a result opens the app (no day deep link yet).

enum SuitoSpotlight {
  static let domain = "com.taigamura.kaji.entries"

  static func apply(enabled: Bool, entriesJson: String) async throws {
    let index = CSSearchableIndex.default()
    try await index.deleteSearchableItems(withDomainIdentifiers: [domain])
    guard enabled else { return }

    let entries: [SuitoSnapshotEntry]
    do {
      entries = try JSONDecoder().decode([SuitoSnapshotEntry].self, from: Data(entriesJson.utf8))
    } catch {
      throw suitoException(.input, "setSpotlight: malformed entries: \(error)")
    }
    if entries.isEmpty { return }

    let snapshot = SuitoSiriStore.loadSnapshot()
    let symbol = snapshot?.currency.symbol ?? "¥"
    let japanese = snapshot.map { $0.locale == "ja" } ?? (Locale.preferredLanguages.first?.hasPrefix("ja") ?? false)
    let dateFormatter = DateFormatter()
    dateFormatter.locale = Locale(identifier: japanese ? "ja_JP" : "en_US")
    dateFormatter.dateStyle = .medium
    dateFormatter.timeStyle = .none

    let items = entries.map { entry -> CSSearchableItem in
      let attributes = CSSearchableItemAttributeSet(contentType: .content)
      let sign = entry.type == "income" ? "+" : ""
      let amount = sign + SuitoSiriStore.formatAmount(entry.amount, symbol: symbol)
      attributes.title = "\(entry.category) \(amount)"
      let date = SuitoSiriStore.date(fromDay: entry.date)
      let dateText = date.map { dateFormatter.string(from: $0) } ?? entry.date
      attributes.contentDescription = entry.note.isEmpty ? dateText : "\(entry.note)  \(dateText)"
      attributes.contentCreationDate = date
      var keywords = [entry.category, entry.date, entry.type == "income" ? (japanese ? "収入" : "income") : (japanese ? "支出" : "expense")]
      keywords += entry.note.split(whereSeparator: { $0.isWhitespace }).map(String.init)
      attributes.keywords = keywords
      return CSSearchableItem(uniqueIdentifier: entry.id, domainIdentifier: domain, attributeSet: attributes)
    }
    // Index in batches to stay well under any per-call limits.
    var start = 0
    while start < items.count {
      let end = min(start + 500, items.count)
      try await index.indexSearchableItems(Array(items[start..<end]))
      start = end
    }
  }
}
