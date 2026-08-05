import type { ReactNode } from 'react';

export interface ContextHeaderProps {
  /** The real resource name this page is about (a campaign's real name, a company's real name)
   * — never a generic page title once real data exists; callers pass the actual fetched value. */
  title: string;
  /** A real status/summary element — typically a MissionStatusBadge (05-mission-status.md) or a
   * Status Badge (docs/design-system/07-component-library.md), never decorative. */
  status?: ReactNode;
  /** Real, page-specific actions (docs/frontend-architecture/04-dashboard-architecture.md — "page
   * header's own actions, not the shell's"). */
  actions?: ReactNode;
}

/**
 * docs/interaction-framework/01-application-shell.md §Context Header — the layout primitive
 * every future workspace page (Campaign, Company) uses to answer "which [campaign/company] am I
 * looking at, what's its status, what can I do here" in one consistent place, directly below the
 * Breadcrumbs. This is a real, generic layout component; it renders no data of its own — every
 * prop is real data the calling page already fetched, never invented here.
 */
export function ContextHeader({ title, status, actions }: ContextHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-display font-semibold text-primary md:text-display-md">{title}</h1>
        {status}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
