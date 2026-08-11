const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const extensionSpec = require('./quick-entry.extension.json');

const APP_BUNDLE_ID = 'com.taigamura.kaji';
const APP_GROUP = 'group.com.taigamura.kaji';
const EXTENSION_NAME = 'KajiQuickEntryExtension';
const EXTENSION_BUNDLE_ID = `${APP_BUNDLE_ID}.quick-entry`;
const SCHEME = 'kaji-quick-entry';
const EXTENSION_MARKETING_VERSION = '0.1.0';
const EXTENSION_PROJECT_VERSION = '1';

if (extensionSpec.bundleIdentifier !== EXTENSION_BUNDLE_ID || extensionSpec.appGroup !== APP_GROUP || extensionSpec.urlScheme !== SCHEME) {
  throw new Error('Quick-entry extension identifiers must derive from the Kaji app namespace');
}

function addExtensionTarget(project) {
  const targets = project.pbxNativeTargetSection();
  const existing = Object.entries(targets).find(([, target]) => target.name === `"${EXTENSION_NAME}"`);
  const target = existing ? { uuid: existing[0], pbxNativeTarget: existing[1] } : project.addTarget(
    EXTENSION_NAME, 'app_extension', EXTENSION_NAME, EXTENSION_BUNDLE_ID,
  );
  const nativeTarget = target.pbxNativeTarget;
  const host = project.getFirstTarget();
  if (host && !host.firstTarget.dependencies.some((dependency) => dependency.value === target.uuid)) {
    project.hash.project.objects.PBXTargetDependency ??= {};
    project.hash.project.objects.PBXContainerItemProxy ??= {};
    project.addTargetDependency(host.uuid, [target.uuid]);
  }
  const configurations = project.pbxXCConfigurationList()[nativeTarget.buildConfigurationList];
  for (const entry of configurations.buildConfigurations ?? []) {
    const build = project.pbxXCBuildConfigurationSection()[entry.value];
    if (!build) continue;
    build.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${EXTENSION_BUNDLE_ID}"`;
    build.buildSettings.INFOPLIST_FILE = `"${EXTENSION_NAME}/${EXTENSION_NAME}-Info.plist"`;
    build.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements"`;
    build.buildSettings.SWIFT_VERSION = '5.0';
    build.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.4';
    build.buildSettings.CURRENT_PROJECT_VERSION = EXTENSION_PROJECT_VERSION;
    build.buildSettings.MARKETING_VERSION = EXTENSION_MARKETING_VERSION;
  }
  const files = project.pbxFileReferenceSection();
  const sourcePhase = nativeTarget.buildPhases.find((phase) => phase.comment === 'Sources')
    ?? project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  const sourcePath = `${EXTENSION_NAME}.swift`;
  const sourceReference = Object.entries(files).find(([, file]) =>
    file && (file.path === `"${sourcePath}"` || file.path === sourcePath),
  );
  const sourceAlreadyInTarget = sourceReference && project.pbxBuildFileSection()
    && Object.values(project.pbxBuildFileSection()).some((buildFile) =>
      buildFile?.fileRef === sourceReference[0]
      && sourcePhase.files.some((file) => file.value === buildFile.uuid),
    );
  if (!sourceAlreadyInTarget) {
    const groups = project.hash.project.objects.PBXGroup;
    const comment = Object.entries(groups).find(([, value]) => value === EXTENSION_NAME);
    let groupKey = comment ? comment[0].replace(/_comment$/, '') : undefined;
    if (!groupKey) {
      const group = project.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME);
      groupKey = group.uuid;
      const root = project.getPBXGroupByKey(project.getFirstProject().firstProject.mainGroup);
      root.children.push({ value: groupKey, comment: EXTENSION_NAME });
    }
    project.addSourceFile(sourcePath, { target: target.uuid }, groupKey);
  }
  return project;
}

