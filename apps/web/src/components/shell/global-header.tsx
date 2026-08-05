'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, X } from 'lucide-react';
import type { UserRole } from '@german-job-engine/shared-types';
import { GlobalSearchEntry } from './global-search-entry';
import { QuickActions } from './quick-actions';
import { BackgroundActivityCenter } from './background-activity-center';
import { NotificationArea } from './notification-area';
import { ProfileMenu } from './profile-menu';
import { ThemeSwitcher } from './theme-switcher';
import { WorkspaceSwitcher } from './workspace-switcher';

/** docs/interaction-framework/01-application-shell.md §Global Header. Owns identity/global
 * actions only — never duplicates Sidebar navigation or page-level actions
 * (docs/frontend-architecture/04-dashboard-architecture.md). */
export function GlobalHeader({ role, onMenuClick }: { role: UserRole | undefined; onMenuClick: () => void }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  if (mobileSearchOpen) {
    // A dedicated mobile search row, not a cramped inline search inside the normal header —
    // fixes a real gap (docs/interaction-framework/13-decision-records.md IDR-008): the desktop
    // search entry was previously unreachable below the md breakpoint entirely.
    return (
      <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
        <GlobalSearchEntry variant="mobile" autoFocus />
        <button
          type="button"
          aria-label="Close search"
          onClick={() => setMobileSearchOpen(false)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-background-subtle"
        >
          <X className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      </header>
    );
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-background-subtle md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
      </button>
      {/* Milestone 24 live-validation fix: the full wordmark plus QuickActions' text label plus
          four icon buttons genuinely overflowed a real 375px mobile viewport by 138px — found by
          rendering the page at that width, not by reading the code. Every other header element
          already collapses at a breakpoint (WorkspaceSwitcher at `sm`, GlobalSearchEntry at `md`);
          this brings the wordmark in line with that same established pattern rather than
          introducing a new one — full name from `sm:` up, a real, still-labeled home link below it. */}
      <Link href="/" className="shrink-0 text-heading-md font-semibold text-primary">
        <span aria-hidden="true" className="sm:hidden">GJE</span>
        <span className="sr-only sm:not-sr-only">German Job Engine</span>
      </Link>
      <WorkspaceSwitcher />
      <GlobalSearchEntry />
      <button
        type="button"
        aria-label="Search"
        onClick={() => setMobileSearchOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-background-subtle md:hidden"
      >
        <Search className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <QuickActions role={role} />
        <BackgroundActivityCenter />
        <NotificationArea />
        <ThemeSwitcher />
        <ProfileMenu />
      </div>
    </header>
  );
}
