/**
 * Calendar one-liners (PRD #145) through the `SuitoAi` seam with the fake, in
 * each availability state: forecast (current month only), day note (notable
 * days only), repeat suggestion (accept / dismiss), and the once-per-key cache.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AiProvider } from '../ai/AiProvider';
import type { Availability, SuitoAi } from '../ai/contract';
import { createFakeSuitoAi } from '../ai/fake';
import type { AiState } from '../ai/state';
import { entriesForMonth, shiftMonth, type Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import { ThemeProvider } from '../theme';
import { CalendarScreen } from './CalendarScreen';

const AVAILABLE: Availability = { onDevice: 'available', system: 'available' };
const NONE: Availability = { onDevice: 'unsupported', system: 'unsupported' };
const TODAY = { y: 2026, m: 9, day: 20 };

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? `t${n++}`,
  timestamp: '2026-10-01T03:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 1000,
  category: 'Food',
  note: '',
  repeat: 'never',
  ...over,
});

/** Steady ¥1,000 Food every day Aug 1 – Oct 20, a big Oct 14, Netflix by hand monthly. */
function ledger(): Transaction[] {
  const out: Transaction[] = [];
  for (let d = new Date(2026, 7, 1); d <= new Date(2026, 9, 20); d.setDate(d.getDate() + 1)) {
    out.push(tx({ y: d.getFullYear(), m: d.getMonth(), day: d.getDate() }));
  }
  out.push(tx({ day: 14, amount: 6000 }));
  for (const m of [7, 8, 9]) out.push(tx({ id: `netflix-${m}`, m, day: 1, amount: 1490, category: 'Fun', note: 'Netflix' }));
  return out;
}

const LEDGER = ledger();

interface HarnessProps {
  availability: Availability;
  ai?: SuitoAi;
  m?: number;
  day?: number;
  initial?: Partial<AppState>;
  onAcceptRepeat?: (entry: Transaction) => void;
  onState?: (s: AppState) => void;
}

function Harness({ m = 9, day = 14, initial = {}, onAcceptRepeat = () => {}, onState }: Omit<HarnessProps, 'availability' | 'ai'>) {
  const [state, setState] = useState<AppState>({ ...DEFAULT_STATE, entries: LEDGER, ...initial });
  onState?.(state);
  const updateAi = (change: (ai: AiState) => AiState) => setState((s) => ({ ...s, ai: change(s.ai) }));
  const entries = [-1, 0, 1].flatMap((o) => entriesForMonth(state, shiftMonth({ y: 2026, m }, o)));
  return (
    <CalendarScreen
      entries={entries}
      budgets={{}}
      budgetMode="category"
      totalBudget={0}
      y={2026}
      m={m}
      day={day}
      today={TODAY}
      symbol="¥"
      view="numbers"
      onToggleView={() => {}}
      onSelectDay={() => {}}
      onEditEntry={() => {}}
      onPrevMonth={() => {}}
      onNextMonth={() => {}}
      onMonthChange={() => {}}
      onSettings={() => {}}
      ai={{ state, today: TODAY, locale: 'en', updateAi, onAcceptRepeat }}
    />
  );
}

function renderCalendar({ availability, ai, ...rest }: HarnessProps) {
  const fake = ai ?? createFakeSuitoAi({ availability });
  return render(
    <AiProvider ai={fake}>
      <ThemeProvider>
        <Harness {...rest} />
      </ThemeProvider>
    </AiProvider>,
  );
}

const settle = () => act(async () => {});

