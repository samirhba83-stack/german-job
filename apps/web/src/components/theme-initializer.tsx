'use client';

import { useEffect } from 'react';
import { useThemeStore, readStoredThemePreference } from '@/lib/stores/theme-store';

/**
 * Syncs the Zustand theme store with the real stored preference on mount. The store's initial
 * value is always 'system' (matching what the server renders, avoiding a hydration mismatch) —
 * this runs once, client-side, after hydration, to bring the store's *state* in line with reality
 * for ThemeSwitcher to display correctly. The DOM attribute itself was already set correctly
 * before this runs, by ThemeBootScript (components/theme-boot-script.tsx) — this component never
 * touches the DOM, only the store.
 */
export function ThemeInitializer() {
  useEffect(() => {
    const stored = readStoredThemePreference();
    if (stored !== useThemeStore.getState().preference) {
      useThemeStore.setState({ preference: stored });
    }
  }, []);

  return null;
}
