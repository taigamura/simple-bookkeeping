const fs = require('node:fs');
const path = require('node:path');
const { withAppDelegate, withDangerousMod, withXcodeProject, CodeGenerator } = require('expo/config-plugins');

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

function targetBuildSettings(project, target) {
  const configurations = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  return new Map((configurations.buildConfigurations ?? []).map((entry) => {
    const build = project.pbxXCBuildConfigurationSection()[entry.value];
    return [build.name.replace(/^"|"$/g, ''), build.buildSettings ?? {}];
  }));
}

function configureTarget(project, target, infoFile, entitlements, hostSettings, config) {
  const configurations = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const entry of configurations.buildConfigurations ?? []) {
    const build = project.pbxXCBuildConfigurationSection()[entry.value];
    const name = build.name.replace(/^"|"$/g, '');
    const host = hostSettings.get(name) ?? {};
    build.buildSettings.INFOPLIST_FILE = `"${infoFile}"`;
    build.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${entitlements}"`;
    build.buildSettings.SWIFT_VERSION = '5.0';
    build.buildSettings.WATCHOS_DEPLOYMENT_TARGET = '10.0';
    // Copy the host values after Expo/EAS has resolved them.  This keeps all
    // embedded products on the same marketing version and build number.
    build.buildSettings.MARKETING_VERSION = host.MARKETING_VERSION ?? config.version;
    build.buildSettings.CURRENT_PROJECT_VERSION = host.CURRENT_PROJECT_VERSION ?? config.ios?.buildNumber;
  }
}

function group(project, name) {
  const groups = project.hash.project.objects.PBXGroup;
  const groupEntry = Object.entries(groups).find(([, value]) => value === name);
  let groupKey = groupEntry ? groupEntry[0].replace(/_comment$/, '') : undefined;
  if (!groupKey) {
    const group = project.addPbxGroup([], name, name);
    groupKey = group.uuid;
    project.getPBXGroupByKey(project.getFirstProject().firstProject.mainGroup).children.push({ value: groupKey, comment: name });
  }
  return groupKey;
}

function sourcePhase(project, target) {
  const phase = target.pbxNativeTarget.buildPhases.find((entry) => entry.comment === 'Sources');
  if (phase) return project.hash.project.objects.PBXSourcesBuildPhase[phase.value];
  return project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid).buildPhase;
}

function fileReference(project, sourcePath, groupKey) {
  const found = Object.entries(project.pbxFileReferenceSection()).find(([, file]) =>
    file && (file.path === `"${sourcePath}"` || file.path === sourcePath),
  );
  if (found) return found[0];
  return project.addFile(sourcePath, groupKey).fileRef;
}

function addExclusiveSource(project, target, sourcePath, groupName) {
  const reference = fileReference(project, sourcePath, group(project, groupName));
  // xcode's addSourceFile falls back to the first target when the target has
  // no Sources phase. Remove any old membership before adding the one target
  // that is allowed to compile this source.
  for (const phase of Object.values(project.hash.project.objects.PBXSourcesBuildPhase ?? {})) {
    if (!phase?.files) continue;
    phase.files = phase.files.filter((entry) => project.pbxBuildFileSection()[entry.value]?.fileRef !== reference);
  }
  for (const [uuid, buildFile] of Object.entries(project.pbxBuildFileSection())) {
    if (buildFile?.fileRef === reference) {
      delete project.pbxBuildFileSection()[uuid];
      delete project.pbxBuildFileSection()[`${uuid}_comment`];
    }
  }
  const buildFile = project.generateUuid();
  const basename = path.basename(sourcePath);
  project.pbxBuildFileSection()[buildFile] = { isa: 'PBXBuildFile', fileRef: reference, fileRef_comment: basename };
  project.pbxBuildFileSection()[`${buildFile}_comment`] = `${basename} in Sources`;
  sourcePhase(project, target).files.push({ value: buildFile, comment: `${basename} in Sources` });
}

