import React, { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { haptic } from '../haptics';
import { font, gutter, monogram, radius, spring, Theme, tileFor, type, useTheme } from '../theme';
import { Icon, IconName } from './Icon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ───────────────────────────── Press feedback ───────────────────────────── */

type ScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far the element squishes when pressed. */
  pressedScale?: number;
  /** Fire a light haptic tick on press. */
  tick?: boolean;
};

/** Pressable that squishes on touch with a spring, then bounces back. */
export function PressableScale({ style, pressedScale = 0.96, tick, onPressIn, onPressOut, onPress, ...rest }: ScaleProps) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        s.set(withSpring(pressedScale, spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, spring));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (tick) haptic.tick();
        onPress?.(e);
      }}
      style={[style, anim]}
    />
  );
}

/* ───────────────────────────────── Screen ───────────────────────────────── */

export function Screen({
  title,
  largeTitle,
  onBack,
  backIcon = 'back',
  right,
  children,
  footer,
  scroll = true,
  testID,
}: {
  /** Small centred title in the top bar. */
  title?: string;
  /** Big left-aligned title at the top of the content. */
  largeTitle?: string;
  onBack?: () => void;
  backIcon?: IconName;
  right?: ReactNode;
  children: ReactNode;
  /** Content pinned below the scroll area (e.g. a primary action). */
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const hasBar = !!(title || onBack || right);
  const inner = (
    <>
      {largeTitle ? <Text style={[type.display, { color: t.ink, marginBottom: 4 }]}>{largeTitle}</Text> : null}
      {children}
    </>
  );
  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom', 'left', 'right']}>
      {hasBar && (
        <View style={styles.bar}>
          {onBack ? (
            <IconButton icon={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack} />
          ) : (
            <View style={styles.barSlot} />
          )}
          <Text style={[type.heading, styles.barTitle, { color: t.ink }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.barSlot, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
      )}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.body, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={[styles.body, { flex: 1 }]}>{inner}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/* ──────────────────────────────── Buttons ──────────────────────────────── */

export function IconButton({
  icon,
  label,
  onPress,
  kind = 'surface',
  size = 44,
  shape = 'round',
  testID,
  iconSize,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  kind?: 'surface' | 'soft' | 'primary' | 'ghost';
  size?: number;
  shape?: 'round' | 'squircle';
  testID?: string;
  iconSize?: number;
}) {
  const t = useTheme();
  const bg = { surface: t.surface, soft: t.chip, primary: t.primary, ghost: 'transparent' }[kind];
  const fg = { surface: t.ink, soft: t.primarySoftInk, primary: t.onPrimary, ghost: t.ink2 }[kind];
  const shadow = kind === 'surface' ? t.shadowRaised : kind === 'primary' ? t.shadowPrimary : undefined;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      pressedScale={0.9}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'round' ? size / 2 : 14,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: shadow,
      }}
    >
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.46)} color={fg} strokeWidth={2.1} />
    </PressableScale>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  busy,
  testID,
  size = 'lg',
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'soft' | 'danger' | 'ghost' | 'secondary';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  size?: 'lg' | 'md';
}) {
  const t = useTheme();
  const k = kind === 'secondary' ? 'soft' : kind;
  const bg = { primary: t.primary, soft: t.primarySoft, danger: t.roseSoft, ghost: 'transparent' }[k];
  const fg = { primary: t.onPrimary, soft: t.primarySoftInk, danger: t.roseInk, ghost: t.primary }[k];
  const off = disabled || busy;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      onPress={() => {
        if (k === 'danger') haptic.medium();
        else haptic.light();
        onPress();
      }}
      disabled={off}
      pressedScale={0.97}
      style={{
        height: size === 'lg' ? 58 : 50,
        borderRadius: size === 'lg' ? radius.button : 16,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        opacity: disabled ? 0.45 : 1,
        boxShadow: k === 'primary' && !disabled ? t.shadowPrimary : undefined,
      }}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} strokeWidth={2.3} /> : null}
          <Text style={[type.button, { color: fg, fontSize: size === 'lg' ? 17 : 16 }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

/** Small inline text link ("Forgot PIN?", "Hide"). */
export function TextLink({ label, onPress, testID, color }: { label: string; onPress: () => void; testID?: string; color?: string }) {
  const t = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={10}
      pressedScale={0.94}
      style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignSelf: 'center' }}
    >
      <Text style={[type.button, { fontSize: 15, color: color ?? t.primary }]}>{label}</Text>
    </PressableScale>
  );
}

