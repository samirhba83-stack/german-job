import { Skeleton } from '@/components/ui/skeleton';

/**
 * Next.js App Router route-level loading boundary — automatic, shape-matching skeleton shown
 * during route transitions and server-side data fetches inside the Workspace Area, per
 * docs/frontend-architecture/10-ux-principles.md's default loading pattern. Previously missing
 * entirely (Milestone 22.2 self-review): without this file, a slow page transition rendered
 * nothing until the new route's content was fully ready — a real, if brief, "is the app broken"
 * moment this directly closes.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <Skeleton variant="text-line" className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}
