/**
 * INTEGRATION CONTRACT: TYPE-UI-001, HOOK-UI-001
 * Purpose: every colour, spacing and font size in the app. Components must use `useTheme()`; no
 *          hard-coded colours outside this file.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (TYPE-UI-001, HOOK-UI-001)
 * Consumers: every screen and component
 * Contract status: APPROVED
 */
import { useColorScheme } from 'react-native';

/** TYPE-UI-001 */
export interface Theme {
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryText: string;
    border: string;
    danger: string;
    warning: string;
    success: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number };
  fontSize: { sm: number; md: number; lg: number; xl: number };
}

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const radius = { sm: 6, md: 12 } as const;
const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 } as const;

const lightColors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#14181F',
  textMuted: '#5B6675',
  primary: '#1F5FA9',
  primaryText: '#FFFFFF',
  border: '#D8DEE7',
  danger: '#A32020',
  warning: '#8A5A00',
  success: '#1E6B3A',
} as const;

const darkColors = {
  background: '#10141A',
  surface: '#1A2029',
  text: '#F2F5F9',
  textMuted: '#A5B0BF',
  primary: '#7FB3F0',
  primaryText: '#0B1017',
  border: '#2C3542',
  danger: '#F19A9A',
  warning: '#E5C07B',
  success: '#7FCF9B',
} as const;

export const lightTheme: Theme = { colors: lightColors, spacing, radius, fontSize };
export const darkTheme: Theme = { colors: darkColors, spacing, radius, fontSize };

/** HOOK-UI-001 — follows the system light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}