describe('Calendar one-liners', () => {
  it('shows the forecast, the day note and the repeat suggestion when available', async () => {
    renderCalendar({ availability: AVAILABLE });
    expect(await screen.findByTestId('ai-forecast')).toHaveTextContent(/At this pace the month ends near ¥[\d,]+\.$/);
    expect(await screen.findByTestId('ai-day-note')).toHaveTextContent('This day: ¥7,000.');
    expect(await screen.findByTestId('ai-repeat-text')).toHaveTextContent('Make Netflix a monthly payment?');
  });

  it('renders nothing, not even the slots, when the on-device model is unavailable', async () => {
    renderCalendar({ availability: NONE });
    await settle();
    for (const id of ['ai-forecast-slot', 'ai-forecast', 'ai-day-note-slot', 'ai-day-note', 'ai-repeat']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('renders nothing when the AI switch is off', async () => {
    const wordLine = jest.fn(async () => null);
    renderCalendar({
      availability: AVAILABLE,
      ai: { ...createFakeSuitoAi({ availability: AVAILABLE }), wordLine },
      initial: { ai: { ...DEFAULT_STATE.ai, nudgesEnabled: false } },
    });
    await settle();
    expect(screen.queryByTestId('ai-forecast-slot')).toBeNull();
    expect(screen.queryByTestId('ai-repeat')).toBeNull();
    expect(wordLine).not.toHaveBeenCalled();
  });

  it('shows no forecast and no repeat row on a past month (the slot stays, so the grid does not shift)', async () => {
    renderCalendar({ availability: AVAILABLE, m: 8, day: 10 });
    await settle();
    expect(screen.getByTestId('ai-forecast-slot')).toBeTruthy();
    expect(screen.queryByTestId('ai-forecast')).toBeNull();
    expect(screen.queryByTestId('ai-repeat')).toBeNull();
  });

  it('shows no day note on an ordinary day', async () => {
    renderCalendar({ availability: AVAILABLE, day: 13 });
    await screen.findByTestId('ai-forecast');
    expect(screen.queryByTestId('ai-day-note-slot')).toBeNull();
  });

  it('accept hands the latest matching entry to the host', async () => {
    const onAcceptRepeat = jest.fn();
    renderCalendar({ availability: AVAILABLE, onAcceptRepeat });
    fireEvent.press(await screen.findByTestId('ai-repeat-accept'));
    expect(onAcceptRepeat).toHaveBeenCalledWith(expect.objectContaining({ id: 'netflix-9' }));
  });

  it('dismiss removes the row and persists the key so it never returns', async () => {
    let latest: AppState | null = null;
    renderCalendar({ availability: AVAILABLE, onState: (s) => (latest = s) });
    fireEvent.press(await screen.findByTestId('ai-repeat-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('ai-repeat')).toBeNull());
    expect(latest!.ai.calendar.dismissedRepeats).toEqual(['netflix|Fun|1490']);
  });

  it('asks the model at most once per key and reuses the cached line', async () => {
    const fake = createFakeSuitoAi({ availability: AVAILABLE });
    const wordLine = jest.fn(fake.wordLine);
    const ai = { ...fake, wordLine };
    let latest: AppState | null = null;
    const { unmount } = renderCalendar({ availability: AVAILABLE, ai, onState: (s) => (latest = s) });
    await screen.findByTestId('ai-repeat-text');
    expect(wordLine.mock.calls.map(([req]) => req.kind).sort()).toEqual(['day', 'forecast', 'repeat']);
    unmount();

    // A fresh mount with the saved AI state: everything renders, nothing is asked.
    wordLine.mockClear();
    renderCalendar({ availability: AVAILABLE, ai, initial: { ai: latest!.ai } });
    expect(await screen.findByTestId('ai-forecast')).toBeTruthy();
    expect(screen.getByTestId('ai-day-note')).toBeTruthy();
    expect(screen.getByTestId('ai-repeat-text')).toBeTruthy();
    expect(wordLine).not.toHaveBeenCalled();
  });

  it('a model that says nothing leaves no row behind', async () => {
    const ai = { ...createFakeSuitoAi({ availability: AVAILABLE }), wordLine: async () => null };
    renderCalendar({ availability: AVAILABLE, ai });
    await settle();
    await settle();
    expect(screen.queryByTestId('ai-repeat')).toBeNull();
    expect(screen.queryByTestId('ai-day-note-slot')).toBeNull();
    expect(screen.queryByTestId('ai-forecast')).toBeNull();
  });
});