/* ───────────────────────────────── Inputs ───────────────────────────────── */

export function Field({
  label,
  icon,
  trailing,
  mono,
  ...props
}: TextInputProps & { label: string; icon?: IconName; trailing?: ReactNode; mono?: boolean }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const multiline = !!props.multiline;
  return (
    <View style={{ gap: 8 }}>
      <Overline style={{ paddingLeft: 4 }}>{label}</Overline>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 10,
          minHeight: multiline ? 96 : 56,
          paddingLeft: 16,
          paddingRight: trailing ? 8 : 16,
          borderRadius: radius.field,
          backgroundColor: t.surface,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? t.primary : t.line,
          margin: focused ? 0 : 1,
        }}
      >
        {icon ? (
          <View style={{ paddingTop: multiline ? 16 : 0 }}>
            <Icon name={icon} size={19} color={focused ? t.primary : t.muted} />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={t.muted}
          autoCorrect={false}
          autoCapitalize="none"
          importantForAutofill="no"
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              color: t.ink,
              fontFamily: mono ? font.mono : font.medium,
              fontSize: 16,
              paddingVertical: multiline ? 14 : 12,
            },
            multiline && { minHeight: 92, textAlignVertical: 'top' },
            props.style,
          ]}
        />
        {trailing}
      </View>
    </View>
  );
}

export function SearchField(props: TextInputProps) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 50,
        paddingHorizontal: 16,
        borderRadius: radius.field,
        backgroundColor: t.sunken,
      }}
    >
      <Icon name="search" size={20} color={t.muted} />
      <TextInput
        placeholderTextColor={t.muted}
        autoCorrect={false}
        autoCapitalize="none"
        importantForAutofill="no"
        accessibilityLabel="Search"
        {...props}
        style={{ flex: 1, color: t.ink, fontFamily: font.medium, fontSize: 16, paddingVertical: 10 }}
      />
    </View>
  );
}

/** Animated on/off switch. */
export function Toggle({ value, onChange, label, testID }: { value: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  const t = useTheme();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withSpring(value ? 1 : 0, spring));
  }, [value, p]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [t.dotOff, t.primary]),
  }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * 20 }] }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        haptic.tick();
        onChange(!value);
      }}
    >
      <Animated.View style={[{ width: 52, height: 32, borderRadius: 16, padding: 3 }, track]}>
        <Animated.View
          style={[
            {
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: '#FFFFFF',
              boxShadow: '0px 2px 6px rgba(0,0,0,0.18)',
            },
            knob,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string; a11y?: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: t.chip }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={String(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: active }}
            tick
            pressedScale={0.94}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? t.surface : 'transparent',
              boxShadow: active ? t.shadowRaised : undefined,
            }}
          >
            <Text style={{ fontFamily: active ? font.extrabold : font.bold, fontSize: 13, color: active ? t.primarySoftInk : t.ink2 }}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ─────────────────────────────── Surfaces ─────────────────────────────── */

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.card,
          boxShadow: t.shadowCard,
          paddingVertical: padded ? 16 : 6,
          paddingHorizontal: padded ? 18 : 0,
          gap: padded ? 8 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.divider, marginLeft: inset }} />;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  testID,
  chevron = true,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
  chevron?: boolean;
}) {
  const t = useTheme();
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[type.rowTitle, { color: t.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.secondary, { color: t.muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && chevron ? <Icon name="chevron" size={18} color={t.chevron} strokeWidth={2.2} /> : null}
    </>
  );
  const rowStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 66, paddingHorizontal: 16, paddingVertical: 10 };
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <PressableScale testID={testID} accessibilityRole="button" onPress={onPress} pressedScale={0.98} style={rowStyle}>
      {content}
    </PressableScale>
  );
}

/** Square icon badge used on settings rows. */
export function IconTile({ icon, bg, fg, size = 38 }: { icon: IconName; bg: string; fg: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.52} color={fg} />
    </View>
  );
}

/** Pastel monogram for an entry. Colour comes from the title hash. */
export function Monogram({ title, size = 44 }: { title: string; size?: number }) {
  const t = useTheme();
  const c = tileFor(t, title);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: font.extrabold, fontSize: size * 0.41, color: c.fg }}>{monogram(title)}</Text>
    </View>
  );
}

