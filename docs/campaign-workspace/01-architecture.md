# 1. Architecture

## Where this fits in the existing layering

No existing architectural decision from M20–M22.3 was redesigned or replaced, per this milestone's own explicit constraint. The Campaign Workspace is built entirely within the three-tier component model M20 already established (`components/ui` primitives → `components/shell` composition → `features/*` product slices, one-directional) and the feature-slice pattern already used by `features/auth`:

```
apps/web/src/
├── features/campaigns/
│   ├── types/index.ts        — re-exports the real shared-types DTOs
│   ├── api/campaigns.api.ts  — real apiClient calls, one per real endpoint
│   ├── hooks/                — TanStack Query reads + useTrackedMutation writes
│   └── components/           — the workspace's own UI, composed in campaign-workspace.tsx
├── features/profiles/        — new, minimal: only what the Overview's "Profile Readiness" field needs
├── lib/campaign-lifecycle-stages.ts   — real timeline → ExecutionStage[] mapping
├── lib/status-mappings.ts             — extended with CAMPAIGN_TARGET_STATUS_TONE
└── app/(dashboard)/campaigns/
    ├── page.tsx               — real list (replaces the M22.3 honest placeholder)
    ├── [id]/page.tsx          — real workspace (new)
    └── new/page.tsx           — unchanged M22.3 placeholder (out of this milestone's scope, see §8)
```

`packages/shared-types/src/dto/campaign.dto.ts` is new — the campaigns module was the first real frontend consumer of the campaigns API, and no shared DTO existed yet (mirroring the existing pattern already used for `application.dto.ts`, `company.dto.ts`, etc.). Every field in it is a direct, verified mirror of the backend's own `campaign-response.dto.ts` — nothing was invented or renamed on the way across the boundary.

## What was reused, not rebuilt

- **`ExecutionStageList`** (`components/shell/execution-stage-list.tsx`, built in M22 for the Application lifecycle) — the Campaign Lifecycle section feeds it real `ExecutionStage[]` via a new mapping function, `lib/campaign-lifecycle-stages.ts`, following the exact same pattern as the existing `lib/application-lifecycle-stages.ts`. The component's contract didn't change at all.
- **`TrustFeedbackCard`** (`components/shell/trust-feedback-card.tsx`, built in M22.2, previously uninstantiated) — the Campaign Health Center is its first real caller.
- **`getMissionStatus()`** (`lib/mission-status.ts`, built in M22/M22.2) — its `context` parameter (added in M22.2 specifically so a future caller could wire real `CampaignHealth` in without a breaking change) is used for the first time here, by both the Overview and the Health Center.
- **`useTrackedMutation`** (`lib/hooks/use-tracked-mutation.ts`) — every one of the six real lifecycle actions goes through it.
- **`ContextHeader`** (built in M22.2) — the campaign list page's title.
- **`Card`, `Badge`, `Button`, `Input`, `Skeleton`** — no new primitives were added to `components/ui/` at all this milestone; every visual element composes from what M21/M22 already shipped.
- **`lib/status-mappings.ts`**'s single-source-of-truth pattern — extended with one new table (`CAMPAIGN_TARGET_STATUS_TONE`), not a parallel mechanism.

## What's genuinely new

- The `features/campaigns/` and `features/profiles/` slices themselves (no campaign or profile frontend consumer existed before this milestone).
- `lib/campaign-lifecycle-stages.ts`.
- Six new workspace-specific components under `features/campaigns/components/` (Overview, Actions, Health Center, Progress Log, Target Status Breakdown, Operational Analytics, Smart Recommendation Panel, Campaign List — see [05-component-hierarchy.md](05-component-hierarchy.md) for the full composition).

## Dependency direction, verified

`features/campaigns` depends on `components/ui`, `components/shell`, and `lib/` — never the reverse. `features/profiles` is a leaf with no dependents outside `features/campaigns`' Overview component. Neither introduces a new dependency direction beyond what M20's own component-architecture document already specifies (features consume composites/primitives, never the other way around).
