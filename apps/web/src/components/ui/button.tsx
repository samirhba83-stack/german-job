import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * docs/frontend-architecture/05-component-architecture.md (contract) +
 * docs/design-system/07-component-library.md (visual spec).
 * `destructive` is reserved for irreversible actions only (docs/product-experience/16-ux-decision-records.md).
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-inverse hover:bg-accent-hover active:bg-accent-active shadow-elevation-1 hover:shadow-elevation-2',
  secondary: 'bg-surface text-primary border border-border hover:bg-background-subtle hover:border-border-focus/40',
  ghost: 'bg-transparent text-primary hover:bg-background-subtle',
  destructive: 'bg-status-critical text-inverse hover:brightness-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-sm gap-1.5',
  md: 'h-9 px-4 text-body gap-2',
  lg: 'h-11 px-5 text-body gap-2', // 44px meets the touch-target minimum (M20 §10)
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-semibold',
          'transition-[background-color,border-color,box-shadow,transform] duration-fast ease-standard',
          // Tactile press feedback (M27.5) — a single, restrained 2% scale on :active, the same
          // treatment every solid-surface control in Linear/Stripe-caliber products uses. No
          // hover-scale (that reads as "gamey" per this milestone's own design principles) —
          // press-only, and gone entirely under prefers-reduced-motion (globals.css zeroes
          // transition-duration, so the scale still applies but doesn't animate into place).
          'active:scale-[0.98]',
          'disabled:opacity-disabled disabled:pointer-events-none disabled:active:scale-100',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" strokeWidth={1.75} />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