export function Notice({ text, kind = 'warn', testID }: { text: string; kind?: 'warn' | 'info' | 'error' | 'success'; testID?: string }) {
  const t = useTheme();
  const map: Record<string, { bg: string; fg: string; icon: IconName; iconColor: string; border?: string }> = {
    warn: { bg: t.butterSoft, fg: t.butterInk, icon: 'alert', iconColor: t.butterIcon },
    info: { bg: t.surface, fg: t.ink2, icon: 'shield', iconColor: t.primarySoftInk, border: t.line },
    error: { bg: t.roseSoft, fg: t.roseInk, icon: 'info', iconColor: t.roseInk },
    success: { bg: t.mintSoft, fg: t.mintInk, icon: 'check', iconColor: t.mintInk },
  };
  const m = map[kind];
  return (
    <View
      testID={testID}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: m.bg,
        borderWidth: m.border ? 1 : 0,
        borderColor: m.border,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <Icon name={m.icon} size={20} color={m.iconColor} />
      </View>
      <Text style={[type.body, { flex: 1, fontSize: 14, lineHeight: 21, color: m.fg }]}>{text}</Text>
    </View>
  );
}

/** Small rounded status pill ("Wrong PIN · 2 attempts left"). */
export function Pill({ text, kind, icon }: { text: string; kind: 'error' | 'success' | 'neutral'; icon?: IconName }) {
  const t = useTheme();
  const bg = { error: t.roseSoft, success: t.mintSoft, neutral: t.surface }[kind];
  const fg = { error: t.roseInk, success: t.mintInk, neutral: t.ink2 }[kind];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: bg,
        boxShadow: kind === 'neutral' ? t.shadowRaised : undefined,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={fg} strokeWidth={2.4} /> : null}
      <Text style={{ fontFamily: kind === 'neutral' ? font.semibold : font.bold, fontSize: 14, color: fg }}>{text}</Text>
    </View>
  );
}

/* ────────────────────────────── Typography ────────────────────────────── */

export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type.overline, { color: t.muted }, style]}>{children}</Text>;
}

export function H1({ children, center }: { children: ReactNode; center?: boolean }) {
  const t = useTheme();
  return <Text style={[type.title, { color: t.ink, textAlign: center ? 'center' : 'left' }]}>{children}</Text>;
}

export function P({ children, muted, center, style }: { children: ReactNode; muted?: boolean; center?: boolean; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type.body, { color: muted ? t.ink2 : t.ink, textAlign: center ? 'center' : 'left' }, style]}>{children}</Text>;
}

/* ──────────────────────────────── Brand ──────────────────────────────── */

/** The keyhole mark: gradient squircle, drawn as vectors so it is crisp at every size. */
export function AppMark({ size = 80, halo = false }: { size?: number; halo?: boolean }) {
  const t = useTheme();
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (!halo) return;
    breathe.set(withRepeat(withSequence(withTiming(1, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1));
  }, [halo, breathe]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 - breathe.value * 0.4,
    transform: [{ scale: 1 + breathe.value * 0.12 }],
  }));
  const r = size * 0.3;
  const mark = (
    <View style={{ width: size, height: size, borderRadius: r, boxShadow: `0px ${size * 0.2}px ${size * 0.4}px -${size * 0.15}px ${t.dark ? 'rgba(140,125,255,0.55)' : 'rgba(91,76,240,0.65)'}` }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
        <Defs>
          <LinearGradient id="km" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.markFrom} />
            <Stop offset="0.55" stopColor={t.markMid} />
            <Stop offset="1" stopColor={t.markTo} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" rx="30" fill="url(#km)" />
        <Circle cx="50" cy="42" r="12" fill="#FFFFFF" />
        <Path d="M44 50h12l3.4 20a2 2 0 0 1-2 2.3H42.6a2 2 0 0 1-2-2.3z" fill="#FFFFFF" />
      </Svg>
    </View>
  );
  if (!halo) return mark;
  const box = size * 1.5;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', width: box, height: box, borderRadius: box / 2, backgroundColor: t.primaryRing }, haloStyle]} />
      {mark}
    </View>
  );
}

/* ──────────────────────────────── Styles ──────────────────────────────── */

export const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 24, gap: 14 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: 8,
    paddingBottom: 8,
  },
  barSlot: { minWidth: 44 },
  barTitle: { flex: 1, textAlign: 'center' },
  footer: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 12, gap: 12 },
});

export type { Theme };
