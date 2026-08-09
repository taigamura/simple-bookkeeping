const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const extensionSpec = require('./quick-entry.extension.json');

const APP_BUNDLE_ID = 'com.taigamura.kaji';
const APP_GROUP = 'group.com.taigamura.kaji';
const EXTENSION_NAME = 'KajiQuickEntryExtension';
const EXTENSION_BUNDLE_ID = `${APP_BUNDLE_ID}.quick-entry`;
const SCHEME = 'kaji-quick-entry';

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
  fs.writeFileSync(path.join(extensionRoot, `${EXTENSION_NAME}.swift`), `import SwiftUI\nimport WidgetKit\n\nstruct KajiQuickEntryWidgetEntry: TimelineEntry {\n  let date: Date\n}\n\nstruct KajiQuickEntryProvider: TimelineProvider {\n  func placeholder(in context: Context) -> KajiQuickEntryWidgetEntry { KajiQuickEntryWidgetEntry(date: Date()) }\n  func getSnapshot(in context: Context, completion: @escaping (KajiQuickEntryWidgetEntry) -> Void) { completion(placeholder(in: context)) }\n  func getTimeline(in context: Context, completion: @escaping (Timeline<KajiQuickEntryWidgetEntry>) -> Void) {\n    completion(Timeline(entries: [placeholder(in: context)], policy: .never))\n  }\n}\n\nstruct KajiQuickEntryWidget: Widget {\n  var body: some WidgetConfiguration {\n    StaticConfiguration(kind: "KajiQuickEntryWidget", provider: KajiQuickEntryProvider()) { _ in\n      Text("Quick Entry")\n    }\n    .configurationDisplayName("Quick Entry")\n    .description("Open the app to review a draft expense.")\n    .supportedFamilies([.systemSmall])\n  }\n}\n\n@main\nstruct KajiQuickEntryExtension: WidgetBundle {\n  var body: some Widget { KajiQuickEntryWidget() }\n}\n`);
  fs.writeFileSync(path.join(extensionRoot, `${EXTENSION_NAME}-Info.plist`), `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundlePackageType</key><string>XPC!</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict></dict></plist>`);
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
