export class IdleLocker {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(
    private idleMs: number,
    private onLock: () => void,
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  setIdleMs(ms: number) {
    if (!Number.isFinite(ms) || ms <= 0) throw new Error('idleMs must be positive');
    this.idleMs = ms;
    if (this.active) this.poke();
  }

  start() {
    this.active = true;
    this.poke();
  }

  stop() {
    this.active = false;
    this.clear();
  }

  poke() {
    this.clear();
    if (this.active) this.timer = setTimeout(() => this.fire(), this.idleMs);
  }

  appStateChanged(state: string) {
    if (this.active && state === 'background') this.fire();
  }

  private fire() {
    this.stop();
    this.onLock();
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