function ensureDependency(project, parent, child) {
  project.hash.project.objects.PBXTargetDependency ??= {};
  project.hash.project.objects.PBXContainerItemProxy ??= {};
  const dependencies = project.hash.project.objects.PBXTargetDependency;
  const exists = parent.pbxNativeTarget.dependencies.some((entry) => dependencies[entry.value]?.target === child.uuid);
  if (!exists) project.addTargetDependency(parent.uuid, [child.uuid]);
}

function ensureEmbedPhase(project, parent, child, name, targetType, subfolderPath) {
  let phaseEntry = parent.pbxNativeTarget.buildPhases.find((entry) => entry.comment === name);
  if (!phaseEntry) phaseEntry = { value: project.addBuildPhase([], 'PBXCopyFilesBuildPhase', name, parent.uuid, targetType, subfolderPath).uuid, comment: name };
  const phase = project.hash.project.objects.PBXCopyFilesBuildPhase[phaseEntry.value];
  const productReference = child.pbxNativeTarget.productReference;
  if (phase.files.some((entry) => project.pbxBuildFileSection()[entry.value]?.fileRef === productReference)) return;
  let buildFile = Object.entries(project.pbxBuildFileSection()).find(([, value]) => value?.fileRef === productReference)?.[0];
  if (!buildFile) {
    buildFile = project.generateUuid();
    const productName = child.pbxNativeTarget.name.replace(/^"|"$/g, '');
    project.pbxBuildFileSection()[buildFile] = { isa: 'PBXBuildFile', fileRef: productReference, fileRef_comment: `${productName}.app` };
    project.pbxBuildFileSection()[`${buildFile}_comment`] = `${productName}.app in ${name}`;
  }
  phase.files.push({ value: buildFile, comment: project.pbxBuildFileSection()[`${buildFile}_comment`] });
}

function addWatchTargets(project, config = {}) {
  const firstTarget = project.getFirstTarget();
  const host = { uuid: firstTarget.uuid, pbxNativeTarget: firstTarget.firstTarget };
  const app = target(project, WATCH_APP, 'watch2_app', WATCH_APP_BUNDLE_ID);
  const extension = target(project, WATCH_EXTENSION, 'watch2_extension', WATCH_EXTENSION_BUNDLE_ID);
  const hostSettings = targetBuildSettings(project, host);
  configureTarget(project, app, `${WATCH_APP}/${WATCH_APP}-Info.plist`, `${WATCH_APP}/${WATCH_APP}.entitlements`, hostSettings, config);
  configureTarget(project, extension, `${WATCH_EXTENSION}/${WATCH_EXTENSION}-Info.plist`, `${WATCH_EXTENSION}/${WATCH_EXTENSION}.entitlements`, hostSettings, config);
  addExclusiveSource(project, extension, `${WATCH_EXTENSION}/${WATCH_EXTENSION}.swift`, WATCH_EXTENSION);
  addExclusiveSource(project, host, 'KajiWatchPhoneBridge.swift', 'KajiWatchSupport');
  ensureDependency(project, app, extension);
  ensureDependency(project, host, app);
  ensureEmbedPhase(project, host, app, 'Embed Watch Content', 'watch2_app', '"$(CONTENTS_FOLDER_PATH)/Watch"');
  ensureEmbedPhase(project, app, extension, 'Embed App Extensions', 'watch2_extension');
  return project;
}

