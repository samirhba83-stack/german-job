import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { NAV_ITEMS } from '@/lib/navigation';

/**
 * Minimal shell landing content — deliberately not the real Dashboard (docs/frontend-
 * architecture/03-screen-inventory.md's Dashboard Home, with its Campaign Summary/Recent
 * Activity/Profile Completeness widgets, is explicitly reserved for the next milestone's
 * production pages, per this milestone's own "do not implement dashboard pages" constraint).
 * This page's only job is to prove the Application Shell renders and navigates correctly.
 */
export default function DashboardRootPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-display font-semibold text-primary md:text-display-md">Welcome back</h1>
      <p className="text-body text-secondary">Pick a workspace to get started.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.filter((item) => item.href !== '/').map((item) => (
          // `group` + `group-hover`, not Card's `interactive` prop — Milestone 22.3 audit fix.
          // `interactive` sets `tabIndex={0}` on the Card itself, which, nested inside this real
          // `<Link>`, produced the same double-focusable defect class M22.2 already fixed once in
          // DropdownMenuTrigger: two separately-tabbable elements for one visual, one action.
          <Link key={item.href} href={item.href} className="group">
            <Card
              padding="md"
              className="flex items-center gap-3 transition-[box-shadow,transform] duration-base ease-standard group-hover:-translate-y-px group-hover:shadow-elevation-2"
            >
              <item.icon className="h-5 w-5 text-accent" aria-hidden="true" strokeWidth={1.75} />
              <span className="text-body-sm font-medium text-primary">{item.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
