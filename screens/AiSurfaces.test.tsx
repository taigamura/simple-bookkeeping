/**
 * Suito AI surfaces on each screen, driven through the `SuitoAi` seam with the
 * deterministic fake in each availability state (ADR-0006). The rule under
 * test: with the on-device model unavailable, no in-app AI surface renders at
 * all; Siri & Search depends only on `system`.
 */
import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AiProvider } from '../ai/AiProvider';
import type { Availability, ParsedEntry, SuitoAi } from '../ai/contract';
import { DEFAULT_AI_STATE, type AiState } from '../ai/state';
import { createFakeSuitoAi } from '../ai/fake';
import { CURRENCIES, type Transaction } from '../domain';
import { strings } from '../i18n';
import { ThemeProvider } from '../theme';
import { AskSheet } from './AskSheet';
import { EntrySheet } from './EntrySheet';
import { SettingsSheet } from './SettingsSheet';
import { SummaryScreen, type SummaryAiProps } from './SummaryScreen';

const AVAILABLE: Availability = { onDevice: 'available', system: 'available' };
const SYSTEM_ONLY: Availability = { onDevice: 'unsupported', system: 'available' };
const NONE: Availability = { onDevice: 'unsupported', system: 'unsupported' };

const withAi = (ai: SuitoAi, node: React.ReactElement) => (
  <AiProvider ai={ai}>
    <ThemeProvider>{node}</ThemeProvider>
  </AiProvider>
);

/** Let AiProvider's async availability read land. */
const settle = () => act(async () => {});

// ------------------------------------------------------------------- Summary

const tx: Transaction = {
  id: 'x',
  timestamp: '2026-10-01T00:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: '',
  repeat: 'never',
};

const aiState = (over: Partial<AiState> = {}): AiState => ({
  ...DEFAULT_AI_STATE,
  letters: {
    '2026-09': {
      paragraphs: ['September went calmly.', 'Keep the same pace.'],
      facts: {},
      createdAt: '2026-10-01T00:00:00.000Z',
      dismissed: false,
    },
  },
  nudge: { date: '2026-10-23', text: 'Food is running a little high.', facts: {}, dismissed: false },
  ...over,
});

function renderSummary(availability: Availability, ai: Partial<SummaryAiProps> = {}, m = 9) {
  const props: SummaryAiProps = {
    state: aiState(),
    today: { y: 2026, m: 9 },
    onAsk: jest.fn(),
    onSetLetterDismissed: jest.fn(),
    onDismissNudge: jest.fn(),
    ...ai,
  };
  render(
    withAi(
      createFakeSuitoAi({ availability }),
      <SummaryScreen
        entries={[tx]}
        budgets={{}}
        budgetMode="category"
        totalBudget={0}
        y={2026}
        m={m}
        symbol="¥"
        granularity="monthly"
        onChangeGranularity={() => {}}
        onPeriodChange={() => {}}
        onSettings={() => {}}
        ai={props}
      />,
    ),
  );
  return props;
}

