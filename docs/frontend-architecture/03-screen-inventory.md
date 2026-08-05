# 3. Screen Inventory

Every screen uses the same field set the milestone requested: Purpose, Entry points, Exit points, Permissions, Displayed data, Backend APIs, the four load-result states (Loading/Empty/Success/Failure), Edge cases, and Navigation. 🟢/🟡/⚪ tags follow [01-information-architecture.md](01-information-architecture.md).

Screens for 🟡/⚪ areas still get the full template — a screen with no live API is still a real screen the design system and routing must accommodate — but their "Backend APIs" field says so plainly, and their Failure/Edge-case rows are shorter because there's nothing live to fail yet.

---

## Public surface

#### Landing / Marketing Home ⚪
| | |
|---|---|
| Purpose | Convert an anonymous visitor into a registrant; explain the product. |
| Entry points | Direct URL, external links, search engines. |
| Exit points | Register, Login, Company Explorer (public browse). |
| Permissions | Anonymous. |
| Displayed data | Static marketing content; optionally a live count (e.g. "X companies indexed") sourced from `GET /companies` — real data, not fabricated copy, if shown at all. |
| Backend APIs | None required; optional `GET /companies?limit=1` for a live count. |
| Loading | N/A (static) or skeleton for the optional live count. |
| Empty | N/A. |
| Success | Renders immediately. |
| Failure | If the optional live count fails, hide it silently — never block the landing page on a non-critical API call. |
| Edge cases | Already-authenticated visitor hitting `/` → redirect to Dashboard (see [09-navigation-architecture.md](09-navigation-architecture.md)). |
| Navigation | → Login, → Register, → Company Explorer. |

