'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { visibleNavItems, isNavItemActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { UserRole } from '@german-job-engine/shared-types';

/**
 * docs/interaction-framework/01-application-shell.md §Primary Sidebar. Active-route highlighting
 * derived from the router (never local state, docs/frontend-architecture/04-dashboard-
 * architecture.md). Dormant areas (Mission Control, Administration) render with a muted "Soon"
 * marker rather than being hidden — docs/frontend-architecture ADR-008.
 */
export function PrimarySidebar({ role, className }: { role: UserRole | undefined; className?: string }) {
  const pathname = usePathname();
  const items = visibleNavItems(role);

  return (
    <nav aria-label="Primary" className={cn('flex flex-col gap-1 p-3', className)}>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-body-sm font-medium',
              'transition-colors duration-fast ease-standard',
              active ? 'bg-accent/10 text-accent' : 'text-secondary hover:bg-background-subtle hover:text-primary',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.status === 'dormant' && (
              <span className="rounded-full bg-status-neutral/10 px-1.5 py-0.5 text-caption font-semibold text-status-neutral">
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
