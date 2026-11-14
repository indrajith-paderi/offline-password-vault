import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  text: '#11151C',
  muted: '#5E6673',
  border: '#E1E4EA',
  primary: '#2F5BEA',
  primaryText: '#FFFFFF',
  danger: '#C62828',
  warn: '#8A5A00',
  warnBg: '#FFF4D6',
  key: '#ECEFF4',
};

const dark: typeof light = {
  bg: '#0E1116',
  card: '#171B22',
  text: '#E8EBF0',
  muted: '#98A1AE',
  border: '#272D37',
  primary: '#6E8EFF',
  primaryText: '#0E1116',
  danger: '#FF6B6B',
  warn: '#FFCF66',
  warnBg: '#2E2510',
  key: '#20252E',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
