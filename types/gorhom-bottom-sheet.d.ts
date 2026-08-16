/**
 * Ambient declarations for `@gorhom/bottom-sheet` 5.2.x.
 *
 * The published 5.2.x tarball is mis-packaged: it declares
 * `"types": "lib/typescript/index.d.ts"` but ships only the `.d.ts.map`
 * sourcemaps under `lib/typescript/`, not the `.d.ts` files themselves. TS
 * therefore falls back to the untyped `lib/commonjs/index.js` and errors with
 * TS7016 ("implicitly has an 'any' type") on every import. Reinstalling does
 * not help because the defect is in the upstream package contents.
 *
 * This shim types only the surface the app actually consumes (see
 * nav/AppShell.tsx, nav/Root.tsx, nav/BottomSheet.tsx). Widen it here if new
 * gorhom symbols get imported. Remove this file once upstream ships correct
 * declarations and the `types` entry point resolves.
 */
declare module '@gorhom/bottom-sheet' {
  import * as React from 'react';
  import type { ViewProps, ViewStyle, StyleProp } from 'react-native';

  export interface BottomSheetModalProviderProps {
    children?: React.ReactNode;
  }
  export const BottomSheetModalProvider: React.FC<BottomSheetModalProviderProps>;

  export interface BottomSheetViewProps extends ViewProps {
    children?: React.ReactNode;
  }
  export const BottomSheetView: React.FC<BottomSheetViewProps>;

  export interface BottomSheetScrollViewProps {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    showsVerticalScrollIndicator?: boolean;
    keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
  }
  export const BottomSheetScrollView: React.FC<BottomSheetScrollViewProps>;

  /** Imperative handle exposed on a `BottomSheetModal` ref. */
  export interface BottomSheetModal {
    present(data?: unknown): void;
    dismiss(): void;
    snapToIndex(index: number): void;
    snapToPosition(position: number | string): void;
    expand(): void;
    collapse(): void;
    close(): void;
    forceClose(): void;
  }
  export const BottomSheetModal: React.ForwardRefExoticComponent<
    Record<string, unknown> & React.RefAttributes<BottomSheetModal>
  >;

  export interface BottomSheetBackdropProps {
    animatedIndex: { value: number };
    animatedPosition: { value: number };
    style?: StyleProp<ViewStyle>;
  }

  export interface BottomSheetTimingConfigs {
    duration?: number;
    easing?: (value: number) => number;
  }
  export function useBottomSheetTimingConfigs(
    configs: BottomSheetTimingConfigs
  ): BottomSheetTimingConfigs;
}
