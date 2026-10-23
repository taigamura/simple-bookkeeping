/**
 * JS entry for the local Swift module `SuitoAi` (modules/suito-ai/ios). Implements the
 * `SuitoAi` seam from ai/contract.ts, or is `null` when the native module isn't linked
 * (web, Jest, Android, Expo Go).
 *
 * Native shape: complex inputs/outputs cross the bridge as JSON strings (Codable on the Swift
 * side), so the Swift structs mirror the TS contract one to one.
 *
 * Errors: `ask`, the Siri file calls and `setSpotlight` reject with `error.code`:
 *   ERR_UNAVAILABLE  on-device model unavailable (check availability())
 *   ERR_CONTEXT      exceeded the ~4K context window
 *   ERR_GUARDRAIL    guardrail violation or refusal
 *   ERR_LANGUAGE     unsupported language / locale
 *   ERR_BUSY         rate limited (backgrounded) or concurrent requests
 *   ERR_DECODING     guided generation decode failure
 *   ERR_CANCELLED    cancelAsk(requestId) was called
 *   ERR_INPUT        malformed JSON input
 *   ERR_IO           snapshot / inbox / Spotlight write failed
 *   ERR_GENERATION   anything else
 * `parseEntry` / `writeLetter` / `pickNudge` never reject: any failure resolves `null`.
 *
 * Post-processing done natively (JS still re-checks via ai/cite.ts):
 *   - parseEntry: category is always one of ctx.expCats / ctx.incCats (it also decides the type);
 *     date resolved deterministically from the phrase (今日/昨日/おととい/N日前/先週の金曜/10/3/3日,
 *     today/yesterday/N days ago/last friday); `null` when neither amount nor category was found.
 *   - writeLetter: sentences citing unknown fact ids or writing literal digits are dropped;
 *     `null` when no paragraph survives. pickNudge: one sentence citing >= 1 known fact, else `null`.
 *   - em dashes become 、 (ja) / ", " (en) in every model output, including streamed Ask text.
 */
import { requireOptionalNativeModule } from 'expo';

import type {
  AskResult,
  Availability,
  InboxEntry,
  LetterDraft,
  NudgeDraft,
  ParsedEntry,
  SuitoAi,
} from '../../ai/contract';

export type AskTextEvent = { requestId: string; text: string };

type Subscription = { remove(): void };

/** The raw native module surface (what Swift exposes). Exported for tests. */
export interface SuitoAiNative {
  availability(): Promise<Availability>;
  parseEntry(text: string, ctxJson: string): Promise<ParsedEntry | null>;
  writeLetter(reqJson: string): Promise<LetterDraft | null>;
  pickNudge(reqJson: string): Promise<{ text: string } | null>;
  ask(reqJson: string): Promise<AskResult>;
  cancelAsk(requestId: string): void;
  writeSiriSnapshot(json: string): Promise<void>;
  readSiriInbox(): Promise<string>;
  clearSiriInbox(ids: string[]): Promise<void>;
  setSpotlight(enabled: boolean, entriesJson: string): Promise<void>;
  addListener(event: 'onAskText', listener: (event: AskTextEvent) => void): Subscription;
}

async function orNull<T>(p: () => Promise<T | null>): Promise<T | null> {
  try {
    return (await p()) ?? null;
  } catch {
    return null;
  }
}

function parseInbox(json: string): InboxEntry[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as InboxEntry[]) : [];
  } catch {
    return [];
  }
}

export function createNativeSuitoAi(mod: SuitoAiNative): SuitoAi {
  return {
    availability: () => mod.availability(),

    parseEntry: (text, ctx) => (text.trim() ? orNull(() => mod.parseEntry(text, JSON.stringify(ctx))) : Promise.resolve(null)),

    writeLetter: (req) =>
      req.facts.length ? orNull(() => mod.writeLetter(JSON.stringify(req))) : Promise.resolve(null),

    pickNudge: (req): Promise<NudgeDraft> =>
      req.facts.length ? orNull(() => mod.pickNudge(JSON.stringify(req))) : Promise.resolve(null),

    ask: async (req, onText) => {
      const sub = mod.addListener('onAskText', (event) => {
        if (event.requestId === req.requestId) onText(event.text);
      });
      try {
        const result = await mod.ask(JSON.stringify(req));
        return { text: result.text, needsStrongerModel: !!result.needsStrongerModel };
      } finally {
        sub.remove();
      }
    },

    cancelAsk: (requestId) => mod.cancelAsk(requestId),

    writeSiriSnapshot: (snapshot) => mod.writeSiriSnapshot(JSON.stringify(snapshot)),
    readSiriInbox: async () => parseInbox(await mod.readSiriInbox()),
    clearSiriInbox: (ids) => (ids.length ? mod.clearSiriInbox(ids) : Promise.resolve()),
    setSpotlight: (req) => mod.setSpotlight(req.enabled, JSON.stringify(req.enabled ? req.entries : [])),
  };
}

const native = requireOptionalNativeModule<SuitoAiNative>('SuitoAi');

export const nativeSuitoAi: SuitoAi | null = native ? createNativeSuitoAi(native) : null;
