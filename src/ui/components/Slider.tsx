import React, { useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring, useTheme } from '../theme';

const THUMB = 28;

/** Integer slider built on the core responder system (no gesture library needed). */
export function Slider({
  min,
  max,
  value,
  onChange,
  label,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const left = useRef(0);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const grab = useSharedValue(0);

  const frac = (value - min) / (max - min);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    ref.current?.measureInWindow((x) => (left.current = x));
  };

  const update = (e: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = e.nativeEvent.pageX - left.current;
    const f = Math.min(1, Math.max(0, x / width));
    const v = Math.round(min + f * (max - min));
    if (v !== value) onChange(v);
  };

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + grab.value * 0.15 }] }));
  const usable = Math.max(0, width);
  const thumbX = frac * usable - THUMB / 2;

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        ref.current?.measureInWindow((x) => (left.current = x));
        grab.set(withSpring(1, spring));
        update(e);
      }}
      onResponderMove={update}
      onResponderRelease={() => grab.set(withSpring(0, spring))}
      onResponderTerminate={() => grab.set(withSpring(0, spring))}
      hitSlop={{ top: 12, bottom: 12 }}
      style={{ height: THUMB, justifyContent: 'center' }}
    >
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.sunken }} />
      <View style={{ position: 'absolute', left: 0, width: frac * usable, height: 8, borderRadius: 4, backgroundColor: t.primary }} />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: thumbX,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: '#FFFFFF',
            borderWidth: 3,
            borderColor: t.primary,
            boxShadow: '0px 6px 14px -4px rgba(91,76,240,0.6)',
          },
          thumbStyle,
        ]}
      />
    </View>
  );
}
