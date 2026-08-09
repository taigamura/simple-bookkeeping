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
            object["version"] as? Int == 2,
            let categories = object["categories"] as? [[String: Any]],
            categories.count > 0 && categories.count <= 100,
            let currency = object["currency"] as? [String: Any],
            let symbol = currency["symbol"] as? String,
            let code = currency["code"] as? String,
            [("¥", "JPY"), ("$", "USD"), ("€", "EUR"), ("£", "GBP")].contains(where: { $0.0 == symbol && $0.1 == code }),
            let defaults = object["defaults"] as? [String: Any],
            let categoryIDs = categories.compactMap({ $0["id"] as? String }),
            categoryIDs.count == categories.count,
            categoryIDs.allSatisfy({ !$0.isEmpty && $0.count <= maxSnapshotStringLength }),
            Set(categoryIDs).count == categories.count,
            let categoryNames = categories.compactMap({ $0["name"] as? String }),
            categoryNames.count == categories.count,
            categoryNames.allSatisfy({ !$0.isEmpty && $0.count <= maxSnapshotStringLength }),
            (defaults["categoryId"] is NSNull || (defaults["categoryId"] as? String) != nil),
            let recentCategoryIDs = defaults["recentCategoryIds"] as? [String],
            recentCategoryIDs.count <= 3,
            Set(recentCategoryIDs).count == recentCategoryIDs.count,
            recentCategoryIDs.allSatisfy({ categoryIDs.contains($0) })
      else { return false }
    if let defaultCategoryID = defaults["categoryId"] as? String {
      return categoryIDs.contains(defaultCategoryID)
    }
    return defaults["categoryId"] is NSNull
  }
}

private struct QuickEntryException: Exception {
  let reason: String
}
