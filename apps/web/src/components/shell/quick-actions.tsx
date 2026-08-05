'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@german-job-engine/shared-types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** docs/interaction-framework/01-application-shell.md §Quick Actions — role-appropriate
 * shortcuts, permission-filtered per docs/frontend-architecture/08-permission-matrix.md. Pure
 * navigation, no new data (docs/frontend-architecture/04-dashboard-architecture.md). */
export function QuickActions({ role }: { role: UserRole | undefined }) {
  const router = useRouter();

  const actions =
    role === UserRole.EMPLOYER
      ? [
          { label: 'Post a job', href: '/jobs/new' },
          { label: 'Add a company', href: '/companies/new' },
        ]
      : [{ label: 'New campaign', href: '/campaigns/new' }];

  if (actions.length === 1) {
    return (
      <Button size="sm" onClick={() => router.push(actions[0]!.href)}>
        <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
        {/* Milestone 24 live-validation fix: this label, plus the header wordmark, plus four
            icon buttons genuinely overflowed a real 375px mobile viewport — found by rendering
            the page at that width. `sr-only sm:not-sr-only` keeps the real accessible name at
            every viewport (never just an aria-label duplicate that could drift from this text)
            while only showing it visually from `sm:` up. */}
        <span className="sr-only sm:not-sr-only">{actions[0]!.label}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          <span className="sr-only sm:not-sr-only">Quick actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem key={action.href} onSelect={() => router.push(action.href)}>
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
