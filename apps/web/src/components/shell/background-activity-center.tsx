'use client';

import { CheckCircle2, Loader2, XCircle, X, RotateCw, Clock } from 'lucide-react';
import { useBackgroundActivityStore, getActivityDuration, type BackgroundActivity } from '@/lib/stores/background-activity-store';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ActivityRow({ activity }: { activity: BackgroundActivity }) {
  const dismiss = useBackgroundActivityStore((state) => state.dismiss);

  return (
    <li className="flex items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-background-subtle">
      {activity.status === 'running' && (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden="true" strokeWidth={1.75} />
      )}
      {activity.status === 'completed' && (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-positive" aria-hidden="true" strokeWidth={1.75} />
      )}
      {activity.status === 'failed' && (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" aria-hidden="true" strokeWidth={1.75} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm text-primary">{activity.label}</p>
        {activity.currentStep && <p className="truncate text-caption text-secondary">{activity.currentStep}</p>}
        {activity.status === 'failed' && activity.errorMessage && (
          <p className="text-caption text-status-critical">{activity.errorMessage}</p>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-caption text-secondary">
          <Clock className="h-3 w-3" aria-hidden="true" strokeWidth={1.75} />
          <span>{formatDuration(getActivityDuration(activity))}</span>
        </div>
      </div>
      {activity.status === 'failed' && activity.retryable && activity.retry && (
        <button
          type="button"
          aria-label={`Retry ${activity.label}`}
          onClick={() => activity.retry?.()}
          className="shrink-0 text-secondary hover:text-accent"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      )}
      {activity.status !== 'running' && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismiss(activity.id)}
          className="shrink-0 text-secondary hover:text-primary"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      )}
    </li>
  );
}

/**
 * docs/interaction-framework/06-background-activity-center.md. Users should always know what's
 * currently running, what completed, what failed — every entry here is a real, client-initiated
 * mutation tracked by lib/hooks/use-tracked-mutation.ts, never a fabricated background process.
 * `currentStep`/`relatedCampaignId`/etc. render only when a real caller actually provided them
 * (docs/interaction-framework/13-decision-records.md) — nothing here is populated by guesswork.
 * "Estimated remaining work" (the milestone's own example) is still deliberately not shown: no
 * real backend signal exists to estimate remaining duration honestly.
 */
export function BackgroundActivityCenter() {
  const activities = useBackgroundActivityStore((state) => state.activities);
  const runningCount = activities.filter((activity) => activity.status === 'running').length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          aria-label={runningCount > 0 ? `${runningCount} background task(s) running` : 'Background activity'}
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-background-subtle"
        >
          <Loader2
            className={cn('h-5 w-5', runningCount > 0 && 'animate-spin text-accent')}
            aria-hidden="true"
            strokeWidth={1.75}
          />
          {runningCount > 0 && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="w-80 px-2 py-1.5">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Activity</p>
        </div>
        {activities.length === 0 ? (
          <p className="px-3 py-4 text-body-sm text-secondary">No recent activity.</p>
        ) : (
          <ul aria-live="polite" className="max-h-80 overflow-y-auto">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
