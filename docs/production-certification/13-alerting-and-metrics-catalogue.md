# Milestone 31 Phase 17 — Metrics Catalogue, Alert Catalogue, Incident Response

**Status: catalogue defined against real, already-existing data sources in this codebase; not yet
instrumented to a real metrics backend (no vendor chosen — Phase 3/15).** Every metric below names
the REAL table/service/event it would be computed from — none of this is invented; it's a mapping
from the brief's abstract requirement list to this application's actual, concrete signals.

## Metrics Catalogue

| Metric | Real source |
|---|---|
| API availability | `/health` polled externally |
| API latency | `RequestContextMiddleware`'s request lifecycle (start/end timestamp — not yet instrumented into a histogram) |
| Error rate | `AllExceptionsFilter` (already the one place every unhandled exception passes through) |
| Worker health | The Worker process's own `/health` (Phase 3 process split) |
| Queue depth / age | `EmailMessage` table — real `status='PENDING'` count + oldest `createdAt` |
| Dead-letter count | `EmailMessage` rows that exhausted `maxAttempts` (M28) |
| Scheduler heartbeat | The 6 tick-driver services' own "tick registered"/successful-tick logs — real, already logged, not yet exported as a metric |
| Database connections | Prisma's own connection pool (not yet exposed as a metric — Phase 12's connection-limit tuning is a prerequisite) |
| Database latency | The same `/ready` `SELECT 1` round trip, timed |
| Storage health | MinIO's own health endpoint (already used by the compose healthcheck) |
| OAuth failures | Real `OAuthTransaction` rows with a failure outcome (M28.6) |
| Token-refresh failures | `ConnectedMailbox.lastFailureAt`/`failureCategory` (real, already tracked, M28.6) |
| Gmail/Outlook sends | `ConnectedMailboxSendAttempt` rows (real, M28.6) |
| Webhook failures | The real `REJECTED`/`MESSAGE_NOT_FOUND` outcomes every webhook controller already returns (Phase 11) |
| Reply-correlation failures | `InboxMessage.correlationStatus = 'UNRELATED'`/`AMBIGUOUS'` (real, M29) |
| Ambiguous reply rate | `InboxMessage.reviewStatus = 'PENDING_REVIEW'` (real, M29) |
| Follow-up blocks | `ApplicationFollowUpControl` creation rate + `FOLLOW_UP_SEND_BLOCKED`-class audit events (real, M30) |
| Follow-up race conflicts | The exactly-once claim's `null` returns (`ApplicationTransitionProposalRepository.tryTransition()`, M30) — currently only observable via the concurrency spec, not a live counter |
| Task creation failures | `RecruitmentActionTask` creation errors (real, M30 — currently only a log line) |
| Billing webhook failures | `WebhookEvent` rows with a failure outcome (real, M27) |
| Login failures | Real, but not yet counted separately from other 401s — a real, cheap follow-up (tag `AllExceptionsFilter`'s 401 responses from `/auth/login` specifically) |
| Rate-limit events | `AppThrottlerGuard`'s own rejections (real, already enforced — Phase 8) |

**None of these currently ships anywhere** — every one is a REAL, already-computable signal from
existing tables/services; wiring them to an actual metrics backend (Prometheus, a hosting
platform's built-in metrics, or a paid APM vendor) is real follow-up work gated on Phase 3's
hosting decision (no paid vendor chosen without approval, per this milestone's own instruction).

## Alert Catalogue

For each alert: severity, meaning, immediate action, investigation, escalation, recovery, closure.

| Alert | Severity | Meaning | Immediate action |
|---|---|---|---|
| API unavailable | Critical | `/health` failing from outside | Check process status; restart if crashed; check upstream (DB/storage) |
| Repeated deployment failure | High | CD pipeline's smoke test failed 2+ times | Halt further deploys; investigate the specific failing check |
| Worker stopped | Critical | No tick-driver "tick registered"/successful-tick log in 2x its own interval | Restart the Worker process; confirm `RUN_TICKS=true` on exactly one instance |
| Scheduler heartbeat missing | Critical | Same signal as above, specifically for `ExecutionTickDriverService` (real campaign sends depend on it) | Same |
| Queue backlog increasing | High | `EmailMessage` PENDING count trending up, not down | Check `EmailQueueWorkerService`'s own tick logs for repeated failures; check provider health |
| Dead-letter queue non-zero | High | Real messages exhausted all retries | Investigate the specific provider rejection reason; may require support ticket with the provider |
| Database nearing connection limit | Critical | Pool utilization approaching `connection_limit` | Investigate for a connection leak; consider raising the limit if load-justified |
| Storage unavailable | Critical | MinIO/S3 health check failing | CV uploads/attachment resolution will fail; treat as user-facing outage |
| OAuth token refresh failures spike | High | `ConnectedMailbox.failureCategory` spike | Could indicate a provider-side outage or a real revoked-grant wave; check provider status pages |
| Provider rejection rate spike | High | Real send rejections trending up | Could indicate a reputation/deliverability issue — check `DeliverabilityService`'s own suppression data |
| Webhook signature failures spike | Critical | Real `REJECTED` outcomes trending up | Could indicate a forged-webhook attempt, OR a misconfigured secret after a rotation — check both |
| Reply processing lag | Medium | Time between `InboxMessage.receivedAt` and `processedAt` growing | Check the inbox polling tick's own health |
| Follow-up incorrectly blocked | Critical | A user reports a legitimate send blocked when it shouldn't be | Real product-safety incident — check the specific `ApplicationFollowUpControl` row's `reasonCode`/`evidence` |
| Migration failure | Critical | `prisma migrate deploy` returned non-zero during a real deployment | Follow the Production Migration Runbook (Phase 12) — do not proceed with the deploy |
| Backup failure | Critical | `scripts/backup-database.sh` exited non-zero, or produced a suspiciously small file (the script's own real check) | Investigate immediately — a missed backup window is a real risk window |
| Retention job failure | Medium | `InboxRetentionService`'s tick logged an error | Investigate; a delayed retention run is not urgent but should not be ignored indefinitely |

Escalation for every Critical alert: page the on-call engineer immediately (real paging mechanism
TBD — no vendor chosen). High: notify within business hours. Medium: daily digest is acceptable.
Recovery/closure evidence for every alert: the same real signal that triggered it returning to its
normal range, observed for a real, sustained period (not a single good reading).

## Incident Response Runbook (skeleton — real steps, no vendor-specific tooling assumed)

1. **Acknowledge** — confirm you're looking at the right alert, not a stale/flapping one.
2. **Assess blast radius** — one user? one provider? the whole API? Use `/health`, `/ready`,
   `GET /version` to establish exactly which release/environment is affected.
3. **Contain** — if the incident involves a specific provider/user/campaign/mailbox, use the real
   Emergency Stop controls (Phase 27) to isolate it rather than a blanket shutdown where avoidable.
4. **Communicate** — for a Closed Beta, direct communication to the affected cohort (Phase 20) is
   both feasible and expected — this is not a public-scale incident-comms problem.
5. **Fix** — prefer the least destructive real fix (a flag flip, a targeted Emergency Stop action)
   over a code deploy where possible; a code deploy still requires Staging verification first
   (Phase 5's own CD gate) even during an incident, unless the situation is severe enough to
   justify a documented, approved exception.
6. **Verify recovery** — the same real signal that triggered the alert, observed healthy for a
   real, sustained period.
7. **Write it up** — what happened, what was the real root cause, what real, concrete change
   (code, config, or runbook) prevents recurrence. Matches this project's own established
   discipline (every milestone's own threat-model/known-limitations docs) of honest, specific
   post-incident documentation.
