# 3. Integration Points

Every real endpoint this milestone consumes, and — the more important half of this document — every thing the milestone's own spec asked for that has no real backend support today. This research was done by reading the actual controller, DTO, domain entity, and command-handler source files in full before any UI code was written, not assumed from documentation.

## Real, live endpoints consumed

| Endpoint | Used by | Real data returned |
|---|---|---|
| `GET /campaigns` | `useCampaigns` (campaign list) | `PaginatedCampaignsDto` |
| `GET /campaigns/:id` | `useCampaign` (Overview, Actions, Health Center) | `CampaignDto` |
| `GET /campaigns/:id/timeline` | `useCampaignTimeline` (Lifecycle, Progress) | `CampaignTimelineEntryDto[]` |
| `GET /campaigns/:id/execution-status` | `useCampaignExecutionStatus` (Pipeline, Analytics) | `CampaignExecutionStatusDto` |
| `POST /campaigns/:id/start` | `useCampaignActions().start` | `CampaignDto` |
| `POST /campaigns/:id/pause` | `useCampaignActions().pause` | `CampaignDto` |
| `POST /campaigns/:id/resume` | `useCampaignActions().resume` | `CampaignDto` |
| `POST /campaigns/:id/cancel` | `useCampaignActions().cancel` | `CampaignDto` |
| `POST /campaigns/:id/complete` | `useCampaignActions().complete` | `CampaignDto` |
| `POST /campaigns/:id/archive` | `useCampaignActions().archive` | `CampaignDto` |
| `GET /profiles/me` | `useMyProfile` (Overview's Profile Readiness) | `ProfileDto` |

## What the milestone asked for that has no real backend support — and what was built instead

### Per-company pipeline list (spec §4, "Company Pipeline")
**Asked for**: a list of every company in the campaign, each with name, location, industry, eligibility, stage, delivery/reply/interview status, confidence, priority.
**What's real**: `CampaignTarget` is a real domain entity (`apps/api/.../campaigns/domain/entities/campaign-target.entity.ts`) with a real `status`, but **no DTO or query exists that returns individual targets** — only `GetCampaignExecutionStatusQuery`'s `targetBreakdown`, which is aggregate counts per `CampaignTargetStatus` (`{status, count}[]`), with no target identity, job, or company attached.
**What was built**: `TargetStatusBreakdown` — the real aggregate counts, honestly presented as counts, not a fabricated per-company table. See [08-future-extension-strategy.md](08-future-extension-strategy.md) for what a real per-target endpoint would need to expose to close this gap.

### Numeric AI health score / confidence (spec §1 "Execution Health"/"Campaign Confidence", §6 "Health Center")
**Asked for**: a computed health score, risk score, and confidence value.
**What's real**: `CampaignDto.health` (`healthScore`, `riskScore`, `progressScore`, three trend fields) is a real DTO field, returned by a real, live `GET /campaigns/:id/health` endpoint — but `Campaign.recordHealthAssessment()`, the only method that ever populates it, is called **nowhere in production code**, confirmed by searching the entire backend source tree (only `.spec.ts` test fixtures call it). Every real campaign's `health` is `null` right now.
**What was built**: `CampaignHealthCenter`, using `getMissionStatus()`'s real tone/confidence/lastUpdateTime — which already passes `campaign.health` straight through when present, and stays honestly `null` when it isn't — plus an explicit, visible note explaining the gap rather than hiding it.

### Smart Recommendations (spec §5)
**Asked for**: specific, evidence-backed suggestions ("Improve German level," "Upload missing certificate," "Retry failed delivery," ...).
**What's real**: `CampaignDto.intelligence.recommendationExplanation` is a real field, populated by the same reserved, never-called-in-production hook pattern as `health`. The `recommendations` and `decision-intelligence` backend modules that would compute this have **zero `@Controller` anywhere** — confirmed by grep — so even a differently-shaped recommendation couldn't be fetched today.
**What was built**: `SmartRecommendationPanel` — renders the real field the moment it's non-null (a real, reachable code path once the engine is wired in), and an explicit "not yet" state until then.

### Campaign-level reply/interview/delivery statistics (spec §7 "Operational Analytics")
**Asked for**: Applications Generated, Emails Sent, Deliveries Confirmed, Replies, Interviews, Success Rate.
**What's real**: `Application` has **no real `campaignId` field** — only a loose, unvalidated free-text `channel.campaignRef: string | null`, never checked against a real campaign id, and neither `GET /applications` nor `GET /applications/search` accepts a campaign filter of any kind. There is no supported way to ask the backend "which applications came from this campaign."
**What was built**: `OperationalAnalytics` — every tile computed from data that genuinely is scoped to the campaign (`targetBreakdown`, `goalProgress`, `targetsCount`, `batchesCount`), including two real ratios (Coverage, Failure rate) computed from two real counts each. Reply/interview/delivery-confirmation counts are not shown, rather than shown as zero or estimated.

### Granular pipeline-internal progress events (spec §3 "Campaign Progress")
**Asked for**: Companies Selected, Eligibility Completed, CV Generated, Motivation Letter Generated, Attachments Verified, Email Prepared, Delivery Confirmed, Reply Received, Interview Received.
**What's real**: these are `recommendations`/`application-assembly`/`execution-tracking` module concepts — all three confirmed to have zero HTTP surface. What's real and live is the campaign's actual status-transition ledger (`GET /campaigns/:id/timeline`), which is a different, coarser kind of "progress" — real status changes, not pipeline sub-steps.
**What was built**: `CampaignProgressLog` — the real transition ledger, with every field the spec asked for (Execution ID, Timestamp, Status, Evidence, Explanation) mapped from real `CampaignTimelineEntryDto` fields (`correlationId`, `timestamp`, `currentState`, `evidenceReference`, `aiExplanation`/`reason.note`).

### `retry` / `replay` lifecycle actions
**Asked for (implicitly, via "what should I do next")**: a way to retry failed targets.
**What's real**: `POST /campaigns/:id/retry` and `.../replay` are real, live endpoints — but both require a real target-level scope (`maxAttempts`/`correlationId` for retry; `scope`/`targetIds` for replay), and, per the Company Pipeline finding above, there is no real way to enumerate individual targets to build that scope from.
**What was built**: not exposed in `CampaignActions`. Building a control that can't honestly fill its own request body would mean either faking a target list or shipping a button that always needs the same hardcoded scope — neither is honest. This is named plainly here rather than silently omitted.

### `/campaigns/:id/stop`
The domain layer has `campaign-stopped.event.ts` and a `STOPPED` status, but no controller endpoint or command wires a stop transition to HTTP. Not built; not referenced anywhere in the workspace's action set.
