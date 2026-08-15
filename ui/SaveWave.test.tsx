/**
 * SaveWave tests — the save-confirmation bloom and its leading droplet ring.
 *
 * The reanimated mock collapses every timed value to its end state, so these
 * don't assert the motion. What they pin is the render gate: nothing exists
 * until the wave has both fired (`nonce > 0`) and measured itself, the ring
 * appears alongside the bloom when it does, and reduced motion suppresses both.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { MotionProvider, ThemeProvider } from '../theme';
import { settleInitialRead } from '../test-utils/settleMotion';
import { SaveWave } from './SaveWave';

const tree = (nonce: number, preference: 'full' | 'reduced') => (
  <ThemeProvider>
    <MotionProvider initialPreference={preference}>
      <SaveWave nonce={nonce} color="#2B33E8" testID="wave" />
    </MotionProvider>
  </ThemeProvider>
);

/** Give the host a box to size the bloom from — never fired automatically. */
const layout = () =>
  act(() => {
    fireEvent(screen.getByTestId('wave'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 640 } },
    });
  });

describe('SaveWave', () => {
  it('renders nothing before it has fired', async () => {
    render(tree(0, 'full'));
    await settleInitialRead();
    layout();
    expect(screen.queryByTestId('wave-ring')).toBeNull();
  });

  it('shows the droplet ring alongside the bloom once fired and measured', async () => {
    const view = render(tree(0, 'full'));
    await settleInitialRead();
    view.rerender(tree(1, 'full'));
    layout();
    expect(screen.getByTestId('wave-ring')).toBeTruthy();
  });

  it('suppresses both bloom and ring under reduced motion', async () => {
    const view = render(tree(0, 'reduced'));
    await settleInitialRead();
    view.rerender(tree(1, 'reduced'));
    layout();
    expect(screen.queryByTestId('wave-ring')).toBeNull();
  });
});
