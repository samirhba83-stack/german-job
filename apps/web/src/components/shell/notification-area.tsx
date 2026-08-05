'use client';

import { Bell } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/**
 * docs/interaction-framework/01-application-shell.md §Notification Area. No notification backend
 * module exists anywhere in the platform yet (docs/frontend-architecture/01-information-
 * architecture.md §1.10; docs/product-experience/09-notification-strategy.md) — this renders a
 * permanently honest empty state rather than simulating notifications by polling/diffing existing
 * endpoints, which docs/frontend-architecture/03-screen-inventory.md explicitly warns against as
 * a correctness trap (missed transitions, no delivery guarantee) masquerading as a feature.
 */
export function NotificationArea() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-background-subtle"
        >
          <Bell className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="w-72 p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Notifications</p>
          <p className="mt-2 text-body-sm text-secondary">
            Notifications aren&apos;t available yet — check back here as this feature becomes available.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
