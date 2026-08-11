const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const APP_BUNDLE_ID = 'com.taigamura.kaji';
const APP_GROUP = 'group.com.taigamura.kaji';
const WATCH_APP = 'KajiWatchApp';
const WATCH_EXTENSION = 'KajiWatchExtension';
const WATCH_APP_BUNDLE_ID = `${APP_BUNDLE_ID}.watchkitapp`;
const WATCH_EXTENSION_BUNDLE_ID = `${WATCH_APP_BUNDLE_ID}.watchkitextension`;

function target(project, name, type, bundleIdentifier) {
  const found = Object.entries(project.pbxNativeTargetSection()).find(([, value]) => value.name === `"${name}"`);
  return found ? { uuid: found[0], pbxNativeTarget: found[1] } : project.addTarget(name, type, name, bundleIdentifier);
}

function configureTarget(project, target, infoFile, entitlements) {
  const configurations = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const entry of configurations.buildConfigurations ?? []) {
    const build = project.pbxXCBuildConfigurationSection()[entry.value];
    build.buildSettings.INFOPLIST_FILE = `"${infoFile}"`;
    build.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${entitlements}"`;
    build.buildSettings.SWIFT_VERSION = '5.0';
    build.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.4';
    build.buildSettings.WATCHOS_DEPLOYMENT_TARGET = '10.0';
  }
}

function addSource(project, target, sourcePath) {
  const files = project.pbxFileReferenceSection();
  const exists = Object.values(files).some((file) => file && (file.path === `"${sourcePath}"` || file.path === sourcePath));
  if (exists) return;
  const groups = project.hash.project.objects.PBXGroup;
  const groupEntry = Object.entries(groups).find(([, value]) => value === 'KajiWatchSupport');
  let groupKey = groupEntry ? groupEntry[0].replace(/_comment$/, '') : undefined;
  if (!groupKey) {
    const group = project.addPbxGroup([], 'KajiWatchSupport', 'KajiWatchSupport');
    groupKey = group.uuid;
    project.getPBXGroupByKey(project.getFirstProject().firstProject.mainGroup).children.push({ value: groupKey, comment: 'KajiWatchSupport' });
  }
  project.addSourceFile(sourcePath, { target: target.uuid }, groupKey);
}

function addWatchTargets(project) {
  const firstTarget = project.getFirstTarget();
  const host = { uuid: firstTarget.uuid, pbxNativeTarget: firstTarget.firstTarget };
  const app = target(project, WATCH_APP, 'watch2_app', WATCH_APP_BUNDLE_ID);
  const extension = target(project, WATCH_EXTENSION, 'watch2_extension', WATCH_EXTENSION_BUNDLE_ID);
  configureTarget(project, app, `${WATCH_APP}/${WATCH_APP}-Info.plist`, `${WATCH_APP}/${WATCH_APP}.entitlements`);
  configureTarget(project, extension, `${WATCH_EXTENSION}/${WATCH_EXTENSION}-Info.plist`, `${WATCH_EXTENSION}/${WATCH_EXTENSION}.entitlements`);
  addSource(project, extension, `${WATCH_EXTENSION}.swift`);
  addSource(project, host, 'KajiWatchPhoneBridge.swift');
  for (const [parent, child] of [[app, extension], [host, app]]) {
    if (!parent.pbxNativeTarget.dependencies.some((dependency) => dependency.value === child.uuid)) project.addTargetDependency(parent.uuid, [child.uuid]);
  }
  return project;
}

