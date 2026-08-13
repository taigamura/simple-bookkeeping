// Gesture-handler side-effect import (#39). Must be the first import in the app
// entry so react-native-gesture-handler installs its native handlers before any
// component (including @gorhom/bottom-sheet's) mounts.
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';
import { init as initErrorReporting } from './platform/errorReporting';

// Sentry (#27): no-ops until a DSN is configured in app.json's expo.extra.
initErrorReporting();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
