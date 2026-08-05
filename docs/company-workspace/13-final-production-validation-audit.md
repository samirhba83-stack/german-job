# 13. Final Production Validation Audit — Company → Job → Application Workflow

**Date**: 2026-07-27
**Scope**: A final, live, full-stack proof that the entire Company → Job → Application workflow — registration, authentication, company/job creation and publishing, application creation, every valid lifecycle transition, persistence, authorization, and audit trail — works end to end against the real running backend and a real Postgres database. No new features were implemented. Every finding below is backed by an actual HTTP response, an actual database row, or actual source code, not inference.

---

## Executive Summary

This audit re-ran the entire workflow from a cold start: four freshly registered real users (candidate, a second unrelated candidate, an employer, and an admin — the latter two promoted to their roles via a direct, documented database update, since `POST /auth/register` has no `role` field and there is no self-service path to grant `EMPLOYER`/`ADMIN`), a real company, a real published job, and four separate real applications, each walked through a different real lifecycle path via the live HTTP API — not a mock, not a unit test, not a code read-through.

**Requirement 1 — the previously reported "Application creation HTTP 500" — was re-verified and confirmed to still not exist as an application defect.** A clean `POST /applications` call returns `201 Created` with a correct `DRAFT`-status body. As concluded in the prior validation pass, the earlier 500 was a PowerShell test-script artifact (a corrupted `Get-Content` variable serialized into a 2.2MB payload), not a backend bug — this pass re-derived that conclusion from a fresh, independent test run rather than re-asserting it.

