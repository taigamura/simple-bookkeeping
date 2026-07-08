/**
 * Babel config (#39). Added when the gesture/animation stack landed: Reanimated
 * needs its worklets Babel plugin to compile the UI-thread animation code that
 * powers @gorhom/bottom-sheet.
 *
 * On Expo SDK 57, `babel-preset-expo` auto-detects `react-native-worklets` and
 * appends `react-native-worklets/plugin` for us (it must run last), so listing
 * it here as well would register the plugin twice and error. Keep the preset as
 * the single source — the worklets/reanimated plugin is configured through it.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
