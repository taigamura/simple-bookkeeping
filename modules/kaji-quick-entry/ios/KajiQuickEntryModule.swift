import ExpoModulesCore
import Foundation

public final class KajiQuickEntryModule: Module {
  private let group = "group.com.taigamura.kaji"
  private let inbox = "quick-entry-inbox"
  private let quarantine = "quick-entry-quarantine"
  private let snapshot = "quick-entry-snapshot.json"
  private let deepLinks = "kaji:quick-entry:v1:deep-links"

  public func definition() -> ModuleDefinition {
    Name("KajiQuickEntry")

    AsyncFunction("listInboxAsync") { () throws -> [[String: String]] in
      let directory = try self.directory(self.inbox)
      return try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        .filter { $0.pathExtension == "json" && !$0.lastPathComponent.hasPrefix(".") }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
        .compactMap { url in
          guard let contents = try? String(contentsOf: url, encoding: .utf8) else { return nil }
          return ["name": url.lastPathComponent, "contents": contents]
        }
    }

    AsyncFunction("acknowledgeInboxFileAsync") { (name: String) throws in
      try self.remove(name, from: self.inbox)
    }

    AsyncFunction("quarantineInboxFileAsync") { (name: String) throws in
      let source = try self.file(name, in: self.inbox)
      let target = try self.file(name, in: self.quarantine)
      try? FileManager.default.moveItem(at: source, to: target)
    }

    AsyncFunction("enqueueDeepLinkAsync") { (url: String) throws in
      guard URL(string: url)?.scheme == "kaji-quick-entry" else { throw QuickEntryException("Invalid deep link") }
      var values = UserDefaults(suiteName: self.group)?.stringArray(forKey: self.deepLinks) ?? []
      if !values.contains(url) { values.append(url) }
      UserDefaults(suiteName: self.group)?.set(values, forKey: self.deepLinks)
    }

    AsyncFunction("drainDeepLinksAsync") { () -> [String] in
      let defaults = UserDefaults(suiteName: self.group)
      let values = defaults?.stringArray(forKey: self.deepLinks) ?? []
      defaults?.removeObject(forKey: self.deepLinks)
      return values
    }

    AsyncFunction("writeCommandFileAsync") { (name: String, command: String) throws in
      guard name.range(of: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\\.json$", options: .regularExpression) != nil else {
        throw QuickEntryException("Invalid quick-entry file name")
      }
      let directory = try self.directory(self.inbox)
      let temporary = directory.appendingPathComponent(".\(name).tmp")
      try Data(command.utf8).write(to: temporary, options: .atomic)
      guard !FileManager.default.fileExists(atPath: directory.appendingPathComponent(name).path) else {
        try? FileManager.default.removeItem(at: temporary)
        throw QuickEntryException("Quick-entry file already exists")
      }
      try FileManager.default.moveItem(at: temporary, to: directory.appendingPathComponent(name))
    }

    AsyncFunction("writeSnapshotAsync") { (contents: String) throws in
      let directory = try self.directory("")
      let temporary = directory.appendingPathComponent(".\(self.snapshot).tmp")
      try Data(contents.utf8).write(to: temporary, options: .atomic)
      try? FileManager.default.removeItem(at: directory.appendingPathComponent(self.snapshot))
      try FileManager.default.moveItem(at: temporary, to: directory.appendingPathComponent(self.snapshot))
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

  private func file(_ name: String, in directory: String) throws -> URL {
    guard name.range(of: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\\.json$", options: .regularExpression) != nil else {
      throw QuickEntryException("Invalid quick-entry file name")
    }
    return try self.directory(directory).appendingPathComponent(name)
  }

  private func remove(_ name: String, from directory: String) throws {
    try? FileManager.default.removeItem(at: file(name, in: directory))
  }
}

private struct QuickEntryException: Exception {
  let reason: String
}
