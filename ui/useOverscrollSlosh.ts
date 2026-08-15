/**
 * useOverscrollSlosh — a header that lags and sloshes when its scroll view is
 * pulled past the top, like water in a bottle tipped and let go.
 *
 * Wire the returned `scrollHandler` to an `Animated.ScrollView`'s `onScroll`
 * and spread `sloshStyle` onto the header element you want to slosh. While the
 * finger drags the list past its top, the header trails the pulled content
 * (`LAG` of the overscroll distance, translated *up* so it separates from the
 * content moving down). On release the trail springs back through rest with a
 * bouncy `springs.pop`, overshooting once — the slosh — before settling.
 *
 * ## Why the drag is a direct follow and the release is a spring
 *
 * This mirrors motion.ts rule 3: "springs for anything a finger caused, timings
 * for anything data caused" — and the finer point that a value *under* the
 * finger should track it exactly. During the drag the header is pinned to the
 * pull (no spring, no lag beyond the deliberate `LAG` ratio); only the release
 * — the moment the finger leaves and physics takes over — is sprung. A spring
 * during the drag would feel like the header was chasing the finger rather than
 * being moved by it.
 *
 * ## `dragging` gate
 *
 * `onScroll` fires during the native settle-back too (momentum), which would
 * overwrite the release spring with the raw offset and cancel the overshoot. So
 * `pull` is only read from the offset *while a drag is in progress*; once the
 * finger lifts, the spring owns `pull` until it rests.
 *
 * ## Platform reality
 *
 * The whole effect is driven by overscroll — a negative content offset — which
 * only exists where the platform rubber-bands: iOS (`bounces`, on by default)
 * and Android over-scroll. react-native-web does not rubber-band, so `pull`
 * never leaves 0 there and the header sits still. That is a graceful no-op, not
 * a bug: this project verifies on web, so the slosh is a device-only flourish,
 * and `sloshTranslateY` is unit-tested directly to cover the math the web build
 * can't exercise.
 *
 * The caller gates whether `sloshStyle` is applied on `useMotion().enabled`
 * (passing `undefined` instead when motion is off), the same pattern every other
 * animated surface in this app uses — the hook itself is always called, since
 * hooks cannot be conditional.
 */
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { springs, withAppSpring } from '../theme';

/** Fraction of the overscroll pull the header trails behind by. */
const LAG = 0.28;
/** Clamp the pull so a hard fling can't throw the header off-screen. */
const PULL_CAP = 130;
/** Clamp the release overshoot the other way, so the bounce stays a nudge. */
const OVERSHOOT_CAP = 44;
/** Below this pull (px) at release there was no real gesture — snap flat. */
const RELEASE_MIN = 3;

/**
 * The header's vertical offset for a given pull, in px. Positive `pull` is an
 * overscroll (content dragged down) and returns a negative offset — the header
 * rides *up*, trailing the content. A negative `pull` is the release spring's
 * overshoot and returns a positive offset — the header dips down once. Both
 * directions are clamped. Exported (and a worklet) so the mapping is both
 * usable inside the style worklet and unit-testable as a plain function.
 */
export function sloshTranslateY(pull: number): number {
  'worklet';
  const capped = pull > PULL_CAP ? PULL_CAP : pull < -OVERSHOOT_CAP ? -OVERSHOOT_CAP : pull;
  const offset = -capped * LAG;
  // Normalise -0 (from -(0 * LAG)) to 0 so a rested header reports a clean zero.
  return offset === 0 ? 0 : offset;
}

export function useOverscrollSlosh() {
  const pull = useSharedValue(0);
  const dragging = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      dragging.value = 1;
    },
    onScroll: (event) => {
      if (dragging.value === 1) {
        const over = -event.contentOffset.y;
        pull.value = over > 0 ? over : 0;
      }
    },
    onEndDrag: () => {
      dragging.value = 0;
      pull.value = pull.value > RELEASE_MIN ? withAppSpring(0, springs.pop) : 0;
    },
  });

  const sloshStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sloshTranslateY(pull.value) }],
  }));

  return { scrollHandler, sloshStyle };
}
