export type NativePeerEvent = {
  deviceId: string;
  protocolVersion: number;
  householdTag: string;
};

export type NativeMessageEvent = NativePeerEvent & { envelope: string };
export type NativeErrorEvent = { message: string };

export type KajiNearbyModuleEvents = {
  onPeer: (event: NativePeerEvent) => void;
  onMessage: (event: NativeMessageEvent) => void;
  onError: (event: NativeErrorEvent) => void;
};
