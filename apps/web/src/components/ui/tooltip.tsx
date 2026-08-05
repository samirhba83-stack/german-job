'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/** docs/design-system/07-component-library.md — triggered by hover AND focus (keyboard-reachable),
 * dismissible via Escape, never the sole location of required information (docs/design-system/
 * 02-design-principles.md #4). */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 150);
  };
  const hide = () => {
    window.clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape') hide();
      }}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {/* M27.5 fix: previously conditionally mounted (`{open && ...}`), so the `transition-opacity`
          class below had no effect — an element can't fade in on the same frame it's created. Kept
          mounted always (with `invisible` removing it from hit-testing/screen-reader flow when
          closed, mirroring `pointer-events-none`) so opacity/translate actually transition. */}
      <span
        role="tooltip"
        id={id}
        aria-hidden={!open}
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-sm bg-neutral-900 px-2 py-1 text-caption text-inverse shadow-elevation-2',
          'transition-[opacity,transform] duration-fast ease-standard',
          side === 'top' ? 'bottom-full left-1/2 -translate-x-1/2' : 'top-full left-1/2 -translate-x-1/2',
          open
            ? cn('opacity-100', side === 'top' ? 'mb-1.5 translate-y-0' : 'mt-1.5 translate-y-0')
            : cn('invisible opacity-0', side === 'top' ? 'mb-1 -translate-y-0.5' : 'mt-1 translate-y-0.5'),
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
