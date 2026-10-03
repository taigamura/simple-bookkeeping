/**
 * Web stand-in for NativeTabHost. `react-native-bottom-tabs` is a native view
 * and imports native-only modules, so web must never bundle it. Root never
 * renders this on web (`NATIVE_TABS` is iOS-only); it exists so the import
 * resolves.
 */
import type { Tab } from './types';

export function NativeTabHost(_props: {
  tab: Tab;
  onSelect: (tab: Tab) => void;
  onAdd: () => void;
  render: (tab: Tab) => React.ReactNode;
}): null {
  return null;
}
