import React, { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { DEFAULT_GENERATOR, generatePassword, GeneratorOptions } from '../../crypto/generator';
import type { EntryInput } from '../../vault/vault';
import { useApp } from '../AppContext';
import { Button, Card, Field, Screen } from '../components/ui';
import { useTheme } from '../theme';

const EMPTY: EntryInput = { title: '', username: '', url: '', password: '', notes: '' };

export function EditScreen({ id }: { id?: string }) {
  const { vault, back } = useApp();
  const t = useTheme();
  const [form, setForm] = useState<EntryInput>(EMPTY);
  const [gen, setGen] = useState<GeneratorOptions>(DEFAULT_GENERATOR);
  const [showGen, setShowGen] = useState(!id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void vault.get(id).then(({ title, username, url, password, notes }) =>
      setForm({ title, username, url, password, notes }),
    );
  }, [vault, id]);

  const set = (k: keyof EntryInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await vault.save(form, id);
      back();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: keyof Omit<GeneratorOptions, 'length'>, label: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: t.text }}>{label}</Text>
      <Switch value={gen[k]} onValueChange={(v) => setGen((g) => ({ ...g, [k]: v }))} />
    </View>
  );

  const canGenerate = gen.lower || gen.upper || gen.digits || gen.symbols;

  return (
    <Screen title={id ? 'Edit' : 'New password'} onBack={back}>
      <Field label="Title" value={form.title} onChangeText={set('title')} placeholder="e.g. Bank" autoCapitalize="sentences" />
      <Field label="Username / email" value={form.username} onChangeText={set('username')} />
      <Field
        label="Password"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        textContentType="none"
        autoComplete="off"
      />
      <Pressable onPress={() => setShowGen((s) => !s)}>
        <Text style={{ color: t.primary, marginBottom: 6 }}>{showGen ? 'Hide generator' : 'Generate a password'}</Text>
      </Pressable>
      {showGen && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: t.text }}>Length: {gen.length}</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {[-4, -1, 1, 4].map((d) => (
                <Pressable
                  key={d}
                  hitSlop={6}
                  onPress={() => setGen((g) => ({ ...g, length: Math.min(64, Math.max(8, g.length + d)) }))}
                >
                  <Text style={{ color: t.primary, fontSize: 16 }}>{d > 0 ? `+${d}` : d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {toggle('lower', 'Lowercase')}
          {toggle('upper', 'Uppercase')}
          {toggle('digits', 'Digits')}
          {toggle('symbols', 'Symbols')}
          <Button
            label="Generate"
            kind="secondary"
            disabled={!canGenerate}
            onPress={() => set('password')(generatePassword(gen))}
          />
        </Card>
      )}
      <Field label="Website" value={form.url} onChangeText={set('url')} keyboardType="url" />
      <Field label="Notes" value={form.notes} onChangeText={set('notes')} multiline autoCapitalize="sentences" />
      <Button label="Save" onPress={save} busy={busy} disabled={!form.title.trim() && !form.username && !form.password} />
    </Screen>
  );
}