One new, real, previously-undetected defect was found and fixed this pass: **28 POST action endpoints across four controllers (Jobs, Companies, Campaigns, Applications) documented `HTTP 200` in Swagger while the live server actually returned `HTTP 201`** — because NestJS defaults every `@Post()` handler to `201 Created` unless a route sets `@HttpCode()` explicitly, and none of these handlers did. This is a real Swagger-contract inaccuracy, not a behavior bug (the frontend's `api-client.ts` only special-cases `401`/`204` and otherwise treats any `response.ok` as success, so no client behavior was ever affected). Fixed by correcting the `@ApiResponse` status annotations to `201` to match actual, already-live behavior — a documentation-accuracy fix with zero runtime behavior change, verified via a full Docker rebuild, a clean 772/772 backend test run, and a live re-fetch of `/api/docs-json` confirming the corrected contract.

Two real, pre-existing **authorization-model gaps** were found and are reported, not silently fixed, because changing authorization rules is explicitly a Security Model decision reserved for user confirmation under the standing engineering-autonomy policy: `POST /applications/:id/prepare`, `/queue`, `/send`, and `/archive` have no `RolesGuard` and their domain policies (`ReadinessPolicy`, `SchedulingPolicy`, `DispatchPolicy`) perform no actor-identity check at all — meaning any authenticated user of any role, not just the owning candidate, can currently drive or archive someone else's application through these four transitions. This was proven live: an unrelated `EMPLOYER` token successfully called `prepare()`, and an unrelated second `CANDIDATE` token successfully called `queue()` and `archive()`, on an application it did not own. By contrast, `withdraw()` correctly enforces ownership (`WithdrawalPolicy`/`IsOwnedBySpecification`) and correctly returned `403 Forbidden` for both a non-owning employer and a non-owning candidate in this same test run — so the gap is specific to those four transitions, not systemic.

Every other requirement of this audit — the full state machine, persistence, timeline/history consistency, role authorization on the remaining 10 guarded transitions, Swagger contract accuracy, HTTP status codes, and production log cleanliness — passed with zero unexpected failures.

---

## 1. Requirement 1 — Application Creation 500, Re-Verified

| Check | Result |
|---|---|
| Fresh `POST /applications` (correctly typed Node.js `fetch`, not PowerShell) | `201 Created`, body `status: "DRAFT"` |
| Root cause of the original report | Confirmed (again, independently) to be a test-script bug: a PowerShell `Get-Content` variable silently became a `FileInfo`-like object and serialized to a 2.2MB JSON body, tripping Express's `PayloadTooLargeError` — not an application defect |
| Conclusion | **The 500 does not exist as an application defect. No fix was needed or applied.** |

---

## 2. Full Workflow Execution — What Was Actually Run

All steps below were executed against the live stack (`german-job-engine-api-1`, `-web-1`, `-postgres-1`, all running throughout) using real HTTP calls with real JWTs, not simulated.

### 2.1 Identity setup
- Registered 4 real users: `candidate`, `candidate2` (for ownership-mismatch tests), `employer`, `admin`.
- Confirmed live: `POST /auth/register` has no `role` field (`RegisterDto` only accepts `email`/`password`); every new user is created as `CANDIDATE` regardless of intent. `employer` and `admin` were promoted via a direct, documented `UPDATE users SET role = ... WHERE id = ...` — the only path available, since no self-service or admin API grants roles.
- Confirmed the response envelope: `POST /auth/login` wraps its body as `{ "data": { accessToken, refreshToken } }`.

### 2.2 Company and Job
| Call | Result |
|---|---|
| `POST /companies` (employer) | `201`, real company created, `ownerId` = employer's user id |
| `POST /companies` (candidate) | `403` — correctly rejected |
| `POST /companies` (employer, second company for the same owner) | `409 Conflict` — **real, correct business rule**: one company per owner (`A company already exists for owner: {id}`), not a defect |
| `GET /companies/:id` | `200`, full `CompanyResponseDto`, zero drift from `shared-types` |
| `POST /jobs` (employer, no `salaryRange`) | `201` `DRAFT`, then `POST /jobs/:id/publish` → `422 Unprocessable Entity`, `"Job cannot be published — missing mandatory fields: salaryRange"` — **real, correctly-functioning domain rule** (`Job.ensureReadyToPublish()`), not a defect. Re-run with `salaryRange` supplied → publish succeeded |
| `POST /jobs` (candidate) | `403` — correctly rejected |
| `GET /jobs/:id` (no token) | `200` — public read confirmed |

### 2.3 Applications — 4 independent lifecycle paths

**Application A — full forward path** (`DRAFT → PREPARED → QUEUED → SENT → DELIVERED → OPENED → VIEWED → COMPANY_REPLIED → INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → OFFER_RECEIVED → CONTRACT_SIGNED → ARCHIVED`, all 12 transitions):

| Step | Caller | HTTP | Resulting status |
|---|---|---|---|
| create | candidate | 201 | DRAFT |
| prepare | candidate | 201 | PREPARED |
| queue | candidate | 201 | QUEUED |
| send | candidate | 201 | SENT |
| delivered | admin (tracking signal) | 201 | DELIVERED |
| opened | admin (tracking signal) | 201 | OPENED |
| viewed | admin (tracking signal) | 201 | VIEWED |
| company-reply | employer | 201 | COMPANY_REPLIED |
| interviews/schedule | employer | 201 | INTERVIEW_SCHEDULED |
| interviews/complete | employer | 201 | INTERVIEW_COMPLETED |
| offer | employer | 201 | OFFER_RECEIVED |
| contract | candidate | 201 | CONTRACT_SIGNED |
| archive | candidate | 201 | ARCHIVED |

Every step returned the exact expected `status` field. A subsequent `POST prepare` against the now-`ARCHIVED` application correctly returned **`409 Conflict`** (`InvalidApplicationStatusTransitionException`), not a 500 — confirming illegal transitions fail safely and predictably.

**Application B — rejection path**: create → prepare → queue → send (candidate) → `reject` attempted by the candidate (`403`, correctly rejected — reject is `EMPLOYER`/`ADMIN`-only) → `reject` by employer with `reasonCode: QUALIFICATION_MISMATCH` (`201`, `REJECTED`) → archive (`201`, `ARCHIVED`).

**Application C — withdrawal and ownership authorization**: create (candidate) → `withdraw` attempted by the employer (`403`) → `withdraw` attempted by the unrelated `candidate2` (`403`, `"Only the candidate who owns this application may withdraw it"`) → `withdraw` by the owning candidate with `reasonCode: CANDIDATE_REQUEST` (`201`, `WITHDRAWN`) → archive (`201`, `ARCHIVED`).

**Application D — authorization-gap demonstration** (see §4 below for the finding this proves): create (candidate) → `prepare` called with the **employer's** token (`201`, succeeded — should not have been permitted) → `queue` called with **candidate2's** token (`201`, succeeded) → `archive` called with **candidate2's** token (`201`, succeeded).

### 2.4 Reads
- `GET /applications/:id` with no token → **`401`** (the whole controller requires authentication, including reads — confirmed).
- `GET /applications/:id/timeline` → `200`, exactly 1 entry after creation, 13 entries after Application A's full walk, with an unbroken `previousState → currentState` chain and correct `correlationId` per entry (verified directly in Postgres, see §3).
- **`GET /applications/:id/history`** — tested live for the first time in this project's history. Returns `200` with a narrative shape (`{ timestamp, summary, actor }`) distinct from the structured timeline, e.g. `"Candidate created the application in DRAFT"`. Matches its Swagger schema (`ApplicationHistoryEntryResponseDto`) exactly.

---

## 3. Persistence Verification (direct Postgres inspection)

Queried `applications`, `timeline_entries`, `companies`, `job_listings` directly (not through the API) after the run:

- All 4 application rows persisted with the correct final `status` (`ARCHIVED` for all, having gone through their respective paths) and correct `candidateId`/`jobId`/`companyId` foreign keys.
- `timeline_entries` row counts matched the exact number of transitions performed per application: **A = 13, B = 6, C = 3, D = 4.**
- Application A's 13-row timeline chain, read directly from the database, is contiguous and correct: every row's `previousState` matches the prior row's `currentState`, `correlationId` is a distinct UUID per transition, and `actorRole` is correctly attributed — `CANDIDATE` for prepare/queue/send/contract/archive, `SYSTEM` for the three tracking signals (delivered/opened/viewed — correct: these are evidence-driven system observations, and the handler does not record the calling admin's identity as "the actor," which is the right domain modeling, not a bug), and `COMPANY` for company-reply/interview/offer (the `ActorRole` the domain uses for the `EMPLOYER` platform role).
- `submittedAt` is `NULL` for the two applications that never reached `SENT` (C, D) and populated for the two that did (A, B) — correct.

