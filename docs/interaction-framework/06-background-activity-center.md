# 6. Background Activity Center

## Real implementation

`lib/stores/background-activity-store.ts` (Zustand) + `components/shell/background-activity-center.tsx` (the header's activity icon and dropdown panel), populated exclusively by `lib/hooks/use-tracked-mutation.ts`.

## Milestone 22.2: from zero real callers to one, plus the fuller data model the milestone asked for

M22.2's self-review found the most consequential gap in the entire M22 shell here: `useTrackedMutation` and the Background Activity Center were fully built in M22, but nothing in the codebase actually called `useTrackedMutation` — `use-auth.ts`'s login/register/logout used a plain TanStack Query `useMutation` directly. The milestone's own centerpiece interaction mechanism had zero real users. This is fixed: `use-auth.ts` now uses `useTrackedMutation` for all three auth mutations, so every real login/register/logout in the product now produces a real Background Activity Center entry.

The milestone also asked each entry to expose Status, Timestamp, Duration, Current Step, Execution Identifier, Related Campaign, Related Company, and Current Recommendation. `BackgroundActivity` now carries `executionId`, `relatedCampaignId`, `relatedCompanyId`, `relatedRecommendationId`, and `currentStep` — all real, optional fields populated only by a caller that genuinely has one (`useTrackedMutation`'s new `activityContext` option); no current caller in this codebase sets any of them, since no real execution-tracking/campaign/recommendation page exists yet to originate one, so they render conditionally and are simply absent today. `getActivityDuration(activity)` computes a real, live duration (`(finishedAt ?? Date.now()) - startedAt`) rather than storing one that would go stale while a task is still running — `background-activity-center.tsx` calls it directly and formats it (`123ms` / `4.2s`).

A `queued` status was added to `BackgroundActivityStatus` for a real future case (a client-side concurrency-limited mutation queue) that doesn't exist yet — nothing sets it today, stated plainly here rather than left to look implemented, the same pattern as the pipeline-stage gaps in [03](03-execution-feedback.md).

## What "always know what's running, completed, or failed" means concretely

Every entry in the center is a real, client-initiated async operation — a real TanStack Query mutation in flight (updating a profile, creating a campaign, a lifecycle action) — never a fabricated background process. The store has four real states per entry (`queued`/`running`/`completed`/`failed`, `queued` reserved per above), each reachable state set by a real callback (`onMutate`/`onSuccess`/`onError`) firing at the real moment the underlying `fetch` promise resolves or rejects. There is no fabricated, simulated state.

## Retry (Milestone 22.2)

A `failed` entry with `retryable: true` and a real `retry` callback shows a Retry button (`background-activity-center.tsx`, `RotateCw` icon). `retryable` uses the exact same eligibility rule as `lib/api-client.ts`'s read-retry logic: a network failure or a real 5xx is retryable; a 4xx (validation, permission) is not, because retrying it verbatim would just fail the same way again — offering "Retry" there would be dishonest UI. `retry()` re-invokes the original mutation with its original variables (tracked in a `ref`, per [13, IDR-001](13-decision-records.md)'s existing pattern) — a real re-execution, not a page reload or a fresh form.

## Bounded growth (Milestone 22.2)

The store previously had no upper bound and could grow unboundedly over a long session. `MAX_FINISHED_ENTRIES = 50` now caps `completed`/`failed` entries via `pruneFinished()`; a `running` or `queued` entry is never pruned regardless of how many finished entries have accumulated.

## "Estimated remaining work" — the one requested feature this deliberately omits

The milestone's own example list includes "estimated remaining work." This is not implemented, and the reason is the same one that governs [03-execution-feedback.md](03-execution-feedback.md): no real backend signal exists that would let this estimate be honest. A real mutation (e.g. `PATCH /campaigns/:id`) typically resolves in well under a second — there's no meaningful "remaining work" to estimate for it, and inventing a percentage or a countdown for the sake of matching the example list would be exactly the "fake loading percentage" this milestone's own constraints explicitly forbid. If a future genuinely long-running operation is added to the platform (e.g. a bulk import), this field is a reasonable real addition to `BackgroundActivity` at that point — not before.

## Every background process remains visible until completed

A `running` entry is never removed or replaced — it transitions in place to `completed` or `failed` and stays visible (dismissible manually, or via `clearFinished()`) rather than disappearing the moment it resolves. This satisfies the milestone's literal requirement: the user can always look at the panel and see what just happened, not just what's currently in flight.

## Interaction with the Toast system

Every tracked mutation produces both a Background Activity Center entry (persistent, checkable after the fact) and a Toast (transient, immediate). These are deliberately not the same mechanism — a toast auto-dismisses in 5.5 seconds ([04](04-interaction-feedback-system.md)); the Background Activity Center entry is the durable record for a user who looks away and comes back. Neither is the sole source of truth for "did this happen" — the real, underlying data change (the campaign that was actually updated) is that, per [Product Experience's Trust Architecture](../product-experience/03-trust-architecture.md) "delivery evidence over assumed success" rule, applied here to the UI's own feedback mechanisms.
