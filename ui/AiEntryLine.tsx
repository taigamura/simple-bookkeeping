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
 *
 * Receipt scan (PRD #145 stories 23–29): an optional camera button at the
 * row's trailing edge. Tap → `scanReceipt()` (the native side presents the
 * scanner) → an 'ok' result goes through the same `onParsed` path and shows
 * the same check. 'none' / 'denied' show one short line in the row; 'cancelled'
 * shows nothing. It lives inside the fixed-height row so the form does not
 * grow (ADR-0004).
 */
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { ParsedEntry, ReceiptResult } from '../ai/contract';
import { strings } from '../i18n';
import { useTheme, Txt } from '../theme';
import { PressScale } from './PressScale';

export const AI_ENTRY_LINE_HEIGHT = 44;
export const AI_PARSE_DEBOUNCE_MS = 400;

/** Tap target of the receipt button; fits inside the 44px row. */
export const RECEIPT_BUTTON_SIZE = 36;

type Status = 'idle' | 'working' | 'filled' | 'receiptNone' | 'receiptDenied';

export function AiEntryLine({
  parse,
  onParsed,
  scanReceipt,
}: {
  parse: (text: string) => Promise<ParsedEntry | null>;
  onParsed: (parsed: ParsedEntry) => void;
  /** Present → the receipt button renders. */
  scanReceipt?: () => Promise<ReceiptResult>;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [scanning, setScanning] = useState(false);
  const generation = useRef(0);
  // Latest callbacks without restarting the debounce on every parent render.
  const latest = useRef({ parse, onParsed });
  latest.current = { parse, onParsed };
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const scan = async () => {
    if (!scanReceipt || scanning) return;
    // A scan supersedes any in-flight phrase parse.
    generation.current += 1;
    setScanning(true);
    setStatus('idle');
    let result: ReceiptResult;
    try {
      result = await scanReceipt();
    } catch {
      result = { status: 'none' };
    }
    if (!mounted.current) return;
    setScanning(false);
    if (result.status === 'ok') {
      latest.current.onParsed(result.entry);
      setStatus('filled');
    } else if (result.status === 'none') setStatus('receiptNone');
    else if (result.status === 'denied') setStatus('receiptDenied');
  };

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
      style={[styles.row, scanReceipt && styles.rowWithButton, { backgroundColor: colors.card2 }]}
    >
      <Feather name="edit-3" size={15} color={colors.dim} />
      <TextInput
        value={text}
        onChangeText={(next) => {
          // Typing retires a stale receipt message.
          setStatus((st) => (st === 'receiptNone' || st === 'receiptDenied' ? 'idle' : st));
          setText(next);
        }}
        placeholder={strings.ai.entryLinePlaceholder}
        placeholderTextColor={colors.dim}
        accessibilityLabel={strings.ai.entryLineLabel}
        accessibilityHint={strings.ai.entryLineHint}
        returnKeyType="done"
        style={[styles.input, { color: colors.ink }]}
      />
      {(status === 'working' || scanning) && (
        <Txt
          variant="secondary"
          tone="dim"
          testID="ai-entry-working"
          accessibilityLiveRegion="polite"
        >
          {scanning ? strings.ai.receipt.working : strings.ai.entryWorking}
        </Txt>
      )}
      {!scanning && (status === 'receiptNone' || status === 'receiptDenied') && (
        <Txt
          variant="secondary"
          tone="dim"
          testID="ai-receipt-message"
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          style={styles.message}
        >
          {status === 'receiptNone' ? strings.ai.receipt.none : strings.ai.receipt.denied}
        </Txt>
      )}
      {!scanning && status === 'filled' && (
        <View
          testID="ai-entry-filled"
          accessible
          accessibilityLabel={strings.ai.entryFilled}
          accessibilityLiveRegion="polite"
        >
          <Feather name="check" size={16} color={colors.positive} />
        </View>
      )}
      {scanReceipt && (
        <PressScale
          scale="control"
          testID="ai-receipt-button"
          onPress={scan}
          disabled={scanning}
          accessibilityRole="button"
          accessibilityLabel={strings.ai.receipt.button}
          accessibilityHint={strings.ai.receipt.hint}
          accessibilityState={{ disabled: scanning, busy: scanning }}
          hitSlop={4}
          style={({ pressed }) => [
            styles.receiptButton,
            { opacity: scanning ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="camera" size={17} color={colors.muted} />
        </PressScale>
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
  // The button's own padding provides the trailing inset.
  rowWithButton: { paddingRight: (AI_ENTRY_LINE_HEIGHT - RECEIPT_BUTTON_SIZE) / 2 },
  message: { flexShrink: 1 },
  receiptButton: {
    width: RECEIPT_BUTTON_SIZE,
    height: RECEIPT_BUTTON_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, height: AI_ENTRY_LINE_HEIGHT, fontSize: 14.5, paddingHorizontal: 0 },
});
