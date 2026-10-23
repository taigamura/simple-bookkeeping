/**
 * The Entry sheet's plain-words line (ADR-0006, PRD stories 1–14): type or
 * dictate 「昨日 スタバ 620」, and ~400ms after the last keystroke the phrase goes
 * to `parse`; a non-null result is handed to `onParsed`, which fills the form.
 *
 * - Never blocks typing: parsing is async and a newer keystroke simply makes
 *   any older result stale (it is dropped on arrival).
 * - The "working" state is a static dim word, not a spinner (ADR-0003); a
 *   successful fill shows a check, which is the confirmation.
 * - A null parse (or a failure) leaves the form untouched and shows nothing.
 * - A plain TextInput with the default keyboard, so the keyboard's own
 *   dictation mic works without any extra code.
 */
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { ParsedEntry } from '../ai/contract';
import { strings } from '../i18n';
import { useTheme, Txt } from '../theme';

export const AI_ENTRY_LINE_HEIGHT = 44;
export const AI_PARSE_DEBOUNCE_MS = 400;

type Status = 'idle' | 'working' | 'filled';

export function AiEntryLine({
  parse,
  onParsed,
}: {
  parse: (text: string) => Promise<ParsedEntry | null>;
  onParsed: (parsed: ParsedEntry) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const generation = useRef(0);
  // Latest callbacks without restarting the debounce on every parent render.
  const latest = useRef({ parse, onParsed });
  latest.current = { parse, onParsed };

  useEffect(() => {
    const id = ++generation.current;
    const phrase = text.trim();
    if (!phrase) {
      setStatus('idle');
      return;
    }
    const timer = setTimeout(() => {
      setStatus('working');
      latest.current.parse(phrase).then(
        (parsed) => {
          if (id !== generation.current) return;
          if (parsed) {
            latest.current.onParsed(parsed);
            setStatus('filled');
          } else {
            setStatus('idle');
          }
        },
        () => {
          if (id === generation.current) setStatus('idle');
        },
      );
    }, AI_PARSE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <View
      testID="ai-entry-line"
      style={[styles.row, { backgroundColor: colors.card2 }]}
    >
      <Feather name="edit-3" size={15} color={colors.dim} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={strings.ai.entryLinePlaceholder}
        placeholderTextColor={colors.dim}
        accessibilityLabel={strings.ai.entryLineLabel}
        accessibilityHint={strings.ai.entryLineHint}
        returnKeyType="done"
        style={[styles.input, { color: colors.ink }]}
      />
      {status === 'working' && (
        <Txt
          variant="secondary"
          tone="dim"
          testID="ai-entry-working"
          accessibilityLiveRegion="polite"
        >
          {strings.ai.entryWorking}
        </Txt>
      )}
      {status === 'filled' && (
        <View
          testID="ai-entry-filled"
          accessible
          accessibilityLabel={strings.ai.entryFilled}
          accessibilityLiveRegion="polite"
        >
          <Feather name="check" size={16} color={colors.positive} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: AI_ENTRY_LINE_HEIGHT,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, height: AI_ENTRY_LINE_HEIGHT, fontSize: 14.5, paddingHorizontal: 0 },
});
