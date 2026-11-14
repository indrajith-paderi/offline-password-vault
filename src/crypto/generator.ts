import sodium from 'react-native-libsodium';

export type GeneratorOptions = {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
};

const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
} as const;

export const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
};

/** Uniform, unbiased picks (randombytes_uniform) with at least one char from each chosen set. */
export function generatePassword(opts: GeneratorOptions): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => opts[k]).map((k) => SETS[k]);
  if (sets.length === 0) throw new Error('Pick at least one character set');
  const length = Math.max(opts.length, sets.length, 8);
  const all = sets.join('');
  const pick = (s: string) => s[sodium.randombytes_uniform(s.length)];

  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates so the guaranteed chars aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = sodium.randombytes_uniform(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
