import React, { ReactNode, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copySecret } from '../../security/clipboard';
import type { Entry } from '../../vault/types';
import { useApp } from '../AppContext';
import { CopyEvent, CopyToast } from '../components/CopyToast';
import { Icon } from '../components/Icon';
import { Button, Card, IconButton, Monogram, Overline, PressableScale } from '../components/ui';
import { haptic } from '../haptics';
import { font, gutter, type, useTheme } from '../theme';

const REVEAL_MS = 20_000;

export function EntryScreen({ id }: { id: string }) {
  const { vault, go, back } = useApp();
  const t = useTheme();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState<CopyEvent | null>(null);

  useEffect(() => {
    void vault.get(id).then(setEntry);
    return () => setEntry(null);
  }, [vault, id]);

  useEffect(() => {
    if (!reveal) return;
    const h = setTimeout(() => setReveal(false), REVEAL_MS);
    return () => clearTimeout(h);
  }, [reveal]);

  if (!entry) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, paddingHorizontal: gutter, paddingTop: 8 }}>
        <IconButton icon="back" label="Back" onPress={back} />
      </SafeAreaView>
    );
  }

  const copy = async (label: string, value: string) => {
    await copySecret(value);
    haptic.success();
    setCopied({ label, at: Date.now() });
  };

  const remove = () => {
    haptic.warning();
    Alert.alert('Delete this entry?', entry.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await vault.remove(id);
          back();
        },
      },
    ]);
  };

  const host = hostOf(entry.url);
  const rows: ReactNode[] = [];
  if (entry.username) {
    rows.push(
      <FieldRow key="u" label="Username">
        <Text selectable style={[type.bodyLg, { fontFamily: font.semibold, color: t.ink }]}>
          {entry.username}
        </Text>
        <RowAction icon="copy" label="Copy username" testID="copy-username" onPress={() => void copy('Username', entry.username)} />
      </FieldRow>,
    );
  }
  if (entry.password) {
    rows.push(
      <View key="p">
        <FieldRow label="Password">
          {reveal ? (
            <Animated.View>
              <ColoredSecret value={entry.password} />
            </Animated.View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, height: 24, alignItems: 'center' }} accessibilityLabel="Password hidden">
              {Array.from({ length: 12 }, (_, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.ink }} />
              ))}
            </View>
          )}
          <RowAction
            icon={reveal ? 'eyeOff' : 'eye'}
            label={reveal ? 'Hide password' : 'Show password'}
            testID="toggle-password"
            onPress={() => {
              haptic.tick();
              setReveal((r) => !r);
            }}
          />
          <RowAction icon="copy" label="Copy password" testID="copy-password" primary onPress={() => void copy('Password', entry.password)} />
        </FieldRow>
        {reveal && <RevealTimer />}
      </View>,
    );
  }
  if (entry.url) {
    rows.push(
      <FieldRow key="w" label="Website">
        <Text selectable style={[type.bodyLg, { fontFamily: font.semibold, color: t.ink }]}>
          {entry.url}
        </Text>
        <RowAction icon="copy" label="Copy website" testID="copy-website" onPress={() => void copy('Website', entry.url)} />
      </FieldRow>,
    );
  }

  return (
    <SafeAreaView testID="entry-screen" style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: gutter, paddingTop: 8 }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <PressableScale
          testID="edit-entry"
          accessibilityRole="button"
          accessibilityLabel="Edit"
          onPress={() => go({ name: 'edit', id })}
          pressedScale={0.94}
          style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: t.shadowRaised }}
        >
          <Icon name="edit" size={18} color={t.ink} />
          <Text style={[type.button, { fontSize: 15, color: t.ink }]}>Edit</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 110, gap: 14, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 8 }}>
          <View style={{ boxShadow: '0px 14px 28px -16px rgba(67,53,214,0.5)', borderRadius: 24 }}>
            <Monogram title={entry.title} size={76} />
          </View>
          <Text style={[type.title, { color: t.ink, textAlign: 'center' }]} accessibilityRole="header">
            {entry.title || 'Untitled'}
          </Text>
          {host ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.sunken }}>
              <Icon name="globe" size={14} color={t.ink2} strokeWidth={2.2} />
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.ink2 }}>{host}</Text>
            </View>
          ) : null}
        </Animated.View>

        {rows.length > 0 && (
          <Animated.View>
            <Card padded={false}>
              {rows.map((r, i) => (
                <View key={i}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 18 }} />}
                  {r}
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {!!entry.notes && (
          <Animated.View>
            <Card>
              <Overline>Notes</Overline>
              <Text selectable style={[type.body, { color: t.ink2 }]}>
                {entry.notes}
              </Text>
            </Card>
          </Animated.View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Icon name="clock" size={14} color={t.muted} strokeWidth={2.2} />
          <Text style={[type.caption, { color: t.muted }]}>Last changed {new Date(entry.updatedAt).toLocaleString()}</Text>
        </View>

        <View style={{ marginTop: 'auto', paddingTop: 24 }}>
          <Button label="Delete entry" kind="danger" icon="trash" size="md" onPress={remove} testID="delete-entry" />
        </View>
      </ScrollView>

      {copied && <CopyToast key={copied.at} event={copied} onDone={() => setCopied(null)} />}
    </SafeAreaView>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  const kids = React.Children.toArray(children);
  const [value, ...actions] = kids;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingLeft: 18, paddingRight: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Overline>{label}</Overline>
        {value}
      </View>
      {actions}
    </View>
  );
}

function RowAction({ icon, label, onPress, testID, primary }: { icon: 'copy' | 'eye' | 'eyeOff'; label: string; onPress: () => void; testID: string; primary?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.88}
      hitSlop={4}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: primary ? t.primary : t.chip,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: primary ? t.shadowPrimary : undefined,
      }}
    >
      <Icon name={icon} size={19} color={primary ? t.onPrimary : t.primarySoftInk} />
    </PressableScale>
  );
}

/** Revealed password in mono; digits and symbols tinted so look-alike characters can't be confused. */
export function ColoredSecret({ value, size = 17 }: { value: string; size?: number }) {
  const t = useTheme();
  const runs: { kind: 'digit' | 'symbol' | 'letter'; text: string }[] = [];
  for (const ch of Array.from(value)) {
    const kind = /[0-9]/.test(ch) ? 'digit' : /[A-Za-z]/.test(ch) ? 'letter' : 'symbol';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else runs.push({ kind, text: ch });
  }
  return (
    <Text selectable={false} style={[type.mono, { fontSize: size, color: t.ink }]}>
      {runs.map((r, i) =>
        r.kind === 'letter' ? (
          r.text
        ) : (
          <Text key={i} style={{ color: r.kind === 'digit' ? t.digit : t.symbol }}>
            {r.text}
          </Text>
        ),
      )}
    </Text>
  );
}

function RevealTimer() {
  const t = useTheme();
  const p = useSharedValue(1);
  useEffect(() => {
    p.set(withTiming(0, { duration: REVEAL_MS, easing: Easing.linear }));
  }, [p]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 16, paddingBottom: 12 }}>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: t.divider, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: t.toastRing, transformOrigin: 'left' }, bar]} />
      </View>
      <Text style={[type.caption, { fontSize: 12, color: t.muted }]}>Hides in 20s</Text>
    </Animated.View>
  );
}

function hostOf(url: string): string | null {
  const m = url.trim().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]*@)?([^/:?#\s]+)/i);
  if (!m) return null;
  const h = m[1].replace(/^www\./i, '');
  return h.includes('.') ? h : null;
}
