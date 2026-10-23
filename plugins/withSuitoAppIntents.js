// Config plugin for Suito AI (ADR-0006), modelled on voice-memo's withKoemoriAppIntents.js.
//
// 1. App Intents into the MAIN APP TARGET: copies plugins/app-intents/*.swift into
//    ios/<Project>/ and adds them to the app target's Sources phase. App Intents metadata
//    (Siri phrases, Shortcuts actions, Action Button) is only extracted from intents compiled
//    into the app target, never from a CocoaPods static library. The intents `import SuitoAi`
//    (the local pod, DEFINES_MODULE) for the shared SuitoSiriStore, so no code is duplicated.
// 2. Minimum iOS 26 (Foundation Models, App Intents APIs): `ios.deploymentTarget` in
//    Podfile.properties.json (read by the Podfile's `platform :ios`) and
//    IPHONEOS_DEPLOYMENT_TARGET on every build configuration of the Xcode project.
//    (expo-build-properties isn't installed, so it's done here.)
//
// 3. Japanese localization of the intents: ja.lproj/AppShortcuts.strings (Siri only matches
//    phrases in languages the app is localized in) and ja.lproj/Localizable.strings (action,
//    parameter and summary titles in Shortcuts). This makes `ja` a bundle localization, so
//    UIKit's own strings (edit menus, system alerts) also appear in Japanese on Japanese devices.
//    Also ja.lproj/InfoPlist.strings: the mic / speech / camera permission prompts (English in
//    app.json `ios.infoPlist`).
//
// No App Group, no new entitlements: the intents share the app's own Documents dir.
// Idempotent; re-runs on every prebuild.

const fs = require('fs');
const path = require('path');
const { withXcodeProject, withPodfileProperties, IOSConfig } = require('expo/config-plugins');

const SOURCE_DIR = path.join(__dirname, 'app-intents');
const DEPLOYMENT_TARGET = '26.0';

// English base phrase (as written in SuitoAppShortcuts.swift, `\(.applicationName)` ->
// ${applicationName}, `\(\.$x)` -> ${x}) -> Japanese phrase. One entry per base phrase.
const JA_APP_SHORTCUTS = {
  'Add an entry in ${applicationName}': '${applicationName}で記録',
  'Log an expense in ${applicationName}': '${applicationName}に記録',
  'Add to ${applicationName}': '${applicationName}に追加',
  'Log ${category} in ${applicationName}': '${applicationName}で${category}を記録',
  'Record ${category} in ${applicationName}': '${applicationName}に${category}を記録',
  '${applicationName} summary': '${applicationName}の収支',
  'Show my ${applicationName} balance': '${applicationName}で収支を確認',
  '${applicationName} summary for ${period}': '${applicationName}で${period}の収支',
  'How much did I spend ${period} in ${applicationName}': '${applicationName}で${period}いくら使った',
  '${category} spending in ${applicationName}': '${applicationName}で${category}はいくら',
  'How much on ${category} in ${applicationName}': '${applicationName}の${category}',
  'Spending by category in ${applicationName}': '${applicationName}でカテゴリ別の支出',
  'Find entries in ${applicationName}': '${applicationName}で記録を探す',
};

// Titles shown in Shortcuts / Siri UI (LocalizedStringResource keys from plugins/app-intents).
const JA_LOCALIZABLE = {
  'Add Entry': '記録を追加',
  Summary: '収支',
  'Spending by Category': 'カテゴリ別の支出',
  'Find Entries': '記録を探す',
  'Records an expense or income in Suito. It shows up in the app the next time you open it.':
    'Suitoに支出か収入を記録します。次にアプリを開いたときに反映されます。',
  'Income, spending, net, budget left and no-spend days for a month or a range of months.':
    'ひと月または複数の月の収入、支出、収支、予算の残り、支出ゼロの日数。',
  'How much went to one category in a month or a range of months.':
    'ひと月または複数の月で、あるカテゴリに使った金額。',
  'Returns Suito entries for a period, a category or words in the note, newest first.':
    '期間、カテゴリ、メモの文字でSuitoの記録を新しい順に探します。',
  Amount: '金額',
  Category: 'カテゴリ',
  Note: 'メモ',
  Date: '日付',
  Period: '期間',
  'From month': '開始月',
  'To month': '終了月',
  'Overrides Period when set (any day in the month).': '指定すると期間より優先されます（その月の任意の日）。',
  'Last month of the range (any day in it).': '範囲の最後の月（その月の任意の日）。',
  'Text in note': 'メモの文字',
  Limit: '件数の上限',
  'Maximum number of entries (1 to 500).': '返す記録の最大件数（1〜500）。',
  'How much?': 'いくら？',
  'Which category?': 'どのカテゴリ？',
  'Add ${amount} to ${category}': '${category}に${amount}を記録',
  'Summary for ${period}': '${period}の収支',
  '${category} spending for ${period}': '${period}の${category}',
  'Find entries': '記録を探す',
  'Suito Entry': 'Suitoの記録',
  Type: '種類',
  Repeating: '繰り返し',
  'This month': '今月',
  'Last month': '先月',
  'This year': '今年',
  'Last year': '去年',
};

