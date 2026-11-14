import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F3FF',
  card: '#FFFFFF',
  text: '#14112B',
  muted: '#5F5B7A',
  border: '#E3E1F5',
  primary: '#5B4CF0',
  primaryText: '#FFFFFF',
  danger: '#D14343',
  warn: '#8A5A00',
  warnBg: '#FFF4D6',
  key: '#ECEAFB',
};

const dark: typeof light = {
  bg: '#0D0A26',
  card: '#16123A',
  text: '#ECEAFF',
  muted: '#A39FC4',
  border: '#2A2552',
  primary: '#8F84FF',
  primaryText: '#0D0A26',
  danger: '#FF7A7A',
  warn: '#FFCF66',
  warnBg: '#2E2510',
  key: '#1C1745',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
