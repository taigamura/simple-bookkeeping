import { NativeModule, requireNativeModule } from 'expo';

export interface QuickEntryNativeBridge {
  listInboxAsync(): Promise<readonly { name: string; contents: string }[]>;
  acknowledgeInboxFileAsync(name: string): Promise<void>;
  quarantineInboxFileAsync(name: string): Promise<void>;
  enqueueDeepLinkAsync(url: string): Promise<void>;
  drainDeepLinksAsync(): Promise<readonly string[]>;
  writeCommandFileAsync(name: string, command: string): Promise<void>;
  writeSnapshotAsync(snapshot: string): Promise<void>;
}

declare class KajiQuickEntryModule extends NativeModule<{}> implements QuickEntryNativeBridge {
  listInboxAsync(): Promise<readonly { name: string; contents: string }[]>;
  acknowledgeInboxFileAsync(name: string): Promise<void>;
  quarantineInboxFileAsync(name: string): Promise<void>;
  enqueueDeepLinkAsync(url: string): Promise<void>;
  drainDeepLinksAsync(): Promise<readonly string[]>;
  writeCommandFileAsync(name: string, command: string): Promise<void>;
  writeSnapshotAsync(snapshot: string): Promise<void>;
}

/** The native extension bridge is deliberately unavailable on web. */
export const quickEntryBridge: QuickEntryNativeBridge | null = (() => {
  try {
    return requireNativeModule<KajiQuickEntryModule>('KajiQuickEntry');
  } catch {
    return null;
  }
})();
