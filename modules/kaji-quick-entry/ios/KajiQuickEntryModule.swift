import AppIntents
import ExpoModulesCore
import Foundation

public final class KajiQuickEntryModule: Module {
  private let group = "group.com.taigamura.kaji"
  private let inbox = "quick-entry-inbox"
  private let quarantine = "quick-entry-quarantine"
  private let deepLinkInbox = "quick-entry-deep-links"
  private let snapshot = "quick-entry-snapshot.json"
  private let maxSnapshotBytes = 24 * 1024
  private let maxSnapshotStringLength = 128

  public func definition() -> ModuleDefinition {
    Name("KajiQuickEntry")

    AsyncFunction("listInboxAsync") { () throws -> [[String: Any]] in
      let directory = try self.directory(self.inbox)
      return try self.jsonFiles(in: directory).map { url in
        do {
          return ["name": url.lastPathComponent, "contents": try String(contentsOf: url, encoding: .utf8)]
        } catch {
          // Keep the filename visible. JS will quarantine this unreadable file.
          return ["name": url.lastPathComponent, "contents": NSNull()]
        }
      }
    }

    AsyncFunction("acknowledgeInboxFileAsync") { (name: String) throws in
      try self.remove(name, from: self.inbox)
    }

    AsyncFunction("quarantineInboxFileAsync") { (name: String) throws in
      let source = try self.file(name, in: self.inbox)
      let quarantineDirectory = try self.directory(self.quarantine)
      var target = quarantineDirectory.appendingPathComponent(name)
      if FileManager.default.fileExists(atPath: target.path) {
        target = quarantineDirectory.appendingPathComponent("\(UUID().uuidString)-\(name)")
      }
      do {
        try FileManager.default.moveItem(at: source, to: target)
      } catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileNoSuchFileError {
        return
      }
    }

    AsyncFunction("enqueueDeepLinkAsync") { (url: String) throws in
      guard URL(string: url)?.scheme == "kaji-quick-entry" else { throw QuickEntryException("Invalid deep link") }
      let directory = try self.directory(self.deepLinkInbox)
      try self.publish(Data(url.utf8), in: directory, name: UUID().uuidString + ".json")
    }

    AsyncFunction("peekDeepLinksAsync") { () throws -> [[String: String]] in
      let directory = try self.directory(self.deepLinkInbox)
      return try self.jsonFiles(in: directory).map { url in
        ["id": url.lastPathComponent, "url": (try? String(contentsOf: url, encoding: .utf8)) ?? ""]
      }
    }

    AsyncFunction("acknowledgeDeepLinkAsync") { (id: String) throws in
      try self.remove(id, from: self.deepLinkInbox)
    }

    AsyncFunction("quarantineDeepLinkAsync") { (id: String) throws in
      let source = try self.file(id, in: self.deepLinkInbox)
      let quarantineDirectory = try self.directory(self.quarantine)
      let target = quarantineDirectory.appendingPathComponent("deep-link-\(id)")
      do { try FileManager.default.moveItem(at: source, to: target) }
      catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileNoSuchFileError { return }
    }

    AsyncFunction("writeCommandFileAsync") { (command: String) throws in
      let directory = try self.directory(self.inbox)
      try self.publish(Data(command.utf8), in: directory, name: UUID().uuidString + ".json")
    }

    AsyncFunction("writeSnapshotAsync") { (contents: String) throws in
      guard self.validSnapshot(contents) else { throw QuickEntryException("Invalid quick-entry snapshot") }
      let directory = try self.directory("")
      let temporaryName = ".\(UUID().uuidString).snapshot.tmp"
      try self.publish(Data(contents.utf8), in: directory, name: temporaryName)
      let temporary = directory.appendingPathComponent(temporaryName)
      let destination = directory.appendingPathComponent(self.snapshot)
      if FileManager.default.fileExists(atPath: destination.path) {
        _ = try FileManager.default.replaceItemAt(destination, withItemAt: temporary)
      } else {
        try FileManager.default.moveItem(at: temporary, to: destination)
      }
    }
  }

