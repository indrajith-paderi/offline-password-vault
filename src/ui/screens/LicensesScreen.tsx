import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppContext';
import { Screen } from '../components/ui';
import { useTheme } from '../theme';

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
    <Screen title="Open source licenses" onBack={back} scroll={false}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={`Search ${data.packages.length} packages`}
        placeholderTextColor={t.muted}
        autoCorrect={false}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          color: t.text,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
        }}
      />
      <FlatList
        style={{ flex: 1 }}
        data={shown}
        keyExtractor={(p) => `${p.name}@${p.version}`}
        initialNumToRender={30}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.border }} />}
        renderItem={({ item }) => {
          const key = `${item.name}@${item.version}`;
          const expanded = open === key;
          return (
            <Pressable onPress={() => setOpen(expanded ? null : key)} style={{ paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>
                  {item.name} <Text style={{ color: t.muted }}>{item.version}</Text>
                </Text>
                <Text style={{ color: t.muted }}>{item.license}</Text>
              </View>
              {expanded && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {!!item.url && (
                    <Text selectable style={{ color: t.muted, fontSize: 12 }}>
                      {item.url}
                    </Text>
                  )}
                  <Text selectable style={{ color: t.text, fontSize: 12, fontFamily: 'monospace' }}>
                    {item.textId ? data.texts[item.textId] : `Licensed under ${item.license}.`}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
