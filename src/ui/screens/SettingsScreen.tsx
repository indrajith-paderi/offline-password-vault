import Constants from 'expo-constants';
import React, { ReactNode, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import SecureNative, { DeviceKeyLevel } from '../../../modules/secure-native';
import { AUTO_LOCK_OPTIONS } from '../../security/autoLock';
import { useApp } from '../AppContext';
import { Icon } from '../components/Icon';
import { Button, Card, IconTile, ListRow, Notice, Overline, Screen, Segmented, Toggle } from '../components/ui';
import { haptic } from '../haptics';
import { font, type, useTheme } from '../theme';

const lockLabel = (ms: number) => (ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000}m`);
const lockA11y = (ms: number) => (ms < 60_000 ? `${ms / 1000} seconds` : `${ms / 60_000} minute${ms === 60_000 ? '' : 's'}`);

export function SettingsScreen() {
  const { vault, go, back, settings, setSettings } = useApp();
  const t = useTheme();
  const [bio, setBio] = useState(false);
  const [level, setLevel] = useState<DeviceKeyLevel | null>(null);

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

  const heroBg = t.dark ? t.primarySoft : '#1B1838';

  return (
    <Screen testID="settings-screen" onBack={back} largeTitle="Settings">
      <Animated.View entering={FadeInDown.duration(320)}>
        <View
          style={{
            borderRadius: 24,
            padding: 18,
            backgroundColor: heroBg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            boxShadow: t.dark ? undefined : '0px 18px 36px -18px rgba(27,24,56,0.6)',
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#1F9D74', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shieldCheck" size={22} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: '#F2F0FF' }}>Vault protected</Text>
            <Text style={[type.caption, { fontFamily: font.medium, color: '#C3BFE6' }]}>
              All data remains stored locally on your device. Export only when you choose.
            </Text>
          </View>
        </View>
      </Animated.View>

      {level === 'software' && (
        <Notice text="This phone has no secure hardware for keys. A 4-digit PIN offers weak protection if someone copies the app's files." />
      )}

      <Section title="Unlocking" delay={40}>
        <ListRow
          title="Biometric unlock"
          subtitle="PIN required every 72 hours or when fingerprints change"
          leading={<IconTile icon="fingerprint" bg={t.primarySoft} fg={t.primarySoftInk} />}
          trailing={<Toggle value={bio} onChange={(v) => void toggleBio(v)} label="Biometric unlock" testID="toggle-biometrics" />}
        />
        <Sep />
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconTile icon="clock" bg={t.tiles[1].bg} fg={t.tiles[1].fg} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.rowTitle, { color: t.ink }]}>Auto-lock when idle</Text>
              <Text style={[type.secondary, { color: t.muted }]}>Always locks instantly when you leave the app.</Text>
            </View>
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

      <Section title="Backup" delay={80}>
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

      <Section title="About" delay={120}>
        <ListRow
          testID="open-licenses"
          title="Acknowledgements"
          leading={<IconTile icon="book" bg={t.chip} fg={t.ink2} />}
          onPress={() => go({ name: 'licenses' })}
        />
      </Section>

      <View style={{ marginTop: 8, gap: 10 }}>
        <Button testID="erase-vault" label="Erase vault" kind="danger" icon="trash" size="md" onPress={erase} />
        <Text style={[type.caption, { fontSize: 12, color: t.muted, textAlign: 'center' }]}>
          Keystill {Constants.expoConfig?.version ?? ''}
        </Text>
      </View>
    </Screen>
  );
}

function Section({ title, children, delay }: { title: string; children: ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(320)} style={{ gap: 10, marginTop: 6 }}>
      <Overline style={{ paddingLeft: 4 }}>{title}</Overline>
      <Card padded={false}>{children}</Card>
    </Animated.View>
  );
}

function Sep() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.divider, marginLeft: 68 }} />;
}
