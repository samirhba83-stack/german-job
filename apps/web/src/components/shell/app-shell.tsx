'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { refreshAccessToken } from '@/lib/api-client';
import { findNavItemForPath } from '@/lib/navigation';
import { GlobalHeader } from './global-header';
import { PrimarySidebar } from './primary-sidebar';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { Breadcrumbs } from './breadcrumbs';
import { NotYetAvailable } from './not-yet-available';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * docs/interaction-framework/01-application-shell.md. The permanent shell every future page
 * lives inside — this component is never recreated per screen (per the milestone's own
 * instruction); screens only ever fill the Workspace Area (the `children` slot below).
 *
 * Auth guard: middleware.ts only checks a coarse, non-httpOnly cookie (a UX redirect, not a real
 * boundary — docs/frontend-architecture/07-state-management-strategy.md ADR-003 note). The real
 * check happens here, client-side, against the Zustand auth store, which is the only place a
 * decoded, verified-by-the-backend session actually lives.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Individual atomic selectors, not a whole-store destructure (Milestone 22.2 self-review
  // fix): `useAuthStore()` with no selector subscribes AppShell to every field in the store,
  // including `accessToken`, which changes on every token refresh (docs/frontend-architecture/
  // 06-api-consumption-architecture.md's silent-refresh flow) — re-rendering the entire shell,
  // header, sidebar, and breadcrumbs on every refresh cycle for no visible reason. These four
  // selectors only re-render AppShell when one of these four specific values actually changes.
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [bootRefreshing, setBootRefreshing] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !refreshToken) {
      router.replace('/login');
    }
  }, [hydrated, refreshToken, router]);

  // M25 sign-off audit fix: `accessToken`/`user` are deliberately never persisted (ADR-003), so
  // every full page reload restores `refreshToken` from storage but leaves `user` null. Without
  // this, the role guard below evaluates with `user === null` and shows a false "Access
  // restricted" on any role-gated route (e.g. /campaigns) — nothing else would ever trigger a
  // refresh, since the child page that would make the API call whose 401 triggers one is exactly
  // what the (incorrectly) failing guard prevents from rendering. Proactively refreshes once,
  // before the guard is evaluated, whenever hydration restored a session to resume but not yet
  // the decoded user it implies.
  // Derived synchronously from render state (not just `bootRefreshing`, which an effect sets one
  // commit later) — found via M27 live-browser testing: the Billing Workspace fires two
  // authenticated queries (`/billing/status`, `/billing/ledger`) in parallel the instant its
  // children mount, and on a hard page reload both raced ahead of the effect below on the very
  // first commit where `hydrated && refreshToken && !user` became true (the gate check still saw
  // `bootRefreshing === false`, since the state-setting effect hadn't run yet), hitting the API
  // with no access token and a real 401 before the retry-on-401 path in api-client.ts recovered
  // it. Recomputing the same condition inline closes that one-commit gap: it's true on the exact
  // same render the effect below will act on, so the gate blocks children before they ever mount.
  const awaitingBootRefresh = hydrated && Boolean(refreshToken) && !user;

  useEffect(() => {
    if (awaitingBootRefresh) {
      setBootRefreshing(true);
      refreshAccessToken().finally(() => setBootRefreshing(false));
    }
  }, [awaitingBootRefresh]);

  if (!hydrated || (!refreshToken && !user) || awaitingBootRefresh || bootRefreshing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton variant="card" className="h-24 w-64" />
      </div>
    );
  }

  // Real route-level role protection (Milestone 22.3 audit fix). Before this, a role restriction
  // (e.g. Administration being ADMIN-only) was enforced only by `visibleNavItems()` hiding the
  // Sidebar entry — nothing stopped a non-admin from navigating to `/admin` directly by URL.
  // This mirrors `docs/frontend-architecture/08-permission-matrix.md`'s own "hidden ≠ secured"
  // principle, previously applied only to the marketing-copy layer, now applied to routing too.
  // Still not a real security boundary on its own — the backend's own guards are that — but it
  // closes the gap between what the Sidebar implies is restricted and what navigation actually
  // enforces.
  const matchedNavItem = findNavItemForPath(pathname);
  const roleAllowed = !matchedNavItem || matchedNavItem.roles === 'any' || (user && matchedNavItem.roles.includes(user.role));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <GlobalHeader role={user?.role} onMenuClick={() => setMobileNavOpen(true)} />
      <div className="mx-auto flex w-full max-w-content flex-1">
        <PrimarySidebar role={user?.role} className="hidden w-60 shrink-0 border-r border-border md:flex" />
        <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} role={user?.role} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 3xl:px-8">
          <div className="mb-4">
            <Breadcrumbs />
          </div>
          {roleAllowed ? (
            children
          ) : (
            <NotYetAvailable title="Access restricted" reason="Your account role doesn't have access to this area." />
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
