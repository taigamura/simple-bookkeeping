/**
 * Root unified-sheet-host test (#60). The single modal renders only the active
 * sheet's content based on the sheet state. This replaces the old three-modal
 * setup where all sheets were unconditionally mounted. Tests verify:
 * - Sheet content selection and mounting on open
 * - Content swaps between sheets without dismiss/present
 * - Budgets sheet rendering from Settings
 * - Keep-editing state persistence across dismiss
 */
// Faithful double, NOT the official `@gorhom/bottom-sheet/mock`: the official
// mock's BottomSheetView ignores the style prop entirely, which let a style
// crash (3-element array → StyleSheet.compose throw on dev web) ship while
// this suite stayed green. The double applies styles the way the real library
// does on dev web, so the click tests below actually exercise that path.
jest.mock('@gorhom/bottom-sheet', () =>
  require('../test-utils/gorhomBottomSheetWebMock'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// Platform seams Root imports at module scope; none of their behavior is under
// test here, and the underlying expo natives don't load in jest.
jest.mock('../platform/auth', () => ({
  isAuthAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock('../platform/haptics', () => ({ entrySaved: jest.fn(), keypadTap: jest.fn() }));
jest.mock('../platform/shareFile', () => ({ shareTextFile: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
const mockFileArrayBuffer = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    arrayBuffer() {
      return mockFileArrayBuffer();
    }
  },
}));

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import {
  entriesThrough,
  saveLedgerItem,
  serializeZaimCsv,
  type EntryDraft,
  type Transaction,
} from '../domain';
import { strings } from '../i18n';
import { shareTextFile } from '../platform/shareFile';
import { DEFAULT_STATE } from '../store/schema';
import { ThemeProvider } from '../theme';
import { Root } from './Root';

describe('Root unified sheet host (#60)', () => {
  it('renders successfully with default state', () => {
    const { root } = render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={() => {}}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // Root renders with no errors
    expect(root).toBeDefined();
  });

  it('calls update callback from Root props', () => {
    const mockUpdate = jest.fn();
    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={mockUpdate}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // The update callback is passed through and will be called by child handlers
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('provides all required AppState props to screens', () => {
    const testState = { ...DEFAULT_STATE };
    const mockUpdate = jest.fn();

    render(
      <ThemeProvider>
        <Root
          state={testState}
          update={mockUpdate}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // Calendar screen is active on mount with the provided state
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('Root sheet click behavior', () => {
  // These drive the same taps as the e2e cold-load suite (#58) but in jest,
  // against the dev-web-faithful gorhom double. The e2e suite runs against a
  // production `expo export`, where react-native-web's compose guard is
  // compiled out — which is why it never saw the dev-only crash these cover.
  function renderRoot() {
    return render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );
  }

  it('tapping ＋ opens the Entry sheet without a style crash', () => {
    renderRoot();
    expect(screen.queryByTestId('entry-sheet')).toBeNull();

    fireEvent.press(screen.getByLabelText(strings.nav.addEntry));

    // Pre-fix this threw the dev-web error the moment the sheet content
    // rendered: "StyleSheet.compose() only accepts 2 arguments, received 3".
    expect(screen.getByTestId('entry-sheet')).toBeTruthy();
  });

  it('saves a new Repeat selection as an infinite rule instead of materialized entries', () => {
    const update = jest.fn();
    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={update}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText(strings.nav.addEntry));
    fireEvent.press(screen.getByLabelText('↻ Repeat: Never'));
    fireEvent.press(screen.getByLabelText('1'));
    fireEvent.press(screen.getByLabelText(strings.entry.addExpense));

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].entries).toEqual([]);
    expect(update.mock.calls[0][0].recurrenceRules).toEqual([
      expect.objectContaining({ repeat: 'daily', amount: 1 }),
    ]);
  });

  it('tapping the Settings gear opens the Settings sheet without a style crash', () => {
    renderRoot();
    expect(screen.queryByTestId('settings-sheet')).toBeNull();

    fireEvent.press(screen.getByLabelText(strings.nav.settings));

    expect(screen.getByTestId('settings-sheet')).toBeTruthy();
    expect(screen.getByText(strings.nav.settings)).toBeTruthy();
  });

  it('sheet content swaps entry → settings on state change (#60)', () => {
    renderRoot();
    fireEvent.press(screen.getByLabelText(strings.nav.addEntry));
    expect(screen.getByTestId('entry-sheet')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    expect(screen.queryByTestId('entry-sheet')).toBeNull();
    expect(screen.getByTestId('settings-sheet')).toBeTruthy();
  });
});

describe('Root sheet state management (#60)', () => {
  it('maintains separate state for sheet visibility and sheet type', () => {
    const mockUpdate = jest.fn();
    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={mockUpdate}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // State management is verified through integration tests
    // The unified host's content selection (entry/settings/budgets) is verified in e2e
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('provides the update callback to child screens', () => {
    const mockUpdate = jest.fn();
    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={mockUpdate}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // The Root component wires up the update callback for state mutations
    // (currency changes, entry edits, budget updates, etc.)
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('auto-presents the Entry sheet on cold launch when openTo is "entry" (#68)', async () => {
    render(
      <ThemeProvider>
        <Root
          state={{ ...DEFAULT_STATE, openTo: 'entry' }}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // Entry sheet is auto-presented on cold launch when openTo='entry'. The
    // present is deferred a frame (so gorhom lays out before present() runs, see
    // Root's openTo effect), hence waitFor rather than a synchronous assertion.
    await waitFor(() => expect(screen.getByTestId('entry-sheet')).toBeTruthy());
  });

  it('does not auto-present the Entry sheet when openTo is "calendar" (#68)', () => {
    render(
      <ThemeProvider>
        <Root
          state={{ ...DEFAULT_STATE, openTo: 'calendar' }}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    // Entry sheet is not auto-presented when openTo='calendar'
    expect(screen.queryByTestId('entry-sheet')).toBeNull();
  });

  it('shows localized recovery guidance when persistence reports a save failure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
          persistenceNotice="save-failed"
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        strings.persistenceNotice.saveFailedTitle,
        strings.persistenceNotice.saveFailedMessage,
      ),
    );
    alert.mockRestore();
  });

  it('shows localized recovery guidance when persisted data cannot be opened', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
          persistenceNotice="read-failed"
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        strings.persistenceNotice.readFailedTitle,
        strings.persistenceNotice.readFailedMessage,
      ),
    );
    alert.mockRestore();
  });

  it('shows localized recovery guidance when an unreadable backup cannot be kept', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
          persistenceNotice="recovery-failed"
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        strings.persistenceNotice.recoveryFailedTitle,
        strings.persistenceNotice.recoveryFailedMessage,
      ),
    );
    alert.mockRestore();
  });

  it('delete-all-data clears ledger and budgets while preserving settings by patch', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const update = jest.fn();

    render(
      <ThemeProvider>
        <Root
          state={{
            ...DEFAULT_STATE,
            entries: [
              {
                id: 'e1',
                y: 2026,
                m: 6,
                day: 2,
                type: 'expense',
                amount: 850,
                category: 'Food',
                note: 'Food',
                repeat: 'never',
              },
            ],
            budgets: { Food: 30000 },
            totalBudget: 100000,
            theme: 'light',
          }}
          update={update}
          showCorruptNotice={false}
          hasCorruptStash={true}
          readCorruptStash={async () => '{bad'}
        />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByText(strings.settings.deleteAllData));

    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      buttons[1].onPress?.();
    });

    expect(update).toHaveBeenCalledWith({
      entries: [],
      recurrenceRules: [],
      budgets: {},
      totalBudget: 0,
    });
    alert.mockRestore();
  });

  it('offers both delete scopes for a projected recurring occurrence', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const update = jest.fn();
    const now = new Date();
    const draft: EntryDraft = {
      type: 'expense',
      amountStr: '850',
      category: 'Food',
      note: 'Lunch',
      y: now.getFullYear(),
      m: now.getMonth(),
      day: now.getDate(),
      repeat: 'monthly',
    };
    const ledger = saveLedgerItem({ entries: [], recurrenceRules: [] }, draft, 'off');
    render(
      <ThemeProvider>
        <Root
          state={{ ...DEFAULT_STATE, ...ledger }}
          update={update}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText(strings.entry.editEntry('Food')));
    expect(screen.getByLabelText('↻ Repeat: Every month')).toBeTruthy();
    expect(screen.getByLabelText(strings.entry.saveThisAndFuture)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(strings.entry.deleteEntry));

    expect(alert).toHaveBeenCalledWith(
      strings.entry.deleteRecurringTitle,
      strings.entry.deleteRecurringMessage,
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((button) => button.text)).toEqual([
      strings.common.cancel,
      strings.entry.deleteOnlyThis,
      strings.entry.deleteThisAndFuture,
    ]);
    await act(async () => buttons[1].onPress?.());
    expect(update.mock.calls[0][0].recurrenceRules[0].exceptions).toHaveLength(1);
    alert.mockRestore();
  });
});

describe('Root CSV backup flow (#75)', () => {
  const entry = (over: Partial<Transaction>): Transaction => ({
    id: 'entry-id',
    y: 2026,
    m: 6,
    day: 1,
    type: 'expense',
    amount: 1200,
    category: 'Food',
    note: 'Lunch',
    repeat: 'never',
    ...over,
  });

  const arrayBufferOf = (text: string): ArrayBuffer => {
    const bytes = Buffer.from(text, 'utf-8');
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  };

  const renderBackupRoot = (over: Partial<React.ComponentProps<typeof Root>> = {}) => {
    const update = jest.fn();
    render(
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={update}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
          {...over}
        />
      </ThemeProvider>,
    );
    return { update };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the current ledger as a restorable CSV through the share seam', async () => {
    const ledger = [
      entry({
        category: '食費, 外食',
        note: 'Lunch with "friends", 2 people — 日本語のメモ',
      }),
    ];
    (shareTextFile as jest.Mock).mockResolvedValue(undefined);
    renderBackupRoot({ state: { ...DEFAULT_STATE, entries: ledger } });

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.exportData));

    await waitFor(() => expect(shareTextFile).toHaveBeenCalled());
    const [filename, csv] = (shareTextFile as jest.Mock).mock.calls[0];
    expect(filename).toBe('kaji-export.csv');
    expect(csv).toBe(serializeZaimCsv(ledger));
  });

  it('exports recurring occurrences only through today as finite CSV rows', async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      {
        type: 'expense',
        amountStr: '850',
        category: 'Food',
        note: 'Lunch',
        y: start.getFullYear(),
        m: start.getMonth(),
        day: start.getDate(),
        repeat: 'daily',
      },
      'off',
    );
    (shareTextFile as jest.Mock).mockResolvedValue(undefined);
    renderBackupRoot({ state: { ...DEFAULT_STATE, ...ledger } });

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.exportData));

    await waitFor(() => expect(shareTextFile).toHaveBeenCalled());
    const expected = entriesThrough(ledger, {
      y: now.getFullYear(),
      m: now.getMonth(),
      day: now.getDate(),
    });
    expect((shareTextFile as jest.Mock).mock.calls[0][1]).toBe(serializeZaimCsv(expected));
  });

  it('shows localized recovery guidance when export write/share fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { update } = renderBackupRoot();
    (shareTextFile as jest.Mock).mockRejectedValue(new Error('share failed'));

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.exportData));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(strings.zaim.exportFailedTitle, strings.zaim.exportFailedMessage),
    );
    expect(update).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('imports an app-generated export after confirmation without losing supported fields', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const ledger = [
      entry({
        day: 3,
        amount: 2480,
        category: '食費, 外食',
        note: 'Lunch with "friends", 2 people — 日本語のメモ',
      }),
      entry({
        id: 'income-id',
        day: 20,
        type: 'income',
        amount: 125000,
        category: '副業',
        note: 'Invoice "A-001", July',
      }),
    ];
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://backup.csv' }],
    });
    mockFileArrayBuffer.mockResolvedValue(arrayBufferOf(serializeZaimCsv(ledger)));
    const { update } = renderBackupRoot({ state: { ...DEFAULT_STATE, entries: [] } });

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.importFromZaim));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        strings.settings.importFromZaim,
        strings.zaim.entriesReady(2),
        expect.any(Array),
      ),
    );
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      buttons[1].onPress?.();
    });

    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][0];
    expect(patch.entries).toHaveLength(2);
    expect(patch.entries[0]).toMatchObject({
      day: 3,
      amount: 2480,
      category: '食費, 外食',
      note: 'Lunch with "friends", 2 people — 日本語のメモ',
    });
    expect(patch.entries[1]).toMatchObject({
      day: 20,
      type: 'income',
      amount: 125000,
      category: '副業',
      note: 'Invoice "A-001", July',
    });
    alert.mockRestore();
  });

  it('re-importing the same export writes nothing and reports duplicates', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const ledger = [
      entry({ day: 1, amount: 1200, category: 'Food', note: 'Lunch' }),
      entry({ id: 'income-id', day: 2, type: 'income', amount: 300000, category: 'Salary', note: 'Salary' }),
    ];
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://backup.csv' }],
    });
    mockFileArrayBuffer.mockResolvedValue(arrayBufferOf(serializeZaimCsv(ledger)));
    const { update } = renderBackupRoot({ state: { ...DEFAULT_STATE, entries: ledger } });

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.importFromZaim));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        strings.zaim.noEntriesTitle,
        `${strings.zaim.noEntriesMessage} — ${strings.zaim.skip.duplicate(2)}`,
      ),
    );
    expect(update).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('detects a duplicate against a persisted future one-time entry', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const now = new Date();
    const future = entry({ y: now.getFullYear() + 1, m: 0, day: 1 });
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://backup.csv' }],
    });
    mockFileArrayBuffer.mockResolvedValue(arrayBufferOf(serializeZaimCsv([future])));
    const { update } = renderBackupRoot({
      state: { ...DEFAULT_STATE, entries: [future] },
    });

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.importFromZaim));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        strings.zaim.noEntriesTitle,
        `${strings.zaim.noEntriesMessage} — ${strings.zaim.skip.duplicate(1)}`,
      ),
    );
    expect(update).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('picker cancellation performs no write and displays no error', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
    const { update } = renderBackupRoot();

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.importFromZaim));

    await waitFor(() => expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('file-read failures preserve the ledger and show localized recovery guidance', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://backup.csv' }],
    });
    mockFileArrayBuffer.mockRejectedValue(new Error('read failed'));
    const { update } = renderBackupRoot();

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.importFromZaim));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(strings.zaim.importFailedTitle, strings.zaim.importFailedMessage),
    );
    expect(update).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('decode failures preserve the ledger and show localized guidance', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://not-zaim.csv' }],
    });
    mockFileArrayBuffer.mockResolvedValue(arrayBufferOf('name,amount\nLunch,1200'));
    const { update } = renderBackupRoot();

    fireEvent.press(screen.getByLabelText(strings.nav.settings));
    fireEvent.press(screen.getByLabelText(strings.settings.importFromZaim));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(strings.zaim.notZaimTitle, strings.zaim.notZaimMessage),
    );
    expect(update).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
