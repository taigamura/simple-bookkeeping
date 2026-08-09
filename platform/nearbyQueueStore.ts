import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NearbyInFlightBatch, NearbyQueueSnapshot, NearbyQueueStore } from './nearbySync';

const PREFIX = 'kaji:nearby-queue:v1';

function validId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function operationId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const id = (value as { operationId?: unknown }).operationId;
  return typeof id === 'string' && validId(id) ? id : null;
}

function parseSnapshot(value: string | null): NearbyQueueSnapshot {
  const empty = (): NearbyQueueSnapshot => ({ pending: [], seenMessageIds: [], inFlight: null });
  if (value === null) return empty();
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!Array.isArray(parsed.pending) || !Array.isArray(parsed.seenMessageIds)) throw new Error();
    const pending = parsed.pending.filter((operation) => operationId(operation) !== null).slice(-5000);
    const seenMessageIds = parsed.seenMessageIds
      .filter((id): id is string => typeof id === 'string' && validId(id))
      .slice(-2048);
    let inFlight: NearbyInFlightBatch | null = null;
    if (typeof parsed.inFlight === 'object' && parsed.inFlight !== null) {
      const candidate = parsed.inFlight as Record<string, unknown>;
      if (typeof candidate.batchId === 'string' && validId(candidate.batchId)
        && typeof candidate.peerDeviceId === 'string' && validId(candidate.peerDeviceId)
        && Array.isArray(candidate.operationIds)
        && candidate.operationIds.every((id) => typeof id === 'string' && validId(id))) {
        inFlight = {
          batchId: candidate.batchId,
          peerDeviceId: candidate.peerDeviceId,
          operationIds: candidate.operationIds as string[],
        };
      }
    }
    return { pending, seenMessageIds, inFlight };
  } catch {
    return empty();
  }
}

export function nearbyQueueStorageKey(householdId: string, deviceId: string): string {
  if (!validId(householdId) || !validId(deviceId)) throw new Error('Invalid nearby queue identity');
  return `${PREFIX}:${householdId}:${deviceId}`;
}

/** Durable operation/replay metadata only. Financial payloads remain encrypted in transit. */
export function createNearbyQueueStore(householdId: string, deviceId: string): NearbyQueueStore {
  const key = nearbyQueueStorageKey(householdId, deviceId);
  return {
    async load() {
      return parseSnapshot(await AsyncStorage.getItem(key));
    },
    async save(snapshot) {
      const serialized = JSON.stringify(parseSnapshot(JSON.stringify(snapshot)));
      await AsyncStorage.setItem(key, serialized);
    },
  };
}
