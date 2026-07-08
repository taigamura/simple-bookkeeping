const babel = require('/home/taigamura/simple-bookkeeping/node_modules/@babel/core');
const out = babel.transformSync('const f=()=>{"worklet";return 1};', {
  filename: '/home/taigamura/simple-bookkeeping/x.tsx',
  configFile: '/home/taigamura/simple-bookkeeping/babel.config.js',
  caller: { name: 'metro', platform: 'ios', supportsStaticESM: false },
});
console.log(/__workletHash|_worklet|WorkletsModule|makeShareableCloneRecursive/.test(out.code) ? 'WORKLETS_PLUGIN_ACTIVE' : 'plugin-not-applied');
