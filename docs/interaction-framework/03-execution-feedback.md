# 3. Real-Time Execution Feedback

## The honesty line this section draws, precisely

The milestone's own example stages — "Preparing Campaign, Loading Profile, Analyzing Companies, Selecting Companies, Generating CV Package, Generating Motivation Letter, Validating Documents, Checking Policies, Preparing Email, Uploading Attachments, Sending Email, Waiting Delivery Confirmation, Campaign Completed" — map onto two genuinely different categories of backend reality, and this implementation treats them differently on purpose.

| Example stage | Real backend state? | Where it lives |
|---|---|---|
| Loading Profile | 🟢 Real, live | `GET /profiles/me` |
| Preparing Email, Sending Email, Waiting Delivery Confirmation | 🟢 Real, live (relabeled) | `ApplicationLifecycleStatus.PREPARED/QUEUED/SENT/DELIVERED` |
| Campaign Completed | 🟢 Real, live | `CampaignStatus.COMPLETED` |
| Analyzing Companies, Selecting Companies, Generating CV Package, Generating Motivation Letter, Validating Documents, Checking Policies | 🟡 Real domain concept, **zero HTTP exposure** | `recommendations`, `application-assembly`, `business-policy-enforcement` modules (all dormant, no controller — [M20 §1](../frontend-architecture/01-information-architecture.md)) |

**The constraint this milestone repeats three times** — "use only real execution states," "never simulate progress," "do NOT create mock workflows" — makes the second row impossible to build honestly today. There is no event, no poll target, no partial-response endpoint that would let a real UI show "Analyzing 24 eligible companies..." with an actual count of 24 behind it. Building that stage list with invented numbers would be exactly the fabrication this whole project's discipline (M14 through M21) has consistently refused to do.

## What was actually built

`components/shell/execution-stage-list.tsx` — a generic, data-source-agnostic `ExecutionStageList` component. It renders whatever `ExecutionStage[]` it's given (`{ id, label, status: 'pending'|'active'|'complete'|'failed', occurredAt?, explanation?, evidence?, recommendedNextAction? }`) and nothing else — it has no built-in knowledge of campaigns, companies, or CVs. This is the real, reusable piece of infrastructure the milestone asked for.

**Explanation/Evidence/Recommended Next Action (Milestone 22.2)**: the milestone asked each execution state to expose these three things. Only two have a real backend field to draw from — a real `ApplicationLifecycleStatus` timeline entry carries an optional `TransitionReason.note` (wired as `explanation`) and an optional `EvidenceReference` (`{ type, externalId, url }`, wired as `evidence`, rendered as a link when a `url` exists). `recommendedNextAction` is kept in the `ExecutionStage` type but is never populated by `toSendExecutionStages()` — no backend field for a per-stage recommended action exists on a timeline entry today, and this milestone's own discipline (restated from [Career Intelligence's evidence-threshold rule](../career-intelligence/README.md)) forbids inventing one. Most real transitions today have neither a reason note nor evidence, so most stages still render as label + icon + timestamp only — the honest state of the data, not an unfinished rendering.

`lib/application-lifecycle-stages.ts` — the one real data source wired to it today: `toSendExecutionStages()` maps an application's actual current `ApplicationLifecycleStatus` plus its real transition timeline (`GET /applications/:id/timeline`) into that generic shape. Every `occurredAt` is a real, recorded transition timestamp; a stage with no matching timeline entry renders `pending`, never given a fabricated time.

`ExecutionFeedbackUnavailable` — the honest counterpart, a small dashed-border placeholder for exactly the situation the second table row describes: real domain concept, no backend surface. It exists so a future screen that wants to show "Analyzing Companies" has a real, designed component to render instead of either fabricating data or leaving a blank gap.

## What this means for a future implementer

The moment `recommendations`, `application-assembly`, or `business-policy-enforcement` gains a controller (and, per [Career Intelligence's grounding](../career-intelligence/README.md), a real event/progress signal to poll or subscribe to), wiring it into `ExecutionStageList` is additive — the component's contract doesn't change, only a new data-mapping function (parallel to `application-lifecycle-stages.ts`) needs to be written. Nothing here needs to be redesigned when that happens, matching the "additive, not a redesign" pattern every prior blueprint milestone established for its own dormant surfaces.
