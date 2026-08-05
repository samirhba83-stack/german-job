'use client';

import { ChevronsUpDown, Check, Building2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/**
 * docs/interaction-framework/01-application-shell.md §Workspace Switcher.
 *
 * Grounding: no multi-workspace/organization/team concept exists in the backend today — a
 * `UserRole` is a single value per user, and there is no `Enterprise` account tier
 * (docs/frontend-architecture/13-risks-and-open-questions.md OQ-14, docs/frontend-architecture/
 * 08-permission-matrix.md "Future Enterprise Accounts"). Every real user has exactly one real
 * workspace: their own account. This component is real and functional today — it shows that one
 * real workspace, correctly checked — structured so that if a multi-workspace concept is ever
 * added, this becomes a real switcher by adding more items, with zero redesign. It does not
 * render a second, fake "Add workspace" or "Switch team" option today, because neither exists.
 */
export function WorkspaceSwitcher() {
  const { user } = useAuth();

  if (!user) return null;

  const workspaceName = user.email.split('@')[0] ?? user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-body-sm font-medium text-primary hover:bg-background-subtle sm:flex"
        >
          <Building2 className="h-4 w-4 text-secondary" aria-hidden="true" strokeWidth={1.75} />
          <span className="max-w-[10rem] truncate">{workspaceName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-secondary" aria-hidden="true" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="px-2 py-1.5 text-caption font-semibold uppercase tracking-wide text-secondary">Workspace</div>
        <DropdownMenuItem onSelect={() => undefined}>
          <Building2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          <span className="flex-1 truncate">{workspaceName}</span>
          <Check className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
