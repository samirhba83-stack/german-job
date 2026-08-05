'use client';

import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '@/lib/stores/theme-store';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * docs/interaction-framework/01-application-shell.md §Theme Switcher — a real, working control
 * (a genuine gap in Milestone 22: dark-mode CSS existed since docs/design-system, but no UI ever
 * let a user actually switch to it). Persists via lib/stores/theme-store.ts; applies instantly
 * with no flash on the *next* load (docs/interaction-framework/13-decision-records.md IDR-007).
 */
export function ThemeSwitcher() {
  const { preference, setPreference } = useThemeStore();
  const ActiveIcon = OPTIONS.find((option) => option.value === preference)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          aria-label={`Theme: ${preference}`}
          className="flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-background-subtle"
        >
          <ActiveIcon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => setPreference(option.value)}>
            <option.icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
            <span className="flex-1">{option.label}</span>
            {preference === option.value && <Check className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
