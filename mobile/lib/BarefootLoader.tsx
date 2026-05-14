/**
 * BarefootLoader — React Native (Reanimated + react-native-svg)
 *
 * Sequence (slow, deliberate):
 * 1. Foot pad draws ~270° open arc — 1200ms
 * 2. Toe 1 spins 360° — 800ms
 * 3. Toe 2 (accent) spins 360° — 800ms
 * 4. Toe 3 spins 360° — 800ms
 * 5. Toe 4 (pinky) spins 360° — 800ms
 * 6. Hold — 600ms
 * 7. Foot pad unspins (rewinds) — 1200ms
 * 8. All toes fade out — 400ms
 * 9. Loop
 */

import { useEffect } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedPath   = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BarefootLoaderProps {
  size?: number;
  theme?: 'dark' | 'light';
}

const COLORS = {
  dark:  { primary: '#ffffff', accent: '#38bdf8' },
  light: { primary: '#0f172a', accent: '#38bdf8' },
};

const PAD_DRAW  = 120;   // ~270° of the open arc
const TOE_C     = 28.3;
const PINKY_C   = 22.0;

const T_PAD_IN  = 1200;
const T_TOE     = 800;
const T_HOLD    = 600;
const T_PAD_OUT = 1200;
const T_FADE    = 400;
const TOTAL     = T_PAD_IN + T_TOE * 4 + T_HOLD + T_PAD_OUT + T_FADE;

const S_T1      = T_PAD_IN;
const S_T2      = S_T1 + T_TOE;
const S_T3      = S_T2 + T_TOE;
const S_T4      = S_T3 + T_TOE;
const S_HOLD    = S_T4 + T_TOE;
const S_PAD_OUT = S_HOLD + T_HOLD;
const S_FADE    = S_PAD_OUT + T_PAD_OUT;

const ease = Easing.bezier(0.4, 0, 0.2, 1);

export function BarefootLoader({ size = 120, theme = 'dark' }: BarefootLoaderProps) {
  const c = COLORS[theme];

  // Pad
  const padOffset  = useSharedValue(PAD_DRAW);
  const padOpacity = useSharedValue(0);

  // Toes
  const t1Offset = useSharedValue(TOE_C);   const t1Opacity = useSharedValue(0);
  const t2Offset = useSharedValue(TOE_C);   const t2Opacity = useSharedValue(0);
  const t3Offset = useSharedValue(TOE_C);   const t3Opacity = useSharedValue(0);
  const t4Offset = useSharedValue(PINKY_C); const t4Opacity = useSharedValue(0);

  useEffect(() => {
    // ── Foot pad ──
    padOpacity.value = withRepeat(withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(1, { duration: S_FADE - 50 }),
      withTiming(0, { duration: T_FADE }),
    ), -1, false);

    padOffset.value = withRepeat(withSequence(
      withTiming(0,        { duration: T_PAD_IN,  easing: ease }),  // spin in
      withTiming(0,        { duration: S_PAD_OUT - T_PAD_IN }),     // hold while toes draw + hold
      withTiming(PAD_DRAW, { duration: T_PAD_OUT, easing: ease }),  // unspin
      withTiming(PAD_DRAW, { duration: T_FADE }),                   // stay hidden during fade
    ), -1, false);

    // ── Toe helper ──
    const animToe = (
      offset: SharedValue<number>,
      opacity: SharedValue<number>,
      startMs: number,
      len: number,
      maxOp: number,
    ) => {
      const holdDur = S_PAD_OUT - (startMs + T_TOE);  // hold after spinning
      const beforeFade = S_FADE - S_PAD_OUT;

      opacity.value = withRepeat(withSequence(
        withDelay(startMs, withTiming(maxOp, { duration: 40 })),
        withTiming(maxOp, { duration: T_TOE - 40 + holdDur + T_PAD_OUT }),
        withTiming(0,     { duration: T_FADE }),
        withTiming(0,     { duration: startMs }),  // gap back to cycle start
      ), -1, false);

      offset.value = withRepeat(withSequence(
        withDelay(startMs, withTiming(0, { duration: T_TOE, easing: ease })),
        withTiming(0,   { duration: holdDur + T_PAD_OUT }),
        withTiming(0,   { duration: T_FADE }),
        withTiming(len, { duration: 0 }),
        withTiming(len, { duration: startMs }),
      ), -1, false);
    };

    animToe(t1Offset, t1Opacity, S_T1, TOE_C,   1);
    animToe(t2Offset, t2Opacity, S_T2, TOE_C,   1);
    animToe(t3Offset, t3Opacity, S_T3, TOE_C,   1);
    animToe(t4Offset, t4Opacity, S_T4, PINKY_C, 0.5);

    return () => {
      cancelAnimation(padOffset);  cancelAnimation(padOpacity);
      cancelAnimation(t1Offset);   cancelAnimation(t1Opacity);
      cancelAnimation(t2Offset);   cancelAnimation(t2Opacity);
      cancelAnimation(t3Offset);   cancelAnimation(t3Opacity);
      cancelAnimation(t4Offset);   cancelAnimation(t4Opacity);
    };
  }, []);

  const padProps = useAnimatedProps(() => ({ strokeDashoffset: padOffset.value, opacity: padOpacity.value }));
  const t1Props  = useAnimatedProps(() => ({ strokeDashoffset: t1Offset.value,  opacity: t1Opacity.value }));
  const t2Props  = useAnimatedProps(() => ({ strokeDashoffset: t2Offset.value,  opacity: t2Opacity.value }));
  const t3Props  = useAnimatedProps(() => ({ strokeDashoffset: t3Offset.value,  opacity: t3Opacity.value }));
  const t4Props  = useAnimatedProps(() => ({ strokeDashoffset: t4Offset.value,  opacity: t4Opacity.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Foot pad — open arc ~270° */}
      <AnimatedPath
        animatedProps={padProps}
        d="M 60 82 C 43 82, 33 71, 33 58 C 33 45, 42 37, 53 35 C 56 34, 60 34, 64 35 C 75 37, 84 45, 84 58 C 84 71, 74 82, 60 82"
        fill="none"
        stroke={c.primary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${PAD_DRAW} 40`}
      />
      {/* Toe 1 — left */}
      <AnimatedCircle animatedProps={t1Props}
        cx={46} cy={28} r={4.5}
        fill="none" stroke={c.primary} strokeWidth={2.5}
        strokeDasharray={TOE_C}
      />
      {/* Toe 2 — middle accent */}
      <AnimatedCircle animatedProps={t2Props}
        cx={57} cy={24} r={4.5}
        fill="none" stroke={c.accent} strokeWidth={2.5}
        strokeDasharray={TOE_C}
      />
      {/* Toe 3 — right */}
      <AnimatedCircle animatedProps={t3Props}
        cx={68} cy={26} r={4.5}
        fill="none" stroke={c.primary} strokeWidth={2.5}
        strokeDasharray={TOE_C}
      />
      {/* Toe 4 — pinky */}
      <AnimatedCircle animatedProps={t4Props}
        cx={78} cy={33} r={3.5}
        fill="none" stroke={c.primary} strokeWidth={2}
        strokeDasharray={PINKY_C}
      />
    </Svg>
  );
}
