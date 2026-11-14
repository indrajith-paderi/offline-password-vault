import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function Screen({
  title,
  onBack,
  right,
  children,
  scroll = true,
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const t = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {(title || onBack || right) && (
        <View style={[styles.header, { borderBottomColor: t.border }]}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={[styles.headerBtn, { color: t.primary }]}>‹ Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ minWidth: 60, alignItems: 'flex-end' }}>{right}</View>
        </View>
      )}
      {body}
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? t.danger : t.card;
  const fg = kind === 'secondary' ? t.text : t.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: t.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        autoCorrect={false}
        autoCapitalize="none"
        importantForAutofill="no"
        {...props}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.card, borderColor: t.border },
          props.multiline && { minHeight: 90, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>;
}

export function Notice({ text, kind = 'warn' }: { text: string; kind?: 'warn' | 'info' }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.notice,
        kind === 'warn' ? { backgroundColor: t.warnBg } : { backgroundColor: t.card, borderColor: t.border, borderWidth: 1 },
      ]}
    >
      <Text style={{ color: kind === 'warn' ? t.warn : t.muted, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function AppMark({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require('../../../assets/icon.png')}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: size * 0.25 }}
    />
  );
}

export function H1({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.h1, { color: t.text }]}>{children}</Text>;
}

export function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const t = useTheme();
  return <Text style={[styles.p, { color: muted ? t.muted : t.text }]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerBtn: { fontSize: 16, width: 60 },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 8 },
  notice: { borderRadius: 10, padding: 12 },
  h1: { fontSize: 26, fontWeight: '700' },
  p: { fontSize: 15, lineHeight: 22 },
});
