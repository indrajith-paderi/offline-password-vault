import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Vault } from '../../vault/vault';
import { formatDuration, nextFrame } from '../AppContext';
import { PinPad } from '../components/PinPad';
import { H1, Notice, P, Screen } from '../components/ui';
import { useTheme } from '../theme';

const BIO_PROMPT = 'Unlock your vault';

export function LockScreen({ vault, blocked, warnings }: { vault: Vault; blocked: string | null; warnings: string[] }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lockedForMs, setLockedForMs] = useState(0);
  const [bio, setBio] = useState(false);
  const [reset, setReset] = useState(0);

  const refresh = useCallback(async () => {
    const s = await vault.lockoutStatus();
    setLockedForMs(s.lockedForMs);
  }, [vault]);

  const tryBio = useCallback(async () => {
    if (blocked) return;
    setBusy(true);
    try {
      await vault.unlockWithBiometrics(BIO_PROMPT);
    } finally {
      setBusy(false);
    }
  }, [vault, blocked]);

  useEffect(() => {
    void refresh();
    void vault.canUseBiometrics().then((ok) => {
      setBio(ok);
      if (ok) void tryBio();
    });
  }, [vault, refresh, tryBio]);

  // Tick the lockout countdown.
  useEffect(() => {
    if (lockedForMs <= 0) return;
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [lockedForMs, refresh]);

  const submit = async (pin: string) => {
    setBusy(true);
    setMessage(null);
    await nextFrame();
    try {
      const r = await vault.unlockWithPin(pin);
      if (r.ok) return;
      setLockedForMs(r.lockedForMs);
      if (r.reason === 'wrong-pin' && r.attemptsLeft > 0) {
        setMessage(`Wrong PIN. ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left before a 1-hour lock.`);
      }
      // Small extra delay on failure, on top of Argon2id.
      await new Promise((res) => setTimeout(res, 800));
    } finally {
      setBusy(false);
      setReset((n) => n + 1);
    }
  };

  const forgot = () =>
    Alert.alert(
      'Forgot your PIN?',
      "There's no way to recover it. You can erase this vault and start over, then restore from a backup file if you have one.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase vault…',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Erase everything?', 'All passwords on this phone will be permanently destroyed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => void vault.destroy() },
            ]),
        },
      ],
    );

  const locked = lockedForMs > 0;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 16 }}>
        <H1>Vault locked</H1>
        <P muted>{locked ? 'Too many wrong PINs.' : 'Enter your 4-digit PIN'}</P>
      </View>
      {blocked && <Notice text={`${blocked} Unlocking is disabled.`} />}
      {warnings.map((w) => (
        <Notice key={w} text={w} />
      ))}
      {locked && <Notice text={`Try again in about ${formatDuration(lockedForMs)}.`} />}
      {message && <Notice text={message} />}
      {busy && <ActivityIndicator style={{ marginVertical: 8 }} />}
      <PinPad
        onComplete={submit}
        disabled={busy || locked || !!blocked}
        resetSignal={reset}
        extraKey={bio && !blocked ? { label: '☝', onPress: () => void tryBio() } : undefined}
      />
      <Pressable onPress={forgot} style={{ alignSelf: 'center', marginTop: 20 }} accessibilityRole="button">
        <Text style={{ color: t.primary }}>Forgot PIN?</Text>
      </Pressable>
    </Screen>
  );
}
