const store = new Map<string, string>();
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 1;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 2;
export async function getItemAsync(k: string) {
  return store.has(k) ? store.get(k)! : null;
}
export async function setItemAsync(k: string, v: string) {
  store.set(k, v);
}
export async function deleteItemAsync(k: string) {
  store.delete(k);
}
export function canUseBiometricAuthentication() {
  return true;
}
export const __store = store;
