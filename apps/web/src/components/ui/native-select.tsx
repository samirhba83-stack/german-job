import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

/**
 * M25 sign-off audit fix: the exact same label+native-`<select>` styling was independently
 * duplicated three times — `campaign-actions.tsx`'s Cancel reason select (M23), and this
 * milestone's own `CampaignForm` and `CampaignFilters` (both new). Extracted here rather than
 * left triplicated, mirroring this codebase's own established precedent (`StatTile`,
 * `DefinitionField`) for exactly this situation. A real design-system `<Select>` (M21) doesn't
 * exist yet (still a named future opportunity as of the M23 review) — this wraps the native
 * element with the same label-association and focus-visible styling every other real form
 * primitive (`Input`) already carries, not a new visual language.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ label, id, className, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <label
        htmlFor={selectId}
        className="flex flex-col gap-1 text-caption font-semibold uppercase tracking-wide text-secondary"
      >
        {label}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-primary',
            'transition-colors duration-fast ease-standard',
            'hover:border-neutral-400 focus-visible:border-border-focus focus-visible:hover:border-border-focus',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </label>
    );
  },
);
NativeSelect.displayName = 'NativeSelect';
