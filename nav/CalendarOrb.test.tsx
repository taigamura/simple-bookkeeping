/**
 * The Calendar orb in the full Root (PRD #145): shown only on the Calendar and
 * only with the on-device model; tap → Ask scoped to the visible month; hold +
 * speak → a create-mode Entry sheet filled from the parse. Plus AskSheet's
 * `scope` prop on its own.
 */
jest.mock('@gorhom/bottom-sheet', () => require('../test-utils/gorhomBottomSheetWebMock'));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../platform/haptics', () => ({ entrySaved: jest.fn(), keypadTap: jest.fn() }));
jest.mock('../platform/shareFile', () => ({ shareTextFile: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {} }));

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AiProvider } from '../ai/AiProvider';
import type { Availability, SuitoAi } from '../ai/contract';
import { createFakeSuitoAi } from '../ai/fake';
import { MIN_HOLD_MS } from '../ai/useVoiceEntry';
import { strings } from '../i18n';
import { AskSheet } from '../screens/AskSheet';
import { DEFAULT_STATE } from '../store/schema';
import { ThemeProvider } from '../theme';
import { Root } from './Root';

const AVAILABLE: Availability = { onDevice: 'available', system: 'available' };
const SYSTEM_ONLY: Availability = { onDevice: 'unsupported', system: 'available' };

const settle = () => act(async () => {});

async function renderRoot(ai: SuitoAi) {
  render(
    <AiProvider ai={ai}>
      <ThemeProvider>
        <Root
          state={DEFAULT_STATE}
          update={jest.fn()}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </ThemeProvider>
    </AiProvider>,
  );
  await settle();
}

