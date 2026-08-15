/**
 * useOverscrollSlosh math tests.
 *
 * The hook's live behaviour is driven by real overscroll offsets that only a
 * device produces (see the hook header — web never rubber-bands), so the part
 * worth pinning in a unit test is the pure mapping from pull distance to the
 * header's offset: its direction, its clamps, and that it rests at zero.
 */
import { sloshTranslateY } from './useOverscrollSlosh';

describe('sloshTranslateY', () => {
  it('rests at zero with no pull', () => {
    expect(sloshTranslateY(0)).toBe(0);
  });

  it('rides the header up as the list is pulled down', () => {
    // Overscroll is a positive pull; the header trails upward (negative offset).
    expect(sloshTranslateY(50)).toBeLessThan(0);
    expect(sloshTranslateY(100)).toBeLessThan(sloshTranslateY(50));
  });

  it('dips the header down on the release overshoot', () => {
    // The settle spring carries pull slightly negative; the header nudges down.
    expect(sloshTranslateY(-20)).toBeGreaterThan(0);
  });

  it('clamps a hard fling so the header cannot be thrown off-screen', () => {
    // Beyond the pull cap the offset stops growing.
    expect(sloshTranslateY(1000)).toBe(sloshTranslateY(130));
    expect(sloshTranslateY(5000)).toBe(sloshTranslateY(130));
  });

  it('clamps the overshoot the other way too', () => {
    expect(sloshTranslateY(-1000)).toBe(sloshTranslateY(-44));
  });
});
