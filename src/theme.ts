import { createContext, useContext } from 'react';
import tokens from './design/desktop-tokens.json';

function colors(mode: 'light' | 'dark') {
  const get = (key: keyof typeof tokens) => String(tokens[key][mode]);
  return {
    dark: mode === 'dark',
    canvas: get('color-bg-canvas'),
    sidebar: get('color-bg-sidebar'),
    surface: get('color-bg-surface'),
    elevated: get('color-bg-elevated'),
    subtle: get('color-bg-subtle'),
    hover: get('color-bg-hover'),
    pressed: get('color-bg-pressed'),
    selected: get('color-bg-selected'),
    text: get('color-text-primary'),
    secondary: get('color-text-secondary'),
    muted: get('color-text-muted'),
    border: get('color-border-subtle'),
    borderDefault: get('color-border-default'),
    control: get('color-border-control'),
    accent: get('color-accent'),
    onAccent: get('color-on-accent'),
    accentSoft: get('color-accent-subtle'),
    onAccentSoft: get('color-on-accent-subtle'),
    success: get('color-success'),
    successSoft: get('color-success-subtle'),
    danger: get('color-danger'),
    dangerSoft: get('color-danger-subtle'),
    warning: get('color-warning'),
    warningSoft: get('color-warning-subtle'),
    dot: get('color-dot'),
    overlay: get('color-overlay'),
  };
}
export const light = colors('light');
export const dark = colors('dark');
export type Colors = typeof light;
export const ThemeContext = createContext(light);
export const useColors = () => useContext(ThemeContext);
