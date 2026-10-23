/**
 * Hold-to-speak entry for the Calendar orb (PRD #145).
 *
 * Long press (the orb's 250 ms `delayLongPress`) → `startListening`, with a
 * haptic. Partials stream into `partial`. Release → `think` → `stopListening`
 * → `parseEntry` → `onParsed(entry)` (the host opens the Entry sheet with it as
 * `prefill`; Save is still the user's tap).
 *
 * Quiet failures, each a short `message` that clears itself:
 * - released under `MIN_HOLD_MS` after listening began → cancel, "hold longer";
 * - no transcript → "didn't catch that"; no parse → "couldn't find an entry";
 * - 'denied' → a hint pointing to Settings (tap-to-Ask still works);
 * - 'unavailable' → voice isn't available here.
 *
 * `active` false (tab blurred, a sheet opened) or unmount → `cancelListening`.
 * Everything async checks a session counter, so a late resolve from an
 * abandoned hold never changes state or opens a sheet.
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { strings } from '../i18n';
import type { Locale, ParseContext, ParsedEntry, SuitoAi } from './contract';

export type VoicePhase = 'idle' | 'listen' | 'think';

/** A release sooner than this after listening began counts as a slip, not speech. */
export const MIN_HOLD_MS = 500;
/** How long a status message stays up. */
export const MESSAGE_MS = 2600;
/** The denied hint carries an instruction, so it stays longer. */
export const DENIED_MESSAGE_MS = 5000;

export interface VoiceEntryInput {
  ai: SuitoAi;
  locale: Locale;
  /** Read at parse time so categories / today are current. */
  parseContext: () => ParseContext;
  onParsed: (entry: ParsedEntry) => void;
  /** False while the Calendar is not the visible, unobstructed screen. */
  active: boolean;
}

export interface VoiceEntry {
  phase: VoicePhase;
  level: number;
  /** Cumulative partial transcript while listening. */
  partial: string;
  message: string | null;
  /** Orb `onLongPress`. */
  start: () => void;
  /** Orb `onPressOut` (every release; a plain tap is ignored here). */
  release: () => void;
}

function hapticStart() {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {
    // Haptics are a nice-to-have; a missing native module is fine.
  }
}

export function useVoiceEntry({ ai, locale, parseContext, onParsed, active }: VoiceEntryInput): VoiceEntry {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const session = useRef(0);
  const phaseRef = useRef<VoicePhase>('idle');
  /** When listening began (the long press fired), or null while not holding. */
  const heldSince = useRef<number | null>(null);
  /** Released before `startListening` resolved. */
  const releasedEarly = useRef(false);
  const started = useRef(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latest = useRef({ ai, locale, parseContext, onParsed });
  latest.current = { ai, locale, parseContext, onParsed };

  const go = (next: VoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const say = useCallback((text: string | null, ms = MESSAGE_MS) => {
    if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    messageTimer.current = null;
    setMessage(text);
    if (text !== null) {
      messageTimer.current = setTimeout(() => {
        messageTimer.current = null;
        setMessage(null);
      }, ms);
    }
  }, []);

  const reset = () => {
    heldSince.current = null;
    releasedEarly.current = false;
    started.current = false;
    setLevel(0);
    setPartial('');
    go('idle');
  };

  const cancel = useCallback(() => {
    if (phaseRef.current === 'idle' && heldSince.current === null) return;
    session.current += 1;
    latest.current.ai.cancelListening();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (id: number) => {
    const { ai: model, parseContext: ctx, onParsed: done } = latest.current;
    const held = heldSince.current === null ? 0 : Date.now() - heldSince.current;
    if (held < MIN_HOLD_MS) {
      model.cancelListening();
      reset();
      say(strings.ai.orb.tooShort);
      return;
    }
    go('think');
    setLevel(0);
    try {
      const text = await model.stopListening();
      if (session.current !== id) return;
      if (!text || !text.trim()) {
        reset();
        say(strings.ai.orb.notHeard);
        return;
      }
      const entry = await model.parseEntry(text, ctx());
      if (session.current !== id) return;
      reset();
      if (!entry) {
        say(strings.ai.orb.notUnderstood);
        return;
      }
      say(null);
      done(entry);
    } catch {
      if (session.current !== id) return;
      reset();
      say(strings.ai.orb.notHeard);
    }
  };

  const start = () => {
    if (!active || phaseRef.current !== 'idle') return;
    const id = ++session.current;
    heldSince.current = Date.now();
    releasedEarly.current = false;
    started.current = false;
    setPartial('');
    setLevel(0);
    say(null);
    go('listen');
    hapticStart();
    const { ai: model, locale: lang } = latest.current;
    model
      .startListening(lang, (event) => {
        if (session.current !== id) return;
        setLevel(event.level);
        setPartial(event.text);
      })
      .then(
        (result) => {
          if (session.current !== id) return;
          if (result === 'denied' || result === 'unavailable') {
            reset();
            say(
              result === 'denied' ? strings.ai.orb.denied : strings.ai.orb.unavailable,
              result === 'denied' ? DENIED_MESSAGE_MS : MESSAGE_MS,
            );
            return;
          }
          started.current = true;
          if (releasedEarly.current) void finish(id);
        },
        () => {
          if (session.current !== id) return;
          reset();
          say(strings.ai.orb.unavailable);
        },
      );
  };

  const release = () => {
    if (phaseRef.current !== 'listen') return; // a plain tap, or already reading
    if (!started.current) {
      // Still waiting on the mic: finish (or cancel) once it answers.
      releasedEarly.current = true;
      return;
    }
    void finish(session.current);
  };

  // Blur / a sheet opening / unmount: drop the hold.
  useEffect(() => {
    if (!active) cancel();
  }, [active, cancel]);
  useEffect(
    () => () => {
      cancel();
      if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    },
    [cancel],
  );

  return { phase, level, partial, message, start, release };
}
