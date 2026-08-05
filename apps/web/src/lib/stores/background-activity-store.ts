import { create } from 'zustand';

export type BackgroundActivityStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface BackgroundActivityContext {
  /** A real correlation/execution id, once the dormant execution-tracking module gains a
   * controller (docs/frontend-architecture/01-information-architecture.md §1.8) — never
   * fabricated today; only ever set by a caller that genuinely has one. */
  executionId?: string;
  relatedCampaignId?: string;
  relatedCompanyId?: string;
  relatedRecommendationId?: string;
  /** A real, named sub-step within a multi-step mutation, if the caller has one — e.g. a future
   * multi-request save flow. Most of today's mutations are single-request and never set this. */
  currentStep?: string;
}

export interface BackgroundActivity extends BackgroundActivityContext {
  id: string;
  label: string;
  status: BackgroundActivityStatus;
  startedAt: number;
  finishedAt: number | null;
  errorMessage: string | null;
  /** Whether a real retry is available for a failed entry — true only for the same class of
   * failure lib/api-client.ts's read-retry logic already treats as transient (network/5xx, never
   * a 4xx validation/permission rejection, which retrying verbatim would just repeat). */
  retryable: boolean;
  /** Re-invokes the exact original mutation call — set only on entries that reached `failed`.
   * Real, not decorative: calling it actually re-runs lib/hooks/use-tracked-mutation.ts's mutation. */
  retry: (() => void) | null;
}

interface BackgroundActivityState {
  activities: BackgroundActivity[];
  start: (label: string, context?: BackgroundActivityContext) => string;
  complete: (id: string) => void;
  fail: (id: string, errorMessage: string, options: { retryable: boolean; retry: (() => void) | null }) => void;
  dismiss: (id: string) => void;
  clearFinished: () => void;
}

/** Bounds memory growth over a long session — a real, if minor, gap fixed in Milestone 22.2's
 * self-review (the store previously had no upper bound at all). Only finished (completed/failed)
 * entries are ever pruned; a running task is never dropped regardless of how many accumulate. */
const MAX_FINISHED_ENTRIES = 50;

function pruneFinished(activities: BackgroundActivity[]): BackgroundActivity[] {
  const running = activities.filter((activity) => activity.status === 'running' || activity.status === 'queued');
  const finished = activities.filter((activity) => activity.status === 'completed' || activity.status === 'failed');
  return [...running, ...finished.slice(0, MAX_FINISHED_ENTRIES)];
}

/**
 * docs/interaction-framework/06-background-activity-center.md. Tracks real, client-initiated
 * async operations only (a real TanStack Query mutation in flight) — never a fabricated pipeline
 * stage. `queued` exists in the status type for a real future case (a client-side concurrency-
 * limited mutation queue) that doesn't exist yet — nothing in this codebase sets it today, and
 * that's stated plainly in docs rather than left to look implemented. Every other status
 * (`running`/`completed`/`failed`) is reachable today via lib/hooks/use-tracked-mutation.ts.
 */
export const useBackgroundActivityStore = create<BackgroundActivityState>((set) => ({
  activities: [],

  start: (label, context) => {
    const id = crypto.randomUUID();
    set((state) => ({
      activities: pruneFinished([
        {
          id,
          label,
          status: 'running',
          startedAt: Date.now(),
          finishedAt: null,
          errorMessage: null,
          retryable: false,
          retry: null,
          ...context,
        },
        ...state.activities,
      ]),
    }));
    return id;
  },

  complete: (id) =>
    set((state) => ({
      activities: state.activities.map((activity) =>
        activity.id === id ? { ...activity, status: 'completed', finishedAt: Date.now() } : activity,
      ),
    })),

  fail: (id, errorMessage, { retryable, retry }) =>
    set((state) => ({
      activities: state.activities.map((activity) =>
        activity.id === id
          ? { ...activity, status: 'failed', finishedAt: Date.now(), errorMessage, retryable, retry }
          : activity,
      ),
    })),

  dismiss: (id) => set((state) => ({ activities: state.activities.filter((activity) => activity.id !== id) })),

  clearFinished: () =>
    set((state) => ({
      activities: state.activities.filter((activity) => activity.status === 'running' || activity.status === 'queued'),
    })),
}));

/** Real, computed duration — never stored (a stored number would go stale the instant a `running`
 * task kept running). Callers needing a live-updating duration re-invoke this on their own render
 * tick rather than reading a persisted field. */
export function getActivityDuration(activity: BackgroundActivity): number {
  return (activity.finishedAt ?? Date.now()) - activity.startedAt;
}