#### Company Explorer (public) 🟢
| | |
|---|---|
| Purpose | Browse/search companies without an account — public read access is a deliberate backend design (M19 §5.1), doubling as SEO surface. |
| Entry points | Landing page, direct link, search engines, main nav (public variant). |
| Exit points | Company Detail; Register/Login (prompted when trying to act). |
| Permissions | Anonymous (read); mutation actions hidden entirely, not just disabled. |
| Displayed data | Paginated company cards: name, industry, size, location, visa sponsorship, trust score. |
| Backend APIs | `GET /companies/search` (keyword + filters: industry, size, city, visa sponsorship), `GET /companies` (unfiltered list), both paginated. |
| Loading | Skeleton grid matching the card layout. |
| Empty | "No companies match your filters" + a clear-filters action, distinct from zero-companies-exist (which shouldn't happen in practice but the empty state must not lie about which case it is — see [10-ux-principles.md](10-ux-principles.md)). |
| Success | Paginated grid + result count. |
| Failure | Retry action; distinguish network failure from a 5xx. |
| Edge cases | Filter combination with zero results; very long company names/lists truncate, don't overflow. |
| Navigation | → Company Detail (public), → Job Listings filtered by company. |

#### Company Detail (public) 🟢
| | |
|---|---|
| Purpose | Evaluate one company before targeting it in a campaign or applying. |
| Entry points | Company Explorer card click, Job Detail's company link, direct link. |
| Exit points | Job Listings (this company's open roles), Register/Login (to act). |
| Permissions | Anonymous (read); Edit/Archive/Restore visible only to the owning `EMPLOYER` or `ADMIN` (01 §1.6). |
| Displayed data | Full `CompanyResponseDto`: name, industry, size, location, contact, trust score, hiring quality, visa sponsorship, status. |
| Backend APIs | `GET /companies/:id`; `PATCH /companies/:id`, `POST /companies/:id/archive`, `POST /companies/:id/restore` (owner/admin only). |
| Loading | Skeleton for header + detail sections. |
| Empty | N/A (a detail page for a specific id — see Failure for the not-found case). |
| Success | Full company profile rendered. |
| Failure | 404 → dedicated Not Found treatment (not a generic error), since a bad/stale id is the expected cause. |
| Edge cases | Archived company viewed by a non-owner — read-only, no indication mutation was ever possible; owner sees a visible "Archived" state with a Restore action. |
| Navigation | → Job Listings (filtered), → Edit (owner/admin only). |

#### Job Listings (public browse) 🟢
| | |
|---|---|
| Purpose | Browse published roles — the actual thing a candidate applies to. |
| Entry points | Company Detail, main nav, direct link, search engines. |
| Exit points | Job Detail. |
| Permissions | Anonymous (read; only `PUBLISHED` jobs are meaningful to show — `search`/`list` are public but the frontend should default filters toward published roles for the public view). |
| Displayed data | Paginated job cards: title, company, city, employment type, salary range, remote policy, visa sponsorship, German-level requirement. |
| Backend APIs | `GET /jobs/search` (keyword, city, companyId, industry, minSalary, employmentType, contractType, remotePolicy, visaSponsorship, ausbildungOnly, germanLevel), `GET /jobs`. |
| Loading | Skeleton grid. |
| Empty | "No roles match your filters" + clear-filters action. |
| Success | Paginated grid + result count + active-filter chips. |
| Failure | Retry; network vs. 5xx distinction. |
| Edge cases | Filter combinations unique to this domain (Ausbildung-only, German-level minimum) need their own filter UI, not generic dropdowns, since they're domain-specific to a German job market. |
| Navigation | → Job Detail, → Company Detail. |

#### Job Detail (public) 🟢
| | |
|---|---|
| Purpose | Full role detail — the basis for an application. |
| Entry points | Job Listings card, Company Detail's roles list, direct link. |
| Exit points | Apply (authenticated candidates only), Company Detail. |
| Permissions | Anonymous (read); Apply requires `CANDIDATE` auth; Edit/Publish/Archive/Close/Reopen require owning `EMPLOYER`/`ADMIN`. |
| Displayed data | Full `JobResponseDto`. |
| Backend APIs | `GET /jobs/:id`; `PATCH /jobs/:id`, `POST /jobs/:id/{publish,archive,close,reopen}` (owner/admin). |
| Loading | Skeleton. |
| Empty | N/A. |
| Success | Full detail + status badge (`DRAFT`/`PUBLISHED`/`ARCHIVED`/`CLOSED`). |
| Failure | 404 for bad id; a `DRAFT`/`ARCHIVED` job viewed by a non-owner should 404-equivalent (not leak draft content), even though the backend doesn't currently enforce this distinction server-side — see OQ-7 in [13-risks-and-open-questions.md](13-risks-and-open-questions.md). |
| Edge cases | `CLOSED` job — Apply button replaced with "This role is closed," not simply hidden (tells the user why). |
| Navigation | → Application Create (candidates), → Company Detail, → Job Edit (owner). |

---

## Authentication

#### Login 🟢
| | |
|---|---|
| Purpose | Authenticate a returning user. |
| Entry points | Landing page, any protected route redirect (with a return-to param), Register page ("already have an account"). |
| Exit points | Dashboard (success), Register (no account). |
| Permissions | Anonymous only — an authenticated user hitting `/login` redirects straight to Dashboard. |
| Displayed data | Email/password form. |
| Backend APIs | `POST /auth/login` (guarded by `LocalAuthGuard` server-side). |
| Loading | Submit button spinner state; form disabled during submit. |
| Empty | N/A. |
| Success | Tokens stored (see [07-state-management-strategy.md](07-state-management-strategy.md)); redirect to return-to path or Dashboard. |
| Failure | Invalid credentials → one generic message (never "email not found" vs "wrong password" — that's a user-enumeration leak); rate-limit/lockout messaging is ⚪ future (no backend rate-limit is actually enforced today, M19 §5.2 — don't imply one exists). |
| Edge cases | Submitting with an expired-but-present refresh token in storage — client must not assume login implies a clean slate; clear prior session state on fresh login. |
| Navigation | → Register, → Dashboard. |

#### Register 🟢
| | |
|---|---|
| Purpose | Create an account. |
| Entry points | Landing page, Login page. |
| Exit points | Onboarding (immediately — no email-verification gate exists, see [02-user-journeys.md](02-user-journeys.md)). |
| Permissions | Anonymous only. |
| Displayed data | Email/password (+ confirm) form. |
| Backend APIs | `POST /auth/register`. |
| Loading | Submit spinner. |
| Empty | N/A. |
| Success | Tokens stored; redirect straight to Onboarding. **Do not** show a "verify your email" interstitial — see OQ-1; if product wants that UX, it needs a backend endpoint first. |
| Failure | 409-equivalent for duplicate email (message: "an account with this email already exists," with a Login link); validation errors shown per-field per the global `ValidationPipe` contract (§6). |
| Edge cases | Password strength — enforced client-side only today (no server-side policy beyond `class-validator` presence/length checks confirmed in the DTO); don't claim a stronger guarantee than exists. |
| Navigation | → Login, → Onboarding. |

#### Verify Email ⚪
| | |
|---|---|
| Purpose | Would confirm the registrant controls the email address. |
| Backend APIs | **None exist.** Reserved route only — see OQ-1. Do not build this screen's logic; the route can exist as a placeholder that immediately redirects if ever reached, so it doesn't become a dead end if a stale link surfaces later. |

#### Forgot / Reset Password ⚪
| | |
|---|---|
| Purpose | Would let a user recover access without support intervention. |
| Backend APIs | **None exist** — `auth` has no password-reset command/endpoint. |
| Interim mitigation | Support-mediated reset only (out of frontend scope); the Login screen should not link to a broken self-service flow. |

---

## Onboarding

#### Onboarding Wizard 🟢 (frontend-composed)
| | |
|---|---|
| Purpose | Sequence profile completion into digestible steps immediately after registration, since there's no backend "onboarding" concept — this is entirely a frontend orchestration over real Profile endpoints. |
| Entry points | Post-registration redirect only. |
| Exit points | Dashboard (on completion or explicit skip). |
| Permissions | Authenticated, any role — though in practice only `CANDIDATE`s have a profile to complete; `EMPLOYER`s should skip straight to Company/Job creation (see OQ-8: no backend distinguishes "employer onboarding" from "candidate onboarding" today, this is a frontend routing decision based on `user.role`). |
| Displayed data | Step indicator; per-step forms (basic info → skills/experience → CV → review). |
| Backend APIs | `POST /profiles` (create, once), `PATCH /profiles/me` (per step), `POST /profiles/me/cv`. |
| Loading | Per-step submit spinner; initial `GET /profiles/me` to resume an interrupted onboarding. |
| Empty | N/A — always has a profile to build once `POST /profiles` succeeds. |
| Success | Final step redirects to Dashboard with a completion acknowledgment. |
| Failure | Per-step validation errors block advancing; a failed `PATCH` doesn't lose the user's in-progress input (keep it in local form state, don't clear on error). |
| Edge cases | User abandons mid-wizard and returns later — must resume from actual profile completeness (derived from `GET /profiles/me`'s populated fields), not a client-only "which step was I on" flag that could desync from server state. Skippable entirely — profile completeness is not server-enforced (see [02-user-journeys.md](02-user-journeys.md) "Incomplete profile"). |
| Navigation | → Dashboard. |

---

## Dashboard

#### Dashboard Home 🟢 (composed)
Full breakdown in [04-dashboard-architecture.md](04-dashboard-architecture.md). Summary:
| | |
|---|---|
| Purpose | Single-screen "what's happening" home base. |
| Entry points | Post-login redirect, main nav logo/home link. |
| Exit points | Every other authenticated area. |
| Permissions | Any authenticated role; content composition differs by role (candidate sees campaigns/applications; employer sees their jobs/companies — see [08-permission-matrix.md](08-permission-matrix.md)). |
| Displayed data | Campaign summary cards, recent application activity, profile-completeness nudge, quick actions. |
| Backend APIs | `GET /campaigns?ownerId=`, `GET /applications` (filtered client-side or via `search`), `GET /profiles/me`. No dedicated dashboard-summary endpoint exists — composed client-side. |
| Loading | Per-widget skeletons — each widget loads and fails independently (see [04](04-dashboard-architecture.md)). |
| Empty | New-user empty state: "Create your first campaign" CTA, distinct per role. |
| Success | Populated widget grid. |
| Failure | Per-widget failure, not whole-page — one failed widget must never blank the dashboard. |
| Edge cases | Candidate with zero campaigns but complete profile — emphasize campaign creation, not profile completion (nudge only what's actually missing). |
| Navigation | → Campaign List/Detail, → Application List/Detail, → Profile, → Mission Control (once live). |

---

## Profile

#### Profile Overview 🟢
| | |
|---|---|
| Purpose | Read view of the candidate's own professional profile. |
| Entry points | Main nav, Dashboard completeness nudge. |
| Exit points | Profile Edit, CV Management. |
| Permissions | Authenticated owner only (`GET /profiles/me` is always self-scoped — there is no "view another candidate's profile" endpoint). |
| Displayed data | Full `ProfileResponseDto`: skills, education, work experience, languages, availability, salary expectation, CV metadata, photo. |
| Backend APIs | `GET /profiles/me`. |
| Loading | Skeleton sections. |
| Empty | Profile not yet created → prompt to start Onboarding rather than showing an empty shell. |
| Success | Full profile rendered, completeness indicator. |
| Failure | Retry; a 404-equivalent here should route to Onboarding (means `POST /profiles` was never called), not show a generic error. |
| Edge cases | Partially-complete profile — every section shows its own "add this" affordance rather than one page-level warning. |
| Navigation | → Profile Edit, → CV Management. |

#### Profile Edit 🟢
| | |
|---|---|
| Purpose | Update professional details. |
| Entry points | Profile Overview. |
| Exit points | Profile Overview (on save/cancel). |
| Permissions | Authenticated owner only. |
| Displayed data | Editable form pre-filled from `GET /profiles/me`. |
| Backend APIs | `PATCH /profiles/me`. |
| Loading | Submit spinner; form disabled during submit. |
| Empty | N/A. |
| Success | Toast confirmation + return to Overview with updated data (no stale cache — see [07](07-state-management-strategy.md) invalidation strategy). |
| Failure | Per-field validation errors from the `ValidationPipe` contract; unsaved-changes guard on navigation away. |
| Edge cases | Concurrent edit in two tabs — last-write-wins is the honest current backend behavior (no optimistic-concurrency/version field on `Profile`); don't imply conflict detection that doesn't exist. |
| Navigation | → Profile Overview. |

#### CV Management 🟢(metadata)/⚪(file) — see 01 §1.4
| | |
|---|---|
| Purpose | Manage the CV artifact specifically. |
| Entry points | Profile Overview, Onboarding step. |
| Exit points | Profile Overview. |
| Permissions | Authenticated owner only. |
| Displayed data | Current CV filename/upload date/size; (future) which applications used it and why, once `application-assembly` (🟡) is wired. |
| Backend APIs | `POST /profiles/me/cv` (metadata only: `fileName`, `fileUrl`, `mimeType`, `sizeBytes`). |
| Loading | Upload progress (client-side, against whatever object-storage transport is chosen — OQ-2). |
| Empty | "No CV uploaded" + upload CTA — a campaign should not be startable without one (frontend-enforced only, see [02](02-user-journeys.md) "Incomplete profile"). |
| Success | CV metadata confirmed, replace/preview actions available. |
| Failure | Upload-transport failure (network/storage) is a **different failure class** from metadata-registration failure (validation) — must be distinguishable in the UI, not collapsed into one generic "upload failed." |
| Edge cases | Replacing an existing CV — confirm before discarding the reference to the old one (no version history exists server-side). |
| Navigation | → Profile Overview. |

---

## Campaign Management

#### Campaign List 🟢
| | |
|---|---|
| Purpose | See every campaign the candidate owns, at a glance, with status. |
| Entry points | Main nav, Dashboard. |
| Exit points | Campaign Detail, Campaign Create. |
| Permissions | `CANDIDATE`/`ADMIN` (guard on the whole controller); scoped to `ownerId` for candidates, unscoped for admins. |
| Displayed data | Paginated campaign cards: name, status badge, goal progress, strategy type. |
| Backend APIs | `GET /campaigns?ownerId=`, `GET /campaigns/search` (status, strategyType, date range filters). |
| Loading | Skeleton grid. |
| Empty | "No campaigns yet" + Create CTA (first-run) vs. "no campaigns match your filters" (filtered) — distinct copy, see [10-ux-principles.md](10-ux-principles.md). |
| Success | Paginated grid, status filter chips. |
| Failure | Retry action. |
| Edge cases | A campaign stuck `RUNNING` with the pipeline doing nothing (see [02](02-user-journeys.md) step 7) — the card must not show a false "in progress" animation; show status honestly, not activity that isn't happening. |
| Navigation | → Campaign Detail, → Campaign Create. |

#### Campaign Create Wizard 🟢
| | |
|---|---|
| Purpose | Configure a new campaign: name, goal, strategy, batch plan, execution window, rate limits. |
| Entry points | Campaign List, Dashboard quick action. |
| Exit points | Campaign Detail (created, in `DRAFT`). |
| Permissions | `CANDIDATE`/`ADMIN`. |
| Displayed data | Multi-step form; goal (`targetApplicationCount`, `desiredOutcome`), strategy type, batch plan (base/min/max), execution window (weekdays/hours/timezone/holidays), rate limit profile. |
| Backend APIs | `POST /campaigns`. |
| Loading | Submit spinner per step transition. |
| Empty | N/A. |
| Success | Redirect to the new Campaign Detail, `DRAFT` status shown, next-step CTA ("mark ready" / "start"). |
| Failure | Per-field validation; a domain-invariant violation (e.g. `minBatchSize > maxBatchSize`) surfaces as a specific field error, not a generic failure — the domain VOs already validate this server-side (`SmartBatchPlan.create`), so the message just needs to be relayed faithfully. |
| Edge cases | Incomplete profile at creation time — frontend-only warning (§2 "Incomplete profile"), does not block submission since the backend doesn't either. |
| Navigation | → Campaign Detail. |

#### Campaign Detail 🟢
The richest screen in the platform — organized as tabs over one aggregate.

| | |
|---|---|
| Purpose | Full visibility into and control over one campaign. |
| Entry points | Campaign List, Campaign Create (redirect), Dashboard card. |
| Exit points | Campaign List (back), Application Detail (from targets/results, once that linkage is surfaced). |
| Permissions | `CANDIDATE` (owner) / `ADMIN` full control; other candidates get no access (404-equivalent, not 403, to avoid confirming existence — see [08](08-permission-matrix.md)). |
| Displayed data | Overview tab: `CampaignResponseDto` (status, goal, strategy, targets). Timeline tab: `CampaignTimelineEntryResponseDto[]` (structured transition ledger). Health tab: `CampaignHealthResponseDto` (nullable — "no health assessment recorded yet" is a real, expected empty state, not an error, since health assessment is a reserved-but-not-always-populated field). Execution Status tab: `CampaignExecutionStatusResponseDto` (active batch, target breakdown, checkpoint, goal progress). |
| Backend APIs | `GET /campaigns/:id`, `GET /campaigns/:id/timeline`, `GET /campaigns/:id/health`, `GET /campaigns/:id/execution-status`; lifecycle actions: `PATCH`, `POST :id/{start,pause,resume,cancel,complete,retry,replay,archive}`. |
| Loading | Per-tab independent loading (switching tabs shouldn't re-fetch the overview). |
| Empty | Health tab: explicit "not yet assessed" state (not an error) when the endpoint returns null. Timeline tab: "No transitions yet" for a freshly-created `DRAFT` campaign. |
| Success | Full tab content + a lifecycle action bar whose available actions are derived from current `status` (see [08](08-permission-matrix.md) for the exact status→action matrix). |
| Failure | 404 for bad/unauthorized id; action failures (e.g. `POST :id/start` on an already-terminal campaign) surface the specific domain exception message, not a generic "action failed." |
| Edge cases | `RUNNING` status with zero pipeline activity (§2 step 7) — Execution Status tab must reflect the Campaign aggregate's own (real, live) batch/target tracking honestly, and must **not** be confused with or padded out with Mission Control-style cross-campaign execution telemetry, which doesn't exist yet. `STOPPED` vs `CANCELLED` vs `COMPLETED` need visually and textually distinct terminal-state treatments (§2 "Failed campaign"). |
| Navigation | → Campaign List, → lifecycle action confirmations (modals, see [05](05-component-architecture.md) Dialog). |

#### Campaign Edit 🟢
| | |
|---|---|
| Purpose | Modify a campaign's configuration. |
| Entry points | Campaign Detail. |
| Permissions | `CANDIDATE` (owner)/`ADMIN`; **only while `DRAFT` or `READY`** — the backend rejects edits to a running/terminal campaign (`PATCH` handler enforces this domain rule). |
| Backend APIs | `PATCH /campaigns/:id`. |
| Failure | If somehow reached for a non-editable status (e.g. a stale tab), surface the domain rejection clearly and redirect back to Detail — don't let the form silently no-op. |
| Navigation | → Campaign Detail. |

---

## Company Explorer (authenticated / employer-side)

#### My Companies (Employer) 🟢
| | |
|---|---|
| Purpose | An employer's own company profile(s) management. |
| Permissions | `EMPLOYER`/`ADMIN`. |
| Backend APIs | `GET /companies?ownerId=` (client-filtered from the same list endpoint — no dedicated "my companies" endpoint exists, same composition pattern as Dashboard). |
| Navigation | → Company Create, → Company Detail (editable view). |

#### Company Create / Edit (Employer) 🟢
| | |
|---|---|
| Purpose | Create or update a company profile. |
| Permissions | `EMPLOYER`/`ADMIN`, owner-only for edit. |
| Backend APIs | `POST /companies` (create), `PATCH /companies/:id` (edit), `POST /companies/:id/{archive,restore}`. |
| Failure | Archive/Restore are idempotent-feeling actions in the domain — confirm archive (destructive-adjacent) per [10-ux-principles.md](10-ux-principles.md); restore does not need confirmation. |
| Navigation | → Company Detail. |

---

## Job Listings (employer-side)

#### My Job Listings (Employer) 🟢
| | |
|---|---|
| Purpose | An employer's own postings, across all statuses (not just `PUBLISHED`). |
| Permissions | `EMPLOYER`/`ADMIN`. |
| Backend APIs | `GET /jobs?companyId=` (client-filtered). |
| Navigation | → Job Create, → Job Detail (editable view). |

#### Job Create / Edit (Employer) 🟢
| | |
|---|---|
| Purpose | Create/configure/publish a role. |
| Permissions | `EMPLOYER`/`ADMIN`, owner-only for edit. |
| Backend APIs | `POST /jobs`, `PATCH /jobs/:id`, `POST /jobs/:id/{publish,archive,close,reopen}`. |
| Success | `publish` is a distinct, explicit action from `create` — a job is created `DRAFT` and stays invisible to public browse until published; the UI must make this two-step nature obvious (draft-then-publish), not implicit. |
| Navigation | → Job Detail. |

---

## Applications

#### Application List 🟢
| | |
|---|---|
| Purpose | See every application, across all 15 lifecycle states, filterable. |
| Entry points | Main nav, Dashboard, Campaign Detail (filtered to that campaign's applications, once `campaignRef` linkage is surfaced). |
| Exit points | Application Detail. |
| Permissions | Authenticated; `CANDIDATE` sees their own, `EMPLOYER` sees applications against their companies, `ADMIN` sees all (role-based scoping is a frontend query-param concern today — `search`'s `candidateId`/`companyId` filters — since the backend doesn't auto-scope by JWT identity on this particular query). |
| Displayed data | Paginated rows: job title, company, status badge, last-updated. |
| Backend APIs | `GET /applications/search` (candidateId, jobId, companyId, status, channelType, date range), `GET /applications`. |
| Loading | Skeleton table/list. |
| Empty | "No applications yet" (candidate, zero state) vs. "no applications match your filters" — distinct. |
| Success | Paginated, sortable-by-status list. |
| Failure | Retry. |
| Edge cases | A candidate's own list should never show `EMPLOYER`-only transitions (delivered/opened/viewed) as actionable — those three are `ADMIN`-only writes (01 §1.7) and must render as read-only status signals everywhere. |
| Navigation | → Application Detail. |

#### Application Detail 🟢
The second-richest screen in the platform — a full state-machine timeline plus role-gated actions.

| | |
|---|---|
| Purpose | Full visibility into and control over one application's 15-state lifecycle. |
| Entry points | Application List, Job Detail (after applying), Campaign Detail. |
| Exit points | Application List, Trust Center (once linked, 🟡), Job/Company Detail. |
| Permissions | Owning `CANDIDATE`, the target's `EMPLOYER`, or `ADMIN`. Each lifecycle action is individually role-gated — see [08-permission-matrix.md](08-permission-matrix.md) for the full per-action matrix; this is the single most role-fragmented screen in the platform and the UI must hide (not just disable) actions the current user cannot take. |
| Displayed data | `ApplicationResponseDto` (current status, job/company/candidate refs, channel, snapshot); Timeline tab (`TimelineEntryResponseDto[]`, structured); History tab (`ApplicationHistoryEntryResponseDto[]`, narrative). |
| Backend APIs | `GET /applications/:id`, `GET /applications/:id/timeline`, `GET /applications/:id/history`; lifecycle actions: `prepare`, `queue`, `send`, `company-reply`, `interviews/schedule`, `interviews/complete`, `offer`, `contract`, `reject`, `withdraw`, `archive` (each role-gated per 01 §1.7). |
| Loading | Independent per-tab. |
| Empty | Timeline/History for a freshly-`DRAFT` application: single "created" entry, not an empty state. |
| Success | Full lifecycle view + status-appropriate action bar. |
| Failure | An action attempted from an invalid state surfaces the specific domain rejection (the `Application` aggregate guards its own transitions, same pattern as Campaign) — never a generic "couldn't complete action." |
| Edge cases | `REJECTED`/`WITHDRAWN` are both real terminal exits reachable from many mid-lifecycle states — the timeline must show *which* exit and *why* (`reasonCode`/`reasonNote`, required for both), not collapse them into one "ended" visual. |
| Navigation | → Application List, → Job Detail, → Company Detail. |

#### Application Create (from Job) 🟢
| | |
|---|---|
| Purpose | Start an application against a specific job. |
| Entry points | Job Detail's Apply action. |
| Permissions | `CANDIDATE` only. |
| Backend APIs | `POST /applications` (jobId, companyId, snapshot, channelType, optional campaignRef/correlationId). |
| Success | Creates in `DRAFT`; redirect to Application Detail with a clear "next: prepare this application" prompt (mirrors the real prepare→queue→send sequence, not implying it's already sent). |
| Edge cases | Applying to the same job twice — no backend uniqueness constraint prevents this today; frontend should warn ("you already have an application for this role") but not hard-block, matching the honest-gap pattern used elsewhere. |
| Navigation | → Application Detail. |

---

## Mission Control 🟡 (all screens — no backend controller exists)

Every screen below is designed fully per the milestone's requirement, but every "Backend APIs" row says the same thing: **none exist yet.** `mission-control`'s 6 projection services (M17–M18) are real, tested application-layer code with zero HTTP exposure. Build these screens' visual/interaction design now; wire them the moment a controller exists — nothing here should require a redesign when that happens, only a real fetch replacing a "not yet available" state.

#### Mission Control Overview 🟡
| | |
|---|---|
| Purpose | Cross-campaign operational home — "how is my whole job search doing." |
| Displayed data (once live) | Composition of all 6 projections: Campaign Timeline, Germany Coverage, Regional Progress, Trust Center summary, Delivery Overview, Recommendation Insights. |
| Backend APIs | None. Reserved route, `⚪`-equivalent state: a permanent, honest "Mission Control isn't connected yet" panel — not a fake loading spinner that never resolves. |
| Navigation | → Trust Center (per-execution drill-down), → individual projection screens. |

#### Germany Coverage Map 🟡
| | |
|---|---|
| Purpose | Geographic view of campaign activity across Germany. |
| Displayed data (once live) | `GermanyCoverageSnapshot` — and *only* real, verified company-location data, per the M17/M18 "never estimate location" rule (M19 report, geographic-context discussion) — never a fabricated or interpolated map fill. |
| Backend APIs | None. |

#### Regional Progress 🟡
| | |
|---|---|
| Purpose | Per-region breakdown of campaign progress. |
| Backend APIs | None. |

#### Delivery Overview 🟡
| | |
|---|---|
| Purpose | Aggregate delivery success/failure across campaigns. |
| Backend APIs | None. |

#### Recommendation Insights 🟡
| | |
|---|---|
| Purpose | Surface what the (dormant) Recommendation Engine is producing and why. |
| Backend APIs | None. |

---

## Trust Center 🟡

#### Trust Center Detail 🟡
| | |
|---|---|
| Purpose | Single-execution drill-down: exact event chain for one send. |
| Entry points (once live) | Application Detail, Campaign Timeline, Mission Control Delivery Overview. |
| Backend APIs | None yet — and when wired, must query by `(correlationId, traceId)` together, **not** `traceId` alone (M19 report §2.3 finding 3 — the current `TrustCenterProjectionService` implementation has this exact bug). Do not build this screen's data layer against a bare-traceId contract even once a controller exists; verify the fix landed first. |

---

## Notifications ⚪

#### Notification Center ⚪
| | |
|---|---|
| Purpose | In-app feed of "something happened" events. |
| Backend APIs | None — no notification module exists anywhere in the backend (01 §1.10). |
| Design guidance | Reserve a bell icon + panel in the global layout (04); its content area renders a permanent empty state until a real backend module exists. Do not build client-side polling against existing endpoints (e.g. diffing `GET /applications`) to *simulate* notifications — that's a correctness trap (missed transitions, no delivery guarantee) masquerading as a feature; see OQ-3. |

---

## Billing / Subscription

#### Subscription & Billing 🟢(read-only, 1 endpoint)/⚪(everything else)
| | |
|---|---|
| Purpose | View subscription status; would manage plan/payment. |
| Permissions | Authenticated owner only — **and this must be enforced client-side today**, because the one live endpoint (`GET /billing/subscriptions/:userId`) has no server-side auth guard yet (M19 report §5.1, unfixed). The frontend must never construct this URL from anything other than the current authenticated user's own id, and this screen should not ship to production until the backend gap is closed — see OQ-4. |
| Displayed data | `SubscriptionDto` (status: `TRIALING`/`ACTIVE`/`PAST_DUE`/`CANCELED`, `currentPeriodEnd`, `planId`). |
| Backend APIs | `GET /billing/subscriptions/:userId` only. No plan-list, checkout, payment-method, invoice, or upgrade/downgrade endpoint exists. |
| Loading | Skeleton. |
| Empty | No subscription record — treat as "free tier" / "no active subscription," not an error. |
| Success | Status card; Upgrade/Manage-Payment buttons rendered but **disabled with an explicit "coming soon"**, not hidden — the product intent is real even though the backend isn't, and hiding vs. disabling communicates different things (see [10-ux-principles.md](10-ux-principles.md)). |
| Failure | Distinguish "no subscription" (empty, expected) from a real fetch failure. |
| Navigation | → (future) Checkout, Invoice History. |

---

## Settings

#### Account Settings 🟢(partial)
| | |
|---|---|
| Purpose | Account-level preferences distinct from the professional Profile. |
| Backend APIs | `GET /users/:id` (self). No update-account endpoint exists yet (distinct from `PATCH /profiles/me`, which only covers profile fields) — password change, email change, and notification preferences are all ⚪ future. |
| Displayed data | Read-only account info today; form fields for future settings rendered disabled/reserved rather than omitted, matching the Billing pattern above. |
| Navigation | → Profile Edit (for professional fields), → Logout. |

---

## Administration ⚪ (reserved, not built)

#### Admin Overview ⚪
| | |
|---|---|
| Purpose | Would be platform operator tooling. |
| Permissions | `UserRole.ADMIN` only — the role already exists and is checked throughout every guarded controller, so the *gate* is real even though the *content* isn't. |
| Backend APIs | None dedicated — no admin listing/metrics endpoint exists. `ADMIN`s today act on other users' resources through the same per-resource endpoints as any owner (campaigns, applications, companies, jobs all accept `ADMIN` in their `@Roles()`). |
| Design guidance | Reserve `/admin` as a route group gated on role, with a single placeholder screen. Do not build tooling ahead of the backend surface that would drive it. |

---

## System / Utility screens

#### 404 Not Found
Purpose: any unmatched route or a resource id that doesn't resolve. Distinct from Unauthorized — never conflate "doesn't exist" with "you can't see it" in copy, even though several screens above deliberately use a 404-equivalent for both (a considered privacy choice, e.g. Campaign Detail) — the screen itself is generic; call sites choose when to use it.

#### Unauthorized (401/403)
Purpose: authenticated but forbidden (role mismatch), or session expired mid-navigation (401 → silent refresh attempt first, per [06-api-consumption-architecture.md](06-api-consumption-architecture.md); only show this screen if refresh also fails).

#### Maintenance Mode
Purpose: reserved for a future deploy-time flag; no backend maintenance-mode signal exists today (no `/health` degraded state beyond up/down). Build the screen; wire its trigger later (see [09-navigation-architecture.md](09-navigation-architecture.md)).

#### Account Suspended ⚪
Purpose: reserved per [02-user-journeys.md](02-user-journeys.md) "Account suspension" — no backend concept exists. Screen shell only.
