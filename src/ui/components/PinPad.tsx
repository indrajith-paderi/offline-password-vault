import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export function PinPad({
  onComplete,
  disabled,
  extraKey,
  resetSignal,
}: {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  extraKey?: { label: string; onPress: () => void };
  resetSignal?: number;
}) {
  const t = useTheme();
  const [pin, setPin] = useState('');

  useEffect(() => setPin(''), [resetSignal]);

  const press = (d: string) => {
    if (disabled || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      onComplete(next);
      setPin('');
    }
  };

  const key = (label: string, onPress: () => void, a11y = label) => (
    <Pressable
      key={a11y}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.key,
        { backgroundColor: t.key, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[s.keyText, { color: t.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.wrap}>
      <View style={s.dots} accessibilityLabel={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[s.dot, { borderColor: t.text, backgroundColor: i < pin.length ? t.text : 'transparent' }]}
          />
        ))}
      </View>
      {[
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
      ].map((row) => (
        <View key={row.join()} style={s.row}>
          {row.map((d) => key(d, () => press(d)))}
        </View>
      ))}
      <View style={s.row}>
        {extraKey ? key(extraKey.label, extraKey.onPress) : <View style={s.key} />}
        {key('0', () => press('0'))}
        {key('⌫', () => setPin((p) => p.slice(0, -1)), 'Delete')}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', gap: 18, marginBottom: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  row: { flexDirection: 'row', gap: 18 },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 28, fontWeight: '500' },
});
