import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Vault } from '../../vault/vault';
import { nextFrame } from '../AppContext';
import { PinPad } from '../components/PinPad';
import { Button, H1, Notice, P, Screen } from '../components/ui';
import { RestoreFlow } from './RestoreScreen';

type Step = 'welcome' | 'pin1' | 'pin2' | 'restore' | 'working';

export function SetupScreen({ vault }: { vault: Vault }) {
  const [step, setStep] = useState<Step>('welcome');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (step === 'restore') {
    return <RestoreFlow mode="new-device" vault={vault} onDone={() => undefined} onCancel={() => setStep('welcome')} />;
  }

  if (step === 'working') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" />
          <P muted>Generating keys…</P>
        </View>
      </Screen>
    );
  }

  if (step === 'pin1' || step === 'pin2') {
    return (
      <Screen title="Create PIN" onBack={() => setStep('welcome')}>
        <P>{step === 'pin1' ? 'Choose a 4-digit PIN.' : 'Enter it again to confirm.'}</P>
        {error && <Notice text={error} />}
        <PinPad
          onComplete={async (pin) => {
            if (step === 'pin1') {
              setFirst(pin);
              setError(null);
              setStep('pin2');
              return;
            }
            if (pin !== first) {
              setError("PINs didn't match. Start again.");
              setFirst('');
              setStep('pin1');
              return;
            }
            setStep('working');
            await nextFrame();
            await vault.create(pin);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Offline Vault</H1>
      <P muted>
        Your passwords stay on this phone, encrypted with AES-256-GCM. No account, no cloud, no
        internet permission.
      </P>
      <Notice text="There is no password recovery. If you forget your PIN and have no backup, your data is gone for good. That's the point." />
      <Button label="Create a new vault" onPress={() => setStep('pin1')} />
      <Button label="Restore from a backup file" kind="secondary" onPress={() => setStep('restore')} />
    </Screen>
  );
}
