'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/navigation';

/** docs/interaction-framework/01-application-shell.md §Breadcrumbs — derived automatically from
 * the route, never manually maintained per screen (docs/frontend-architecture/04-dashboard-
 * architecture.md). Tabs (a route segment within a detail screen) are not breadcrumb segments —
 * this only reflects hierarchy, matching docs/frontend-architecture/09-navigation-architecture.md's
 * "tabs are lateral, not hierarchical" rule. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const rootLabel = NAV_ITEMS.find((item) => item.href === `/${segments[0]}`)?.label ?? humanize(segments[0]);

  const crumbs = [
    { label: 'Dashboard', href: '/' },
    { label: rootLabel, href: `/${segments[0]}` },
    ...segments.slice(1).map((segment, index) => ({
      label: humanize(segment),
      href: `/${segments.slice(0, index + 2).join('/')}`,
    })),
  ];

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-body-sm text-secondary">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />}
            {isLast ? (
              <span aria-current="page" className="font-medium text-primary">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-primary hover:underline">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function humanize(segment: string): string {
  // Route-param-shaped segments (ids) don't have a human label to derive — the owning screen's
  // own data-fetch will show the real name; the breadcrumb just avoids showing a raw UUID.
  if (/^[0-9a-f-]{16,}$/i.test(segment)) return 'Detail';
  return segment
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}
