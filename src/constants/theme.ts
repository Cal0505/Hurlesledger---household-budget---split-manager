// src/constants/theme.ts
export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentColor =
  | 'ocean'
  | 'forest'
  | 'lavender'
  | 'sunset'
  | 'crimson'
  | 'glacier'
  | 'midnight'
  | 'tidepool'
  | null;

export const ACCENT_COLORS: Array<{
  id: NonNullable<AccentColor>;
  label: string;
  hex: string;
}> = [
  { id: 'ocean', label: 'Ocean', hex: '#3b82f6' },
  { id: 'forest', label: 'Forest', hex: '#10b981' },
  { id: 'lavender', label: 'Lavender', hex: '#a855f7' },
  { id: 'sunset', label: 'Sunset', hex: '#f59e0b' },
  { id: 'crimson', label: 'Crimson', hex: '#ef4444' },
  { id: 'glacier', label: 'Glacier', hex: '#06b6d4' },
  { id: 'midnight', label: 'Midnight', hex: '#6366f1' },
  { id: 'tidepool', label: 'Tidepool', hex: '#14b8a6' },
];

export const THEME_STORAGE_KEY = 'hearthledger_theme_mode';
export const ACCENT_STORAGE_KEY = 'hearthledger_theme_accent';