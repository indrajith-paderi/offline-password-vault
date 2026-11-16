import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { DEFAULT_GENERATOR, generatePassword, GeneratorOptions } from '../../crypto/generator';
import type { EntryInput } from '../../vault/vault';
import { useApp } from '../AppContext';
import { Icon, Sparkle } from '../components/Icon';
import { Slider } from '../components/Slider';
import { Button, Card, Field, IconButton, PressableScale, Screen, TextLink } from '../components/ui';
import { haptic } from '../haptics';
import { font, type, useTheme } from '../theme';
import { ColoredSecret } from './EntryScreen';

const EMPTY: EntryInput = { title: '', username: '', url: '', password: '', notes: '' };

/** Character-set sizes mirror src/crypto/generator.ts (look-alike characters removed). */
const SET_SIZE = { lower: 25, upper: 24, digits: 8, symbols: 25 } as const;
type SetKey = keyof typeof SET_SIZE;

function strength(g: GeneratorOptions): { bits: number; label: string; level: 1 | 2 | 3 | 4 } {
  const pool = (Object.keys(SET_SIZE) as SetKey[]).reduce((n, k) => (g[k] ? n + SET_SIZE[k] : n), 0);
  const bits = pool > 1 ? Math.round(g.length * Math.log2(pool)) : 0;
  if (bits >= 100) return { bits, label: 'Very strong', level: 4 };
  if (bits >= 70) return { bits, label: 'Strong', level: 3 };
  if (bits >= 50) return { bits, label: 'Fair', level: 2 };
  return { bits, label: 'Weak', level: 1 };
}

