# 5. Mission Status Layer

## Real implementation: `lib/mission-status.ts`

The milestone's requested states are implemented as a pure function, `getMissionStatus(campaignStatus: CampaignStatus, context?: MissionStatusContext): MissionStatusDescriptor`, derived entirely from the real, live `CampaignStatus` enum — never a new, parallel state machine. `CampaignStatus` remains authoritative everywhere else (the Status Badge, filters, API calls); Mission Status is a relabeling layer for operational language, not a second source of truth.

**Milestone 22.2** expanded the original seven states to nine, splitting `Waiting` into two real, distinct backend states rather than collapsing them: `COOLING_DOWN` (a deliberate slowdown, nothing wrong) now stays `Waiting`, while `RESUMING` (actively coming back from a pause/cooldown) becomes its own `Recovering` state — the milestone's own requested addition, backed by a real enum value already in the domain, not invented. `CANCELLED` also gets its own `Cancelled` state instead of being folded into `Idle` — a user's deliberate cancellation is a distinct, terminal outcome from "never started," per [Product Experience's Emotional Journey](../product-experience/02-emotional-journey.md).

## The mapping

| Real `CampaignStatus` | Mission Status | Why |
|---|---|---|
| `DRAFT` | Idle | Nothing has been configured to run yet |
| `READY` | Preparing | Configured, not yet started |
| `RUNNING` | Running | Active |
| `PAUSED` | Paused | User-initiated hold |
| `COOLING_DOWN` | Waiting | Between active batches — a deliberate, real, transient backend state |
| `RESUMING` | Recovering | Actively coming back from a pause or cooldown — a real, distinct backend state (Milestone 22.2) |
| `COMPLETED` | Completed | Goal reached |
| `STOPPED` | Attention Required | Stopped before reaching its goal — distinct from a user's own `CANCELLED` choice, per [Product Experience's Emotional Journey](../product-experience/02-emotional-journey.md) "Failed campaign" distinction |
| `CANCELLED` | Cancelled | The user's own deliberate, terminal choice — no longer folded into `Idle` as of Milestone 22.2 |
| `ARCHIVED` | Idle | Terminal, no longer actionable (unchanged; out of this milestone's explicit ask) |

## Each state's real identity, explanation, and recommended action

Every `MissionStatusDescriptor` carries the fields the milestone requires — `label`, a real `tone` (`BadgeTone`, resolving through the exact same [design-system semantic tokens](../design-system/03-design-tokens.md) every other status in the product uses, never a bespoke color), `explanation`, and `recommendedAction` (nullable — `Running` and `Waiting` have none, honestly, since there's nothing for the user to do while a campaign is actively progressing on its own).

## Confidence and last-update time (Milestone 22.2)

`GetMissionStatus`'s optional second argument, `context?: { health?: { healthScore: number | null; computedAt: string } | null; updatedAt?: string }`, wires `MissionStatusDescriptor.confidence` and `.lastUpdateTime` to the real, live `CampaignHealth.healthScore`/`.computedAt` fields (`GET /campaigns/:id`'s `health` property, or `GET /campaigns/:id/health` directly — both real, live endpoints). Both fields default to `null`, never a fabricated value, when the caller has no health context — which is every caller in this milestone, honestly: no page that would fetch a real `Campaign` exists yet (that's the Campaign Workspace, [M23](14-risks-and-future-expansion.md) scope), so `getMissionStatus()` is called with no second argument anywhere in this codebase today. The parameter exists so the Campaign Workspace can wire real confidence in without changing this function's contract, mirroring the `queued` Background Activity status pattern ([06](06-background-activity-center.md)): structurally supported, honestly not yet reachable.

## What's deliberately not built

A cross-campaign "mission status" aggregate (e.g. "3 campaigns running, 1 attention required" as a single platform-wide indicator) is not implemented — it would require the same cross-campaign aggregation [M20's Mission Control](../frontend-architecture/01-information-architecture.md) already identifies as blocked on a dormant module gaining a controller. `getMissionStatus()` operates on one real campaign at a time today, which is exactly what the live `GET /campaigns/:id`/`GET /campaigns/:id/execution-status` endpoints can honestly support.
