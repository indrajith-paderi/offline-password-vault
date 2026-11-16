import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { saveBackupToFolder, shareBackup } from '../../backup/backupFiles';
import { backupFileName, createBackup } from '../../backup/format';
import { backupPasswordChecks, backupPasswordProblem } from '../../backup/passwordPolicy';
import { wipe } from '../../crypto/bytes';
import { nextFrame, useApp } from '../AppContext';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Notice, Screen } from '../components/ui';
import { haptic } from '../haptics';
import { font, type, useTheme } from '../theme';

export function ExportScreen() {
  const { vault, back } = useApp();
  const t = useTheme();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState<'folder' | 'share' | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const problem = pw ? backupPasswordProblem(pw) : null;
  const checks = backupPasswordChecks(pw);
  const match = pw2.length > 0 && pw === pw2;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const ready = !!pw && !problem && pw === pw2;

  const run = async (target: 'folder' | 'share') => {
    setBusy(target);
    setDone(null);
    await nextFrame();
    let file: Uint8Array | null = null;
    try {
      const entries = await vault.exportAll();
      file = createBackup(entries, pw, { appVersion: Constants.expoConfig?.version ?? '0' });
      entries.length = 0;
      const name = backupFileName();
      if (target === 'folder') {
        const uri = await saveBackupToFolder(file, name);
        if (uri) setDone(`Saved ${name}. Keep it somewhere safe and offline, and remember the backup password.`);
      } else {
        await shareBackup(file, name);
        setDone(`Sent ${name}.`);
      }
      haptic.success();
      setPw('');
      setPw2('');
    } catch (e) {
      haptic.error();
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      wipe(file);
      setBusy(null);
    }
  };

  const confirmShare = () =>
    Alert.alert(
      'Pick an offline target',
      'Use Quick Share / Nearby Share, Bluetooth or a USB transfer. The share sheet also lists email and cloud apps: avoid those. The file is encrypted either way, but keeping it off the internet is the whole idea.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void run('share') },
      ],
    );

  return (
    <Screen testID="export-screen" title="Export backup" onBack={back}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18 }}>
          <FileGlyph />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: font.monoBold, fontSize: 12, color: t.primarySoftInk }}>vault_backup_….enc</Text>
            <Text style={[type.secondary, { color: t.ink2, lineHeight: 20 }]}>Secured with a separate backup password for access on any phone</Text>
          </View>
        </Card>
      </Animated.View>

      <View style={{ gap: 10 }}>
        <Field
          testID="backup-password"
          label="Backup password"
          icon="key"
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoComplete="off"
          textContentType="none"
        />
        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          <Check ok={checks.length} active={!!pw} text="At least 12 characters" />
          <Check ok={checks.variety} active={!!pw} text="Use at least 3 character types or a minimum of 20 characters" />
          <Check ok={checks.notWeak} active={!!pw} text="No common words, not repetitive" />
        </View>
      </View>

      <Field
        testID="backup-password-repeat"
        label="Repeat it"
        value={pw2}
        onChangeText={setPw2}
        secureTextEntry
        autoComplete="off"
        textContentType="none"
        trailing={
          match ? (
            <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.mintSoft, alignItems: 'center', justifyContent: 'center', marginRight: 4 }} accessibilityLabel="Passwords match">
              <Icon name="check" size={16} color={t.mintInk} strokeWidth={2.8} />
            </Animated.View>
          ) : undefined
        }
      />
      {mismatch && (
        <Animated.View entering={FadeIn}>
          <Notice kind="error" text="Passwords don't match." />
        </Animated.View>
      )}

      <Notice text="Keep this password safe and separate from the backup file. Without it, recovery is impossible." />

      {done && (
        <Animated.View entering={FadeInDown.springify().damping(14)}>
          <Notice kind="success" text={done} />
        </Animated.View>
      )}

      <View style={{ marginTop: 'auto', gap: 12, paddingTop: 12 }}>
        <Button testID="export-folder" icon="folder" label="Save to a folder or USB drive" onPress={() => void run('folder')} disabled={!ready || !!busy} busy={busy === 'folder'} />
        <Button testID="export-share" icon="bluetooth" kind="soft" label="Send via Quick Share / Bluetooth" onPress={confirmShare} disabled={!ready || !!busy} busy={busy === 'share'} />
      </View>
    </Screen>
  );
}

function Check({ ok, active, text }: { ok: boolean; active: boolean; text: string }) {
  const t = useTheme();
  const color = !active ? t.muted : ok ? t.mintInk : t.ink2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={`${text}: ${ok ? 'met' : 'not met'}`}>
      {ok && active ? (
        <Animated.View key="ok" entering={ZoomIn.springify().damping(12)}>
          <Icon name="check" size={16} color={t.mintInk} strokeWidth={2.6} />
        </Animated.View>
      ) : (
        <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.chevron }} />
        </View>
      )}
      <Text style={[type.caption, { flex: 1, color }]}>{text}</Text>
    </View>
  );
}

function FileGlyph() {
  const t = useTheme();
  return (
    <View style={{ width: 58, height: 68 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, backgroundColor: t.primarySoft }} />
      <View style={{ position: 'absolute', right: 0, top: 0, width: 20, height: 20, borderTopRightRadius: 14, borderBottomLeftRadius: 10, backgroundColor: t.primaryRing }} />
      <View style={{ position: 'absolute', left: 14, bottom: 12, width: 30, height: 30, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={16} color={t.onPrimary} strokeWidth={2.4} />
      </View>
    </View>
  );
}
