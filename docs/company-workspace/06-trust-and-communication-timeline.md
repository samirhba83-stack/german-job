# 6. Trust Timeline & Communication Timeline

## Trust Timeline

The milestone's spec lists "Trust Timeline" as its own element of the Company Workspace (§2). This codebase already has a real, established Trust Layer primitive — `TrustFeedbackCard` (built in M22.2, first given a real caller in M23's Campaign Health Center) — and the honest, evidence-transparent design question is what real data it should show for a Company.

**The real backing is `CompanyHealthCenter`.** Rather than a chronological "trust events" log (which would need real trust-relevant events at the company level — a concept that doesn't exist; see [02-integration-points.md](02-integration-points.md)), Trust here means the same thing `TrustFeedbackCard` has meant everywhere else it's been used in this codebase: a single, honest, evidence-backed statement of "here's the real state, and here's what it's based on." For a company:

- If `ARCHIVED` (real status) → stated plainly, with the real `updatedAt` as the evidence timestamp.
- If `ACTIVE` with zero real applications → "No engagement yet," an honest, real absence, not a fabricated "Inactive" verdict with an invented threshold behind it.
- If `ACTIVE` with real applications → "Active engagement," with the real count and the real most-recent-activity timestamp (computed as the max `lastActivityAt` across the real, already-fetched application set) shown as evidence.

This is deliberately the *only* place in the Company Workspace that makes any evidence-based inference at all beyond directly displaying a DTO field — and even then, it infers nothing the user couldn't verify themselves from the same real numbers shown right next to it. No staleness threshold, no "Attention Required" verdict, no numeric score. See [10, ADR-003](10-architecture-decision-records.md) for the full reasoning behind not building the milestone's literal 6-state model.

## Communication Timeline

**Fully real**, via `GET /applications/:id/timeline`, and — unlike Trust Timeline above — a genuine chronological event log, not an inference. Every field the milestone's spec asks each history event to carry (Timestamp, Evidence, Execution Identifier, Explanation) maps directly to a real `ApplicationTimelineEntryDto` field:

| Spec field | Real source |
|---|---|
| Timestamp | `entry.timestamp` |
| Execution Identifier | `entry.correlationId` |
| Evidence | `entry.evidenceReference` (`{type, externalId, url}`, rendered as a link when a real `url` exists) |
| Explanation | `entry.reason?.note` (real, optional — many transitions have none) |

`entry.currentState` (a real `ApplicationLifecycleStatus`) is the event's real label — "Email Sent" maps to `SENT`, "Delivery Confirmation" to `DELIVERED`, "Reply" to `COMPANY_REPLIED`, "Interview" to `INTERVIEW_SCHEDULED`/`INTERVIEW_COMPLETED` — all real, all humanized through the same `humanizeStatus()` every other status label in this codebase uses, never a bespoke re-labeling.

**Deliberately lazy** — fetched only once a `CompanyHistory` row is expanded for the first time, not for every application on page load. Full reasoning in [07-performance.md](07-performance.md).

**"Manual Notes" and "Future Follow-up"** (both named in the milestone's own example list) are not shown — no note-taking or follow-up-scheduling capability exists anywhere in the backend. Naming this here rather than silently omitting it: a real, future note-taking feature would need its own domain concept and endpoint before this timeline could honestly include it.
