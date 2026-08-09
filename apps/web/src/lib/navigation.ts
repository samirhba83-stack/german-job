import {
  LayoutDashboard,
  Megaphone,
  FileText,
  Building2,
  Briefcase,
  Radar,
  CreditCard,
  Settings,
  ShieldCheck,
  Inbox,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '@german-job-engine/shared-types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | 'any';
  /** Real live surface today vs. a real-but-dormant/no-controller surface — rendered distinctly
   * (docs/frontend-architecture/12-architecture-decision-records.md ADR-008; docs/design-system/
   * 07-component-library.md Alert pattern), never hidden. */
  status: 'live' | 'dormant';
}

/** The permanent sidebar structure — one entry per product area from
 * docs/frontend-architecture/01-information-architecture.md, permission-filtered by real role
 * (docs/frontend-architecture/08-permission-matrix.md). */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: 'any', status: 'live' },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone, roles: [UserRole.CANDIDATE, UserRole.ADMIN], status: 'live' },
  { label: 'Applications', href: '/applications', icon: FileText, roles: 'any', status: 'live' },
  { label: 'Inbox', href: '/inbox', icon: Inbox, roles: [UserRole.CANDIDATE, UserRole.ADMIN], status: 'live' },
  { label: 'Tasks', href: '/tasks', icon: ListChecks, roles: [UserRole.CANDIDATE, UserRole.ADMIN], status: 'live' },
  { label: 'Companies', href: '/companies', icon: Building2, roles: 'any', status: 'live' },
  { label: 'Jobs', href: '/jobs', icon: Briefcase, roles: 'any', status: 'live' },
  { label: 'Mission Control', href: '/mission-control', icon: Radar, roles: 'any', status: 'dormant' },
  { label: 'Billing', href: '/billing', icon: CreditCard, roles: 'any', status: 'live' },
  { label: 'Settings', href: '/settings', icon: Settings, roles: 'any', status: 'live' },
  { label: 'Administration', href: '/admin', icon: ShieldCheck, roles: [UserRole.ADMIN], status: 'dormant' },
];

export function visibleNavItems(role: UserRole | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'any' || (role && item.roles.includes(role)));
}

/** Single source of truth for "is this NAV_ITEM the one this pathname is inside" — previously
 * duplicated inline in `PrimarySidebar` (Milestone 22.3 audit: extracted so `AppShell`'s route
 * guard, below, can reuse the exact same matching rule rather than risking a second, subtly
 * different implementation drifting from the Sidebar's own active-highlight logic. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
}

/** Finds the NAV_ITEM (if any) that owns the given pathname — the longest matching `href` wins,
 * so `/jobs/new` resolves to the `/jobs` item rather than accidentally matching `/` first. Used
 * by `AppShell`'s real role guard (Milestone 22.3 audit fix — role-based access was previously
 * enforced only by hiding a Sidebar entry, which never stopped direct navigation to the URL). */
export function findNavItemForPath(pathname: string): NavItem | undefined {
  const matches = NAV_ITEMS.filter((item) => isNavItemActive(item, pathname));
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}
