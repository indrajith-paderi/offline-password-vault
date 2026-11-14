export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

const DEVICE_ONLY = new Set([
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  ALWAYS_THIS_DEVICE_ONLY,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
]);

const KEY_PATTERN = /^[\w.-]+$/;

type Options = {
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
  keychainAccessible?: number;
};

type Item = { value: string; auth: boolean; accessible: number };

export type PromptOutcome = 'success' | 'cancel' | 'lockout';

type State = {
  items: Map<string, Item>;
  biometricAvailable: boolean;
  biometricInvalidated: boolean;
  outcomes: PromptOutcome[];
  prompts: string[];
};

function fresh(): State {
  return {
    items: new Map(),
    biometricAvailable: true,
    biometricInvalidated: false,
    outcomes: [],
    prompts: [],
  };
}

let state = fresh();

function checkKey(key: unknown): string {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw new Error(`Invalid key provided to SecureStore: ${String(key)}`);
  }
  return key;
}

function accessibility(opts?: Options): number {
  const a = opts?.keychainAccessible ?? WHEN_UNLOCKED;
  if (!DEVICE_ONLY.has(a)) {
    throw new Error('Test policy: SecureStore writes must use a *_THIS_DEVICE_ONLY accessibility');
  }
  return a;
}

function prompt(opts?: Options) {
  if (!state.biometricAvailable) throw new Error('No biometrics enrolled');
  if (!opts?.authenticationPrompt) throw new Error('Test policy: biometric prompts need a message');
  state.prompts.push(opts.authenticationPrompt);
  const outcome = state.outcomes.shift() ?? 'success';
  if (outcome === 'cancel') throw new Error('User canceled the authentication');
  if (outcome === 'lockout') throw new Error('Too many attempts. Biometrics locked');
}

export async function setItemAsync(key: string, value: string, opts?: Options): Promise<void> {
  checkKey(key);
  if (typeof value !== 'string') throw new Error('SecureStore values must be strings');
  const accessible = accessibility(opts);
  const auth = !!opts?.requireAuthentication;
  if (auth) {
    prompt(opts);
    state.biometricInvalidated = false;
  }
  state.items.set(key, { value, auth, accessible });
}

export async function getItemAsync(key: string, opts?: Options): Promise<string | null> {
  checkKey(key);
  const item = state.items.get(key);
  if (!item) return null;
  if (opts?.keychainAccessible !== undefined && opts.keychainAccessible !== item.accessible) return null;
  if (item.auth) {
    if (!opts?.requireAuthentication) {
      throw new Error('Item was stored with requireAuthentication and must be read with it');
    }
    if (state.biometricInvalidated) {
      state.items.delete(key);
      return null;
    }
    prompt(opts);
  }
  return item.value;
}

export async function deleteItemAsync(key: string): Promise<void> {
  checkKey(key);
  state.items.delete(key);
}

export function canUseBiometricAuthentication(): boolean {
  return state.biometricAvailable;
}

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export const secureStoreControl = {
  reset() {
    state = fresh();
  },
  wipe() {
    state.items.clear();
  },
  setBiometricAvailable(v: boolean) {
    state.biometricAvailable = v;
  },
  enrollNewBiometric() {
    state.biometricInvalidated = true;
  },
  queuePrompts(...outcomes: PromptOutcome[]) {
    state.outcomes.push(...outcomes);
  },
  tamper(key: string, value: string) {
    const item = state.items.get(key);
    if (!item) throw new Error(`No item ${key} to tamper with`);
    state.items.set(key, { ...item, value });
  },
  peek(key: string): string | null {
    return state.items.get(key)?.value ?? null;
  },
  isAuthProtected(key: string): boolean {
    return state.items.get(key)?.auth ?? false;
  },
  get prompts(): readonly string[] {
    return [...state.prompts];
  },
  get keys(): string[] {
    return [...state.items.keys()];
  },
};
