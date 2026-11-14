import type { KdfParams } from '../src/crypto/kdf';
import type { Clock } from '../src/vault/lockout';
import { MemoryStore, VaultStore } from '../src/vault/store';
import { EntryInput, Vault } from '../src/vault/vault';

export const FAST_KDF: KdfParams = { ops: 2, memKiB: 19 * 1024 };
export const HOUR = 60 * 60 * 1000;

export class TestClock {
  wall = 1_700_000_000_000;
  mono = 1_000_000;
  boot = 'boot-1';
  private boots = 1;

  now = (): Clock => ({ wall: this.wall, mono: this.mono, boot: this.boot });

  advance(ms: number) {
    this.wall += ms;
    this.mono += ms;
  }

  setWall(wall: number) {
    this.wall = wall;
  }

  reboot() {
    this.boots += 1;
    this.boot = `boot-${this.boots}`;
    this.mono = 5_000;
  }
}

export const sampleEntry: EntryInput = {
  title: 'Bank',
  username: 'me@example.com',
  url: 'https://bank.example',
  password: 'correct horse battery staple',
  notes: 'pin is not 1234',
};

export async function makeVault(pin = '4821', store: VaultStore = new MemoryStore()) {
  const clock = new TestClock();
  const vault = new Vault(store, clock.now, FAST_KDF);
  await vault.create(pin);
  return { vault, store, clock };
}

export function hex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

export function unhex(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'hex'));
}
