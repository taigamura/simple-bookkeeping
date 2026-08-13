import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
const xcode: any = require('xcode');
const plist = require('@expo/plist').default;

const root = path.resolve(__dirname, '..');

function prebuildWatchProject(watchExpenseEnabled = true) {
  const temp = fs.mkdtempSync('/tmp/kaji-watch-config-test-');
  for (const file of ['app.json', 'app.config.js', 'package.json', 'package-lock.json']) fs.copyFileSync(path.join(root, file), path.join(temp, file));
  for (const directory of ['config', 'modules', 'assets']) fs.cpSync(path.join(root, directory), path.join(temp, directory), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(temp, 'node_modules'));
  childProcess.execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--no-install', '--platform', 'ios'], {
    cwd: temp,
    env: {
      ...process.env,
      ...(watchExpenseEnabled ? { KAJI_ENABLE_WATCH_EXPENSE: '1' } : { KAJI_ENABLE_WATCH_EXPENSE: undefined }),
    },
    stdio: 'pipe',
  });
  // The generated Xcode project and host target take their name from the Expo
  // `name`, which is the public product name and may change. Resolve it from
  // the prebuild output rather than pinning it, so a rename cannot silently
  // turn these assertions into a false pass.
  const hostName = fs.readdirSync(path.join(temp, 'ios')).find((entry) => entry.endsWith('.xcodeproj'))!.replace('.xcodeproj', '');
  const project = xcode.project(path.join(temp, `ios/${hostName}.xcodeproj/project.pbxproj`));
  project.parseSync();
  return { temp, project, hostName };
}

function target(project: any, name: string) {
  return Object.entries(project.pbxNativeTargetSection()).find(([, value]: any) => value.name === name)!;
}

function sourcePaths(project: any, nativeTarget: any) {
  const phases = project.hash.project.objects.PBXSourcesBuildPhase;
  const buildFiles = project.pbxBuildFileSection();
  const references = project.pbxFileReferenceSection();
  return nativeTarget.buildPhases.flatMap((phase: any) => phases[phase.value]?.files ?? [])
    .map((file: any) => references[buildFiles[file.value]?.fileRef]?.path?.replaceAll('"', ''));
}

function dependencyTargets(project: any, nativeTarget: any) {
  const dependencies = project.hash.project.objects.PBXTargetDependency;
  return nativeTarget.dependencies.map((dependency: any) => dependencies[dependency.value]?.target);
}

