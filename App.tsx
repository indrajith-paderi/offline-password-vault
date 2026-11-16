import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import sodium from 'react-native-libsodium';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAutoLock } from './src/security/autoLock';
import { clearCopiedSecret } from './src/security/clipboard';
import { checkIntegrity, IntegrityVerdict } from './src/security/integrity';
import { AppContext, AppCtx, Route } from './src/ui/AppContext';
import { AboutScreen } from './src/ui/screens/AboutScreen';
import { ChangePinScreen } from './src/ui/screens/ChangePinScreen';
import { EditScreen } from './src/ui/screens/EditScreen';
import { EntryScreen } from './src/ui/screens/EntryScreen';
import { ExportScreen } from './src/ui/screens/ExportScreen';
import { LicensesScreen } from './src/ui/screens/LicensesScreen';
import { ListScreen } from './src/ui/screens/ListScreen';
import { LockScreen } from './src/ui/screens/LockScreen';
import { RestoreScreen } from './src/ui/screens/RestoreScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { SetupScreen } from './src/ui/screens/SetupScreen';
import { AppMark } from './src/ui/components/ui';
import { useTheme } from './src/ui/theme';
import { loadThemePref } from './src/ui/themePref';
import { SqliteStore } from './src/vault/sqliteStore';
import { Settings, Vault } from './src/vault/vault';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

/** Screens swap with a short cross-fade only: no sliding, scaling or bouncing. */
const ENTER = FadeIn.duration(150);

type Boot =
  | { phase: 'loading' }
  | { phase: 'ready'; vault: Vault; initialized: boolean; unlocked: boolean; integrity: IntegrityVerdict };

async function boot(): Promise<{ vault: Vault; initialized: boolean; integrity: IntegrityVerdict }> {
  await ScreenCapture.preventScreenCaptureAsync();
  if (Platform.OS === 'ios') await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
  await loadThemePref();
  await sodium.ready;
  const vault = new Vault(await SqliteStore.open());
  return { vault, initialized: await vault.isInitialized(), integrity: checkIntegrity() };
}

export default function App() {
  const t = useTheme();
  const [state, setState] = useState<Boot>({ phase: 'loading' });
  const [stack, setStack] = useState<Route[]>([{ name: 'list' }]);
  const [settings, setSettings] = useState<Settings>({ autoLockMs: 60_000 });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void boot().then(({ vault, initialized, integrity }) => {
      setState({ phase: 'ready', vault, initialized, unlocked: false, integrity });
      void SplashScreen.hideAsync();
      unsub = vault.onChange(async (unlocked) => {
        const init = await vault.isInitialized();
        if (unlocked) setSettings(await vault.getSettings());
        else void clearCopiedSecret();
        setStack([{ name: 'list' }]);
        setState((s) => (s.phase === 'ready' ? { ...s, initialized: init, unlocked } : s));
      });
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    // Root view colour shows behind the system bars; keep it in step with the theme.
    void SystemUI.setBackgroundColorAsync(t.bg);
  }, [t.bg]);

  const ready = state.phase === 'ready' ? state : null;
  const lock = useCallback(() => ready?.vault.lock(), [ready]);
  const poke = useAutoLock(!!ready?.unlocked, settings.autoLockMs, lock);

  const go = useCallback((r: Route) => {
    setStack((s) => [...s, r]);
  }, []);
  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const ctx = useMemo<AppCtx | null>(
    () =>
      ready
        ? { vault: ready.vault, settings, setSettings, go, back, warnings: ready.integrity.warnings }
        : null,
    [ready, settings, go, back],
  );

  let body: React.ReactNode;
  let sceneKey: string;
  if (!ready || !ctx) {
    sceneKey = 'boot';
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <AppMark size={80} />
      </View>
    );
  } else if (!ready.initialized) {
    sceneKey = 'setup';
    body = <SetupScreen vault={ready.vault} />;
  } else if (!ready.unlocked || ready.integrity.blocked) {
    sceneKey = 'lock';
    body = <LockScreen vault={ready.vault} blocked={ready.integrity.blocked} warnings={ready.integrity.warnings} />;
  } else {
    const r = stack[stack.length - 1];
    sceneKey = `${stack.length}:${r.name}:${'id' in r ? r.id ?? '' : ''}`;
    body = (
      <>
        {r.name === 'list' && <ListScreen />}
        {r.name === 'entry' && <EntryScreen id={r.id} />}
        {r.name === 'edit' && <EditScreen id={r.id} />}
        {r.name === 'settings' && <SettingsScreen />}
        {r.name === 'export' && <ExportScreen />}
        {r.name === 'restore' && <RestoreScreen />}
        {r.name === 'changePin' && <ChangePinScreen />}
        {r.name === 'licenses' && <LicensesScreen />}
        {r.name === 'about' && <AboutScreen />}
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <View style={{ flex: 1, backgroundColor: t.bg }} onTouchStart={poke}>
        <Animated.View key={sceneKey} entering={ENTER} style={{ flex: 1 }}>
          {ctx ? <AppContext.Provider value={ctx}>{body}</AppContext.Provider> : body}
        </Animated.View>
      </View>
    </SafeAreaProvider>
  );
}