  private func directory(_ name: String) throws -> URL {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw QuickEntryException("App Group is unavailable")
    }
    let url = root.appendingPathComponent(name, isDirectory: true)
    if !name.isEmpty { try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true) }
    return url
  }

  private func jsonFiles(in directory: URL) throws -> [URL] {
    try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "json" && !$0.lastPathComponent.hasPrefix(".") }
      .sorted { $0.lastPathComponent < $1.lastPathComponent }
  }

  private func file(_ name: String, in directory: String) throws -> URL {
    guard name.range(of: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\\.json$", options: .regularExpression) != nil else {
      throw QuickEntryException("Invalid quick-entry file name")
    }
    return try self.directory(directory).appendingPathComponent(name)
  }

  private func remove(_ name: String, from directory: String) throws {
    do { try FileManager.default.removeItem(at: try file(name, in: directory)) }
    catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileNoSuchFileError { return }
  }

  private func publish(_ data: Data, in directory: URL, name: String) throws {
    let temporary = directory.appendingPathComponent(".\(UUID().uuidString).tmp")
    try data.write(to: temporary, options: .atomic)
    try FileManager.default.moveItem(at: temporary, to: directory.appendingPathComponent(name))
  }

  private func validSnapshot(_ contents: String) -> Bool {
      guard let data = contents.data(using: .utf8),
            data.count <= maxSnapshotBytes,
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            object["version"] as? Int == 3,
            let categories = object["categories"] as? [[String: Any]],
            categories.count > 0 && categories.count <= 100,
            let currency = object["currency"] as? [String: Any],
            let symbol = currency["symbol"] as? String,
            let code = currency["code"] as? String,
            [("¥", "JPY"), ("$", "USD"), ("€", "EUR"), ("£", "GBP")].contains(where: { $0.0 == symbol && $0.1 == code }),
            let defaults = object["defaults"] as? [String: Any],
            let allowance = object["allowance"] as? [String: Any],
            let allowanceStatus = allowance["status"] as? String,
            ["available", "no-budget", "overspent"].contains(allowanceStatus)
      else { return false }

    // compactMap returns a non-optional array, so these cannot be bound with
    // `guard let`. The count checks below are what enforce that every entry
    // actually carried a String value.
    let categoryIDs = categories.compactMap { $0["id"] as? String }
    let categoryNames = categories.compactMap { $0["name"] as? String }

    guard categoryIDs.count == categories.count,
            categoryIDs.allSatisfy({ !$0.isEmpty && $0.count <= maxSnapshotStringLength }),
            Set(categoryIDs).count == categories.count,
            categoryNames.count == categories.count,
            categoryNames.allSatisfy({ !$0.isEmpty && $0.count <= maxSnapshotStringLength }),
            (defaults["categoryId"] is NSNull || (defaults["categoryId"] as? String) != nil),
            let recentCategoryIDs = defaults["recentCategoryIds"] as? [String],
            recentCategoryIDs.count <= 3,
            Set(recentCategoryIDs).count == recentCategoryIDs.count,
            recentCategoryIDs.allSatisfy({ categoryIDs.contains($0) })
      else { return false }
    if allowanceStatus == "available" {
      guard let amount = allowance["amount"] as? Int, amount >= 0 else { return false }
    } else if !(allowance["amount"] is NSNull) { return false }
    if let defaultCategoryID = defaults["categoryId"] as? String {
      return categoryIDs.contains(defaultCategoryID)
    }
    return defaults["categoryId"] is NSNull
  }
}

// ExpoModulesCore's Exception is an open class, not a protocol, so this has to
// subclass rather than conform. GenericException<String> supplies the positional
// init the call sites above already use.
private final class QuickEntryException: GenericException<String> {
  override var reason: String { param }
}