describe('Apple Watch expense companion configuration (#118)', () => {
  it('is disabled by default and enabled only by the explicit development opt-in', () => {
    const appConfig = require(path.join(root, 'app.config.js'));
    const original = process.env.KAJI_ENABLE_WATCH_EXPENSE;
    delete process.env.KAJI_ENABLE_WATCH_EXPENSE;
    expect(appConfig().plugins).not.toContain('./config/withWatchExpense');
    process.env.KAJI_ENABLE_WATCH_EXPENSE = '1';
    expect(appConfig().plugins).toContain('./config/withWatchExpense');
    if (original === undefined) delete process.env.KAJI_ENABLE_WATCH_EXPENSE;
    else process.env.KAJI_ENABLE_WATCH_EXPENSE = original;
  });

  it('does not generate a Watch target or host bridge startup without the opt-in', () => {
    const { temp, project, hostName } = prebuildWatchProject(false);
    expect(Object.values(project.pbxNativeTargetSection()).some((value: any) => value.name === '"KajiWatchApp"')).toBe(false);
    expect(fs.readFileSync(path.join(temp, `ios/${hostName}/AppDelegate.swift`), 'utf8')).not.toContain('KajiWatchPhoneBridge.shared.start()');
  }, 30_000);

  it('keeps the Watch contract bounded to queued expense commands and exact acknowledgements', () => {
    const plugin = fs.readFileSync(path.join(root, 'config/withWatchExpense.js'), 'utf8');
    expect(plugin).toContain('recentCategoryIds');
    expect(plugin).toContain('allowance');
    expect(plugin).toContain('Button("Save")');
    expect(plugin).toContain('model.select(category: category)');
    expect(plugin).toContain('model.saveSelectedCategory()');
    expect(plugin).not.toContain('Button(category.name) { model.save(category: category) }');
    expect(plugin).toContain('source: "watch"');
    expect(plugin).toContain('replyHandler(["ack": "watch:\\(id)"])');
    expect(plugin).toContain('sessionReachabilityDidChange');
    expect(plugin).toContain('CLKComplicationPrincipalClass');
    expect(plugin).toContain('WatchAllowanceComplicationDataSource');
    expect(plugin).not.toContain('recurrence');
  });

  it('prebuilds isolated Watch sources, target dependencies, embeds, plist links, and host versions', () => {
    const { temp, project, hostName } = prebuildWatchProject();
    const [, host] = target(project, hostName) as any;
    const [watchAppId, watchApp] = target(project, '"KajiWatchApp"') as any;
    const [watchExtensionId, watchExtension] = target(project, '"KajiWatchExtension"') as any;

    expect(sourcePaths(project, host)).toContain('KajiWatchPhoneBridge.swift');
    expect(sourcePaths(project, host)).not.toContain('KajiWatchExtension/KajiWatchExtension.swift');
    expect(sourcePaths(project, watchExtension)).toEqual(['KajiWatchExtension/KajiWatchExtension.swift']);
    expect(sourcePaths(project, watchApp)).toEqual([]);
    expect(dependencyTargets(project, host)).toContain(watchAppId);
    expect(dependencyTargets(project, watchApp)).toEqual([watchExtensionId]);

    const copyPhases = project.hash.project.objects.PBXCopyFilesBuildPhase;
    const hostEmbed = host.buildPhases.find((phase: any) => phase.comment === 'Embed Watch Content');
    const appEmbed = watchApp.buildPhases.find((phase: any) => phase.comment === 'Embed App Extensions');
    expect(copyPhases[hostEmbed.value]).toEqual(expect.objectContaining({ dstSubfolderSpec: 16, dstPath: '"$(CONTENTS_FOLDER_PATH)/Watch"' }));
    expect(copyPhases[appEmbed.value]).toEqual(expect.objectContaining({ dstSubfolderSpec: 13 }));

    const settings = project.pbxXCBuildConfigurationSection();
    const hostConfigs = project.pbxXCConfigurationList()[host.buildConfigurationList].buildConfigurations;
    const appConfigs = project.pbxXCConfigurationList()[watchApp.buildConfigurationList].buildConfigurations;
    const extensionConfigs = project.pbxXCConfigurationList()[watchExtension.buildConfigurationList].buildConfigurations;
    for (const config of [...appConfigs, ...extensionConfigs]) {
      const build = settings[config.value];
      const hostConfig = hostConfigs.find((candidate: any) => settings[candidate.value].name === build.name);
      expect(build.buildSettings.MARKETING_VERSION).toBe(settings[hostConfig.value].buildSettings.MARKETING_VERSION);
      expect(build.buildSettings.CURRENT_PROJECT_VERSION).toBe(settings[hostConfig.value].buildSettings.CURRENT_PROJECT_VERSION);
    }

    const appInfo = plist.parse(fs.readFileSync(path.join(temp, 'ios/KajiWatchApp/KajiWatchApp-Info.plist'), 'utf8'));
    const extensionInfo = plist.parse(fs.readFileSync(path.join(temp, 'ios/KajiWatchExtension/KajiWatchExtension-Info.plist'), 'utf8'));
    expect(appInfo).toEqual(expect.objectContaining({
      CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
      WKCompanionAppBundleIdentifier: 'com.taigamura.kaji', WKWatchKitApp: true,
    }));
    expect(extensionInfo).toEqual(expect.objectContaining({
      CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
      WKAppBundleIdentifier: 'com.taigamura.kaji.watchkitapp',
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.watchkit' },
    }));
    expect(extensionInfo.CLKComplicationPrincipalClass).toBe('$(PRODUCT_MODULE_NAME).WatchAllowanceComplicationDataSource');
    const watchSource = fs.readFileSync(path.join(temp, 'ios/KajiWatchExtension/KajiWatchExtension.swift'), 'utf8');
    expect(watchSource).toContain('WatchConnectivity');
    expect(watchSource).toContain('WatchAllowanceComplicationDataSource');
    expect(watchSource).toContain('sessionReachabilityDidChange');
    expect(fs.readFileSync(path.join(temp, `ios/${hostName}/AppDelegate.swift`), 'utf8')).toContain('KajiWatchPhoneBridge.shared.start()');
  }, 30_000);
});
