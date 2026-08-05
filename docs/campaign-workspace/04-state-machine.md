# 4. State Machine

## The real `CampaignStatus` enum

`packages/shared-types/src/enums/campaign-status.enum.ts` — 10 real values: `DRAFT, READY, RUNNING, PAUSED, COOLING_DOWN, RESUMING, COMPLETED, STOPPED, CANCELLED, ARCHIVED`. This is the platform's only real campaign state machine; the workspace never introduces a second, parallel one.

## How the workspace visualizes it — two views, one source of truth

**Lifecycle tracker** (`lib/campaign-lifecycle-stages.ts` → `ExecutionStageList`) — a 4-stage "happy path" (`Draft → Ready → Running → Completed`). The three transient sub-states of being in the Running phase (`PAUSED`, `COOLING_DOWN`, `RESUMING`) are folded into the Running stage rather than drawn as separate boxes — they're real, but they're states *within* Running, not stages a campaign visits once and leaves. The Running stage's explanation/recommended-action text reflects whichever of the three (or plain Running) is actually current, via `getMissionStatus()`.

**Off-path resolution, using real evidence**: `STOPPED`, `CANCELLED`, and `ARCHIVED` aren't on the happy path at all. Rather than assume every off-path status happened "during Running" (a real campaign can be cancelled straight from Draft or Ready), `resolveEffectiveIndex()` reads the real timeline's `previousState` field on the transition that led to the current status, and marks *that* stage as `failed` — one real level of lookback, not a guess.

**Failure-path detection for `ARCHIVED`**: archiving is not itself a failure — a successfully `COMPLETED` campaign gets archived too. `isFailurePath()` checks whether the real transition into `ARCHIVED` came from `COMPLETED` (not a failure) or anywhere else (treated as a failure path, since it means the campaign was archived without ever reaching its goal).

**Progress log** (`CampaignProgressLog`) — the same real timeline, rendered a second way: as a flat, reverse-chronological event log rather than a stage tracker, satisfying the milestone's request for a granular per-event view (Execution ID/Timestamp/Status/Evidence/Explanation) without duplicating data-fetching.

## Mapping table

| Real `CampaignStatus` | Lifecycle stage shown | Mission Status label (via `getMissionStatus`) |
|---|---|---|
| `DRAFT` | Draft (active) | Idle |
| `READY` | Ready (active) | Preparing |
| `RUNNING` | Running (active) | Running |
| `PAUSED` | Running (active, Paused framing) | Paused |
| `COOLING_DOWN` | Running (active, Waiting framing) | Waiting |
| `RESUMING` | Running (active, Recovering framing) | Recovering |
| `COMPLETED` | Completed (complete) | Completed |
| `STOPPED` | Diverged stage marked failed | Attention required |
| `CANCELLED` | Diverged stage marked failed | Cancelled |
| `ARCHIVED` | Diverged stage marked failed unless archived-from-Completed | Idle |

Every label in the right two columns was already real, live code before this milestone (`lib/mission-status.ts`, M22/M22.2) — the Lifecycle stage mapping is new; the label vocabulary underneath it is entirely reused.
