/**
 * reviewPrompt — asks for an App Store rating at a good moment: right after a
 * new entry lands, once someone has saved a few (they've seen the app work),
 * and at most once per marketing version, at least 120 days apart. iOS adds
 * its own cap (3 prompts a year) and may show nothing; that's fine.
 *
 * Bookkeeping lives under its own AsyncStorage key, not in `AppState`: it
 * isn't the user's data, so it stays out of backups, exports and restores.
 * Everything is fire-and-forget: a failed read, write or prompt is ignored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

export const REVIEW_KEY = 'suito:review:v1';
/** New entries saved before the first ask. */
export const SAVES_BEFORE_PROMPT = 5;
/** Minimum days between asks (also never twice for one version). */
export const DAYS_BETWEEN_PROMPTS = 120;
/** Let the Entry sheet finish dismissing before the system dialog shows. */
export const PROMPT_DELAY_MS = 1200;

export interface ReviewState {
  saves: number;
  lastPromptAt?: string;
  lastPromptVersion?: string;
}

/** Pure decision: after this save, should we ask? */
export function shouldPrompt(state: ReviewState, version: string, now: Date): boolean {
  if (state.saves < SAVES_BEFORE_PROMPT) return false;
  if (state.lastPromptVersion === version) return false;
  if (state.lastPromptAt) {
    const days = (now.getTime() - new Date(state.lastPromptAt).getTime()) / 86_400_000;
    if (!(days >= DAYS_BETWEEN_PROMPTS)) return false;
  }
  return true;
}

function readState(raw: string | null): ReviewState {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.saves === 'number' && parsed.saves >= 0) return parsed;
  } catch {
    // Corrupt bookkeeping just starts over.
  }
  return { saves: 0 };
}

const appVersion = () => Constants.expoConfig?.version ?? 'unknown';

/** Call after a NEW entry is saved (not an edit). */
export async function noteEntrySaved(now = new Date()): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const state = readState(await AsyncStorage.getItem(REVIEW_KEY));
    const next: ReviewState = { ...state, saves: state.saves + 1 };
    const version = appVersion();
    const ask = shouldPrompt(next, version, now) && (await StoreReview.hasAction());
    if (ask) {
      next.lastPromptAt = now.toISOString();
      next.lastPromptVersion = version;
    }
    await AsyncStorage.setItem(REVIEW_KEY, JSON.stringify(next));
    if (ask) setTimeout(() => void StoreReview.requestReview().catch(() => {}), PROMPT_DELAY_MS);
  } catch {
    // A missed rating prompt is never worth an error.
  }
}
