import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { saveBackupToFolder, shareBackup } from '../../backup/backupFiles';
import { backupFileName, createBackup } from '../../backup/format';
import { backupPasswordProblem } from '../../backup/passwordPolicy';
import { wipe } from '../../crypto/bytes';
import { nextFrame, useApp } from '../AppContext';
import { Button, Field, Notice, P, Screen } from '../components/ui';

export function ExportScreen() {
  const { vault, back } = useApp();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState<'folder' | 'share' | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const problem = pw ? backupPasswordProblem(pw) : null;
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
      setPw('');
      setPw2('');
    } catch (e) {
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
    <Screen title="Export backup" onBack={back}>
      <P>
        Creates an encrypted <P muted>vault_backup_….enc</P> file you can move to a new phone. It is protected
        by a separate backup password, not your PIN, so it opens on any device.
      </P>
      <Notice text="If you lose the backup password, the backup is useless. Write it down and keep it apart from the file." />
      <Field label="Backup password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="off" textContentType="none" />
      {problem && <Notice text={problem} />}
      <Field label="Repeat backup password" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="off" textContentType="none" />
      {mismatch && <Notice text="Passwords don't match." />}
      <Button label="Save to a folder / USB drive" onPress={() => void run('folder')} disabled={!ready || !!busy} busy={busy === 'folder'} />
      <Button label="Send via Quick Share / Bluetooth" kind="secondary" onPress={confirmShare} disabled={!ready || !!busy} busy={busy === 'share'} />
      {done && <Notice kind="info" text={done} />}
    </Screen>
  );
}
