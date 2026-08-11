import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
const xcode: any = require('xcode');

const root = path.resolve(__dirname, '..');

describe('Apple Watch expense companion configuration (#118)', () => {
  it('registers a generated Watch app, extension, and paired-phone WatchConnectivity bridge', () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
    const plugin = fs.readFileSync(path.join(root, 'config/withWatchExpense.js'), 'utf8');
    expect(app.plugins).toContain('./config/withWatchExpense');
    expect(plugin).toContain("'watch2_app'");
    expect(plugin).toContain("'watch2_extension'");
    expect(plugin).toContain('KajiWatchPhoneBridge.swift');
    expect(plugin).toContain('WatchConnectivity');
    expect(plugin).toContain('quick-entry-inbox');
    expect(plugin).toContain('replyHandler(["ack": "watch:\\(id)"])');
  });

  it('limits the companion to expenses, recent categories, explicit Save, and the shared allowance snapshot', () => {
    const plugin = fs.readFileSync(path.join(root, 'config/withWatchExpense.js'), 'utf8');
    expect(plugin).toContain('recentCategoryIds');
    expect(plugin).toContain('allowance');
    expect(plugin).toContain('Button("Save")');
    expect(plugin).toContain('source: "watch"');
    expect(plugin).toContain('queued.append(Command');
    expect(plugin).not.toContain('recurrence');
  });

  it('generates Watch app and extension targets, entitlements, and the paired-phone bridge during prebuild', () => {
    const temp = fs.mkdtempSync('/tmp/kaji-watch-config-test-');
    for (const file of ['app.json', 'package.json', 'package-lock.json']) fs.copyFileSync(path.join(root, file), path.join(temp, file));
    for (const directory of ['config', 'modules', 'assets']) fs.cpSync(path.join(root, directory), path.join(temp, directory), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(temp, 'node_modules'));
    childProcess.execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--no-install', '--platform', 'ios'], { cwd: temp, stdio: 'pipe' });

    const project = xcode.project(path.join(temp, 'ios/Kaji.xcodeproj/project.pbxproj'));
    project.parseSync();
    const targets = project.pbxNativeTargetSection();
    expect(Object.values(targets).find((value: any) => value.name === '"KajiWatchApp"')).toBeDefined();
    expect(Object.values(targets).find((value: any) => value.name === '"KajiWatchExtension"')).toBeDefined();
    expect(fs.readFileSync(path.join(temp, 'ios/KajiWatchApp/KajiWatchApp.entitlements'), 'utf8')).toContain('group.com.taigamura.kaji');
    expect(fs.readFileSync(path.join(temp, 'ios/KajiWatchExtension.swift'), 'utf8')).toContain('WatchConnectivity');
    const bridge = fs.readFileSync(path.join(temp, 'ios/KajiWatchPhoneBridge.swift'), 'utf8');
    expect(bridge).toContain('quick-entry-inbox');
    expect(bridge).toContain('replyHandler(["ack": "watch:\\(id)"])');
  }, 30_000);
});
