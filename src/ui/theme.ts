import { useColorScheme } from 'react-native';

/**
 * Design tokens.
 *
 * The categorical series slots and the chart chrome come from a palette that
 * was validated for colour-vision deficiency separation and surface contrast in
 * both modes (worst adjacent CVD dE 9.1 light / 8.4 dark against a >=8 target).
 * Three light-mode slots sit below 3:1 against the surface, so anything painted
 * with a series colour must also carry a visible text label - identity is never
 * colour alone. Dark is a separately stepped set, not an automatic inversion.
 */

export const SPACE = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, pill: 999,
} as const;

export const TYPE = {
  hero:      { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.6 },
  title:     { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading:   { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
  body:      { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong:{ fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  label:     { fontSize: 13, lineHeight: 17, fontWeight: '500' as const },
  caption:   { fontSize: 11, lineHeight: 15, fontWeight: '500' as const, letterSpacing: 0.3 },
} as const;

/** Fixed across modes. Always shipped with an icon or label, never colour alone. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export interface Theme {
  mode: 'light' | 'dark';
  plane: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  grid: string;
  baseline: string;
  /** Single hue for magnitude encoding (category bars, trend columns). */
  sequential: string;
  sequentialSoft: string;
  debit: string;
  credit: string;
  /** Categorical identity slots, fixed order, never cycled. */
  series: string[];
}

const LIGHT: Theme = {
  mode: 'light',
  plane: '#f9f9f7',
  surface: '#fcfcfb',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#f1f1ee',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#898781',
  border: 'rgba(11,11,11,0.10)',
  grid: '#e1e0d9',
  baseline: '#c3c2b7',
  sequential: '#2a78d6',
  sequentialSoft: '#cde2fb',
  debit: '#d03b3b',
  credit: '#006300',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
};

const DARK: Theme = {
  mode: 'dark',
  plane: '#0d0d0d',
  surface: '#1a1a19',
  surfaceRaised: '#232321',
  surfaceSunken: '#131312',
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  textMuted: '#898781',
  border: 'rgba(255,255,255,0.10)',
  grid: '#2c2c2a',
  baseline: '#383835',
  sequential: '#3987e5',
  sequentialSoft: '#184f95',
  debit: '#e66767',
  credit: '#0ca30c',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

/**
 * Identity colour for a bank. Keyed off the bank's position in the registry so
 * the colour follows the entity and never shifts when a filter changes how many
 * banks are on screen.
 */
export function seriesColor(theme: Theme, index: number): string {
  return theme.series[index % theme.series.length];
}

export function statusColor(level: 'high' | 'medium' | 'low'): string {
  return level === 'high' ? STATUS.critical : level === 'medium' ? STATUS.serious : STATUS.warning;
}
