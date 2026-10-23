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
// No App Group, no new entitlements: the intents share the app's own Documents dir.
// Idempotent; re-runs on every prebuild.

const fs = require('fs');
const path = require('path');
const { withXcodeProject, withPodfileProperties, IOSConfig } = require('expo/config-plugins');

const SOURCE_DIR = path.join(__dirname, 'app-intents');
const DEPLOYMENT_TARGET = '26.0';

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
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot;
    const projectName = cfg.modRequest.projectName || IOSConfig.XcodeUtils.getProjectName(projectRoot);
    addSwiftSources(project, projectRoot, projectName);
    setDeploymentTarget(project);
    stripUndefined(project);
    return cfg;
  });
  return config;
};

module.exports = withSuitoAppIntents;
module.exports.DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