// Japanese permission prompts (ja.lproj/InfoPlist.strings). The English base strings live in
// app.json `ios.infoPlist`; every key there needs a Japanese line here (plugin test checks it).
const JA_INFO_PLIST = {
  NSMicrophoneUsageDescription: 'ボタンを押している間だけマイクを使い、話した内容から記録を作ります。音声はiPhoneの外に出ません。',
  NSSpeechRecognitionUsageDescription: '話した内容はiPhoneの中だけで文字にします。どこにも送りません。',
  NSCameraUsageDescription: 'レシートを読み取って記録を作ります。読み取りはiPhoneの中だけで行い、写真は保存しません。',
};

/** `.strings` lines need quoted keys; IOSConfig.Locales.writeStringsFile quotes only values. */
function stringsMap(obj) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [`"${esc(k)}"`, esc(v)]));
}

async function addJapaneseStrings(project, projectRoot, projectName) {
  const supportingDirectory = path.join(projectRoot, 'ios', projectName, 'Supporting');
  for (const [fileName, map] of [
    ['AppShortcuts.strings', JA_APP_SHORTCUTS],
    ['Localizable.strings', JA_LOCALIZABLE],
    ['InfoPlist.strings', JA_INFO_PLIST],
  ]) {
    project = await IOSConfig.Locales.writeStringsFile({
      localesMap: { ja: stringsMap(map) },
      supportingDirectory,
      fileName,
      projectName,
      project,
    });
  }
  for (const [, pbx] of entries(section(project, 'PBXProject'))) {
    if (Array.isArray(pbx.knownRegions) && !pbx.knownRegions.includes('ja')) pbx.knownRegions.push('ja');
  }
  return project;
}

function section(project, isa) {
  const objects = project.hash.project.objects;
  if (!objects[isa]) objects[isa] = {};
  return objects[isa];
}

function entries(sec) {
  return Object.entries(sec).filter(([k]) => !k.endsWith('_comment'));
}

function addSwiftSources(project, projectRoot, projectName) {
  const iosAppDir = path.join(projectRoot, 'ios', projectName);
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.swift'))
    .sort();
  for (const file of files) {
    fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(iosAppDir, file));
    // Skips files already in the group (re-runs without --clean).
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: path.join(projectName, file),
      groupName: projectName,
      project,
    });
  }
}

function setDeploymentTarget(project) {
  for (const [, config] of entries(section(project, 'XCBuildConfiguration'))) {
    if (config.buildSettings) config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
  }
}

// The `xcode` pbxFile helper can leave `explicitFileType: undefined` on new file references,
// which a later rewrite serializes literally; Xcode then won't compile the Swift file.
function stripUndefined(project) {
  for (const [, ref] of entries(section(project, 'PBXFileReference'))) {
    for (const key of Object.keys(ref)) {
      if (ref[key] === undefined || ref[key] === 'undefined') delete ref[key];
    }
  }
}

const withSuitoAppIntents = (config) => {
  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.deploymentTarget'] = DEPLOYMENT_TARGET;
    return cfg;
  });
  config = withXcodeProject(config, async (cfg) => {
    let project = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot;
    const projectName = cfg.modRequest.projectName || IOSConfig.XcodeUtils.getProjectName(projectRoot);
    addSwiftSources(project, projectRoot, projectName);
    setDeploymentTarget(project);
    project = await addJapaneseStrings(project, projectRoot, projectName);
    stripUndefined(project);
    cfg.modResults = project;
    return cfg;
  });
  return config;
};

module.exports = withSuitoAppIntents;
module.exports.DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
module.exports.JA_APP_SHORTCUTS = JA_APP_SHORTCUTS;
module.exports.JA_LOCALIZABLE = JA_LOCALIZABLE;
module.exports.JA_INFO_PLIST = JA_INFO_PLIST;