export function EditScreen({ id }: { id?: string }) {
  const { vault, back } = useApp();
  const t = useTheme();
  const [form, setForm] = useState<EntryInput>(EMPTY);
  const [gen, setGenState] = useState<GeneratorOptions>(DEFAULT_GENERATOR);
  const [candidate, setCandidate] = useState(() => generatePassword(DEFAULT_GENERATOR));
  const [showGen, setShowGen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastLen = useRef(gen.length);

  useEffect(() => {
    if (!id) return;
    void vault.get(id).then(({ title, username, url, password, notes }) => setForm({ title, username, url, password, notes }));
  }, [vault, id]);

  const regenerate = useCallback((g: GeneratorOptions) => setCandidate(generatePassword(g)), []);

  /** Every option change produces a fresh candidate straight away. */
  const setGen = (update: (g: GeneratorOptions) => GeneratorOptions) => {
    const next = update(gen);
    setGenState(next);
    regenerate(next);
  };

  const set = (k: keyof EntryInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await vault.save(form, id);
      haptic.success();
      back();
    } finally {
      setBusy(false);
    }
  };

  const toggleSet = (k: SetKey) => {
    const on = (Object.keys(SET_SIZE) as SetKey[]).filter((s) => gen[s]);
    if (gen[k] && on.length === 1) {
      haptic.warning();
      return;
    }
    haptic.tick();
    setGen((g) => ({ ...g, [k]: !g[k] }));
  };

  const s = strength(gen);
  const meterColor = [t.rose, t.butterRing, t.primary, t.mint][s.level - 1];
  const meterInk = [t.roseInk, t.butterInk, t.primarySoftInk, t.mintInk][s.level - 1];

  return (
    <Screen testID="edit-screen" title={id ? 'Edit password' : 'New password'} onBack={back} backIcon="close">
      <Field testID="field-title" label="Title" value={form.title} onChangeText={set('title')} placeholder="e.g. Bank" autoCapitalize="sentences" />
      <Field
        testID="field-username"
        label="Username or email"
        icon="user"
        value={form.username}
        onChangeText={set('username')}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <Field
        testID="field-password"
        label="Password"
        icon="key"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry={!showPw}
        textContentType="none"
        autoComplete="off"
        mono={showPw}
        trailing={<IconButton icon={showPw ? 'eyeOff' : 'eye'} label={showPw ? 'Hide password' : 'Show password'} kind="soft" shape="squircle" size={40} onPress={() => setShowPw((v) => !v)} />}
      />

      <View>
        {showGen ? (
          <View>
            <Card style={{ gap: 16, paddingVertical: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Sparkle size={18} color={t.primary} />
                  <Text style={[type.heading, { fontSize: 14, color: t.ink }]}>Generator</Text>
                </View>
                <TextLink label="Hide" onPress={() => setShowGen(false)} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 16, paddingRight: 10, borderRadius: 18, backgroundColor: t.bg }}>
                <View style={{ flex: 1 }}>
                  <ColoredSecret value={candidate} size={15} />
                </View>
                <IconButton
                  icon="refresh"
                  label="Generate another"
                  kind="primary"
                  shape="squircle"
                  testID="regenerate"
                  onPress={() => {
                    haptic.light();
                    regenerate(gen);
                  }}
                />
              </View>

              <View style={{ gap: 8 }} accessible accessibilityLabel={`Strength: ${s.label}, about ${s.bits} bits`}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= s.level ? meterColor : t.divider }} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: meterInk }}>{s.label}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.muted }}>≈ {s.bits} bits</Text>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={[type.rowTitle, { fontSize: 14, color: t.ink }]}>Length</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 17, color: t.primary }}>{gen.length}</Text>
                </View>
                <Slider
                  min={8}
                  max={64}
                  value={gen.length}
                  label="Password length"
                  onChange={(v) => {
                    if (v !== lastLen.current) haptic.tick();
                    lastLen.current = v;
                    setGen((g) => ({ ...g, length: v }));
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[type.caption, { fontSize: 12, color: t.muted }]}>8</Text>
                  <Text style={[type.caption, { fontSize: 12, color: t.muted }]}>64</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(
                  [
                    ['lower', 'abc', 'Lowercase'],
                    ['upper', 'ABC', 'Uppercase'],
                    ['digits', '123', 'Digits'],
                    ['symbols', '#$&', 'Symbols'],
                  ] as const
                ).map(([k, glyph, a11y]) => (
                  <PressableScale
                    key={k}
                    testID={`gen-${k}`}
                    accessibilityRole="switch"
                    accessibilityLabel={a11y}
                    accessibilityState={{ checked: gen[k] }}
                    onPress={() => toggleSet(k)}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: gen[k] ? t.primary : t.chip,
                    }}
                  >
                    <Text style={{ fontFamily: font.monoBold, fontSize: 14, color: gen[k] ? t.onPrimary : t.ink2 }}>{glyph}</Text>
                  </PressableScale>
                ))}
              </View>

              <Button
                testID="use-generated"
                label="Use this password"
                kind="soft"
                size="md"
                icon="check"
                onPress={() => {
                  set('password')(candidate);
                  haptic.success();
                }}
              />
            </Card>
          </View>
        ) : (
          <View>
            <PressableScale
              testID="show-generator"
              accessibilityRole="button"
              onPress={() => {
                haptic.tick();
                regenerate(gen);
                setShowGen(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18, backgroundColor: t.primarySoft }}
            >
              <Sparkle size={18} color={t.primarySoftInk} />
              <Text style={[type.button, { flex: 1, fontSize: 14, color: t.primarySoftInk }]}>Generate a strong password</Text>
              <Icon name="chevron" size={16} color={t.primarySoftInk} strokeWidth={2.2} />
            </PressableScale>
          </View>
        )}
      </View>

      <Field label="Website" icon="globe" value={form.url} onChangeText={set('url')} keyboardType="url" placeholder="example.com" />
      <Field label="Notes" value={form.notes} onChangeText={set('notes')} multiline autoCapitalize="sentences" placeholder="Security questions, PINs, anything" />

      <View style={{ paddingTop: 8 }}>
        <Button
          testID="save-entry"
          label="Save to vault"
          icon="check"
          onPress={() => void save()}
          busy={busy}
          disabled={!form.title.trim() && !form.username && !form.password}
        />
      </View>
    </Screen>
  );
}
