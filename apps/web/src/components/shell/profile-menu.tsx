'use client';

import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** docs/interaction-framework/01-application-shell.md §Profile Menu — real authenticated-user
 * data only (decoded from the real JWT, lib/stores/auth-store.ts); renders nothing if there's no
 * real session rather than a placeholder identity. */
export function ProfileMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button type="button" aria-label="Account menu" className="rounded-full">
          <Avatar name={user.email} id={user.id} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="truncate text-body-sm font-semibold text-primary">{user.email}</p>
          <p className="text-caption text-secondary">{user.role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem href="/profile">
          <UserIcon className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem href="/settings">
          <Settings className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} destructive>
          <LogOut className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
