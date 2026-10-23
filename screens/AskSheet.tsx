/**
 * AskSheet — 「聞く」 (ADR-0006, PRD stories 32–47). Ask the on-device model
 * about your money, a few turns deep.
 *
 * - Empty: starter questions to tap.
 * - Each answer streams in as cumulative text. No spinner and no looping
 *   "thinking" animation (ADR-0003): before the first chunk a static, dim
 *   label says the question was received.
 * - 「ChatGPTで聞く」 is always offered as a secondary action, and promoted with
 *   a one-line explanation when the model flags `needsStrongerModel`. It first
 *   shows the exact prompt (`buildHandoffPrompt`, supplied by the host), then
 *   opens RN's built-in share sheet: the user sends it, never Suito.
 * - Closing the sheet (unmount) cancels any in-flight answer.
 *
 * The cloud-model switch and its explainer are compiled out of this release
 * (ADR-0006 amendment), so there is no cloud UI here.
 */
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useAi } from '../ai/AiProvider';
import type { AskTurn, Locale } from '../ai/contract';
import { strings } from '../i18n';
import { IconButton } from '../nav/IconButton';
import { glowFor, metrics, mono, useTheme, Txt } from '../theme';
import { PressScale } from '../ui';

interface ScrollContainerProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  children: ReactNode;
}

export interface AskSheetProps {
  locale: Locale;
  /** The prompt previewed and shared by 「ChatGPTで聞く」. */
  buildHandoff: (question: string) => string;
  onClose: () => void;
  /** gorhom's BottomSheetScrollView in the app; RN ScrollView in tests. */
  ScrollContainer?: ComponentType<ScrollContainerProps>;
  /** gorhom's BottomSheetTextInput in the app, so the sheet rides the keyboard. */
  InputComponent?: ComponentType<TextInputProps>;
}

/** How many past turns go back to the model as history. */
const HISTORY_TURNS = 6;

interface Turn extends AskTurn {
  /** Assistant turn still streaming. */
  pending?: boolean;
}

let requestCounter = 0;

