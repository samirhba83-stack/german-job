import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/** docs/frontend-architecture/05-component-architecture.md (contract) +
 * docs/design-system/07-component-library.md (visual spec). Label is always programmatically
 * associated and the error is always aria-describedby'd — never color-alone (M20 §5). */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-caption font-semibold uppercase tracking-wide text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-9 rounded-md border border-border bg-surface px-3 text-body text-primary',
            'placeholder:text-disabled',
            'transition-colors duration-fast ease-standard',
            'hover:border-neutral-400 focus-visible:border-border-focus focus-visible:hover:border-border-focus',
            error && 'border-status-critical hover:border-status-critical',
            'disabled:opacity-disabled disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-body-sm text-status-critical">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-body-sm text-secondary">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
