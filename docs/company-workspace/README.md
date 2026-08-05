# Milestone 24 — Company Intelligence Workspace & Opportunity Intelligence Platform

**Date**: 2026-07-25
**Scope**: real, working code in `apps/web/src/features/companies/` (new) and `apps/web/src/features/applications/` (its real API layer implemented for the first time, replacing an M1-era stub), consuming only existing, real backend contracts. No mock data, no fabricated company information, no simulated analytics anywhere in this milestone's code.

## Index

| # | Document | Covers |
|---|---|---|
| 1 | [Architecture](01-architecture.md) | Where the Company Workspace sits in the existing layering; the real Applications-API fix this milestone required first |
| 2 | [Integration Points](02-integration-points.md) | Every backend endpoint consumed — and, more importantly, every thing the spec asked for with no real backend support |
| 3 | [Component Hierarchy](03-component-hierarchy.md) | Every component built, how they compose, files created/modified |
| 4 | [Interaction Flow](04-interaction-flow.md) | The real user workflow end to end, with a diagram |
| 5 | [Opportunity Intelligence](05-opportunity-intelligence.md) | Why this section is a fully honest "not available" panel, and what would need to be real to change that |
| 6 | [Trust Timeline & Communication Timeline](06-trust-and-communication-timeline.md) | The real evidence behind Company Health, and the lazy-loaded real per-application event ledger |
| 7 | [Performance](07-performance.md) | Why one bounded 100-item fetch, not N+1 fetches; where lazy loading is real |
| 8 | [Accessibility](08-accessibility.md) | What was verified, reusing the exact lessons already learned in M22.3/M23.1 |
| 9 | [Future Extension Strategy](09-future-extension-strategy.md) | What becomes additive the moment a real per-company endpoint, health engine, or campaign link exists |
| 10 | [Architecture Decision Records](10-architecture-decision-records.md) | Every real decision this milestone made, with alternatives considered |
| 11 | [Final Deliverables & Principal Engineer Review](11-final-deliverables-and-principal-review.md) | Executive summary, files, security/technical-debt review, and the YES/NO production-readiness verdict |
| 12 | [Production Integration Validation](12-production-integration-validation.md) | The real, full-stack, real-browser live validation pass — 4 real defects found and fixed, full validation matrix, final readiness score |
| 13 | [Final Production Validation Audit](13-final-production-validation-audit.md) | The complete Company → Job → Application workflow proven live: full lifecycle state machine, persistence, authorization, audit trail, Swagger contract fix, and the final Production Readiness Report |
| 14 | [Milestone 24 Completion Report](14-milestone-24-completion-production-readiness-report.md) | Closing validation pass: all 14 named transitions individually verified (HTTP + DTO + DB + timeline + domain events + authorization + state consistency), zero unexpected failures, final score and Milestone 24 completion verdict |

## Executive Summary

This milestone's research phase (documented in full in [02-integration-points.md](02-integration-points.md)) found the Companies module's real backend surface is narrower than Campaigns' was: `CompanyStatus` is a 2-value enum (`ACTIVE`/`ARCHIVED`), there is no company-level timeline/history endpoint at all, `hiringQuality`/`trustScore` have no setter anywhere in the domain (not even an unused one — Company has *less* reserved intelligence infrastructure than Campaign did), and there is no way to ask "which campaign is this company part of" through any endpoint. Against that, one real, valuable discovery: `Application` carries a real, validated `companyId` field, and `GET /applications/search?companyId=` is a real, live, filterable endpoint — meaning a company's real application history, and each application's own real communication timeline, genuinely exist and are reachable, even though nothing about a company's own aggregate "health" or "opportunity score" does.

The Company Workspace is built to that real boundary exactly: Overview/Actions/Health from `CompanyDto` directly; History, Communication Timeline, and Analytics from real, `companyId`-filtered Application data (fetched once, shared across all three sections, capped at 100 to avoid an unbounded fetch); Opportunity Intelligence as a fully honest, evidence-explained "not available" panel, since — unlike Campaign — Company has no intelligence DTO shape at all to eventually populate. Building this required first fixing a real, pre-existing gap: `packages/shared-types`' `ApplicationDto` was an M1-era stub shape that didn't match the real backend at all — corrected as a prerequisite, not a scope addition.

A self-audit (the milestone's own explicit ask) found and fixed two real duplications before they could compound: an ownership/role permission check implemented slightly differently in two components (extracted into one shared `canManageCompany()`), and an exact-duplicate `StatTile` component independently defined in both this milestone's `CompanyAnalytics` and the M23 Campaign Workspace's `OperationalAnalytics` — extracted into a shared `components/ui/stat-tile.tsx`, which also retroactively cleaned up the Campaign Workspace's own code.

## Production Integration Validation

A follow-up pass started the full real stack (Docker Postgres + API, a real frontend build) for the first time since M22, registered real users, created a real company/job/application, and drove the actual rendered application through a real headless browser. That real verification found and fixed four genuine defects invisible to static analysis alone — a date-formatting locale bug, a missing success-toast on every lifecycle action (Company and Campaign both), a real 138px mobile header overflow, and a backend exception filter that logged nothing at all. Full account, validation matrix, and final score: [12-production-integration-validation.md](12-production-integration-validation.md).

## Final Production Validation Audit

A final audit proved the complete Company → Job → Application workflow end to end against the live stack: 4 real users, a real company, a real published job, and 4 applications independently walked through the full lifecycle state machine (create → every valid transition → terminal state), including the first-ever live test of `GET /applications/:id/history`. Found and fixed a real Swagger-contract defect (28 POST endpoints documented `200`, actually returned `201`); found and reported — but did not fix, per the standing security-model autonomy boundary — a real authorization gap on 4 application-transition endpoints. Full account: [13-final-production-validation-audit.md](13-final-production-validation-audit.md).

## Milestone 24 Completion

A closing pass individually verified all 14 named lifecycle transitions (Prepare, Queue, Send, Delivered, Opened, Viewed, Company Reply, Interview Scheduled, Interview Completed, Offer, Contract, Reject, Withdraw, Archive) across 3 fresh applications, checking HTTP response, DTO shape, database persistence, timeline record, domain events, authorization, and state consistency for each — 33/33 assertions passed, zero unexpected failures. Full account: [14-milestone-24-completion-production-readiness-report.md](14-milestone-24-completion-production-readiness-report.md).

## Readiness for Milestone 25

See [11-final-deliverables-and-principal-review.md](11-final-deliverables-and-principal-review.md), [12-production-integration-validation.md](12-production-integration-validation.md), [13-final-production-validation-audit.md](13-final-production-validation-audit.md), and [14-milestone-24-completion-production-readiness-report.md](14-milestone-24-completion-production-readiness-report.md) for the full, evidence-backed verdicts. **Milestone 24 is COMPLETE.** Final score: **92/100** — production-ready, with one open security decision (prepare/queue/send/archive authorization, see docs 13–14) to resolve before or during Milestone 25.
