import { cn } from '@/lib/utils';

export interface SkeletonProps {
  variant?: 'text-line' | 'card' | 'table-row' | 'avatar';
  className?: string;
}

/** docs/design-system/07-component-library.md — shape-matching loading pattern, the default
 * loading treatment everywhere (docs/frontend-architecture/10-ux-principles.md). Respects
 * prefers-reduced-motion via the global rule in globals.css (animation-duration forced near-zero,
 * which freezes the shimmer sweep to a single static frame — not a separate reduced-motion branch,
 * the same mechanism every other animation in this codebase already relies on). */
const VARIANT_CLASSES: Record<NonNullable<SkeletonProps['variant']>, string> = {
  'text-line': 'h-4 w-full rounded-sm',
  card: 'h-32 w-full rounded-lg',
  'table-row': 'h-10 w-full rounded-sm',
  avatar: 'h-8 w-8 rounded-full',
};

export function Skeleton({ variant = 'text-line', className }: SkeletonProps) {
  return (
    // M27.5: a moving highlight sweep (bg-skeleton -> bg-skeleton-highlight -> bg-skeleton, both
    // real theme-aware tokens) replaces the flat `animate-pulse` opacity fade — reads calmer and
    // more deliberate at the caliber this milestone asks for, still just as fast/cheap (CSS
    // background-position only, no layout thrash).
    <div
      className={cn(
        'animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-skeleton via-skeleton-highlight to-skeleton',
        VARIANT_CLASSES[variant],
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** Wraps a region that's loading so screen readers announce it correctly
 * (docs/design-system/09-accessibility.md). */
export function SkeletonRegion({ loading, children, label = 'Loading' }: { loading: boolean; children: React.ReactNode; label?: string }) {
  return (
    <div aria-busy={loading} aria-live="polite" aria-label={loading ? label : undefined}>
      {children}
    </div>
  );
}