const withWatchFiles = (config) => withDangerousMod(config, ['ios', async (config) => {
  const root = config.modRequest.platformProjectRoot;
  const write = (directory, file, contents) => { fs.mkdirSync(path.join(root, directory), { recursive: true }); fs.writeFileSync(path.join(root, directory, file), contents); };
  const entitlement = fs.readFileSync(path.join(config.modRequest.projectRoot, 'config/watch-expense.entitlements'));
  write(WATCH_APP, `${WATCH_APP}.entitlements`, entitlement);
  write(WATCH_EXTENSION, `${WATCH_EXTENSION}.entitlements`, entitlement);
  write(WATCH_APP, `${WATCH_APP}-Info.plist`, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundlePackageType</key><string>APPL</string><key>WKCompanionAppBundleIdentifier</key><string>${APP_BUNDLE_ID}</string><key>WKWatchKitApp</key><true/></dict></plist>`);
  write(WATCH_EXTENSION, `${WATCH_EXTENSION}-Info.plist`, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundlePackageType</key><string>XPC!</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.watchkit</string></dict></dict></plist>`);
  fs.writeFileSync(path.join(root, `${WATCH_EXTENSION}.swift`), String.raw`import SwiftUI
import WatchConnectivity
import WidgetKit

private struct Category: Codable, Hashable { let id: String; let name: String }
private struct Allowance: Codable { let status: String; let amount: Int? }
private struct Snapshot: Codable { let version: Int; let categories: [Category]; let currency: Currency; let defaults: Defaults; let allowance: Allowance }
private struct Currency: Codable { let symbol: String; let code: String }
private struct Defaults: Codable { let categoryId: String?; let recentCategoryIds: [String] }
private struct Command: Codable, Identifiable { let version: Int; let source: String; let id: String; let timestamp: String; let amount: Int; let category: String; let note: String; let date: DateParts }
private struct DateParts: Codable { let y: Int; let m: Int; let day: Int }

@MainActor final class WatchExpenseModel: NSObject, ObservableObject, WCSessionDelegate {
  @Published var amount = ""; @Published var snapshot: Snapshot?; @Published var queued: [Command] = []
  private let queueKey = "kaji.watch.expense.queue.v1"
  override init() { super.init(); queued = (try? JSONDecoder().decode([Command].self, from: UserDefaults.standard.data(forKey: queueKey) ?? Data())) ?? []; if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() } }
  var recentCategories: [Category] { guard let snapshot else { return [] }; let ids = [snapshot.defaults.categoryId].compactMap { $0 } + snapshot.defaults.recentCategoryIds; return ids.compactMap { id in snapshot.categories.first { $0.id == id } }.prefix(3).map { $0 } }
  func save(category: Category) { guard let value = Int(amount), value > 0 else { return }; let now = Date(); let parts = Calendar.current.dateComponents([.year,.month,.day], from: now); let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime,.withFractionalSeconds]; queued.append(Command(version: 1, source: "watch", id: UUID().uuidString, timestamp: formatter.string(from: now), amount: value, category: category.name, note: "", date: DateParts(y: parts.year!, m: parts.month! - 1, day: parts.day!))); amount = ""; persist(); retry() }
  func retry() { guard WCSession.default.activationState == .activated else { return }; for command in queued { let key = "watch:\(command.id)"; if WCSession.default.isReachable { WCSession.default.sendMessage(["command": (try? JSONEncoder().encode(command))?.base64EncodedString() ?? ""], replyHandler: { [weak self] reply in if reply["ack"] as? String == key { DispatchQueue.main.async { self?.queued.removeAll { $0.id == command.id }; self?.persist() } } }, errorHandler: nil) } } }
  private func persist() { UserDefaults.standard.set(try? JSONEncoder().encode(queued), forKey: queueKey) }
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { requestSnapshot(); retry() }
  private func requestSnapshot() { guard WCSession.default.isReachable else { return }; WCSession.default.sendMessage(["snapshot": true], replyHandler: { [weak self] reply in guard let data = reply["quickEntrySnapshot"] as? Data, let decoded = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }; DispatchQueue.main.async { self?.snapshot = decoded } }, errorHandler: nil) }
  func session(_ session: WCSession, didReceiveApplicationContext context: [String : Any]) { guard let data = context["quickEntrySnapshot"] as? Data, let decoded = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }; DispatchQueue.main.async { self.snapshot = decoded } }
  func session(_ session: WCSession, didReceiveMessage message: [String : Any]) { retry() }
}

@main struct KajiWatchExtension: App { @StateObject private var model = WatchExpenseModel(); var body: some Scene { WindowGroup { VStack { Text("Quick expense"); Text(model.snapshot.map { $0.allowance.status == "available" ? "\($0.currency.symbol)\($0.allowance.amount ?? 0)" : $0.allowance.status } ?? "No budget"); TextField("Amount", text: $model.amount).keyboardType(.numberPad); ForEach(model.recentCategories, id: \.id) { category in Button(category.name) { model.save(category: category) } }; Button("Save") { if let category = model.recentCategories.first { model.save(category: category) } }.disabled(model.amount.isEmpty || model.recentCategories.isEmpty) } } } }
`);
  fs.writeFileSync(path.join(root, 'KajiWatchPhoneBridge.swift'), String.raw`import Foundation
import WatchConnectivity

// The host bridge writes Watch commands into the same immutable inbox used by iPhone widgets.
// It acknowledges only after the atomic file move succeeds; the JavaScript ledger remains the sole writer.
@objc(KajiWatchPhoneBridge) final class KajiWatchPhoneBridge: NSObject, WCSessionDelegate {
  @objc static let shared = KajiWatchPhoneBridge()
  @objc func start() { guard WCSession.isSupported() else { return }; WCSession.default.delegate = self; WCSession.default.activate() }
  private func snapshot() -> Data? { guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.taigamura.kaji") else { return nil }; return try? Data(contentsOf: root.appendingPathComponent("quick-entry-snapshot.json")) }
  private func publishSnapshot() { guard let data = snapshot() else { return }; try? WCSession.default.updateApplicationContext(["quickEntrySnapshot": data]) }
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { publishSnapshot() }
  func sessionDidBecomeInactive(_ session: WCSession) { }
  func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
  func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) { if message["snapshot"] as? Bool == true { replyHandler(snapshot().map { ["quickEntrySnapshot": $0] } ?? [:]); return }; guard let encoded = message["command"] as? String, let data = Data(base64Encoded: encoded), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], object["source"] as? String == "watch", let id = object["id"] as? String, let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.taigamura.kaji") else { return }; do { let inbox = root.appendingPathComponent("quick-entry-inbox", isDirectory: true); try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true); let temporary = inbox.appendingPathComponent(".\(UUID().uuidString).tmp"); let destination = inbox.appendingPathComponent("watch-\(id).json"); try data.write(to: temporary, options: .atomic); if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: temporary) } else { try FileManager.default.moveItem(at: temporary, to: destination) }; replyHandler(["ack": "watch:\(id)"]); publishSnapshot() } catch { } }
}
`);
  return config;
}]);

const withWatchExpense = (config) => withWatchFiles(withXcodeProject(config, (config) => { config.modResults = addWatchTargets(config.modResults); return config; }));
module.exports = withWatchExpense;
module.exports.default = withWatchExpense;
module.exports.addWatchTargets = addWatchTargets;
