const app = require('./app.json').expo;

const APP_GROUP_ENTITLEMENTS = {
  'com.apple.security.application-groups': ['group.com.taigamura.kaji'],
};

// EAS resolves per-target credentials from this list, not from the generated
// Xcode project, so the Watch targets must appear here exactly when the Watch
// plugin runs. Declaring a target that prebuild never creates makes EAS
// provision a profile with nothing to sign.
const WATCH_APP_EXTENSIONS = [
  {
    targetName: 'KajiWatchApp',
    bundleIdentifier: 'com.taigamura.kaji.watchkitapp',
    entitlements: APP_GROUP_ENTITLEMENTS,
  },
  {
    targetName: 'KajiWatchExtension',
    bundleIdentifier: 'com.taigamura.kaji.watchkitapp.watchkitextension',
    entitlements: APP_GROUP_ENTITLEMENTS,
  },
];

// The Watch target is a development scaffold until it has passed the physical
// device certification gate. Keep production builds free of its embedded app.
module.exports = () => {
  const watchExpenseEnabled = process.env.KAJI_ENABLE_WATCH_EXPENSE === '1';
  const experimental = app.extra.eas.build.experimental;
  return {
    ...app,
    plugins: app.plugins.filter((plugin) => plugin !== './config/withWatchExpense')
      .concat(watchExpenseEnabled ? ['./config/withWatchExpense'] : []),
    extra: {
      ...app.extra,
      eas: {
        ...app.extra.eas,
        build: {
          ...app.extra.eas.build,
          experimental: {
            ...experimental,
            ios: {
              ...experimental.ios,
              appExtensions: experimental.ios.appExtensions
                .concat(watchExpenseEnabled ? WATCH_APP_EXTENSIONS : []),
            },
          },
        },
      },
      watchExpenseEnabled,
    },
  };
};