const withWatchFiles = (config) => withDangerousMod(config, ['ios', async (config) => {
  const root = config.modRequest.platformProjectRoot;
  const write = (directory, file, contents) => { fs.mkdirSync(path.join(root, directory), { recursive: true }); fs.writeFileSync(path.join(root, directory, file), contents); };
  const entitlement = fs.readFileSync(path.join(config.modRequest.projectRoot, 'config/watch-expense.entitlements'));
  write(WATCH_APP, `${WATCH_APP}.entitlements`, entitlement);
  write(WATCH_EXTENSION, `${WATCH_EXTENSION}.entitlements`, entitlement);
  write(WATCH_APP, `${WATCH_APP}-Info.plist`, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleDisplayName</key><string>${config.name}</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>CFBundlePackageType</key><string>APPL</string><key>WKCompanionAppBundleIdentifier</key><string>${APP_BUNDLE_ID}</string><key>WKWatchKitApp</key><true/></dict></plist>`);
  write(WATCH_EXTENSION, `${WATCH_EXTENSION}-Info.plist`, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleDisplayName</key><string>${config.name}</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>CFBundlePackageType</key><string>XPC!</string><key>WKAppBundleIdentifier</key><string>${WATCH_APP_BUNDLE_ID}</string><key>CLKComplicationPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).WatchAllowanceComplicationDataSource</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.watchkit</string></dict></dict></plist>`);
  fs.writeFileSync(path.join(root, WATCH_EXTENSION, `${WATCH_EXTENSION}.swift`), String.raw`import ClockKit
import SwiftUI
import WatchConnectivity

private struct Category: Codable, Hashable { let id: String; let name: String }
private struct Allowance: Codable { let status: String; let amount: Int? }
private struct Snapshot: Codable { let version: Int; let categories: [Category]; let currency: Currency; let defaults: Defaults; let allowance: Allowance }
private struct Currency: Codable { let symbol: String; let code: String }
private struct Defaults: Codable { let categoryId: String?; let recentCategoryIds: [String] }
private struct Command: Codable, Identifiable { let version: Int; let source: String; let id: String; let timestamp: String; let amount: Int; let category: String; let note: String; let date: DateParts }
private struct DateParts: Codable { let y: Int; let m: Int; let day: Int }

@MainActor final class WatchExpenseModel: NSObject, ObservableObject, WCSessionDelegate {
  @Published var amount = ""; @Published var snapshot: Snapshot?; @Published var selectedCategoryId: String?; @Published var queued: [Command] = []
  private let queueKey = "kaji.watch.expense.queue.v1"
  private let snapshotKey = "kaji.watch.expense.snapshot.v1"
  override init() { super.init(); queued = (try? JSONDecoder().decode([Command].self, from: UserDefaults.standard.data(forKey: queueKey) ?? Data())) ?? []; if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() } }
  var recentCategories: [Category] { guard let snapshot else { return [] }; let ids = [snapshot.defaults.categoryId].compactMap { $0 } + snapshot.defaults.recentCategoryIds; return ids.compactMap { id in snapshot.categories.first { $0.id == id } }.prefix(3).map { $0 } }
  var selectedCategory: Category? { recentCategories.first { $0.id == selectedCategoryId } }
  func select(category: Category) { selectedCategoryId = category.id }
  func saveSelectedCategory() { guard let category = selectedCategory, let value = Int(amount), value > 0 else { return }; let now = Date(); let parts = Calendar.current.dateComponents([.year,.month,.day], from: now); let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime,.withFractionalSeconds]; queued.append(Command(version: 1, source: "watch", id: UUID().uuidString, timestamp: formatter.string(from: now), amount: value, category: category.name, note: "", date: DateParts(y: parts.year!, m: parts.month! - 1, day: parts.day!))); amount = ""; persist(); retry() }
  func retry() { guard WCSession.default.activationState == .activated else { return }; for command in queued { let key = "watch:\(command.id)"; if WCSession.default.isReachable { WCSession.default.sendMessage(["command": (try? JSONEncoder().encode(command))?.base64EncodedString() ?? ""], replyHandler: { [weak self] reply in if reply["ack"] as? String == key { DispatchQueue.main.async { self?.queued.removeAll { $0.id == command.id }; self?.persist() } } }, errorHandler: nil) } } }
  private func persist() { UserDefaults.standard.set(try? JSONEncoder().encode(queued), forKey: queueKey) }
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { requestSnapshot(); retry() }
  private func requestSnapshot() { guard WCSession.default.isReachable else { return }; WCSession.default.sendMessage(["snapshot": true], replyHandler: { [weak self] reply in guard let data = reply["quickEntrySnapshot"] as? Data, let decoded = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }; DispatchQueue.main.async { self?.apply(snapshot: decoded, data: data) } }, errorHandler: nil) }
  private func apply(snapshot: Snapshot, data: Data) { self.snapshot = snapshot; UserDefaults.standard.set(data, forKey: snapshotKey); if selectedCategory == nil { selectedCategoryId = recentCategories.first?.id }; CLKComplicationServer.sharedInstance().activeComplications?.forEach { CLKComplicationServer.sharedInstance().reloadTimeline(for: $0) } }
  func session(_ session: WCSession, didReceiveApplicationContext context: [String : Any]) { guard let data = context["quickEntrySnapshot"] as? Data, let decoded = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }; DispatchQueue.main.async { self.apply(snapshot: decoded, data: data); self.retry() } }
  func session(_ session: WCSession, didReceiveMessage message: [String : Any]) { retry() }
  func sessionReachabilityDidChange(_ session: WCSession) { if session.isReachable { requestSnapshot(); retry() } }
}

final class WatchAllowanceComplicationDataSource: NSObject, CLKComplicationDataSource {
  private func text() -> String { guard let data = UserDefaults.standard.data(forKey: "kaji.watch.expense.snapshot.v1"), let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data) else { return "No budget" }; return snapshot.allowance.status == "available" ? "\(snapshot.currency.symbol)\(snapshot.allowance.amount ?? 0)" : snapshot.allowance.status }
  func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) { handler([CLKComplicationDescriptor(identifier: "allowance", displayName: "Allowance", supportedFamilies: [.utilitarianSmall, .utilitarianSmallFlat])]) }
  func getCurrentTimelineEntry(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void) { let provider = CLKSimpleTextProvider(text: text()); let template: CLKComplicationTemplate? = complication.family == .utilitarianSmallFlat ? CLKComplicationTemplateUtilitarianSmallFlat(textProvider: provider) : CLKComplicationTemplateUtilitarianSmallSimpleText(textProvider: provider); handler(template.map { CLKComplicationTimelineEntry(date: Date(), complicationTemplate: $0) }) }
  func getLocalizableSampleTemplate(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTemplate?) -> Void) { let provider = CLKSimpleTextProvider(text: "¥0"); handler(complication.family == .utilitarianSmallFlat ? CLKComplicationTemplateUtilitarianSmallFlat(textProvider: provider) : CLKComplicationTemplateUtilitarianSmallSimpleText(textProvider: provider)) }
}

@main struct KajiWatchExtension: App { @StateObject private var model = WatchExpenseModel(); var body: some Scene { WindowGroup { VStack { Text("Quick expense"); Text(model.snapshot.map { $0.allowance.status == "available" ? "\($0.currency.symbol)\($0.allowance.amount ?? 0)" : $0.allowance.status } ?? "No budget"); TextField("Amount", text: $model.amount).keyboardType(.numberPad); ForEach(model.recentCategories, id: \.id) { category in Button(category.name) { model.select(category: category) }.buttonStyle(.bordered).tint(model.selectedCategoryId == category.id ? .accentColor : .gray) }; Button("Save") { model.saveSelectedCategory() }.disabled(model.amount.isEmpty || model.selectedCategory == nil) } } } }
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

const withWatchPhoneBridge = (config) => withAppDelegate(config, (config) => {
  if (config.modResults.language !== 'swift') throw new Error('Kaji Watch bridge requires a Swift AppDelegate');
  config.modResults.contents = CodeGenerator.mergeContents({
    tag: 'kaji-watch-phone-bridge-start',
    src: config.modResults.contents,
    newSrc: 'KajiWatchPhoneBridge.shared.start()',
    anchor: /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
    offset: 0,
    comment: '//',
  }).contents;
  return config;
});

const withWatchExpense = (config) => withWatchPhoneBridge(withWatchFiles(withXcodeProject(config, (config) => { config.modResults = addWatchTargets(config.modResults, config); return config; })));
module.exports = withWatchExpense;
module.exports.default = withWatchExpense;
module.exports.addWatchTargets = addWatchTargets;