const withQuickEntryFiles = (config) => withDangerousMod(config, ['ios', async (config) => {
  const extensionRoot = path.join(config.modRequest.platformProjectRoot, EXTENSION_NAME);
  fs.mkdirSync(extensionRoot, { recursive: true });
  fs.writeFileSync(path.join(extensionRoot, `${EXTENSION_NAME}.swift`), String.raw`import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let appGroup = "group.com.taigamura.kaji"
private let snapshotName = "quick-entry-snapshot.json"
private let inboxName = "quick-entry-inbox"
private let draftKey = "widget-expense-draft-v1"

private struct Category: Codable, Hashable { let id: String; let name: String }
private struct Currency: Codable { let symbol: String; let code: String }
private struct Defaults: Codable { let categoryId: String?; let recentCategoryIds: [String] }
private struct Allowance: Codable { let status: String; let amount: Int? }
private struct Snapshot: Codable {
  let version: Int; let categories: [Category]; let currency: Currency; let defaults: Defaults; let allowance: Allowance
  static let empty = Snapshot(version: 3, categories: [], currency: Currency(symbol: "¥", code: "JPY"), defaults: Defaults(categoryId: nil, recentCategoryIds: []), allowance: Allowance(status: "no-budget", amount: nil))
}
private struct ExpenseDraft: Codable { var amount = ""; var categoryId: String? }

private enum Copy {
  static var japanese: Bool { Locale.current.language.languageCode?.identifier == "ja" }
  static var title: String { japanese ? "支出を入力" : "Quick expense" }
  static var save: String { japanese ? "保存" : "Save" }
  static var clear: String { japanese ? "クリア" : "Clear" }
  static var open: String { japanese ? "入力を開く" : "Open entry" }
  static var allowance: String { japanese ? "今日使えるお金" : "Today available" }
  static var noBudget: String { japanese ? "予算未設定" : "No budget" }
  static var overspent: String { japanese ? "予算超過" : "Over budget" }
}

private enum Store {
  static var root: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) }
  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
  static func snapshot() -> Snapshot {
    guard let root, let data = try? Data(contentsOf: root.appendingPathComponent(snapshotName)), let result = try? JSONDecoder().decode(Snapshot.self, from: data), result.version == 3 else { return .empty }
    return result
  }
  static func draft() -> ExpenseDraft {
    guard let data = defaults?.data(forKey: draftKey), let result = try? JSONDecoder().decode(ExpenseDraft.self, from: data) else { return ExpenseDraft() }
    return result
  }
  static func save(_ draft: ExpenseDraft) { defaults?.set(try? JSONEncoder().encode(draft), forKey: draftKey) }
  static func categories(_ snapshot: Snapshot) -> [Category] {
    let ids = [snapshot.defaults.categoryId].compactMap { $0 } + snapshot.defaults.recentCategoryIds
    let preferred = ids.compactMap { id in snapshot.categories.first { $0.id == id } }
    var result: [Category] = []
    for category in preferred + snapshot.categories where !result.contains(where: { $0.id == category.id }) { result.append(category) }
    return Array(result.prefix(4))
  }
  static func launchURL(_ snapshot: Snapshot) -> URL {
    var components = URLComponents(); components.scheme = "kaji-quick-entry"; components.host = "new"
    let category = categories(snapshot).first?.name ?? "Expense"
    components.queryItems = [URLQueryItem(name: "launch", value: "widget"), URLQueryItem(name: "category", value: category)]
    return components.url!
  }
  static func enqueue(_ draft: ExpenseDraft, snapshot: Snapshot) throws {
    guard let root, let amount = Int(draft.amount), amount > 0,
      let category = categories(snapshot).first(where: { $0.id == draft.categoryId }) ?? categories(snapshot).first else { return }
    // Clear before publishing so a second Save cannot enqueue the same draft.
    save(ExpenseDraft())
    let date = Calendar.current.dateComponents([.year, .month, .day], from: Date())
    let payload: [String: Any] = ["version": 1, "source": "widget", "id": UUID().uuidString, "timestamp": ISO8601DateFormatter().string(from: Date()), "amount": amount, "category": category.name, "note": "", "date": ["y": date.year!, "m": date.month! - 1, "day": date.day!]]
    let directory = root.appendingPathComponent(inboxName, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let data = try JSONSerialization.data(withJSONObject: payload)
    let temporary = directory.appendingPathComponent(".\(UUID().uuidString).tmp")
    let destination = directory.appendingPathComponent("\(UUID().uuidString).json")
    try data.write(to: temporary, options: .atomic); try FileManager.default.moveItem(at: temporary, to: destination)
  }
}

@available(iOS 17.0, *)
private enum KeypadAction: String, AppEnum { case digit, clear, backspace, save
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Keypad action")
  static var caseDisplayRepresentations: [KeypadAction: DisplayRepresentation] = [.digit: "Digit", .clear: "Clear", .backspace: "Backspace", .save: "Save"]
}
@available(iOS 17.0, *)
private struct KeypadIntent: AppIntent {
  static var title: LocalizedStringResource = "Quick expense"; static var openAppWhenRun = false
  @Parameter(title: "Action") var action: KeypadAction
  @Parameter(title: "Digit", default: "") var digit: String
  init() { action = .clear; digit = "" }; init(action: KeypadAction, digit: String = "") { self.action = action; self.digit = digit }
  func perform() async throws -> some IntentResult {
    var draft = Store.draft()
    switch action { case .digit: if digit.range(of: "^[0-9]$", options: .regularExpression) != nil && draft.amount.count < 12 { draft.amount += digit }; case .clear: draft.amount = ""; case .backspace: draft.amount = String(draft.amount.dropLast()); case .save: try Store.enqueue(draft, snapshot: Store.snapshot()); WidgetCenter.shared.reloadAllTimelines(); return .result() }
    Store.save(draft); WidgetCenter.shared.reloadAllTimelines(); return .result()
  }
}
@available(iOS 17.0, *)
private struct CategoryIntent: AppIntent {
  static var title: LocalizedStringResource = "Expense category"; static var openAppWhenRun = false
  @Parameter(title: "Category") var id: String
  init() { id = "" }; init(id: String) { self.id = id }
  func perform() async throws -> some IntentResult { var draft = Store.draft(); draft.categoryId = id; Store.save(draft); WidgetCenter.shared.reloadAllTimelines(); return .result() }
}

struct KajiQuickEntryWidgetEntry: TimelineEntry { let date: Date; let snapshot: Snapshot; let draft: ExpenseDraft }
struct KajiQuickEntryProvider: TimelineProvider {
  func placeholder(in context: Context) -> KajiQuickEntryWidgetEntry { KajiQuickEntryWidgetEntry(date: Date(), snapshot: .empty, draft: ExpenseDraft()) }
  func getSnapshot(in context: Context, completion: @escaping (KajiQuickEntryWidgetEntry) -> Void) { completion(KajiQuickEntryWidgetEntry(date: Date(), snapshot: Store.snapshot(), draft: Store.draft())) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<KajiQuickEntryWidgetEntry>) -> Void) { getSnapshot(in: context) { completion(Timeline(entries: [$0], policy: .never)) } }
}
private struct AllowanceView: View { let snapshot: Snapshot
  var body: some View { VStack(alignment: .leading) { Text(Copy.allowance).font(.caption); Text(snapshot.allowance.status == "available" ? "\(snapshot.currency.symbol)\(snapshot.allowance.amount ?? 0)" : snapshot.allowance.status == "overspent" ? Copy.overspent : Copy.noBudget).font(.headline).privacySensitive().accessibilityLabel("\(Copy.allowance): \(snapshot.allowance.amount.map(String.init) ?? snapshot.allowance.status)") } }
}
private struct LaunchOnlyView: View { let snapshot: Snapshot
  var body: some View { Link(destination: Store.launchURL(snapshot)) { VStack(alignment: .leading) { Text(Copy.title).font(.headline); AllowanceView(snapshot: snapshot); Spacer(); Text(Copy.open).font(.caption) }.padding() }.accessibilityLabel(Copy.open) }
}
@available(iOS 17.0, *)
private struct InteractiveView: View { let entry: KajiQuickEntryWidgetEntry
  private var categories: [Category] { Store.categories(entry.snapshot) }
  var body: some View { VStack(alignment: .leading, spacing: 6) { HStack { Text(Copy.title).font(.headline); Spacer(); Text(entry.snapshot.currency.symbol + (entry.draft.amount.isEmpty ? "0" : entry.draft.amount)).monospacedDigit().privacySensitive() }; AllowanceView(snapshot: entry.snapshot)
    HStack { ForEach(categories, id: \.id) { category in Button(intent: CategoryIntent(id: category.id)) { Text(category.name).lineLimit(1) }.buttonStyle(.bordered).tint(entry.draft.categoryId == category.id ? .accentColor : .gray) } }
    HStack { ForEach(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], id: \.self) { digit in Button(intent: KeypadIntent(action: .digit, digit: digit)) { Text(digit) }.buttonStyle(.bordered) }; Button(intent: KeypadIntent(action: .clear)) { Text(Copy.clear) }; Button(intent: KeypadIntent(action: .save)) { Text(Copy.save) }.tint(.green) }.buttonStyle(.borderedProminent) }
  }.padding() }
}
private struct KajiQuickEntryWidgetView: View { let entry: KajiQuickEntryWidgetEntry; @Environment(\.widgetFamily) private var family
  var body: some View { if family == .systemSmall || family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline { LaunchOnlyView(snapshot: entry.snapshot) } else if #available(iOS 17.0, *) { InteractiveView(entry: entry) } else { LaunchOnlyView(snapshot: entry.snapshot) } }
}
struct KajiQuickEntryWidget: Widget {
  var body: some WidgetConfiguration { StaticConfiguration(kind: "KajiQuickEntryWidget", provider: KajiQuickEntryProvider()) { KajiQuickEntryWidgetView(entry: $0) }.configurationDisplayName(Copy.title).description("Launch-only on iOS 16.4; expense keypad on iOS 17.").supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline]) }
}
@main struct KajiQuickEntryExtension: WidgetBundle { var body: some Widget { KajiQuickEntryWidget() } }
`);
  fs.writeFileSync(path.join(extensionRoot, `${EXTENSION_NAME}-Info.plist`), `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundleInfoDictionaryVersion</key><string>6.0</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundlePackageType</key><string>XPC!</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict></dict></plist>`);
  fs.copyFileSync(path.join(config.modRequest.projectRoot, 'config/quick-entry.entitlements'), path.join(extensionRoot, `${EXTENSION_NAME}.entitlements`));
  return config;
}]);

const withQuickEntry = (config) => {
  config = withInfoPlist(config, (info) => ({ ...info, CFBundleURLTypes: [{ CFBundleURLSchemes: [SCHEME] }] }));
  config = withEntitlementsPlist(config, (entitlements) => ({ ...entitlements, 'com.apple.security.application-groups': [APP_GROUP] }));
  config = withXcodeProject(config, (config) => {
    config.modResults = addExtensionTarget(config.modResults);
    return config;
  });
  return withQuickEntryFiles(config);
};

module.exports = withQuickEntry;
module.exports.default = withQuickEntry;
module.exports.addExtensionTarget = addExtensionTarget;
