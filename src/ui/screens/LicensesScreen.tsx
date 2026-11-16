import React, { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../AppContext';
import { Icon } from '../components/Icon';
import { IconButton, P, PressableScale, SearchField } from '../components/ui';
import { font, gutter, radius, type, useTheme } from '../theme';

type LicensePackage = {
  name: string;
  version: string;
  license: string;
  url: string | null;
  textId: string | null;
};

type LicenseData = { packages: LicensePackage[]; texts: Record<string, string> };

export function LicensesScreen() {
  const { back } = useApp();
  const t = useTheme();
  const data = useMemo<LicenseData>(() => require('../../legal/licenses.json'), []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? data.packages.filter((p) => p.name.toLowerCase().includes(needle)) : data.packages;
  }, [data, q]);

  return (
    <SafeAreaView testID="licenses-screen" style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <FlatList
        data={shown}
        keyExtractor={(p) => `${p.name}@${p.version}`}
        initialNumToRender={30}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingTop: 8, paddingBottom: 14 }}>
            <IconButton icon="back" label="Back" onPress={back} />
            <Text style={[type.display, { color: t.ink }]} accessibilityRole="header">
              Acknowledgements
            </Text>
            <P muted>Keystill is built on these open-source packages. Thank you to everyone who made them.</P>
            <SearchField value={q} onChangeText={setQ} placeholder={`Search ${data.packages.length} packages`} />
          </View>
        }
        renderItem={({ item, index }) => {
          const key = `${item.name}@${item.version}`;
          const expanded = open === key;
          const first = index === 0;
          const last = index === shown.length - 1;
          return (
            <View
              style={{
                backgroundColor: t.surface,
                borderTopLeftRadius: first ? radius.card : 0,
                borderTopRightRadius: first ? radius.card : 0,
                borderBottomLeftRadius: last ? radius.card : 0,
                borderBottomRightRadius: last ? radius.card : 0,
                paddingTop: first ? 4 : 0,
                paddingBottom: last ? 4 : 0,
              }}
            >
              {!first && <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 16 }} />}
              <PressableScale
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setOpen(expanded ? null : key)}
                pressedScale={0.99}
                style={{ paddingVertical: 14, paddingHorizontal: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: t.ink }} numberOfLines={1}>
                    {item.name} <Text style={{ fontFamily: font.medium, color: t.muted }}>{item.version}</Text>
                  </Text>
                  <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.chip }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: t.ink2 }}>{item.license}</Text>
                  </View>
                  <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                    <Icon name="chevron" size={16} color={t.chevron} strokeWidth={2.2} />
                  </View>
                </View>
                {expanded && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 12, gap: 8 }}>
                    {!!item.url && (
                      <Text selectable style={{ fontFamily: font.medium, color: t.muted, fontSize: 12 }}>
                        {item.url}
                      </Text>
                    )}
                    <View style={{ padding: 12, borderRadius: 14, backgroundColor: t.bg }}>
                      <Text selectable style={{ color: t.ink2, fontSize: 12, lineHeight: 18, fontFamily: font.mono }}>
                        {item.textId ? data.texts[item.textId] : `Licensed under ${item.license}.`}
                      </Text>
                    </View>
                  </Animated.View>
                )}
              </PressableScale>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
