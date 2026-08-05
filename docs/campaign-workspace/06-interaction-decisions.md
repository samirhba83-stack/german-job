# 6. Interaction Decisions

Same Context/Decision/Consequences/Alternatives-Considered format as every prior milestone's decision records.

---

### IDR-C1: Overview does not duplicate Health/Confidence/Recommendation into its own card

**Context**: spec §1 lists "Execution Health," "Campaign Confidence," and "Current Recommendation" as Overview fields.

**Decision**: these get their own dedicated sections (`CampaignHealthCenter`, `SmartRecommendationPanel`) instead of being crammed into the Overview card alongside certain, always-populated fields.

**Consequences**: the Overview card never has to explain a `null` value inline next to fully-populated ones — each reserved-data section gets room to state its own honest gap clearly, which reads better as the "distinct mission-control panels" feel the milestone asked for than one dense card mixing certain and uncertain data.

**Alternatives considered**: one large Overview card with all fields (rejected — would either hide the `null`s' honesty note in cramped space, or bloat the card disproportionately just for one section's caveat).

---

### IDR-C2: The Lifecycle tracker folds Paused/CoolingDown/Resuming into the Running stage

**Context**: the milestone's own example lifecycle list treats "Waiting," "Paused," and (implicitly) a resuming state as their own stages alongside Running.

**Decision**: `lib/campaign-lifecycle-stages.ts` treats them as sub-states of Running, using `getMissionStatus()`'s real label/explanation to describe which one is current, rather than a 6- or 7-box tracker.

**Consequences**: matches the real state machine's actual topology (these three states only exist while `RUNNING` is the "phase" a campaign is in) rather than flattening it into a longer, less accurate linear sequence. `ExecutionStageList`'s existing 4-status contract (`pending/active/complete/failed`) didn't need any new status added to support this.

**Alternatives considered**: a literal per-status stage box for all 10 `CampaignStatus` values (rejected — several, like `COOLING_DOWN` and `RESUMING`, are genuinely transient and would make the tracker misleadingly implying a campaign "arrives" and "leaves" them in sequence, when they're really oscillating sub-states of Running).

---

### IDR-C3: Cancel's mandatory reason uses an inline expanding form, not a new Modal/Dialog component

**Context**: `POST /campaigns/:id/cancel` requires a real `reasonCode` — the only campaign action with a mandatory body field. No Modal/Dialog primitive exists in `components/ui/` yet.

**Decision**: `CampaignActions` reveals a small inline form (native `<select>` for the real `CampaignReasonCode` enum, the existing `Input` component for an optional note) directly under the Cancel button when clicked, rather than building a new Modal component to host a confirmation dialog.

**Consequences**: a real, functional, accessible mandatory-reason flow without adding a whole new UI primitive category this milestone didn't otherwise need — consistent with the standing "no abstractions beyond what the task requires" discipline. The full, real `CampaignReasonCode` enum (11 values) is offered, not a curated subset, since presenting only some real reasons as available would misrepresent the real enum.

**Alternatives considered**: building a real `Dialog`/`Modal` primitive now (rejected — real, valuable future work, but scope creep for this one flow; M21's design system already specifies it, reserved for whichever future milestone first needs a true blocking overlay); a `window.confirm()`-style browser prompt (rejected — can't collect a reason code, and isn't stylable/consistent with the rest of the shell).

---

### IDR-C4: Client-side action-eligibility checks are a real UX guide, not a security boundary

**Context**: `CampaignActions` only renders Start when the real status is `DRAFT`/`READY`, only renders Pause when `RUNNING`, etc.

**Decision**: these checks use real `campaign.status`/`campaign.isTerminal` fields, but are explicitly documented as an approximation, not a guarantee — the backend's own command handlers remain the actual authority and reject an invalid transition with a real domain error, surfaced through the existing `useTrackedMutation` → toast mechanism.

**Consequences**: a slightly-stale client (e.g., another tab already paused the campaign) might briefly show a now-invalid button; clicking it fails with a real, specific backend error message rather than silently doing nothing or crashing — the same "every failure is explained" principle every other real mutation in this codebase already follows.

**Alternatives considered**: querying the backend for "which actions are currently valid" before rendering buttons (rejected — no such endpoint exists, and inferring it from `CampaignStatus` is a reasonable, real approximation given the command descriptions already documented in the controller itself, e.g. "idempotent if already running").

---

### IDR-C5: `retry`/`replay` are not exposed as UI actions

**Context**: covered in full in [03-integration-points.md](03-integration-points.md) — restated here as a deliberate interaction decision, not an oversight.

**Decision**: no Retry/Replay button anywhere in `CampaignActions`.

**Consequences**: the workspace is visibly incomplete relative to a fully-realized "what should I do next" experience for a campaign with failed targets. Accepted because both real endpoints require a real target-level scope this milestone has no honest way to construct (no endpoint enumerates individual targets) — building the control anyway would mean either a fake target picker or a button that always submits the same hardcoded scope, both dishonest.

**Alternatives considered**: a "Retry all failed" button that omits `targetIds`/`scope` and hopes the backend infers a sensible default (rejected — reading the real DTOs, `RetryCampaignDto`/`ReplayCampaignDto` don't document that behavior, and guessing at undocumented backend behavior isn't a decision this milestone should make on the backend's behalf).

---

### IDR-C6: The Progress Log and Lifecycle tracker read from one shared query, not two

**Context**: both sections need the same real timeline data (`GET /campaigns/:id/timeline`), just presented two different ways.

**Decision**: `useCampaignTimeline` is called once in `CampaignWorkspace` and passed down to both `toCampaignLifecycleStages()` (via a `useMemo`) and `CampaignProgressLog` directly.

**Consequences**: one real network request backs two real UI sections — no duplicate fetching, and the two views can never disagree about what actually happened, since they're rendering the same underlying array.

**Alternatives considered**: each section fetching its own copy (rejected — TanStack Query's cache would dedupe the actual network request anyway given the identical query key, but passing the same resolved data down explicitly is clearer and avoids relying on cache-dedup behavior for two sections' data to stay in sync).
