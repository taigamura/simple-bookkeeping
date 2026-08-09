import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

    const project = fs.readFileSync(path.join(temp, 'ios/Kaji.xcodeproj/project.pbxproj'), 'utf8');
    expect(project).toContain('KajiQuickEntryExtension');
    expect(project).toContain('com.taigamura.kaji.quick-entry');
    expect(fs.readFileSync(path.join(temp, 'ios/KajiQuickEntryExtension/KajiQuickEntryExtension.entitlements'), 'utf8')).toContain('group.com.taigamura.kaji');
    expect(fs.readFileSync(path.join(temp, 'ios/Kaji/Info.plist'), 'utf8')).toContain('kaji-quick-entry');
  }, 30_000);
});