describe('Summary AI surfaces', () => {
  it('render nothing when the on-device model is unavailable', async () => {
    renderSummary(SYSTEM_ONLY);
    await settle();
    expect(screen.queryByTestId('ask-pill')).toBeNull();
    expect(screen.queryByTestId('ai-letter')).toBeNull();
    expect(screen.queryByTestId('ai-nudge')).toBeNull();
  });

  it('shows the Ask pill, last month’s letter and today’s nudge on the current month', async () => {
    const props = renderSummary(AVAILABLE);
    await settle();
    fireEvent.press(screen.getByLabelText(strings.ai.askA11y));
    expect(props.onAsk).toHaveBeenCalled();
    expect(screen.getByText(strings.ai.letterTitle(8))).toBeTruthy();
    expect(screen.getByText('September went calmly.')).toBeTruthy();
    expect(screen.getByText('Food is running a little high.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(strings.ai.letterDismiss));
    expect(props.onSetLetterDismissed).toHaveBeenCalledWith('2026-09', true);
    fireEvent.press(screen.getByLabelText(strings.ai.nudgeDismiss));
    expect(props.onDismissNudge).toHaveBeenCalled();
  });

  it('hides a dismissed letter and nudge on the current month', async () => {
    const state = aiState();
    state.letters['2026-09'].dismissed = true;
    state.nudge!.dismissed = true;
    renderSummary(AVAILABLE, { state });
    await settle();
    expect(screen.queryByTestId('ai-letter')).toBeNull();
    expect(screen.queryByTestId('ai-letter-reopen')).toBeNull();
    expect(screen.queryByTestId('ai-nudge')).toBeNull();
  });

  it('shows a past month’s letter on that month, with a reopen row once dismissed', async () => {
    renderSummary(AVAILABLE, {}, 8);
    await settle();
    expect(screen.getByTestId('ai-letter')).toBeTruthy();
    // The nudge belongs to the current month only.
    expect(screen.queryByTestId('ai-nudge')).toBeNull();
    screen.unmount();

    const state = aiState();
    state.letters['2026-09'].dismissed = true;
    const props = renderSummary(AVAILABLE, { state }, 8);
    await settle();
    fireEvent.press(screen.getByLabelText(strings.ai.letterReopen(8)));
    expect(props.onSetLetterDismissed).toHaveBeenCalledWith('2026-09', false);
  });

  it('hides letter and nudge when 「ふりかえりと気づき」 is off, but keeps Ask', async () => {
    renderSummary(AVAILABLE, { state: aiState({ nudgesEnabled: false }) });
    await settle();
    expect(screen.getByTestId('ask-pill')).toBeTruthy();
    expect(screen.queryByTestId('ai-letter')).toBeNull();
    expect(screen.queryByTestId('ai-nudge')).toBeNull();
  });

  it('drops a null nudge', async () => {
    renderSummary(AVAILABLE, { state: aiState({ nudge: { date: '2026-10-23', text: null, facts: {}, dismissed: false } }) });
    await settle();
    expect(screen.queryByTestId('ai-nudge')).toBeNull();
  });
});

// ------------------------------------------------------------------- Entry

function renderEntry(ai: SuitoAi, onSave = jest.fn(), prefill?: ParsedEntry) {
  render(
    withAi(
      ai,
      <EntrySheet
        expCats={['Food', 'Rent']}
        incCats={['Salary', 'Gift']}
        y={2026}
        m={9}
        day={23}
        today={{ y: 2026, m: 9, day: 23 }}
        symbol="¥"
        prefill={prefill}
        onSave={onSave}
        onClose={() => {}}
      />,
    ),
  );
  return onSave;
}

describe('Entry prefill (Calendar orb voice entry)', () => {
  it('opens with the parsed fields filled; Save is still the user’s tap', async () => {
    const onSave = renderEntry(createFakeSuitoAi(), jest.fn(), {
      type: 'expense',
      amount: 850,
      category: 'Food',
      date: { y: 2026, m: 9, day: 22 },
      note: 'lunch',
    });
    await settle();
    expect(screen.getByText('¥850')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText(strings.entry.addExpense));
    expect(onSave.mock.calls[0][0]).toMatchObject({ amountStr: '850', category: 'Food', note: 'lunch', day: 22 });
  });
});

describe('Entry text line', () => {
  it('is absent when the on-device model is unavailable', async () => {
    renderEntry(createFakeSuitoAi({ availability: SYSTEM_ONLY }));
    await settle();
    expect(screen.queryByLabelText(strings.ai.entryLineLabel)).toBeNull();
  });

  it('fills amount, category, date and note from the phrase; Save is still the user’s tap', async () => {
    const ai = createFakeSuitoAi();
    const onSave = renderEntry(ai);
    await settle();
    fireEvent.changeText(screen.getByLabelText(strings.ai.entryLineLabel), 'lunch 850 yesterday');
    await waitFor(() => expect(screen.getByText('¥850')).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByTestId('ai-entry-filled')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText(strings.entry.addExpense));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      type: 'expense',
      amountStr: '850',
      category: 'Food',
      note: 'lunch',
      y: 2026,
      m: 9,
      day: 22,
    });
  });

  it('leaves the form untouched when the phrase cannot be read', async () => {
    const ai = createFakeSuitoAi();
    const parse = jest.spyOn(ai, 'parseEntry');
    const onSave = renderEntry(ai);
    await settle();
    fireEvent.changeText(screen.getByLabelText(strings.ai.entryLineLabel), 'hmm');
    await waitFor(() => expect(parse).toHaveBeenCalled(), { timeout: 3000 });
    await settle();
    expect(screen.queryByTestId('ai-entry-filled')).toBeNull();
    expect(screen.getByText('¥0')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------- Settings

function renderSettings(availability: Availability) {
  const onChangeAiNudges = jest.fn();
  const onChangeSpotlight = jest.fn();
  render(
    withAi(
      createFakeSuitoAi({ availability }),
      <SettingsSheet
        currency={CURRENCIES[0]}
        expCats={['Food']}
        incCats={['Salary']}
        onChangeCurrency={() => {}}
        onChangeExpCats={() => {}}
        onChangeIncCats={() => {}}
        activeRepeatCount={0}
        onOpenRepeats={() => {}}
        onOpenBudgets={() => {}}
        onExportData={() => {}}
        onImportData={() => {}}
        onBackupData={() => {}}
        onRestoreData={() => {}}
        hasCorruptStash={false}
        onExportCorruptStash={() => {}}
        onDeleteAllData={() => {}}
        onClose={() => {}}
        aiNudgesEnabled
        onChangeAiNudges={onChangeAiNudges}
        spotlightEnabled
        onChangeSpotlight={onChangeSpotlight}
      />,
    ),
  );
  return { onChangeAiNudges, onChangeSpotlight };
}

describe('Settings AI section', () => {
  it('shows both switches, each with its one-line explanation', async () => {
    const { onChangeAiNudges, onChangeSpotlight } = renderSettings(AVAILABLE);
    await settle();
    expect(screen.getByText(strings.ai.nudgesExplain)).toBeTruthy();
    expect(screen.getByText(strings.ai.spotlightExplain)).toBeTruthy();
    fireEvent(screen.getByLabelText(strings.ai.nudgesSwitch), 'valueChange', false);
    fireEvent(screen.getByLabelText(strings.ai.spotlightSwitch), 'valueChange', false);
    expect(onChangeAiNudges).toHaveBeenCalledWith(false);
    expect(onChangeSpotlight).toHaveBeenCalledWith(false);
  });

  it('shows only Siri & Search without the on-device model', async () => {
    renderSettings(SYSTEM_ONLY);
    await settle();
    expect(screen.queryByLabelText(strings.ai.nudgesSwitch)).toBeNull();
    expect(screen.getByLabelText(strings.ai.spotlightSwitch)).toBeTruthy();
  });

  it('has no AI section at all when nothing is available', async () => {
    renderSettings(NONE);
    await settle();
    expect(screen.queryByText(strings.ai.settingsSection)).toBeNull();
    expect(screen.queryByTestId('settings-ai')).toBeNull();
  });
});

// ------------------------------------------------------------------- Ask

function renderAsk(ai: SuitoAi, buildHandoff = jest.fn((q: string) => `PROMPT: ${q}`)) {
  const view = render(
    withAi(ai, <AskSheet locale="en" buildHandoff={buildHandoff} onClose={() => {}} />),
  );
  return { buildHandoff, view };
}

describe('AskSheet', () => {
  it('offers starters, streams the answer, and allows a follow-up turn', async () => {
    const ai = createFakeSuitoAi({ chunkDelayMs: 5 });
    const ask = jest.spyOn(ai, 'ask');
    renderAsk(ai);
    await settle();
    fireEvent.press(screen.getByLabelText(strings.ai.askStarters[0]));
    await waitFor(() =>
      expect(screen.getByText('Looking at this month, your spending is moving at its usual, steady pace.')).toBeTruthy(),
    );
    expect(screen.queryByTestId('ask-starters')).toBeNull();

    fireEvent.changeText(screen.getByLabelText(strings.ai.askInputLabel), 'And last month?');
    fireEvent.press(screen.getByLabelText(strings.ai.askSend));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask.mock.calls[1][0].history).toEqual([
      { role: 'user', text: strings.ai.askStarters[0] },
      { role: 'assistant', text: 'Looking at this month, your spending is moving at its usual, steady pace.' },
    ]);
  });

  it('offers the handoff when the model needs a stronger one, previews it, then shares', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const { buildHandoff } = renderAsk(createFakeSuitoAi({ chunkDelayMs: 5 }));
    await settle();
    fireEvent.changeText(screen.getByLabelText(strings.ai.askInputLabel), 'Any advice for saving?');
    fireEvent.press(screen.getByLabelText(strings.ai.askSend));
    await waitFor(() => expect(screen.getByTestId('ask-stronger')).toBeTruthy());

    fireEvent.press(screen.getByLabelText(strings.ai.askHandoff));
    expect(buildHandoff).toHaveBeenCalledWith('Any advice for saving?');
    expect(screen.getByText('PROMPT: Any advice for saving?')).toBeTruthy();
    expect(share).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(strings.ai.handoffShare));
    });
    expect(share).toHaveBeenCalledWith({ message: 'PROMPT: Any advice for saving?' });
    share.mockRestore();
  });

  it('cancels the in-flight answer when the sheet closes', async () => {
    const ai = createFakeSuitoAi({ chunkDelayMs: 50 });
    const cancel = jest.spyOn(ai, 'cancelAsk');
    const { view } = renderAsk(ai);
    await settle();
    fireEvent.press(screen.getByLabelText(strings.ai.askStarters[1]));
    view.unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
  });
});
