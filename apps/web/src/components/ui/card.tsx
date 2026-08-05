import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Only for a Card that IS the interactive element itself (has its own `onClick`, no wrapping
   * `<Link>`/`<button>`) — this sets `tabIndex={0}` on the Card's own `<div>`. If the Card is
   * already nested inside a real interactive element (a `<Link>` wrapping it for navigation),
   * leave this false and apply the hover-shadow visual treatment via `group`/`group-hover:` on
   * the wrapper instead — setting it here too creates a second, separately-focusable element for
   * the same one action (a real bug this exact pattern produced once already; see
   * `app/(dashboard)/page.tsx`'s Milestone 22.3 fix). */
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES = { sm: 'p-3', md: 'p-4', lg: 'p-6' } as const;

/** docs/frontend-architecture/05-component-architecture.md (contract) +
 * docs/design-system/07-component-library.md (visual spec: surface.default, radius-lg, elevation-1
 * at rest, elevation-2 on hover when interactive). */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, padding = 'md', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          'rounded-lg bg-surface shadow-elevation-1',
          'transition-[box-shadow,transform] duration-base ease-standard',
          PADDING_CLASSES[padding],
          // M27.5: a 1px lift alongside the existing elevation-1→2 hover shadow — restrained on
          // purpose (no rotation, no scale, no oversized shadow jump) to read as "responsive
          // surface," not a gaming-UI effect.
          interactive && 'cursor-pointer hover:-translate-y-px hover:shadow-elevation-2',
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';
