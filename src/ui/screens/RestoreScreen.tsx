import React, { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
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
import { PinPad } from '../components/PinPad';
import { Button, Card, Field, Notice, P, Screen } from '../components/ui';

type Mode = 'new-device' | 'existing';

/** Wrapper used from Settings, where the vault is already unlocked. */
export function RestoreScreen() {
  const { vault, back } = useApp();
  return <RestoreFlow mode="existing" vault={vault} onDone={back} onCancel={back} />;
}

/**
 * pick file -> show date/version -> backup password -> fully decrypt + validate
 *   -> new device: choose a PIN, create vault (fresh hardware key), import
 *   -> existing:   confirm replace or merge
 * The live vault is untouched until the very last step.
 */
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
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; info: BackupInfo } | null>(null);
  const [pw, setPw] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pin1, setPin1] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setError(null);
    try {
      const f = await pickBackupFile();
      if (!f) return;
      setFile({ ...f, info: readBackupInfo(f.bytes) });
    } catch (e) {
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
    } catch (e) {
      setError(
        e instanceof WrongBackupPasswordError || e instanceof BackupFormatError
          ? e.message
          : 'Could not open the backup.',
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
        // Brand-new hardware key and vault key on this phone; nothing reused from the old one.
        await vault.create(pin!, entries);
      } else {
        await vault.importEntries(entries, how);
      }
      if (file) wipe(file.bytes);
      setEntries(null);
      setFile(null);
      Alert.alert('Restored', `${count} entr${count === 1 ? 'y' : 'ies'} restored.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const confirmExisting = (how: 'replace' | 'merge') =>
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

  if (busy) {
    return (
      <Screen title="Restore" scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" />
          <P muted>Working… this takes a few seconds on purpose.</P>
        </View>
      </Screen>
    );
  }

  // Step 4 (new device): choose a PIN for this phone.
  if (entries && mode === 'new-device') {
    return (
      <Screen title="Set a PIN for this phone" onBack={() => setPin1(null)}>
        <P>
          Backup verified: {entries.length} entries. {pin1 ? 'Enter the PIN again.' : 'Choose a 4-digit PIN for this phone.'}
        </P>
        {error && <Notice text={error} />}
        <PinPad
          resetSignal={pin1 ? 1 : 0}
          onComplete={(p) => {
            if (!pin1) return setPin1(p);
            if (p !== pin1) {
              setPin1(null);
              setError("PINs didn't match.");
              return;
            }
            void finish('replace', p);
          }}
        />
      </Screen>
    );
  }

  // Step 4 (existing vault): replace or merge.
  if (entries) {
    return (
      <Screen title="Restore" onBack={onCancel}>
        <Notice kind="info" text={`Backup verified: ${entries.length} entries.`} />
        <Button label="Merge into current vault" onPress={() => confirmExisting('merge')} />
        <Button label="Replace current vault" kind="danger" onPress={() => confirmExisting('replace')} />
      </Screen>
    );
  }

  return (
    <Screen title="Restore from backup" onBack={onCancel}>
      <P muted>
        Choose a vault_backup….enc file from this phone, an SD card or a USB-OTG drive. Nothing is changed until the
        backup has been fully decrypted and checked.
      </P>
      {error && <Notice text={error} />}
      {!file ? (
        <Button label="Choose backup file" onPress={() => void pick()} />
      ) : (
        <>
          <Card>
            <P>{file.name}</P>
            <P muted>Created {new Date(file.info.createdAt).toLocaleString()}</P>
            <P muted>
              Format v{file.info.version} · app {file.info.appVersion}
            </P>
          </Card>
          <Field label="Backup password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="off" textContentType="none" />
          <Button label="Verify and decrypt" onPress={() => void decrypt()} disabled={!pw} />
          <Button label="Choose a different file" kind="secondary" onPress={() => setFile(null)} />
        </>
      )}
    </Screen>
  );
}