export function AskSheet({
  locale,
  buildHandoff,
  onClose,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
  InputComponent = TextInput,
}: AskSheetProps) {
  const { ai } = useAi();
  const { colors } = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [needsStronger, setNeedsStronger] = useState(false);
  const [handoff, setHandoff] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  // Closing the sheet unmounts it: stop the stream so nothing keeps writing.
  useEffect(
    () => () => {
      if (inFlight.current) ai.cancelAsk(inFlight.current);
    },
    [ai],
  );

  const streaming = inFlight.current !== null || turns.some((t) => t.pending);
  const lastQuestion = [...turns].reverse().find((t) => t.role === 'user')?.text ?? '';
  const handoffQuestion = input.trim() || lastQuestion;

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question || streaming) return;
    const requestId = `ask-${Date.now()}-${++requestCounter}`;
    const history = turns
      .filter((t) => !t.pending && t.text)
      .map(({ role, text }) => ({ role, text }))
      .slice(-HISTORY_TURNS);
    inFlight.current = requestId;
    setInput('');
    setNeedsStronger(false);
    setTurns((cur) => [
      ...cur,
      { role: 'user', text: question },
      { role: 'assistant', text: '', pending: true },
    ]);
    const setAnswer = (text: string, pending: boolean) =>
      setTurns((cur) => {
        const next = cur.slice();
        next[next.length - 1] = { role: 'assistant', text, pending };
        return next;
      });
    ai.ask({ requestId, question, history, locale }, (soFar) => {
      if (inFlight.current === requestId) setAnswer(soFar, true);
    }).then(
      (result) => {
        if (inFlight.current !== requestId) return;
        inFlight.current = null;
        setAnswer(result.text, false);
        setNeedsStronger(result.needsStrongerModel);
      },
      () => {
        if (inFlight.current !== requestId) return;
        inFlight.current = null;
        setAnswer('', false);
      },
    );
  };

  const share = async () => {
    if (handoff === null) return;
    try {
      await Share.share({ message: handoff });
    } catch {
      // Dismissed or unsupported (web without navigator.share): nothing to do.
    }
  };

  if (handoff !== null) {
    return (
      <View style={styles.container} testID="ask-handoff">
        <View style={styles.header}>
          <Txt variant="screenTitle">{strings.ai.handoffTitle}</Txt>
          <IconButton name="x" accessibilityLabel={strings.nav.close} onPress={onClose} />
        </View>
        <Txt variant="secondary" tone="muted">
          {strings.ai.handoffExplain}
        </Txt>
        <ScrollContainer
          style={[styles.previewScroll, { backgroundColor: colors.card2 }]}
          contentContainerStyle={styles.previewBody}
          showsVerticalScrollIndicator={false}
        >
          <Txt
            variant="secondary"
            tone="ink"
            selectable
            testID="ask-handoff-prompt"
            style={styles.previewText}
          >
            {handoff}
          </Txt>
        </ScrollContainer>
        <View style={styles.footer}>
          <PressScale
            scale="surface"
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel={strings.ai.handoffShare}
            style={[styles.cta, { backgroundColor: colors.positive }, glowFor(colors.positive)]}
          >
            <Txt variant="listItem" tone="onPositive">
              {strings.ai.handoffShare}
            </Txt>
          </PressScale>
          <Pressable
            onPress={() => setHandoff(null)}
            accessibilityRole="button"
            accessibilityLabel={strings.ai.handoffBack}
            style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}
          >
            <Txt variant="listItem" tone="positive">
              {strings.ai.handoffBack}
            </Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  const openHandoff = () => {
    if (!handoffQuestion) return;
    setHandoff(buildHandoff(handoffQuestion));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Txt variant="screenTitle">{strings.ai.askTitle}</Txt>
        <IconButton name="x" accessibilityLabel={strings.nav.close} onPress={onClose} />
      </View>

      <ScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.transcript}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 ? (
          <View style={styles.starters} testID="ask-starters">
            <Txt variant="microLabel" tone="dim">
              {strings.ai.askStartersLabel}
            </Txt>
            {strings.ai.askStarters.map((q) => (
              <Pressable
                key={q}
                onPress={() => send(q)}
                accessibilityRole="button"
                accessibilityLabel={q}
                style={({ pressed }) => [
                  styles.starter,
                  { backgroundColor: pressed ? colors.card3 : colors.card2 },
                ]}
              >
                <Txt variant="optionLabel" tone="ink">
                  {q}
                </Txt>
              </Pressable>
            ))}
          </View>
        ) : (
          turns.map((t, i) =>
            t.role === 'user' ? (
              <View
                key={i}
                style={[styles.userBubble, { backgroundColor: colors.card2 }]}
                accessible
                accessibilityLabel={`${strings.ai.askYou}: ${t.text}`}
              >
                <Txt variant="optionLabel" tone="ink">
                  {t.text}
                </Txt>
              </View>
            ) : (
              <View
                key={i}
                style={styles.answer}
                testID={i === turns.length - 1 ? 'ask-answer' : undefined}
                accessible
                accessibilityLabel={`${strings.ai.askSuito}: ${t.text || strings.ai.askWaiting}`}
                accessibilityLiveRegion="polite"
              >
                <Txt variant="microLabel" tone="positive">
                  {strings.ai.askSuito}
                </Txt>
                <Txt variant="optionLabel" tone={t.text ? 'ink' : 'dim'} style={styles.answerText}>
                  {t.text || strings.ai.askWaiting}
                </Txt>
              </View>
            ),
          )
        )}
        {needsStronger && !streaming && (
          <View style={[styles.stronger, { backgroundColor: colors.card2 }]} testID="ask-stronger">
            <Txt variant="secondary" tone="muted">
              {strings.ai.askStrongerHint}
            </Txt>
            <PressScale
              scale="surface"
              onPress={openHandoff}
              accessibilityRole="button"
              accessibilityLabel={strings.ai.askHandoff}
              accessibilityHint={strings.ai.askHandoffHint}
              style={[styles.strongerButton, { backgroundColor: colors.positive }]}
            >
              <Txt variant="listItem" tone="onPositive">
                {strings.ai.askHandoff}
              </Txt>
            </PressScale>
          </View>
        )}
      </ScrollContainer>

      <View style={styles.footer}>
        <View style={[styles.inputRow, { backgroundColor: colors.card2 }]}>
          <InputComponent
            value={input}
            onChangeText={setInput}
            placeholder={strings.ai.askPlaceholder}
            placeholderTextColor={colors.dim}
            accessibilityLabel={strings.ai.askInputLabel}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            style={[styles.input, { color: colors.ink }]}
          />
          <PressScale
            scale="control"
            onPress={() => send(input)}
            disabled={!input.trim() || streaming}
            accessibilityRole="button"
            accessibilityLabel={strings.ai.askSend}
            accessibilityState={{ disabled: !input.trim() || streaming }}
            style={[
              styles.send,
              { backgroundColor: input.trim() && !streaming ? colors.positive : colors.card3 },
            ]}
          >
            <Feather
              name="arrow-up"
              size={17}
              color={input.trim() && !streaming ? colors.onPositive : colors.dim}
            />
          </PressScale>
        </View>
        {!needsStronger && (
          <Pressable
            onPress={openHandoff}
            disabled={!handoffQuestion}
            accessibilityRole="button"
            accessibilityLabel={strings.ai.askHandoff}
            accessibilityHint={strings.ai.askHandoffHint}
            accessibilityState={{ disabled: !handoffQuestion }}
            style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}
          >
            <Txt variant="optionLabel" tone={handoffQuestion ? 'positive' : 'dim'}>
              {strings.ai.askHandoff}
            </Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, gap: 10 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scroll: { flex: 1, minHeight: 0 },
  transcript: { gap: 14, paddingBottom: 8 },
  starters: { gap: 8 },
  starter: {
    minHeight: 44,
    borderRadius: metrics.iconTileRadius + 3,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  answer: { gap: 6 },
  answerText: { lineHeight: 20 },
  stronger: { borderRadius: 14, padding: 14, gap: 10 },
  strongerButton: {
    height: 44,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 50,
    gap: 8,
  },
  input: { flex: 1, minHeight: 44, fontSize: 14.5, paddingHorizontal: 0 },
  send: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  previewScroll: { flex: 1, minHeight: 0, borderRadius: 14 },
  previewBody: { padding: 14 },
  previewText: { fontFamily: mono.regular, lineHeight: 18 },
  cta: {
    height: metrics.ctaHeight,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