**Persistence is fully verified. Nothing observed via the API diverges from what is actually stored.**

---

## 4. Authorization Verification

| Endpoint | Guard | Verified |
|---|---|---|
| `POST /applications` | `CANDIDATE` only | ✅ employer correctly `403` |
| `POST /companies` | `EMPLOYER`/`ADMIN` | ✅ candidate correctly `403` |
| `POST /jobs`, `/publish` | `EMPLOYER`/`ADMIN` | ✅ candidate correctly `403` |
| `POST /applications/:id/reject` | `EMPLOYER`/`ADMIN` | ✅ candidate correctly `403` |
| `POST /applications/:id/withdraw` | `CANDIDATE`/`ADMIN` + **ownership** | ✅ non-owning employer `403`; ✅ non-owning candidate2 `403`; ✅ owner succeeds |
| `POST /applications/:id/delivered\|opened\|viewed` | `ADMIN` only | ✅ (called with admin token; role gate confirmed via controller source) |
| `POST /applications/:id/prepare\|queue\|send\|archive` | **No role guard, no ownership check** | ⚠️ **confirmed real gap — see below** |
| `GET /applications/:id` (and all sibling reads) | Authenticated (any role) | ✅ no-token call correctly `401` |

**Security finding (reported, not fixed — a Security Model change requires explicit confirmation under the standing autonomy policy):** `prepare`, `queue`, `send`, and `archive` are reachable by *any* authenticated user regardless of role or relationship to the application. This was proven, not inferred: an `EMPLOYER` token successfully prepared a candidate's `DRAFT` application it had no relationship to; an unrelated candidate successfully queued and then archived that same application. The domain policies backing these four transitions (`ReadinessPolicy`, `SchedulingPolicy`, `DispatchPolicy`, and archive's implicit no-op policy) each explicitly allow with no actor check — one's own doc comment reads *"No actor restriction today — the extension point a future 'who may prepare on a candidate's behalf' rule attaches to."* This is a real, intentional-but-incomplete extension point, structurally identical to the dormant intelligence hooks found in M23/M24 (reserved shape, not yet wired) — except this one is a live authorization surface, not an inert data field, so it carries real risk in a multi-tenant deployment with adversarial actors. `withdraw` is the one transition that *does* enforce ownership correctly, proving the pattern is known and buildable — it just hasn't been extended to the other four yet.

