/**
 * Root mounting-contract test (#47). The Entry/Settings sheet bodies must be
 * passed to BottomSheet unconditionally — never gated on the open-sheet state —
 * so the modal's dynamic sizing always has real content to measure at
 * present() time (the gated version presented blank on first open).
 *
 * The shipped @gorhom/bottom-sheet mock renders BottomSheetModal children
 * straight through, so if Root ever regresses to conditional mounting the
 * sheet copy asserted below disappears from a fresh render.
 */
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// Platform seams Root imports at module scope; none of their behavior is under
// test here, and the underlying expo natives don't load in jest.
jest.mock('../platform/auth', () => ({
  isAuthAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock('../platform/haptics', () => ({ entrySaved: jest.fn() }));
jest.mock('../platform/shareFile', () => ({ shareTextFile: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {} }));

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { strings } from '../i18n';
import { DEFAULT_STATE } from '../store/schema';
import { ThemeProvider } from '../theme';
import { Root } from './Root';

describe('Root sheet mounting (#47)', () => {
  it('mounts both sheet bodies on a fresh render, with no sheet opened first', async () => {
    render(
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

    // Entry sheet content (create-mode CTA) exists before any ＋ tap or
    // Settings open/close cycle — the exact regression from gated mounting.
    expect(await screen.findByText(strings.entry.addExpense)).toBeTruthy();
    // Settings and Budgets sheet content likewise renders from the start —
    // each sheet carries its own Done button (#49 added the Budgets sheet).
    expect(screen.getAllByText(strings.nav.done)).toHaveLength(2);
  });
});
