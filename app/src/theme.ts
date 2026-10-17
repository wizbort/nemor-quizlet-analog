// Design tokens. Dark theme with an indigo accent.

export const colors = {
  bg: '#0b1020',
  surface: '#141a2e',
  surfaceAlt: '#1c2440',
  border: '#2a3354',
  text: '#e6e9f5',
  textMuted: '#9aa3c0',
  accent: '#6366f1',
  accentMuted: '#4f52c4',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  // NOT `as const`: values stay `string` so a `let c = colors.a; c = colors.b`
  // reassignment (used in SyncBadge / quiz option styles) typechecks. Keys are
  // still exact, so `colors.typo` is still an error.
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const theme = { colors, spacing, radius, fontSize } as const;
export type Theme = typeof theme;
