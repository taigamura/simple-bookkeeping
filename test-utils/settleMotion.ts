/**
 * `MotionProvider` reads the OS reduce-motion flag through an async
 * `AccessibilityInfo` call and commits the answer in a `.then`. Under jest that
 * lands after a synchronous test body has returned, so any test that renders the
 * provider without flushing it emits an "update was not wrapped in act(...)"
 * warning — noise that buries real warnings (#73).
 *
 * Awaiting this once after render lets the initial read settle inside `act`.
 * Needed even by tests that pass an explicit `full`/`reduced` preference: the
 * provider always reads the OS flag, because it also feeds `systemReducedMotion`
 * and must be live if the preference later flips back to `system`.
 */
import { act } from '@testing-library/react-native';

/** Let MotionProvider's async initial read of the OS flag resolve. */
export const settleInitialRead = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
