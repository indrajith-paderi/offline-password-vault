import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { CLIPBOARD_CLEAR_MS } from '../../security/clipboard';
import { font, useTheme } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 14;
const C = 2 * Math.PI * R;

export type CopyEvent = { label: string; at: number };

const secondsUntil = (deadline: number) => Math.ceil(Math.max(0, deadline - Date.now()) / 1000);

/**
 * Bottom toast shown after copying. The ring drains in step with the real clipboard
 * wipe (CLIPBOARD_CLEAR_MS), so the user can see when the secret is gone.
 */
export function CopyToast({ event, onDone }: { event: CopyEvent; onDone: () => void }) {
  const t = useTheme();
  const deadline = event.at + CLIPBOARD_CLEAR_MS;
  const [left, setLeft] = useState(() => secondsUntil(deadline));
  const progress = useSharedValue(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const ms = Math.max(0, deadline - Date.now());
    progress.set(1 - ms / CLIPBOARD_CLEAR_MS);
    progress.set(withTiming(1, { duration: ms, easing: Easing.linear }));
    const id = setInterval(() => {
      const s = secondsUntil(deadline);
      setLeft(s);
      if (s <= 0) {
        clearInterval(id);
        onDoneRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [deadline, progress]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * progress.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingLeft: 10,
          paddingRight: 18,
          borderRadius: 999,
          backgroundColor: t.toastBg,
          boxShadow: '0px 18px 36px -12px rgba(27,24,56,0.55)',
        }}
      >
        <Svg width={34} height={34} viewBox="0 0 34 34" accessible={false}>
          <Circle cx={17} cy={17} r={R} fill="none" stroke={t.dark ? 'rgba(27,24,56,0.14)' : 'rgba(255,255,255,0.16)'} strokeWidth={3} />
          <AnimatedCircle
            cx={17}
            cy={17}
            r={R}
            fill="none"
            stroke={t.toastRing}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={C}
            animatedProps={ringProps}
            transform="rotate(-90 17 17)"
          />
          <Path d="m11.5 17 3.6 3.6L22.5 13" fill="none" stroke={t.toastInk} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={{ fontFamily: font.semibold, fontSize: 13, color: t.toastInk }}>
          {event.label} copied · clears in {left}s
        </Text>
      </View>
    </Animated.View>
  );
}
