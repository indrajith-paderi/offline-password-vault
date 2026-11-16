import React, { useState } from 'react';
import { formatDuration, nextFrame, useApp } from '../AppContext';
import { haptic } from '../haptics';
import { PinStep } from './SetupScreen';

type Step = 'current' | 'new1' | 'new2';

const COPY: Record<Step, { n: number; title: string; subtitle: string }> = {
  current: { n: 1, title: 'Enter your current PIN', subtitle: 'Your passwords stay as they are. Only the key that unlocks them is re-wrapped.' },
  new1: { n: 2, title: 'Choose a new 4 digit PIN', subtitle: "You'll type it every time you open Keystill" },
  new2: { n: 3, title: 'Enter the new PIN again', subtitle: 'Just making sure it sticks.' },
};

export function ChangePinScreen() {
  const { vault, back } = useApp();
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const fail = (m: string, to: Step) => {
    setMsg(m);
    setShake((n) => n + 1);
    setStep(to);
  };

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
      fail("New PINs didn't match.", 'new1');
      return;
    }
    setBusy(true);
    await nextFrame();
    try {
      const r = await vault.changePin(current, next);
      if (r.ok) {
        haptic.success();
        back();
        return;
      }
      fail(
        r.reason === 'locked' || r.lockedForMs > 0
          ? `Too many wrong PINs. Try again in ${formatDuration(r.lockedForMs)}.`
          : `Current PIN was wrong · ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left`,
        'current',
      );
    } finally {
      setCurrent('');
      setBusy(false);
    }
  };

  const c = COPY[step];
  return (
    <PinStep
      testID="change-pin-screen"
      step={c.n}
      total={3}
      title={busy ? 'Updating your PIN…' : c.title}
      subtitle={c.subtitle}
      error={msg}
      errorSignal={shake}
      disabled={busy}
      resetSignal={c.n}
      onBack={back}
      onComplete={(p) => void onPin(p)}
    />
  );
}
