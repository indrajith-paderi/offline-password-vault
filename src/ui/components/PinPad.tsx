import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '../haptics';
import { font, spring, useTheme } from '../theme';
import { Icon } from './Icon';

export type PinTone = 'idle' | 'error' | 'success';

export function PinPad({
  onComplete,
  disabled,
  extraKey,
  resetSignal,
  errorSignal,
  tone = 'idle',
}: {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  extraKey?: { label: string; onPress: () => void };
  resetSignal?: number;
  /** Increment to shake the dots (wrong PIN / mismatch). */
  errorSignal?: number;
  tone?: PinTone;
}) {
  const t = useTheme();
  const [pin, setPin] = useState('');
  const [seenReset, setSeenReset] = useState(resetSignal);
  const shake = useSharedValue(0);

  // Clear typed digits when the parent bumps resetSignal (adjust-state-during-render pattern).
  if (seenReset !== resetSignal) {
    setSeenReset(resetSignal);
    setPin('');
  }

  useEffect(() => {
    if (!errorSignal) return;
    haptic.error();
    shake.set(
      withSequence(
        withTiming(-12, { duration: 60 }),
        withTiming(10, { duration: 70 }),
        withTiming(-6, { duration: 70 }),
        withTiming(3, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      ),
    );
  }, [errorSignal, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (d: string) => {
    if (disabled || pin.length >= 4) return;
    haptic.tick();
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      onComplete(next);
      setPin('');
    }
  };

  const del = () => {
    if (disabled) return;
    haptic.tick();
    setPin((p) => p.slice(0, -1));
  };

  const filled = tone === 'success' ? 4 : pin.length;

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.dots, shakeStyle]} accessible accessibilityLabel={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <Dot key={i} on={i < filled} tone={tone} />
        ))}
      </Animated.View>
      <View style={s.grid}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PinKey key={d} testID={`pin-key-${d}`} a11y={d} onPress={() => press(d)} disabled={disabled}>
            <Text style={[s.digit, { color: t.ink }]}>{d}</Text>
          </PinKey>
        ))}
        {extraKey ? (
          <PinKey testID="pin-key-bio" a11y="Biometric unlock" onPress={extraKey.onPress} disabled={disabled} soft>
            <Icon name="fingerprint" size={30} color={t.primarySoftInk} strokeWidth={1.8} />
          </PinKey>
        ) : (
          <View style={s.key} />
        )}
        <PinKey testID="pin-key-0" a11y="0" onPress={() => press('0')} disabled={disabled}>
          <Text style={[s.digit, { color: t.ink }]}>0</Text>
        </PinKey>
        <PinKey testID="pin-key-del" a11y="Delete" onPress={del} disabled={disabled} ghost>
          <Icon name="backspace" size={28} color={t.ink2} strokeWidth={1.9} />
        </PinKey>
      </View>
    </View>
  );
}

function Dot({ on, tone }: { on: boolean; tone: PinTone }) {
  const t = useTheme();
  const color = !on ? t.dotOff : tone === 'error' ? t.rose : tone === 'success' ? t.mint : t.primary;
  const ring = !on ? 'transparent' : tone === 'error' ? t.roseSoft : tone === 'success' ? t.mintSoft : t.primarySoft;
  return <Animated.View style={[s.dot, { backgroundColor: color, boxShadow: `0px 0px 0px 6px ${ring}` }]} />;
}

function PinKey({
  children,
  onPress,
  disabled,
  testID,
  a11y,
  soft,
  ghost,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
  a11y: string;
  soft?: boolean;
  ghost?: boolean;
}) {
  const t = useTheme();
  const p = useSharedValue(0);
  const rest = ghost ? 'transparent' : soft ? t.primarySoft : t.key;
  const pressed = ghost ? t.chip : t.keyPressed;
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - p.value * 0.04 }],
    backgroundColor: interpolateColor(p.value, [0, 1], [rest, pressed]),
  }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        p.set(withSpring(1, spring));
      }}
      onPressOut={() => {
        p.set(withSpring(0, spring));
      }}
      style={{ opacity: disabled ? 0.38 : 1 }}
    >
      <Animated.View style={[s.key, { boxShadow: ghost || soft ? undefined : t.shadowKey }, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 36, width: '100%' },
  dots: { flexDirection: 'row', gap: 22, height: 28, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16, width: '100%', maxWidth: 300 },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: font.semibold, fontSize: 24 },
});
