import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import SecureNative, { DeviceKeyLevel } from '../../../modules/secure-native';
import { AUTO_LOCK_OPTIONS } from '../../security/autoLock';
import { useApp } from '../AppContext';
import { Button, Card, Notice, P, Screen } from '../components/ui';
import { useTheme } from '../theme';

const LEVEL_LABEL: Record<DeviceKeyLevel, string> = {
  strongbox: 'StrongBox secure chip',
  tee: 'Trusted Execution Environment',
  secure_enclave: 'Secure Enclave',
  keychain: 'Keychain (no Secure Enclave)',
  software: 'Software only (weak)',
};

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

  const erase = () =>
    Alert.alert(
      'Erase vault?',
      'Every password on this phone will be permanently destroyed. Backup files you saved elsewhere are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => void vault.destroy() },
      ],
    );

  return (
    <Screen title="Settings" onBack={back}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.text, fontSize: 16 }}>Biometric unlock</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              Fingerprint / Face. Your PIN is still required every 72 hours and after new biometrics are enrolled.
            </Text>
          </View>
          <Switch value={bio} onValueChange={(v) => void toggleBio(v)} />
        </View>
      </Card>

      <Card>
        <Text style={{ color: t.text, fontSize: 16 }}>Auto-lock after inactivity</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {AUTO_LOCK_OPTIONS.map((ms) => {
            const active = settings.autoLockMs === ms;
            return (
              <Pressable
                key={ms}
                onPress={() => {
                  const next = { ...settings, autoLockMs: ms };
                  setSettings(next);
                  void vault.saveSettings(next);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? t.primary : t.border,
                  backgroundColor: active ? t.primary : 'transparent',
                }}
              >
                <Text style={{ color: active ? t.primaryText : t.text }}>
                  {ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000} min`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: t.muted, fontSize: 13 }}>The vault always locks immediately when you leave the app.</Text>
      </Card>

      <Button label="Change PIN" kind="secondary" onPress={() => go({ name: 'changePin' })} />
      <Button label="Export encrypted backup" kind="secondary" onPress={() => go({ name: 'export' })} />
      <Button label="Restore from backup" kind="secondary" onPress={() => go({ name: 'restore' })} />

      <Card>
        <Text style={{ color: t.text, fontSize: 16 }}>Security</Text>
        <P muted>
          Records: AES-256-GCM. PIN: Argon2id + hardware-bound key{level ? ` (${LEVEL_LABEL[level]})` : ''}.
          No internet permission. Nothing leaves this phone unless you export a backup.
        </P>
        {level === 'software' && (
          <Notice text="This phone has no secure hardware for keys. A 4-digit PIN offers weak protection if someone copies the app's files." />
        )}
      </Card>

      <Button label="Open source licenses" kind="secondary" onPress={() => go({ name: 'licenses' })} />
      <Button label="Erase vault" kind="danger" onPress={erase} />
    </Screen>
  );
}
