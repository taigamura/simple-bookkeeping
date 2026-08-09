import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// xcode ships without TypeScript declarations; this test intentionally parses
// the generated project through its public runtime parser.
const xcode: any = require('xcode');
const plist = require('@expo/plist').default;

const root = path.resolve(__dirname, '..');

describe('generated quick-entry native configuration', () => {
  it('registers the config plugin and navigation-only scheme from the public Expo config', () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
    expect(app.plugins).toContain('./config/withQuickEntry');
    expect(app.ios.infoPlist.CFBundleURLTypes).toEqual([
      { CFBundleURLSchemes: ['kaji-quick-entry'] },
    ]);
    expect(app.ios.bundleIdentifier).toBe('com.taigamura.kaji');
    expect(app.ios.entitlements['com.apple.security.application-groups']).toEqual([
      'group.com.taigamura.kaji',
    ]);
  });

  it('has one derived extension target, entitlement, and explicit draft-only URL policy', () => {
    const plugin = fs.readFileSync(path.join(root, 'config/withQuickEntry.js'), 'utf8');
    expect(plugin).toContain('`${APP_BUNDLE_ID}.quick-entry`');
    expect(plugin).toContain('group.com.taigamura.kaji');
    expect(plugin).toContain('pbxNativeTargetSection');
    expect(plugin).toContain('com.apple.security.application-groups');
    expect(plugin).toContain('CFBundleURLSchemes');
  });

  it('generates the extension target and native files during Expo prebuild', () => {
    const temp = fs.mkdtempSync('/tmp/kaji-config-test-');
    for (const file of ['app.json', 'package.json', 'package-lock.json']) fs.copyFileSync(path.join(root, file), path.join(temp, file));
    for (const directory of ['config', 'modules', 'assets']) fs.cpSync(path.join(root, directory), path.join(temp, directory), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(temp, 'node_modules'));
    childProcess.execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--no-install', '--platform', 'ios'], { cwd: temp, stdio: 'pipe' });

    const projectPath = path.join(temp, 'ios/Kaji.xcodeproj/project.pbxproj');
    const project = xcode.project(projectPath);
    project.parseSync();
    const targets = project.pbxNativeTargetSection();
    const host = Object.values(targets).find((target: any) => target.name === 'Kaji');
    const extension = Object.values(targets).find((target: any) => target.name === '"KajiQuickEntryExtension"');
    expect(host).toBeDefined();
    expect(extension).toBeDefined();

    const sourcePhases = project.hash.project.objects.PBXSourcesBuildPhase;
    const buildFiles = project.pbxBuildFileSection();
    const references = project.pbxFileReferenceSection();
    const extensionSourcePhase = Object.entries(sourcePhases).find(([, phase]: any) =>
      phase.files?.some((file: any) => {
        const buildFile = buildFiles[file.value];
        return buildFile && references[buildFile.fileRef]?.path === '"KajiQuickEntryExtension.swift"';
      }),
    );
    expect(extensionSourcePhase).toBeDefined();
    expect((sourcePhases[extensionSourcePhase![0]] as any).files).toHaveLength(1);
    expect((extension as any).buildPhases).toEqual([
      expect.objectContaining({ value: extensionSourcePhase![0] }),
    ]);
    const extensionSourceRef = Object.entries(references).find(([, ref]: any) =>
      ref.path === '"KajiQuickEntryExtension.swift"',
    )![0];
    expect((host as any).buildPhases.flatMap((phase: any) => sourcePhases[phase.value]?.files ?? [])
      .some((file: any) => buildFiles[file.value]?.fileRef === extensionSourceRef)).toBe(false);
    expect((host as any).dependencies).toEqual([
      expect.objectContaining({ value: expect.any(String) }),
    ]);
    const dependency = project.hash.project.objects.PBXTargetDependency[(host as any).dependencies[0].value];
    expect(dependency.target).toBe(Object.entries(targets).find(([, target]: any) => target.name === '"KajiQuickEntryExtension"')![0]);
    const copyPhase = (host as any).buildPhases.find((phase: any) => phase.comment === 'Copy Files');
    expect(sourcePhases[copyPhase.value]).toBeUndefined();
    const copyFiles = project.hash.project.objects.PBXCopyFilesBuildPhase[copyPhase.value].files;
    expect(copyFiles).toEqual([expect.objectContaining({ value: expect.any(String) })]);
    expect(references[buildFiles[copyFiles[0].value].fileRef].path).toBe('"KajiQuickEntryExtension.appex"');
    expect(references[Object.entries(references).find(([, ref]: any) => ref.path === '"KajiQuickEntryExtension.swift"')![0]].path)
      .toBe('"KajiQuickEntryExtension.swift"');

    const extensionBuilds = project.pbxXCBuildConfigurationSection();
    const extensionConfigList = project.pbxXCConfigurationList()[(extension as any).buildConfigurationList];
    for (const config of extensionConfigList.buildConfigurations) {
      const settings = extensionBuilds[config.value].buildSettings;
      expect(settings.INFOPLIST_FILE).toBe('"KajiQuickEntryExtension/KajiQuickEntryExtension-Info.plist"');
      expect(settings.CODE_SIGN_ENTITLEMENTS).toBe('"KajiQuickEntryExtension/KajiQuickEntryExtension.entitlements"');
      expect(settings.CURRENT_PROJECT_VERSION).toBe(1);
      expect(settings.MARKETING_VERSION).toBe('0.1.0');
    }
    expect(fs.readFileSync(path.join(temp, 'ios/KajiQuickEntryExtension/KajiQuickEntryExtension.entitlements'), 'utf8')).toContain('group.com.taigamura.kaji');
    const extensionInfo = fs.readFileSync(path.join(temp, 'ios/KajiQuickEntryExtension/KajiQuickEntryExtension-Info.plist'), 'utf8');
    const parsedExtensionInfo = plist.parse(extensionInfo);
    expect(parsedExtensionInfo).toEqual(expect.objectContaining({
      CFBundleExecutable: '$(EXECUTABLE_NAME)',
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleName: '$(PRODUCT_NAME)',
      CFBundleInfoDictionaryVersion: '6.0',
      CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
      CFBundleShortVersionString: '$(MARKETING_VERSION)',
      CFBundlePackageType: 'XPC!',
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
    }));
    for (const key of [
      'CFBundleExecutable', '$(EXECUTABLE_NAME)',
      'CFBundleIdentifier', '$(PRODUCT_BUNDLE_IDENTIFIER)',
      'CFBundleName', '$(PRODUCT_NAME)',
      'CFBundleInfoDictionaryVersion', '6.0',
      'CFBundleVersion', '$(CURRENT_PROJECT_VERSION)',
      'CFBundleShortVersionString', '$(MARKETING_VERSION)',
    ]) expect(extensionInfo).toContain(key);
    expect(extensionInfo).toContain('com.apple.widgetkit-extension');
    expect(extensionInfo).not.toContain('NSExtensionPrincipalClass');
    expect(extensionInfo).not.toContain('WKCompanionAppBundleIdentifier');
    const extensionSource = fs.readFileSync(path.join(temp, 'ios/KajiQuickEntryExtension/KajiQuickEntryExtension.swift'), 'utf8');
    expect(extensionSource).toContain('Text("Quick Entry")');
    expect(extensionSource).not.toContain('Text("Kaji")');
    expect(extensionSource).not.toContain('configurationDisplayName("Kaji');
    expect(extensionSource).not.toContain('description("Open Kaji');
    expect(extensionSource).toMatch(/import SwiftUI[\s\S]*import WidgetKit[\s\S]*WidgetBundle/);
    expect(fs.readFileSync(path.join(temp, 'ios/Kaji/Info.plist'), 'utf8')).toContain('kaji-quick-entry');
  }, 30_000);
});
