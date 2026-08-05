import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gje.theme';

interface ThemeState {
  /** The user's stored preference — 'system' means "follow the OS," not a fixed choice. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

/**
 * Client-only preference (docs/frontend-architecture/07-state-management-strategy.md §Settings —
 * a UI preference with no backend counterpart, persisted to localStorage, safe because it's
 * neither sensitive nor a source of truth for domain data). Applying the resolved theme to the
 * DOM (`data-theme` on <html>) happens in applyTheme() below and in the inline boot script in
 * app/layout.tsx — never inside a React effect alone, which would cause a visible flash of the
 * wrong theme on first paint (see docs/interaction-framework/13-decision-records.md IDR-007).
 */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
    applyTheme(preference);
    set({ preference });
  },
}));

/** Reads the persisted preference — called once, client-side, on mount (see ThemeInitializer). */
export function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export const THEME_STORAGE_KEY = STORAGE_KEY;
