import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import type { ListedEntry } from '../../vault/vault';
import { useApp } from '../AppContext';
import { Button, Notice, P, Screen } from '../components/ui';
import { useTheme } from '../theme';

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

  return (
    <Screen
      title="Vault"
      scroll={false}
      right={
        <Pressable testID="open-settings" onPress={() => go({ name: 'settings' })} hitSlop={12} accessibilityLabel="Settings">
          <Text style={{ color: t.primary, fontSize: 16 }}>Settings</Text>
        </Pressable>
      }
    >
      {warnings.map((w) => (
        <Notice key={w} text={w} />
      ))}
      <TextInput
        value={q}
        onChangeText={setQ}
        testID="search"
        placeholder="Search"
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
        keyExtractor={(e) => e.id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          items === null ? undefined : (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <P muted>{q ? 'Nothing matches.' : 'No passwords yet. Add your first one.'}</P>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => go({ name: 'entry', id: item.id })}
            style={({ pressed }) => ({
              backgroundColor: t.card,
              borderColor: t.border,
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
              {item.title}
            </Text>
            {!!item.username && (
              <Text style={{ color: t.muted, marginTop: 2 }} numberOfLines={1}>
                {item.username}
              </Text>
            )}
          </Pressable>
        )}
      />
      <Button testID="add-entry" label="+ Add password" onPress={() => go({ name: 'edit' })} />
    </Screen>
  );
}
