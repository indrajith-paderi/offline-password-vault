import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ListedEntry } from '../../vault/vault';
import { useApp } from '../AppContext';
import { Icon, Sparkle } from '../components/Icon';
import { IconButton, ListRow, Monogram, Notice, Overline, P, PressableScale, SearchField } from '../components/ui';
import { haptic } from '../haptics';
import { font, gutter, radius, type, useTheme } from '../theme';

export function ListScreen() {
  const { vault, go, warnings } = useApp();
  const t = useTheme();
  const [items, setItems] = useState<ListedEntry[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    void vault.list().then(setItems);
  }, [vault]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!items || !needle) return items ?? [];
    return items.filter(
      (e) =>
        e.title.toLowerCase().includes(needle) ||
        e.username.toLowerCase().includes(needle) ||
        e.url.toLowerCase().includes(needle),
    );
  }, [items, q]);

  const count = items?.length ?? 0;
  const empty = items !== null && count === 0;

  const header = (
    <View style={{ gap: 18, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 12 }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={[type.display, { color: t.ink }]} accessibilityRole="header">
            Vault
          </Text>
          <Text style={[type.secondary, { fontFamily: font.semibold, color: t.muted }]}>
            {items === null ? ' ' : empty ? 'Empty and encrypted' : `${count} saved password${count === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
          <IconButton
            icon="lock"
            label="Lock now"
            testID="lock-now"
            onPress={() => {
              haptic.medium();
              vault.lock();
            }}
          />
          <IconButton icon="settings" label="Settings" testID="open-settings" onPress={() => go({ name: 'settings' })} />
        </View>
      </View>
      {warnings.map((w) => (
        <Notice key={w} text={w} />
      ))}
      {!empty && <SearchField value={q} onChangeText={setQ} testID="search" placeholder="Search titles, usernames, sites" />}
      {!empty && shown.length > 0 && <Overline style={{ paddingLeft: 4, marginTop: 2 }}>{q ? 'Results' : 'All items'}</Overline>}
    </View>
  );

  return (
    <SafeAreaView testID="vault-list" style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom', 'left', 'right']}>
      {/* Inner wrapper so the floating button sits above the system navigation bar, never behind it. */}
      <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 110, flexGrow: 1 }}
        ListHeaderComponent={header}
        ListEmptyComponent={items === null ? undefined : q ? <NoMatches /> : <EmptyVault />}
        renderItem={({ item, index }) => {
          const first = index === 0;
          const last = index === shown.length - 1;
          return (
            <Animated.View
              style={{
                backgroundColor: t.surface,
                borderTopLeftRadius: first ? radius.card : 0,
                borderTopRightRadius: first ? radius.card : 0,
                borderBottomLeftRadius: last ? radius.card : 0,
                borderBottomRightRadius: last ? radius.card : 0,
                paddingTop: first ? 6 : 0,
                paddingBottom: last ? 6 : 0,
              }}
            >
              <ListRow
                title={item.title || 'Untitled'}
                subtitle={item.username || undefined}
                leading={<Monogram title={item.title} />}
                onPress={() => go({ name: 'entry', id: item.id })}
              />
              {!last && <View style={{ height: 1, backgroundColor: t.divider, marginLeft: 74, marginRight: 16 }} />}
            </Animated.View>
          );
        }}
      />
      <Fab onPress={() => go({ name: 'edit' })} />
      </View>
    </SafeAreaView>
  );
}

function Fab({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Svg width="100%" height={110} style={{ position: 'absolute', bottom: 0 }} pointerEvents="none">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.bg} stopOpacity={0} />
            <Stop offset="0.45" stopColor={t.bg} stopOpacity={0.92} />
            <Stop offset="1" stopColor={t.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="110" fill="url(#fade)" />
      </Svg>
      <Animated.View style={{ marginBottom: 16 }}>
        <PressableScale
          testID="add-entry"
          accessibilityRole="button"
          accessibilityLabel="New password"
          onPress={() => {
            haptic.light();
            onPress();
          }}
          style={{
            height: 52,
            paddingLeft: 18,
            paddingRight: 22,
            borderRadius: 26,
            backgroundColor: t.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            boxShadow: t.shadowPrimary,
          }}
        >
          <Icon name="plus" size={20} color={t.onPrimary} strokeWidth={2.4} />
          <Text style={[type.button, { color: t.onPrimary }]}>New password</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

function EmptyVault() {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 40 }}>
      <View style={{ width: 200, height: 170 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[cardStack, { backgroundColor: t.primarySoft, transform: [{ rotate: '-8deg' }] }]} />
        <View style={[cardStack, { backgroundColor: t.tiles[1].bg, transform: [{ rotate: '6deg' }] }]} />
        <Animated.View
          style={[cardStack, { backgroundColor: t.surface, boxShadow: t.shadowCard, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 }]}
        >
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="key" size={20} color={t.primarySoftInk} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 9, borderRadius: 5, backgroundColor: t.line, width: '80%' }} />
            <View style={{ height: 9, borderRadius: 5, backgroundColor: t.divider, width: '55%' }} />
          </View>
        </Animated.View>
        <View style={{ position: 'absolute', right: 6, top: 6 }}>
          <Sparkle size={22} color={t.tiles[1].fg} />
        </View>
        <View style={{ position: 'absolute', left: 6, bottom: 22 }}>
          <Sparkle size={14} color={t.primary} />
        </View>
      </View>
      <Text style={[type.title, { color: t.ink, marginTop: 18 }]}>Nothing here yet</Text>
      <P muted center style={{ marginTop: 8 }}>
        Add your first password. It’s encrypted on your device and never leaves your phone.
      </P>
    </Animated.View>
  );
}

function NoMatches() {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ alignItems: 'center', paddingTop: 48, gap: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="search" size={24} color={t.muted} />
      </View>
      <P muted center>
        Nothing matches.
      </P>
    </Animated.View>
  );
}

const cardStack = {
  position: 'absolute' as const,
  left: 22,
  top: 30,
  width: 156,
  height: 96,
  borderRadius: 22,
};
