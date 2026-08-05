import type { Config } from 'tailwindcss';

/**
 * Real values from Milestone 21 (docs/design-system/). Colors resolve through CSS custom
 * properties (globals.css) so dark mode is a variable-resolution concern, never a component-level
 * branch (docs/frontend-architecture/11-design-system-foundation.md). `withOpacity` lets Tailwind's
 * opacity modifiers (e.g. bg-accent/10) work against the `r g b` custom-property format.
 */
function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          hover: withOpacity('--color-accent-hover'),
          active: withOpacity('--color-accent-active'),
        },
        background: {
          DEFAULT: withOpacity('--color-background-default'),
          subtle: withOpacity('--color-background-subtle'),
          inverse: withOpacity('--color-background-inverse'),
        },
        surface: {
          DEFAULT: withOpacity('--color-surface-default'),
          raised: withOpacity('--color-surface-raised'),
          overlay: withOpacity('--color-surface-overlay'),
        },
        border: {
          DEFAULT: withOpacity('--color-border-default'),
          subtle: withOpacity('--color-border-subtle'),
          focus: withOpacity('--color-border-focus'),
        },
        primary: withOpacity('--color-text-primary'),
        secondary: withOpacity('--color-text-secondary'),
        disabled: withOpacity('--color-text-disabled'),
        inverse: withOpacity('--color-text-inverse'),
        status: {
          positive: withOpacity('--color-status-positive'),
          warning: withOpacity('--color-status-warning'),
          critical: withOpacity('--color-status-critical'),
          info: withOpacity('--color-status-info'),
          neutral: withOpacity('--color-status-neutral'),
        },
        scrim: withOpacity('--color-scrim'),
        skeleton: withOpacity('--color-skeleton'),
        'skeleton-highlight': withOpacity('--color-skeleton-highlight'),
        neutral: {
          50: withOpacity('--color-neutral-50'),
          100: withOpacity('--color-neutral-100'),
          200: withOpacity('--color-neutral-200'),
          300: withOpacity('--color-neutral-300'),
          400: withOpacity('--color-neutral-400'),
          500: withOpacity('--color-neutral-500'),
          600: withOpacity('--color-neutral-600'),
          700: withOpacity('--color-neutral-700'),
          800: withOpacity('--color-neutral-800'),
          900: withOpacity('--color-neutral-900'),
          950: withOpacity('--color-neutral-950'),
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // docs/frontend-architecture/11-design-system-foundation.md §Typography scale,
        // docs/design-system/04-typography-system.md (mobile values applied via the
        // `md:` variant at each call site per that document's responsive rule).
        display: ['26px', { lineHeight: '1.25' }],
        'display-md': ['32px', { lineHeight: '1.2' }],
        'heading-lg': ['20px', { lineHeight: '1.3' }],
        'heading-lg-md': ['24px', { lineHeight: '1.3' }],
        'heading-md': ['17px', { lineHeight: '1.4' }],
        'heading-md-md': ['18px', { lineHeight: '1.4' }],
        body: ['15px', { lineHeight: '1.5' }],
        'body-sm': ['13px', { lineHeight: '1.5' }],
        caption: ['12px', { lineHeight: '1.4' }],
        mono: ['13px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'elevation-1': 'var(--shadow-elevation-1)',
        'elevation-2': 'var(--shadow-elevation-2)',
        'elevation-3': 'var(--shadow-elevation-3)',
      },
      transitionDuration: {
        fast: '100ms',
        base: '200ms',
        slow: '350ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        entrance: 'cubic-bezier(0, 0, 0.2, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      screens: {
        '2xl': '1536px',
        '3xl': '1920px',
      },
      maxWidth: {
        content: '1440px',
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '150% 0' },
          '100%': { backgroundPosition: '-50% 0' },
        },
        'menu-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        // Entrance only (docs/design-system/08-motion-system.md ease-entrance) — respects
        // prefers-reduced-motion via the global override in globals.css.
        'toast-in': 'toast-in 200ms cubic-bezier(0,0,0.2,1)',
        // M27.5: DropdownMenuContent conditionally *mounts* (`if (!open) return null`) rather than
        // toggling a CSS class, so a `transition` property would never fire (nothing to transition
        // from). A CSS `animation`, unlike `transition`, plays automatically on mount — same
        // mechanism `toast-in` already relies on for the same reason.
        'menu-in': 'menu-in 120ms cubic-bezier(0,0,0.2,1)',
        // M27.5: replaces the flat opacity `animate-pulse` loading treatment with a moving
        // highlight sweep — the same loading-state language Linear/Stripe/Vercel use. Slow and
        // linear on purpose (no easing snap, nothing to draw the eye) — a loading indicator should
        // read as calm, not urgent. Frozen to a single static frame under prefers-reduced-motion
        // via the existing global override (globals.css), same as every other animation here.
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
