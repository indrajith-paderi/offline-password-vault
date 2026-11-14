import SecureNative, { nativeControl } from '../__mocks__/secure-native';
import { clearCopiedSecret, CLIPBOARD_CLEAR_MS, copySecret } from '../src/security/clipboard';

afterEach(async () => {
  await clearCopiedSecret();
});

describe('clipboard', () => {
  it('copies as sensitive and clears after 30 seconds', async () => {
    jest.useFakeTimers();
    await copySecret('hunter2');
    expect(nativeControl.clipboard).toMatchObject({ text: 'hunter2', sensitive: true });
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS - 1);
    expect(nativeControl.clipboard?.text).toBe('hunter2');
    await jest.advanceTimersByTimeAsync(1);
    expect(nativeControl.clipboard).toBeNull();
  });

  it('asks the OS to expire the clip too', async () => {
    const start = nativeControl.clock.mono;
    await copySecret('hunter2');
    expect(nativeControl.clipboard?.expiresAt).toBe(start + CLIPBOARD_CLEAR_MS);
  });

  it('restarts the countdown on a second copy', async () => {
    jest.useFakeTimers();
    await copySecret('first');
    await jest.advanceTimersByTimeAsync(20_000);
    await copySecret('second');
    await jest.advanceTimersByTimeAsync(20_000);
    expect(nativeControl.clipboard?.text).toBe('second');
    await jest.advanceTimersByTimeAsync(10_000);
    expect(nativeControl.clipboard).toBeNull();
  });

  it('clears immediately on lock', async () => {
    await copySecret('hunter2');
    await clearCopiedSecret();
    expect(nativeControl.clipboard).toBeNull();
  });

  it('leaves the clipboard alone when it never copied anything', async () => {
    await clearCopiedSecret();
    expect(nativeControl.calls('clearClipboard')).toBe(0);
  });

  it('does not clear twice', async () => {
    jest.useFakeTimers();
    await copySecret('x');
    await clearCopiedSecret();
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(nativeControl.calls('clearClipboard')).toBe(1);
  });

  it('swallows a native error while clearing', async () => {
    await copySecret('x');
    jest.spyOn(SecureNative, 'clearClipboard').mockRejectedValueOnce(new Error('owner changed'));
    await expect(clearCopiedSecret()).resolves.toBeUndefined();
  });
});
