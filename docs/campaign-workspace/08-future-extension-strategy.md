# 8. Future Extension Strategy

Every gap named in [03-integration-points.md](03-integration-points.md) has a real, specific, additive extension path — none of them require rewriting what this milestone shipped.

## When `recommendations`/`decision-intelligence` gain a controller

`SmartRecommendationPanel` already checks `campaign.intelligence?.recommendationExplanation` and renders it the moment it's non-null — no frontend change is needed at all for a single-explanation recommendation to start appearing. A richer, multi-recommendation panel (the milestone's example list implies several concurrent suggestions, not one) would need the backend to expose an array rather than a single string — at that point, this component's internal rendering swaps from one `<div>` to a `.map()`, a small, contained change; its data-fetching (`useCampaign`, already fetching the whole `CampaignDto`) wouldn't need to change unless the richer shape moves to its own endpoint.

## When a real per-target endpoint exists

The moment the backend exposes `GET /campaigns/:id/targets` (or similar) returning individual `{jobId, companyId, status, ...}` records, `TargetStatusBreakdown` is replaced by a real per-company table — a new component (following this milestone's own established patterns: a `features/campaigns/hooks/use-campaign-targets.ts` query hook, a `CAMPAIGN_TARGET_STATUS_TONE`-driven table). The aggregate breakdown component doesn't need to be deleted immediately either — it remains a legitimate "at a glance" summary even once per-target detail exists, the same way `CampaignExecutionStatusDto.targetBreakdown` would likely remain a real, useful aggregate even after a detail endpoint ships.

## When Applications gain a real `campaignId` and a matching query filter

`OperationalAnalytics` gains real reply/interview/delivery-confirmation tiles the moment `GET /applications/search` accepts a `campaignId` parameter — additive tiles alongside the existing real ones (Coverage, Failure rate), which stay correct and don't need to change.

## When a real health-assessment engine starts calling `recordHealthAssessment()`

Nothing in the frontend needs to change at all. `CampaignHealthCenter` and `getMissionStatus()`'s `context` parameter already read `campaign.health.healthScore`/`.computedAt` — they're wired to real data today, just data that happens to always be `null`. The moment a production code path populates it, the confidence percentage and "Numeric health scoring isn't computed yet" note both update correctly with zero code change, exactly the "structurally ready, not yet reachable" pattern this whole project has used since M22.2's Background Activity Center `queued` status.

## Retry/Replay

Requires a real per-target endpoint (see above) first, since both actions need a real way to construct their `targetIds`/`scope`. Once that exists, `use-campaign-actions.ts` gains two more `useTrackedMutation` entries following the exact same pattern as the six already there — no new pattern needs to be invented.

## Real campaign creation (`/campaigns/new`)

Out of this milestone's explicit scope (the milestone's 10 sections describe an *existing* campaign's workspace, not a creation flow) — the M22.3 honest placeholder remains at `/campaigns/new`. A real creation form is real, substantial future work (the backend's `CreateCampaignDto` has a wide surface: goal, strategy, batch plan, execution window, rate limits) better suited to its own focused milestone than an addendum to this one.
