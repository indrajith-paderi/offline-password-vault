import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Vault } from '../../vault/vault';
import { formatDuration, nextFrame } from '../AppContext';
import { Icon } from '../components/Icon';
import { PinPad } from '../components/PinPad';
import { AppMark, H1, Notice, P, Pill, TextLink } from '../components/ui';
import { haptic } from '../haptics';
import { font, gutter, useTheme } from '../theme';

const BIO_PROMPT = 'Unlock your vault';
const LOCKOUT_WINDOW_MS = 60 * 60 * 1000;

export function LockScreen({ vault, blocked, warnings }: { vault: Vault; blocked: string | null; warnings: string[] }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lockedForMs, setLockedForMs] = useState(0);
  const [bio, setBio] = useState(false);
  const [reset, setReset] = useState(0);
  const [shake, setShake] = useState(0);

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
    void vault.lockoutStatus().then((s) => setLockedForMs(s.lockedForMs));
    void vault.canUseBiometrics().then((ok) => {
      setBio(ok);
      if (ok) void tryBio();
    });
  }, [vault, tryBio]);

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
      if (r.ok) {
        haptic.success();
        return;
      }
      setShake((n) => n + 1);
      setLockedForMs(r.lockedForMs);
      if (r.reason === 'wrong-pin' && r.attemptsLeft > 0) {
        setMessage(`Wrong PIN · ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left`);
      }
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
          onPress: () => {
            haptic.warning();
            Alert.alert('Erase everything?', 'All passwords on this phone will be permanently destroyed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => void vault.destroy() },
            ]);
          },
        },
      ],
    );

  const locked = lockedForMs > 0;

  return (
    <SafeAreaView testID="lock-screen" style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: gutter, paddingTop: 40, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {locked ? (
          <Animated.View key="locked" entering={FadeIn.duration(150)} style={{ alignItems: 'center' }}>
            <LockoutRing fraction={Math.min(1, lockedForMs / LOCKOUT_WINDOW_MS)} />
            <View style={{ height: 22 }} />
            <H1 center>Too many wrong PINs.</H1>
            <P muted center style={{ marginTop: 6 }}>
              Try again in about <Text style={{ fontFamily: font.bold, color: t.ink }}>{formatDuration(lockedForMs)}</Text>.
            </P>
            <View style={{ marginTop: 22 }}>
              <Pill kind="neutral" icon="clock" text="Closing the app won't reset the timer." />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="open" style={{ alignItems: 'center' }}>
            <AppMark size={80} />
            <View style={{ height: 6 }} />
            <H1 center>Keystill</H1>
            <P muted center style={{ marginTop: 4 }}>
              Enter your PIN
            </P>
          </Animated.View>
        )}

        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
          {blocked && <Notice kind="error" text={`${blocked} Unlocking is disabled.`} />}
          {warnings.map((w) => (
            <Notice key={w} text={w} />
          ))}
        </View>

        <View style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          {message ? (
            <Animated.View key={message}>
              <Pill kind="error" icon="info" text={message} />
            </Animated.View>
          ) : busy && !locked ? (
            <Animated.View entering={FadeIn.delay(250)}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.muted }}>Checking…</Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end', alignSelf: 'stretch', alignItems: 'center' }}>
          <PinPad
            onComplete={submit}
            disabled={busy || locked || !!blocked}
            resetSignal={reset}
            errorSignal={shake}
            extraKey={bio && !blocked && !locked ? { label: 'bio', onPress: () => void tryBio() } : undefined}
          />
          <View style={{ height: 14 }} />
          <TextLink testID="forgot-pin" label="Forgot PIN?" onPress={forgot} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LockoutRing({ fraction }: { fraction: number }) {
  const t = useTheme();
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={120} height={120} viewBox="0 0 120 120" style={{ position: 'absolute' }}>
        <Circle cx={60} cy={60} r={r} fill={t.butterSoft} />
        <Circle cx={60} cy={60} r={r} fill="none" stroke={t.butterTrack} strokeWidth={6} />
        <Circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke={t.butterRing}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform="rotate(-90 60 60)"
        />
      </Svg>
      <Icon name="lockKeyhole" size={44} color={t.butterIcon} strokeWidth={1.9} />
    </View>
  );
}