/** The App Intent lives in the host app target, not the widget extension. */
@available(iOS 16.4, *)
private struct ShortcutCategory: AppEntity, Identifiable {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Expense category")
  static var defaultQuery = ShortcutCategoryQuery()
  let id: String
  let name: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

@available(iOS 16.4, *)
private struct ShortcutCategoryQuery: EntityStringQuery {
  private func categories() -> [ShortcutCategory] {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.taigamura.kaji"),
      let data = try? Data(contentsOf: root.appendingPathComponent("quick-entry-snapshot.json")),
      let snapshot = try? JSONDecoder().decode(ShortcutSnapshot.self, from: data),
      snapshot.version == 3 else { return [] }
    return snapshot.categories.map { ShortcutCategory(id: $0.id, name: $0.name) }
  }

  func entities(for identifiers: [ShortcutCategory.ID]) async throws -> [ShortcutCategory] {
    let categoriesByID = Dictionary(uniqueKeysWithValues: categories().map { ($0.id, $0) })
    return identifiers.compactMap { categoriesByID[$0] }
  }

  func entities(matching string: String) async throws -> [ShortcutCategory] {
    categories().filter { $0.name.localizedCaseInsensitiveContains(string) }
  }

  func suggestedEntities() async throws -> [ShortcutCategory] { categories() }
}

@available(iOS 16.4, *)
private struct LogExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Log expense"
  static var description = IntentDescription("Records a private expense without opening Kaji.")
  static var openAppWhenRun = false

  @Parameter(title: "Amount", requestValueDialog: "How much did you spend?") var amount: Int
  @Parameter(title: "Category", requestValueDialog: "Which expense category?") var category: ShortcutCategory
  @Parameter(title: "Note", default: "") var note: String

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$amount) in \(\.$category)")
  }

  init() {
    amount = 0
    category = ShortcutCategory(id: "", name: "")
    note = ""
  }

  func perform() async throws -> some IntentResult {
    let categories = try await ShortcutCategoryQuery().entities(for: [category.id])
    guard amount > 0, note.count <= 512, let savedCategory = categories.first else {
      throw ShortcutIntentError.invalidParameters
    }
    try ShortcutCommandPublisher.publish(amount: amount, category: savedCategory, note: note)
    return .result()
  }
}

@available(iOS 16.4, *)
private struct KajiAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: LogExpenseIntent(), phrases: [
      "Log an expense in \(.applicationName)",
      "Add an expense with \(.applicationName)",
      "\(.applicationName)で支出を記録",
      "\(.applicationName)に支出を追加",
    ], shortTitle: "Log expense", systemImageName: "plus.circle")
  }
}

@available(iOS 16.4, *)
private struct ShortcutSnapshot: Decodable {
  struct Category: Decodable { let id: String; let name: String }
  let version: Int
  let categories: [Category]
}

@available(iOS 16.4, *)
private enum ShortcutCommandPublisher {
  static func publish(amount: Int, category: ShortcutCategory, note: String) throws {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.taigamura.kaji") else {
      throw ShortcutIntentError.appGroupUnavailable
    }
    let date = Calendar.current.dateComponents([.year, .month, .day], from: Date())
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let payload: [String: Any] = [
      "version": 1, "source": "shortcut", "id": UUID().uuidString,
      "timestamp": formatter.string(from: Date()), "amount": amount,
      "category": category.name, "note": note,
      "date": ["y": date.year!, "m": date.month! - 1, "day": date.day!],
    ]
    let directory = root.appendingPathComponent("quick-entry-inbox", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let temporary = directory.appendingPathComponent(".\(UUID().uuidString).tmp")
    let destination = directory.appendingPathComponent("\(UUID().uuidString).json")
    try JSONSerialization.data(withJSONObject: payload).write(to: temporary, options: .atomic)
    // A visible command is complete. Reconciliation de-duplicates its persisted id
    // if delivery is retried after the app has been killed or restarted.
    try FileManager.default.moveItem(at: temporary, to: destination)
  }
}

@available(iOS 16.4, *)
private enum ShortcutIntentError: LocalizedError {
  case invalidParameters
  case appGroupUnavailable

  var errorDescription: String? {
    switch self {
    case .invalidParameters: return "Enter a positive amount and choose a current category."
    case .appGroupUnavailable: return "Kaji storage is unavailable."
    }
  }
}
