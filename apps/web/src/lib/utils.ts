import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * M25 sign-off audit fix: `twMerge`'s default config only recognizes Tailwind's *built-in* color
 * and font-size scales. This project's design tokens (tailwind.config.ts) use custom names for
 * both — `text-primary`/`text-secondary`/`text-disabled`/`text-inverse`/`text-status-*` for text
 * *color*, and `text-body`/`text-body-sm`/`text-caption`/`text-display*`/`text-heading-*` for text
 * *size* — none of which twMerge's built-in validators recognize, so both fall into the same
 * unclassified `text-*` bucket and silently conflict: the LAST one in a `cn()` call wins,
 * discarding the other. Confirmed directly: `twMerge('text-inverse text-body-sm')` returns only
 * `'text-body-sm'` — `Button`'s `primary`/`destructive` variants (`bg-accent text-inverse ...`)
 * combined with any `SIZE_CLASSES` entry (`... text-body-sm ...`) were silently losing their
 * intended white/inverse text color to the default inherited `text-primary` (near-black),
 * producing real WCAG-failing contrast on every primary/destructive button in the app — caught by
 * this milestone's own automated accessibility audit (color-contrast, "New campaign" button, 2.83:1
 * against a 4.5:1 requirement), not a milestone-25-introduced regression, but a real, pre-existing,
 * previously-undiscovered bug this audit is the first to have evidence for.
 *
 * Fixed by teaching `twMerge` this project's two custom scales as their own conflict groups, so a
 * `text-{color}` class and a `text-{size}` class are correctly recognized as non-conflicting and
 * both survive a merge, exactly as Tailwind's own built-in `text-red-500 text-sm` combination
 * already does.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'display-md', 'heading-lg', 'heading-lg-md', 'heading-md', 'heading-md-md', 'body', 'body-sm', 'caption', 'mono'] },
      ],
      'text-color': [
        { text: ['primary', 'secondary', 'disabled', 'inverse', 'accent', 'status-positive', 'status-warning', 'status-critical', 'status-info', 'status-neutral'] },
      ],
    },
  },
});

/** Merges conditional class names and resolves Tailwind conflicts (last-wins). Used by every
 * component in components/ui and components/shell so variant/className composition is consistent. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
