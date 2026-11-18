import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Vault } from '../../vault/vault';
import { nextFrame } from '../AppContext';
import { Icon, IconName } from '../components/Icon';
import { PinPad } from '../components/PinPad';
import { AppMark, Button, H1, IconButton, Notice, P, Pill } from '../components/ui';
import { haptic } from '../haptics';
import { font, gutter, type, useTheme } from '../theme';
import { RestoreFlow } from './RestoreScreen';

type Step = 'welcome' | 'pin1' | 'pin2' | 'restore' | 'working';

export function SetupScreen({ vault }: { vault: Vault }) {
  const [step, setStep] = useState<Step>('welcome');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  if (step === 'restore') {
    return <RestoreFlow mode="new-device" vault={vault} onDone={() => undefined} onCancel={() => setStep('welcome')} />;
  }
  if (step === 'working') return <Working label="Generating keys…" />;
  if (step === 'pin1' || step === 'pin2') {
    return (
      <PinStep
        step={step === 'pin1' ? 1 : 2}
        title={step === 'pin1' ? 'Choose a 4 digit PIN' : 'Enter it again to confirm'}
        subtitle={step === 'pin1' ? "You'll type it every time you open Keystill" : 'Just making sure it sticks.'}
        error={error}
        errorSignal={shake}
        onBack={() => {
          setError(null);
          setStep('welcome');
        }}
        onComplete={async (pin) => {
          if (step === 'pin1') {
            setFirst(pin);
            setError(null);
            setStep('pin2');
            return;
          }
          if (pin !== first) {
            setError("PINs didn't match. Start again.");
            setShake((n) => n + 1);
            setFirst('');
            setStep('pin1');
            return;
          }
          haptic.success();
          setStep('working');
          await nextFrame();
          await vault.create(pin);
        }}
      />
    );
  }
  return <Welcome onCreate={() => setStep('pin1')} onRestore={() => setStep('restore')} />;
}

function Welcome({ onCreate, onRestore }: { onCreate: () => void; onRestore: () => void }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 300, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', width: 264, height: 264, borderRadius: 132, backgroundColor: t.chip }} />
          <Animated.View style={{ position: 'absolute', width: 192, height: 192, borderRadius: 96, backgroundColor: t.primarySoft }} />
          <Animated.View>
            <AppMark size={108} />
          </Animated.View>
          <Badge icon="shieldCheck" label="Encrypted" tone="mint" style={{ left: 4, top: 64 }} rotate={-6} delay={320} />
          <Badge icon="wifiOff" label="No internet" tone="peach" style={{ right: 0, top: 104 }} rotate={5} delay={420} />
          <Badge icon="phone" label="Your device" tone="sky" style={{ left: 40, bottom: 34 }} rotate={3} delay={520} />
        </View>

        <Animated.View style={{ gap: 12, marginTop: 8 }}>
          <Text style={[type.overline, { fontSize: 13, color: t.primary }]}>Keystill</Text>
          <Text style={{ fontFamily: font.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, color: t.ink }}>
            Your passwords.{'\n'}Only on this phone.
          </Text>
          <P muted style={{ fontSize: 15, lineHeight: 22 }}>
            Fully encrypted. No accounts, no internet access.
          </P>
        </Animated.View>

        <Animated.View style={{ marginTop: 20 }}>
          <Notice text="No recovery without a backup. Lose your PIN, and your data is gone." />
        </Animated.View>
      </ScrollView>

      {/* Pinned below the scroll area so the main actions are on screen even on small phones. */}
      <View style={{ gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}>
        <Button testID="create-vault" label="Create a new vault" onPress={onCreate} />
        <Button testID="restore-vault" label="Restore from a backup" kind="soft" onPress={onRestore} />
      </View>
    </SafeAreaView>
  );
}

function Badge({
  icon,
  label,
  tone,
  style,
  rotate,
  delay,
}: {
  icon: IconName;
  label: string;
  tone: 'mint' | 'peach' | 'sky';
  style: object;
  rotate: number;
  delay: number;
}) {
  const t = useTheme();
  const c = { mint: t.tiles[2], peach: t.tiles[1], sky: t.tiles[3] }[tone];
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingLeft: 8,
          paddingRight: 12,
          borderRadius: 16,
          backgroundColor: t.surface,
          boxShadow: t.shadowRaised,
          transform: [{ rotate: `${rotate}deg` }],
        },
        style,
      ]}
    >
      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={c.fg} strokeWidth={2.2} />
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.ink }}>{label}</Text>
    </Animated.View>
  );
}

/** Shared full-screen PIN entry step: progress, title, dots and keypad. */
export function PinStep({
  step,
  total = 2,
  title,
  subtitle,
  error,
  errorSignal,
  onBack,
  onComplete,
  disabled,
  resetSignal,
  testID,
}: {
  step?: number;
  total?: number;
  title: string;
  subtitle?: string;
  error?: string | null;
  errorSignal?: number;
  onBack: () => void;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  resetSignal?: number;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, paddingHorizontal: gutter, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
          <IconButton icon="back" label="Back" onPress={onBack} />
          {step ? (
            <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of ${total}`}>
              {Array.from({ length: total }, (_, i) => (
                <View key={i} style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: i < step ? t.primary : t.dotOff }} />
              ))}
            </View>
          ) : null}
          <View style={{ width: 44 }} />
        </View>

        <Animated.View key={title} style={{ alignItems: 'center', gap: 10, marginTop: 40 }}>
          {step ? (
            <Text style={[type.overline, { fontSize: 12, color: t.primary }]}>
              Step {step} of {total}
            </Text>
          ) : null}
          <H1 center>{title}</H1>
          {subtitle ? (
            <P muted center style={{ maxWidth: 290 }}>
              {subtitle}
            </P>
          ) : null}
        </Animated.View>

        <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          {error ? <Pill kind="error" icon="info" text={error} /> : null}
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 16 }}>
          <PinPad onComplete={onComplete} errorSignal={errorSignal} disabled={disabled} resetSignal={resetSignal} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function Working({ label }: { label: string }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <AppMark size={80} />
      <Text style={[type.heading, { color: t.ink2 }]} accessibilityLiveRegion="polite">
        {label}
      </Text>
    </SafeAreaView>
  );
}
