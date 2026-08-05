'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { UserRole } from '@german-job-engine/shared-types';
import { PrimarySidebar } from './primary-sidebar';

/** docs/interaction-framework/01-application-shell.md §Responsive Navigation. Sidebar becomes an
 * off-canvas Drawer below the `md` breakpoint (docs/frontend-architecture/04-dashboard-
 * architecture.md), reusing the Drawer visual spec (docs/design-system/07-component-library.md). */
export function MobileNavDrawer({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: UserRole | undefined;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgb(var(--color-scrim) / var(--opacity-scrim))` }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div role="dialog" aria-modal="true" aria-label="Navigation" className="absolute left-0 top-0 h-full w-72 bg-surface-raised shadow-elevation-3">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-heading-md font-semibold text-primary">Menu</span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-background-subtle"
          >
            <X className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
          </button>
        </div>
        <PrimarySidebar role={role} />
      </div>
    </div>
  );
}