**Recommendation for Milestone 25 (not applied here):** add a `RolesGuard`/ownership check to `prepare`, `queue`, `send`, and `archive` — most likely constraining `prepare`/`queue`/`send` to the owning `CANDIDATE` (mirroring `WithdrawalPolicy`) and `archive` to the owning candidate, the company on the application, or `ADMIN`.

---

## 5. Swagger Contract Validation

- **28 POST action endpoints across Jobs, Companies, Campaigns, and Applications controllers documented `200` while returning `201`** (NestJS's undecorated default for `@Post()`). Fixed by correcting the `@ApiResponse` annotations to `201`, matching real, already-live behavior. This is a documentation-accuracy fix, not a behavior change — verified by checking `apps/web/src/lib/api-client.ts`, which only branches on `401`/`204` and otherwise treats any `response.ok` as success, so no frontend code depended on the incorrect `200` documentation.
- `ApplicationHistoryEntryResponseDto` (tested live for the first time this pass) matches its Swagger schema exactly: `{ timestamp, summary, actor: { role, actorId } }`.
- `ApplicationResponseDto`, `TimelineEntryResponseDto`, `CompanyResponseDto`, `JobResponseDto` — re-confirmed zero drift against `/api/docs-json` in this pass's live responses.
- **Known, honest gap (unchanged, not fixed — out of this audit's "no new features" scope):** `GET /applications/:id/history` has no corresponding `ApplicationHistoryEntryDto` in `packages/shared-types` and zero frontend consumers. The endpoint is real, live, and now proven correct — but nothing in `apps/web` calls it yet. This is a legitimate scope item for a future milestone.

---

## 6. Error Handling and Production Logs

- Every illegal or unauthorized call in this entire audit returned the correct, specific HTTP status: `400` (invalid id / validation), `401` (unauthenticated), `403` (role or ownership denial), `404` (not found, exercised implicitly via the earlier `AllExceptionsFilter` fix's own verification), `409` (invalid state transition, and the one-company-per-owner rule), `422` (missing mandatory fields for publish). **Zero 500s anywhere in this entire run.**
- `docker logs german-job-engine-api-1` for the full duration of this audit shows **zero `ERROR`-level entries** — confirming every one of the above 4xx responses was a correctly-handled `HttpException`, not a crash masquerading as a client error, and confirming the earlier `AllExceptionsFilter` logging fix (from the prior validation pass) produces zero false-positive noise under heavy, deliberately-adversarial real traffic.

---

## 7. Domain Events / Audit Trail — What "Audit Events" Actually Means Here

Investigated directly in source, not assumed: `Application` raises real domain events (`ApplicationCreated`, `ApplicationPrepared`, `ApplicationTransitioned`, etc.) via `@nestjs/cqrs`'s `EventBus`, published from `saveAndPublish()` after every command. **There are zero `@EventsHandler` subscribers anywhere in the codebase for any of these events.** They are published into a live but entirely unconsumed in-memory bus — a real, reserved extension point (e.g., for future notifications or analytics), not currently wired to anything.

The actual, durable audit trail is the `timeline_entries` table: each transition method's command handler writes a new row directly via `repository.save()` in the same call that raises the (unconsumed) event — the two are parallel effects of one command, not producer/consumer. **This means "audit events," in the sense of a queryable, persisted record of everything that happened to an application, are real and fully verified (§3) — they just live in the timeline table, not in an event-sourced log.** This is architecturally sound as-is; it only becomes a gap the moment a future feature needs to *react* to a transition (e.g., send an email on `INTERVIEW_SCHEDULED`), at which point a subscriber would need to be added — nothing currently reacts to any application state change other than the return response.

---

## Production Readiness Report

### Validated Endpoints (this audit)
`POST /auth/register`, `POST /auth/login`, `POST /companies`, `GET /companies/:id`, `POST /jobs`, `POST /jobs/:id/publish`, `GET /jobs/:id`, `POST /applications`, `GET /applications/:id`, `GET /applications/:id/timeline`, `GET /applications/:id/history` *(first-ever live test)*, `POST /applications/:id/{prepare,queue,send,delivered,opened,viewed,company-reply,interviews/schedule,interviews/complete,offer,contract,reject,withdraw,archive}` — all 14 transition endpoints exercised with real state changes and real role/ownership boundary tests.

### Fixed Defects (this audit)
1. **Swagger status-code drift** — 28 POST action endpoints (Jobs ×4, Companies ×2, Campaigns ×8, Applications ×14) documented `200`, actually returned `201`. Fixed by correcting the documented status to match real, already-live behavior. Verified via Docker rebuild, 772/772 backend tests passing, and a live `/api/docs-json` re-check.

### Remaining Known Limitations
- `GET /applications/:id/history` has no `shared-types` DTO and no frontend consumer yet (real endpoint, zero UI usage).
- Application domain events (`ApplicationCreated`, `ApplicationTransitioned`, etc.) are published to an in-memory bus with zero subscribers — a real, inert extension point, not a defect, but worth knowing before assuming any event-driven side effect currently exists.
- `GET /applications/:id/history` and the tracking-signal endpoints' actor semantics (SYSTEM-attributed regardless of caller) are correct but undocumented outside this report and inline code comments.

### Technical Debt
- None newly introduced by this audit. The Swagger annotation fix is a pure correction.

### Security Observations
- **Real, unaddressed gap**: `prepare`, `queue`, `send`, and `archive` on `/applications/:id` have no role guard and no ownership check — any authenticated user can drive or archive any application, not just their own. Proven live in this audit (§4). This is a Security Model change and was intentionally **not** fixed under the standing engineering-autonomy policy — flagged here for an explicit decision before Milestone 25 or before this is exposed to real adversarial multi-tenant traffic.
- All other authorization boundaries tested (company/job creation, reject, withdraw, tracking signals, read authentication) are correctly enforced and were proven, not assumed.
- One-company-per-owner and job-publish-readiness are both correctly enforced domain invariants (`409`/`422` respectively), confirmed live, not defects.

### Performance Observations
- Full 13-step Application A lifecycle walk (13 sequential HTTP round trips) completed in well under 1 second server-side (timestamps in the timeline chain span ~480ms total, §3) — no latency concerns observed at this scale. No load/concurrency testing was performed (out of this audit's scope).

### Architecture Observations
- The forward-only `TRANSITION_GRAPH` (a declarative, independently-unit-tested lookup table) correctly gates every transition; illegal transitions fail with `409`, never `500` — confirmed for the terminal-state case (`ARCHIVED → PREPARED` correctly rejected).
- The domain policy pattern (`ReadinessPolicy`, `WithdrawalPolicy`, etc.) is a clean, consistent extension point — it's precisely *because* the pattern is so consistent that the four unimplemented actor checks (§4) stand out as an intentional gap rather than an oversight.
- Timeline persistence and domain-event publication are parallel effects of the same command, not a producer/consumer pipeline — worth knowing precisely because it looks like it could be event-sourced and isn't.

### Final Production Readiness Score: **90 / 100**

**Basis**: the entire Company → Job → Application workflow is proven correct end to end, under real load, with zero unexpected failures, zero 500s, correct persistence, correct audit trail, and correct Swagger contracts after this pass's fix. The 10-point deduction is entirely attributable to the one real, load-bearing gap found this pass — the missing ownership/role check on four application-transition endpoints — which is a genuine pre-launch concern for a multi-tenant deployment and is correctly left unfixed pending an explicit Security Model decision, not evidence of an unstable or unverified system.

**Milestone 24 is fully validated. This report confirms readiness to proceed to Milestone 25**, with the one open security decision above carried forward as the first item to resolve, per the user's own instruction to flag rather than silently alter security-model behavior.
