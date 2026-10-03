import { Platform } from 'react-native';

/**
 * Whether the tab bar is the OS's own UITabBar (`NativeTabHost`) rather than
 * the custom `TabBar`. iOS only: there the system bar is the genuine Liquid
 * Glass on iOS 26. Web (no native view) and Android keep the custom bar.
 * jest.setup.js pins this to false so the suite exercises the JS bar.
 */
export const NATIVE_TABS = Platform.OS === 'ios';
