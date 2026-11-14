import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { copySecret } from '../../security/clipboard';
import type { Entry } from '../../vault/types';
import { useApp } from '../AppContext';
import { Button, Card, P, Screen } from '../components/ui';
import { useTheme } from '../theme';

export function EntryScreen({ id }: { id: string }) {
  const { vault, go, back } = useApp();
  const t = useTheme();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [reveal, setReveal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void vault.get(id).then(setEntry);
    return () => setEntry(null);
  }, [vault, id]);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(h);
  }, [toast]);

  useEffect(() => {
    if (!reveal) return;
    const h = setTimeout(() => setReveal(false), 20_000);
    return () => clearTimeout(h);
  }, [reveal]);

  if (!entry) return <Screen title="" onBack={back}>{null}</Screen>;

  const copy = async (label: string, value: string) => {
    await copySecret(value);
    setToast(`${label} copied. Clipboard clears in 30s.`);
  };

  const row = (label: string, value: string, opts?: { secret?: boolean }) =>
    !!value && (
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text
            selectable={!opts?.secret}
            style={{ color: t.text, fontSize: 16, flex: 1, fontFamily: opts?.secret ? 'monospace' : undefined }}
          >
            {opts?.secret && !reveal ? '••••••••••••' : value}
          </Text>
          {opts?.secret && (
            <Pressable testID="toggle-password" onPress={() => setReveal((r) => !r)} hitSlop={8}>
              <Text style={{ color: t.primary }}>{reveal ? 'Hide' : 'Show'}</Text>
            </Pressable>
          )}
          <Pressable testID={`copy-${label.toLowerCase()}`} onPress={() => void copy(label, value)} hitSlop={8}>
            <Text style={{ color: t.primary }}>Copy</Text>
          </Pressable>
        </View>
      </View>
    );

  const remove = () =>
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

  return (
    <Screen
      title={entry.title}
      onBack={back}
      right={
        <Pressable onPress={() => go({ name: 'edit', id })} hitSlop={12}>
          <Text style={{ color: t.primary, fontSize: 16 }}>Edit</Text>
        </Pressable>
      }
    >
      <Card>
        {row('Username', entry.username)}
        {row('Password', entry.password, { secret: true })}
        {row('Website', entry.url)}
      </Card>
      {!!entry.notes && (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13 }}>Notes</Text>
          <P>{entry.notes}</P>
        </Card>
      )}
      <P muted>Last changed {new Date(entry.updatedAt).toLocaleString()}</P>
      {toast && <P muted>{toast}</P>}
      <Button label="Delete" kind="danger" onPress={remove} />
    </Screen>
  );
}
