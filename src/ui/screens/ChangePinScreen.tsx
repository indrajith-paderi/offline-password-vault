import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { formatDuration, nextFrame, useApp } from '../AppContext';
import { PinPad } from '../components/PinPad';
import { Notice, P, Screen } from '../components/ui';

type Step = 'current' | 'new1' | 'new2';

export function ChangePinScreen() {
  const { vault, back } = useApp();
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const prompt = {
    current: 'Enter your current PIN.',
    new1: 'Choose a new 4-digit PIN.',
    new2: 'Enter the new PIN again.',
  }[step];

  const onPin = async (pin: string) => {
    setMsg(null);
    if (step === 'current') {
      setCurrent(pin);
      setStep('new1');
      return;
    }
    if (step === 'new1') {
      setNext(pin);
      setStep('new2');
      return;
    }
    if (pin !== next) {
      setMsg("New PINs didn't match.");
      setStep('new1');
      return;
    }
    setBusy(true);
    await nextFrame();
    try {
      const r = await vault.changePin(current, next);
      if (r.ok) {
        back();
        return;
      }
      setMsg(
        r.reason === 'locked' || r.lockedForMs > 0
          ? `Too many wrong PINs. Try again in ${formatDuration(r.lockedForMs)}.`
          : `Current PIN was wrong. ${r.attemptsLeft} attempt(s) left.`,
      );
      setStep('current');
    } finally {
      setCurrent('');
      setBusy(false);
    }
  };

  return (
    <Screen title="Change PIN" onBack={back}>
      <P>{prompt}</P>
      {msg && <Notice text={msg} />}
      {busy && <ActivityIndicator />}
      <PinPad onComplete={(p) => void onPin(p)} disabled={busy} resetSignal={step.length} />
      <P muted>Your passwords are not re-encrypted; only the key that unlocks them is re-wrapped.</P>
    </Screen>
  );
}
