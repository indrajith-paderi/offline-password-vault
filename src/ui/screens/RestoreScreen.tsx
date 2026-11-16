import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { pickBackupFile } from '../../backup/backupFiles';
import {
  BackupFormatError,
  BackupInfo,
  openBackup,
  readBackupInfo,
  WrongBackupPasswordError,
} from '../../backup/format';
import { wipe } from '../../crypto/bytes';
import type { Entry } from '../../vault/types';
import type { Vault } from '../../vault/vault';
import { nextFrame, useApp } from '../AppContext';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Notice, PressableScale, Screen } from '../components/ui';
import { haptic } from '../haptics';
import { font, type, useTheme } from '../theme';
import { PinStep, Working } from './SetupScreen';

type Mode = 'new-device' | 'existing';

export function RestoreScreen() {
  const { vault, back } = useApp();
  return <RestoreFlow mode="existing" vault={vault} onDone={back} onCancel={back} />;
}

export function RestoreFlow({
  mode,
  vault,
  onDone,
  onCancel,
}: {
  mode: Mode;
  vault: Vault;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; info: BackupInfo } | null>(null);
  const [pw, setPw] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pin1, setPin1] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const pick = async () => {
    setError(null);
    try {
      const f = await pickBackupFile();
      if (!f) return;
      setFile({ ...f, info: readBackupInfo(f.bytes) });
      haptic.light();
    } catch (e) {
      haptic.error();
      setError(e instanceof BackupFormatError ? e.message : 'Could not read that file.');
    }
  };

  const decrypt = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    await nextFrame();
    try {
      const res = openBackup(file.bytes, pw);
      setEntries(res.entries);
      setPw('');
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(
        e instanceof WrongBackupPasswordError || e instanceof BackupFormatError ? e.message : 'Could not open the backup.',
      );
    } finally {
      setBusy(false);
    }
  };

  const finish = async (how: 'replace' | 'merge', pin?: string) => {
    if (!entries) return;
    setBusy(true);
    await nextFrame();
    try {
      const count = entries.length;
      if (mode === 'new-device') {
        await vault.create(pin!, entries);
      } else {
        await vault.importEntries(entries, how);
      }
      if (file) wipe(file.bytes);
      setEntries(null);
      setFile(null);
      haptic.success();
      Alert.alert('Restored', `${count} entr${count === 1 ? 'y' : 'ies'} restored.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const confirmExisting = (how: 'replace' | 'merge') => {
    haptic.warning();
    Alert.alert(
      how === 'replace' ? 'Replace your vault?' : 'Merge into your vault?',
      how === 'replace'
        ? 'Everything currently in this vault will be removed and replaced by the backup.'
        : 'Backup entries will be added. Entries with the same id are overwritten by the backup copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: how === 'replace' ? 'Replace' : 'Merge', style: 'destructive', onPress: () => void finish(how) },
      ],
    );
  };

  if (busy) return <Working label="Working… this may take a few seconds" />;

  if (entries && mode === 'new-device') {
    return (
      <PinStep
        title={pin1 ? 'Enter the PIN again' : 'Set a PIN for this phone'}
        subtitle={`Backup verified: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`}
        error={error}
        errorSignal={shake}
        resetSignal={pin1 ? 1 : 0}
        onBack={() => setPin1(null)}
        onComplete={(p) => {
          if (!pin1) {
            setError(null);
            setPin1(p);
            return;
          }
          if (p !== pin1) {
            setPin1(null);
            setError("PINs didn't match.");
            setShake((n) => n + 1);
            return;
          }
          void finish('replace', p);
        }}
      />
    );
  }

  const stage = entries ? 3 : file ? 2 : 1;

  return (
    <Screen testID="restore-screen" title="Restore" onBack={onCancel}>
      <Stepper stage={stage} />

      {error && (
        <Animated.View entering={FadeInDown.springify().damping(14)}>
          <Notice kind="error" text={error} />
        </Animated.View>
      )}

      {entries ? (
        <Animated.View key="import" entering={FadeInDown.duration(300)} style={{ gap: 14, flex: 1 }}>
          <Notice kind="success" text={`Backup verified: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`} />
          <View style={{ marginTop: 'auto', gap: 12, paddingTop: 12 }}>
            <Button testID="restore-merge" label="Merge into current vault" onPress={() => confirmExisting('merge')} />
            <Button testID="restore-replace" label="Replace current vault" kind="danger" onPress={() => confirmExisting('replace')} />
          </View>
        </Animated.View>
      ) : !file ? (
        <Animated.View key="pick" entering={FadeInDown.duration(300)} style={{ gap: 14, flex: 1 }}>
          <PressableScale
            testID="choose-backup"
            accessibilityRole="button"
            accessibilityLabel="Choose backup file"
            onPress={() => void pick()}
            pressedScale={0.98}
            style={{
              alignItems: 'center',
              gap: 12,
              paddingVertical: 32,
              paddingHorizontal: 24,
              borderRadius: 24,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: t.primaryRing,
              backgroundColor: t.surface,
            }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="file" size={28} color={t.primarySoftInk} />
            </View>
            <Text style={[type.heading, { color: t.ink }]}>Choose backup file</Text>
            <Text style={[type.secondary, { color: t.ink2, textAlign: 'center', lineHeight: 20 }]}>
              A vault_backup….enc file from this phone, an SD card or a USB-OTG drive.
            </Text>
          </PressableScale>
          <Notice kind="info" text="Your vault remains unchanged until the backup is fully decrypted and verified. This may take a few seconds" />
        </Animated.View>
      ) : (
        <Animated.View key="unlock" entering={FadeInDown.duration(300)} style={{ gap: 14, flex: 1 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 48, height: 56, borderRadius: 12, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="file" size={22} color={t.primarySoftInk} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.monoBold, fontSize: 13, color: t.ink }}>
                {file.name}
              </Text>
              <Text style={[type.caption, { fontFamily: font.medium, color: t.muted }]}>Created {new Date(file.info.createdAt).toLocaleString()}</Text>
              <Text style={[type.caption, { fontSize: 12, color: t.muted }]}>
                Format v{file.info.version} · app {file.info.appVersion}
              </Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Choose a different file"
              onPress={() => setFile(null)}
              pressedScale={0.94}
              style={{ height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.chip, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.primarySoftInk }}>Change</Text>
            </PressableScale>
          </Card>
          <Field
            testID="restore-password"
            label="Backup password"
            icon="key"
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            autoComplete="off"
            textContentType="none"
          />
          <Notice kind="info" text="Your vault remains unchanged until the backup is fully decrypted and verified. This may take a few seconds" />
          <View style={{ marginTop: 'auto', paddingTop: 12 }}>
            <Button testID="restore-decrypt" label="Verify and decrypt" onPress={() => void decrypt()} disabled={!pw} />
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

function Stepper({ stage }: { stage: number }) {
  const t = useTheme();
  const steps = ['File', 'Unlock', 'Import'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 4 }} accessibilityLabel={`Step ${stage} of 3: ${steps[stage - 1]}`}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < stage;
        const current = n === stage;
        return (
          <React.Fragment key={label}>
            {i > 0 && <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: done || current ? t.primaryRing : t.line }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? t.mint : current ? t.primary : t.sunken,
                }}
              >
                {done ? (
                  <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: current ? t.onPrimary : t.muted }}>{n}</Text>
                )}
              </View>
              <Text style={{ fontFamily: current ? font.extrabold : font.bold, fontSize: 13, color: done ? t.mintInk : current ? t.primarySoftInk : t.muted }}>
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}