describe('Calendar orb in Root', () => {
  it('is absent when the on-device model is unavailable', async () => {
    await renderRoot(createFakeSuitoAi({ availability: SYSTEM_ONLY }));
    expect(screen.queryByTestId('ai-orb')).toBeNull();
  });

  it('is absent with no AI provider at all (web without ?ai=fake)', async () => {
    render(
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
    await settle();
    expect(screen.queryByTestId('ai-orb')).toBeNull();
  });

  it('shows on the Calendar, labelled for tap and hold, and leaves on Summary', async () => {
    await renderRoot(createFakeSuitoAi({ availability: AVAILABLE }));
    const orb = screen.getByTestId('ai-orb');
    expect(orb.props.accessibilityLabel).toBe(strings.ai.orb.label);
    expect(orb.props.accessibilityHint).toBe(strings.ai.orb.hint);

    fireEvent.press(screen.getByRole('tab', { name: strings.nav.summary }));
    await waitFor(() => expect(screen.queryByTestId('ai-orb')).toBeNull());

    fireEvent.press(screen.getByRole('tab', { name: strings.nav.calendar }));
    await waitFor(() => expect(screen.getByTestId('ai-orb')).toBeTruthy());
  });

  it('tap opens Ask scoped to the visible month', async () => {
    await renderRoot(createFakeSuitoAi({ availability: AVAILABLE }));
    // Page back a month first: the scope follows the cursor, not today.
    fireEvent.press(screen.getAllByLabelText(strings.calendar.previousMonth)[0]);
    await settle();
    fireEvent.press(screen.getByTestId('ai-orb'));
    expect(screen.getByTestId('ask-sheet')).toBeTruthy();
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    expect(screen.getByTestId('ask-scope').props.accessibilityLabel).toBe(
      strings.ai.orb.scopeLabel(prev.getFullYear(), prev.getMonth()),
    );
  });

  it('the Summary Ask stays unscoped', async () => {
    await renderRoot(createFakeSuitoAi({ availability: AVAILABLE }));
    fireEvent.press(screen.getByTestId('ai-orb'));
    expect(screen.getByTestId('ask-scope')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(strings.nav.close));
    fireEvent.press(screen.getByRole('tab', { name: strings.nav.summary }));
    await settle();
    fireEvent.press(screen.getAllByLabelText(strings.ai.askA11y)[0]);
    expect(screen.getByTestId('ask-sheet')).toBeTruthy();
    expect(screen.queryByTestId('ask-scope')).toBeNull();
  });

  it('hold → partial bubble → release → Entry sheet filled with the parse', async () => {
    const ai = createFakeSuitoAi({ availability: AVAILABLE });
    await renderRoot(ai);
    const orb = screen.getByTestId('ai-orb');
    const realNow = Date.now;
    let now = realNow();
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      fireEvent(orb, 'longPress');
      await settle();
      expect(screen.getByTestId('ai-orb').props.accessibilityValue).toEqual({ text: 'listen' });
      await waitFor(() => expect(screen.getByText('lunch 850 yesterday')).toBeTruthy());
      expect(screen.getByTestId('ai-orb-bubble')).toBeTruthy();

      now += MIN_HOLD_MS + 100;
      fireEvent(orb, 'pressOut');
      await waitFor(() => expect(screen.getByTestId('entry-sheet')).toBeTruthy());
      expect(screen.getAllByText(/850/).length).toBeGreaterThan(0);
      expect(screen.queryByTestId('ai-orb-bubble')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('a slip (short hold) opens nothing and says so', async () => {
    await renderRoot(createFakeSuitoAi({ availability: AVAILABLE }));
    const orb = screen.getByTestId('ai-orb');
    fireEvent(orb, 'longPress');
    await settle();
    fireEvent(orb, 'pressOut');
    await settle();
    expect(screen.queryByTestId('entry-sheet')).toBeNull();
    expect(screen.getByText(strings.ai.orb.tooShort)).toBeTruthy();
  });

  it('denied: the Settings hint, and tap still opens Ask', async () => {
    await renderRoot(createFakeSuitoAi({ availability: AVAILABLE, listenStart: 'denied' }));
    const orb = screen.getByTestId('ai-orb');
    fireEvent(orb, 'longPress');
    await settle();
    expect(screen.getByText(strings.ai.orb.denied)).toBeTruthy();
    fireEvent(orb, 'pressOut');
    fireEvent.press(orb);
    expect(screen.getByTestId('ask-sheet')).toBeTruthy();
  });
});

describe('AskSheet scope', () => {
  it('shows the month and prefixes what is sent, not what is shown', async () => {
    const ai = createFakeSuitoAi({ availability: AVAILABLE, chunkDelayMs: 1 });
    const ask = jest.spyOn(ai, 'ask');
    render(
      <AiProvider ai={ai}>
        <ThemeProvider>
          <AskSheet locale="en" scope={{ y: 2026, m: 6 }} buildHandoff={() => ''} onClose={() => {}} />
        </ThemeProvider>
      </AiProvider>,
    );
    await settle();
    expect(screen.getByText('July 2026')).toBeTruthy();
    fireEvent.press(screen.getByText(strings.ai.askStarters[0]));
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: `About July 2026: ${strings.ai.askStarters[0]}` }),
      expect.any(Function),
    );
    expect(screen.getByLabelText(`${strings.ai.askYou}: ${strings.ai.askStarters[0]}`)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('ask-answer')).toBeTruthy());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  });

  it('without scope: no month row and the question goes as typed', async () => {
    const ai = createFakeSuitoAi({ availability: AVAILABLE, chunkDelayMs: 1 });
    const ask = jest.spyOn(ai, 'ask');
    render(
      <AiProvider ai={ai}>
        <ThemeProvider>
          <AskSheet locale="en" buildHandoff={() => ''} onClose={() => {}} />
        </ThemeProvider>
      </AiProvider>,
    );
    await settle();
    expect(screen.queryByTestId('ask-scope')).toBeNull();
    fireEvent.press(screen.getByText(strings.ai.askStarters[0]));
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: strings.ai.askStarters[0] }),
      expect.any(Function),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  });
});
