import { Platform, TextStyle, useColorScheme } from 'react-native';

/**
 * "Soft Vault" design tokens. Every colour on screen comes from here; screens never
 * hard-code hex values. Light and dark share one shape so components stay theme-agnostic.
 */

type Tile = { bg: string; fg: string };

const light = {
  dark: false,
  bg: '#F6F4FF',
  surface: '#FFFFFF',
  sunken: '#EDEAFF',
  chip: '#F1EFFF',
  line: '#E6E2FA',
  divider: '#F0EEFB',
  ink: '#1B1838',
  ink2: '#5A5680',
  muted: '#6A6690',
  chevron: '#B4B0D4',
  primary: '#5B4CF0',
  onPrimary: '#FFFFFF',
  primarySoft: '#E9E6FF',
  primarySoftInk: '#4335D6',
  primaryRing: '#C9C2FF',
  keyPressed: '#DCD7FF',
  dotOff: '#DCD7FF',
  key: '#FFFFFF',
  mint: '#1F9D74',
  mintSoft: '#D9F5EA',
  mintInk: '#17795A',
  digit: '#5B4CF0',
  symbol: '#A8441C',
  butterSoft: '#FFF3D1',
  butterInk: '#6B4A00',
  butterIcon: '#855C00',
  butterRing: '#C48A00',
  butterTrack: '#F3DE9E',
  roseSoft: '#FFE5E8',
  roseInk: '#B02535',
  rose: '#D63B4A',
  toastBg: '#1B1838',
  toastInk: '#FFFFFF',
  toastRing: '#A196FF',
  shadowCard: '0px 1px 2px rgba(27,24,56,0.04), 0px 12px 28px -18px rgba(67,53,214,0.25)',
  shadowRaised: '0px 6px 16px -8px rgba(67,53,214,0.3)',
  shadowPrimary: '0px 14px 28px -12px rgba(91,76,240,0.75)',
  shadowKey: '0px 4px 12px -6px rgba(67,53,214,0.2)',
  markFrom: '#8F84FF',
  markMid: '#5B4CF0',
  markTo: '#3A2BC2',
  tiles: [
    { bg: '#E9E6FF', fg: '#4335D6' },
    { bg: '#FFE6DA', fg: '#A8441C' },
    { bg: '#D9F5EA', fg: '#17795A' },
    { bg: '#DDEEFF', fg: '#1F5FA8' },
    { bg: '#FFF1C9', fg: '#7E5A06' },
    { bg: '#FFE1E7', fg: '#B4304A' },
  ] as Tile[],
};

export type Theme = typeof light;

const dark: Theme = {
  dark: true,
  bg: '#0E0B22',
  surface: '#17133A',
  sunken: '#1C1844',
  chip: '#221D4D',
  line: '#2B2560',
  divider: '#221D4D',
  ink: '#F2F0FF',
  ink2: '#C3BFE6',
  muted: '#ABA6D6',
  chevron: '#5A5490',
  primary: '#A196FF',
  onPrimary: '#0E0B22',
  primarySoft: '#2A2366',
  primarySoftInk: '#C3BCFF',
  primaryRing: '#2A2366',
  keyPressed: '#34297A',
  dotOff: '#342D6E',
  key: '#1C1844',
  mint: '#3CCB98',
  mintSoft: '#123628',
  mintInk: '#7FE0BA',
  digit: '#B3AAFF',
  symbol: '#FFB89A',
  butterSoft: '#2E2510',
  butterInk: '#FFD76A',
  butterIcon: '#FFCF66',
  butterRing: '#FFCF66',
  butterTrack: '#4A3C14',
  roseSoft: '#3D1A26',
  roseInk: '#FF9DB1',
  rose: '#FF7A8A',
  toastBg: '#F2F0FF',
  toastInk: '#1B1838',
  toastRing: '#5B4CF0',
  shadowCard: '0px 0px 0px 1px #241F52',
  shadowRaised: '0px 0px 0px 1px #241F52',
  shadowPrimary: '0px 16px 36px -12px rgba(161,150,255,0.55)',
  shadowKey: '0px 0px 0px 0px transparent',
  markFrom: '#A196FF',
  markMid: '#6B5CFF',
  markTo: '#4335D6',
  tiles: [
    { bg: '#2A2366', fg: '#C3BCFF' },
    { bg: '#3A2418', fg: '#FFB89A' },
    { bg: '#123628', fg: '#7FE0BA' },
    { bg: '#152B47', fg: '#8CC4FF' },
    { bg: '#3A2E0E', fg: '#FFD76A' },
    { bg: '#3D1A26', fg: '#FF9DB1' },
  ],
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Monogram tile colour. Derived from the entry title only — never from a secret. */
export function tileFor(t: Theme, title: string): Tile {
  let h = 2166136261;
  const s = title.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return t.tiles[(h >>> 0) % t.tiles.length];
}

export function monogram(title: string): string {
  const ch = Array.from(title.trim())[0];
  return ch ? ch.toUpperCase() : '•';
}

/** Fonts are embedded at build time by the expo-font config plugin (see app.json). */
const fontNames = Platform.select({
  ios: {
    medium: 'PlusJakartaSans-Medium',
    semibold: 'PlusJakartaSans-SemiBold',
    bold: 'PlusJakartaSans-Bold',
    extrabold: 'PlusJakartaSans-ExtraBold',
    mono: 'JetBrainsMono-Medium',
    monoBold: 'JetBrainsMono-SemiBold',
  },
  default: {
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
    mono: 'JetBrainsMono_500Medium',
    monoBold: 'JetBrainsMono_600SemiBold',
  },
});

export const font = fontNames;

export const type = {
  display: { fontFamily: font.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  title: { fontFamily: font.bold, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  heading: { fontFamily: font.bold, fontSize: 16, lineHeight: 21 },
  rowTitle: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  bodyLg: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  secondary: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: font.extrabold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  button: { fontFamily: font.bold, fontSize: 15, lineHeight: 20 },
  mono: { fontFamily: font.monoBold, fontSize: 16, lineHeight: 22, letterSpacing: 0.3 },
} satisfies Record<string, TextStyle>;

export const radius = { chip: 12, field: 16, button: 20, card: 24, sheet: 28 } as const;
export const gutter = 20;

/** Critically damped spring for presses and toggles: settles quickly with no bounce. */
export const spring = { damping: 40, stiffness: 400, mass: 1 } as const;
