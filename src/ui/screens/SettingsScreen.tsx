import React, { ReactNode, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import SecureNative, { DeviceKeyLevel } from '../../../modules/secure-native';
import { AUTO_LOCK_OPTIONS } from '../../security/autoLock';
import { useApp } from '../AppContext';
import { Button, Card, IconTile, ListRow, Notice, Overline, Screen, Segmented, Toggle } from '../components/ui';
import { haptic } from '../haptics';
import { type, useTheme } from '../theme';
import { getThemePref, setThemePref, ThemePref } from '../themePref';

const lockLabel = (ms: number) => (ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000}m`);
const lockA11y = (ms: number) => (ms < 60_000 ? `${ms / 1000} seconds` : `${ms / 60_000} minute${ms === 60_000 ? '' : 's'}`);

export function SettingsScreen() {
  const { vault, go, back, settings, setSettings } = useApp();
  const t = useTheme();
  const [bio, setBio] = useState(false);
  const [level, setLevel] = useState<DeviceKeyLevel | null>(null);
  const [themePref, setThemePrefState] = useState<ThemePref>(getThemePref);

  useEffect(() => {
    void vault.biometricsEnabled().then(setBio);
    void SecureNative.deviceKeySecurityLevel().then(setLevel).catch(() => setLevel(null));
  }, [vault]);

  const toggleBio = async (on: boolean) => {
    try {
      if (on) await vault.enableBiometrics('Confirm to enable biometric unlock');
      else await vault.disableBiometrics();
      setBio(on);
    } catch (e) {
      Alert.alert('Biometrics', e instanceof Error ? e.message : 'Could not change biometric setting');
    }
  };

  const erase = () => {
    haptic.warning();
    Alert.alert(
      'Erase vault?',
      'Every password on this phone will be permanently destroyed. Backup files you saved elsewhere are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => void vault.destroy() },
      ],
    );
  };

  return (
    <Screen testID="settings-screen" onBack={back} title="Settings">
      {level === 'software' && (
        <Notice text="This phone has no secure hardware for keys. A 4-digit PIN offers weak protection if someone copies the app's files." />
      )}

      <Section title="Appearance">
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconTile icon="contrast" bg={t.chip} fg={t.primarySoftInk} />
            <Text style={[type.rowTitle, { flex: 1, color: t.ink }]}>Theme</Text>
          </View>
          <View style={{ marginLeft: 52 }}>
            <Segmented
              testIDPrefix="theme-"
              value={themePref}
              options={[
                { value: 'system' as ThemePref, label: 'System' },
                { value: 'light' as ThemePref, label: 'Light' },
                { value: 'dark' as ThemePref, label: 'Dark' },
              ]}
              onChange={(p) => {
                setThemePrefState(p);
                void setThemePref(p);
              }}
            />
          </View>
        </View>
      </Section>

      <Section title="Unlocking">
        <ListRow
          title="Biometric unlock"
          leading={<IconTile icon="fingerprint" bg={t.primarySoft} fg={t.primarySoftInk} />}
          trailing={<Toggle value={bio} onChange={(v) => void toggleBio(v)} label="Biometric unlock" testID="toggle-biometrics" />}
        />
        <Sep />
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconTile icon="clock" bg={t.tiles[1].bg} fg={t.tiles[1].fg} />
            <Text style={[type.rowTitle, { flex: 1, color: t.ink }]}>Auto-lock when idle</Text>
          </View>
          <View style={{ marginLeft: 52 }}>
            <Segmented
              testIDPrefix="autolock-"
              value={settings.autoLockMs}
              options={AUTO_LOCK_OPTIONS.map((ms) => ({ value: ms as number, label: lockLabel(ms), a11y: `Lock after ${lockA11y(ms)}` }))}
              onChange={(ms) => {
                const next = { ...settings, autoLockMs: ms };
                setSettings(next);
                void vault.saveSettings(next);
              }}
            />
          </View>
        </View>
        <Sep />
        <ListRow
          testID="open-change-pin"
          title="Change PIN"
          leading={<IconTile icon="pin" bg={t.tiles[3].bg} fg={t.tiles[3].fg} />}
          onPress={() => go({ name: 'changePin' })}
        />
      </Section>

      <Section title="Backup">
        <ListRow
          testID="open-export"
          title="Backup"
          leading={<IconTile icon="download" bg={t.tiles[2].bg} fg={t.tiles[2].fg} />}
          onPress={() => go({ name: 'export' })}
        />
        <Sep />
        <ListRow
          testID="open-restore"
          title="Restore"
          leading={<IconTile icon="upload" bg={t.tiles[4].bg} fg={t.tiles[4].fg} />}
          onPress={() => go({ name: 'restore' })}
        />
      </Section>

      <Section title="About">
        <ListRow
          testID="open-about"
          title="App"
          leading={<IconTile icon="info" bg={t.primarySoft} fg={t.primarySoftInk} />}
          onPress={() => go({ name: 'about' })}
        />
        <Sep />
        <ListRow
          testID="open-licenses"
          title="Third party"
          leading={<IconTile icon="book" bg={t.chip} fg={t.ink2} />}
          onPress={() => go({ name: 'licenses' })}
        />
      </Section>

      <View style={{ marginTop: 8, gap: 10 }}>
        <Button testID="erase-vault" label="Erase vault" kind="danger" icon="trash" size="md" onPress={erase} />
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 6 }}>
      <Overline style={{ paddingLeft: 4 }}>{title}</Overline>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function Sep() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.divider, marginLeft: 68 }} />;
}
