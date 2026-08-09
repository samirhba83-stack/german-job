# Milestone 31 / 31.1 / 31.2 — Production Certification, Controlled Closed Beta Launch & Real-World Validation

**FINAL VERDICT (Milestone 31.2): MILESTONE 31.2 NOT READY** — see
[40-m31-2-final-blocker-matrix-and-verdict.md](40-m31-2-final-blocker-matrix-and-verdict.md) for
the full reasoning. 16 of 24 required checklist items remain `BLOCKED_EXTERNAL` — every one behind
real account/infrastructure creation (Render, Google Cloud, Microsoft Entra, Grafana Cloud) only
the Product Owner can perform. A real, YAML-validated Render Blueprint
([`render.yaml`](../../render.yaml)) and a complete CD pipeline now exist and will deploy
automatically the moment the required GitHub secrets are set — the path from here to a real
Staging environment is fully prepared, not merely proposed.

**Do not start Milestone 32.**

## Reading order

Start with [40-m31-2-final-blocker-matrix-and-verdict.md](40-m31-2-final-blocker-matrix-and-verdict.md)
(the current, decisive checklist and verdict), then
[37-m31-2-render-staging-topology.md](37-m31-2-render-staging-topology.md) for the real deployment
plan and its EXTERNAL ACTION REQUIRED block. Everything else is the real, phase-by-phase evidence
those documents draw on.

| Doc | Title |
|---|---|
| 01 | Production Readiness Audit |
| 02 | Environment Architecture |
| 03 | Cloud Topology |
| 04 | CI/CD and Release Versioning |
| 05 | Secret Management |
| 06 | Domain/HTTPS/Network Security |
| 07 | Google OAuth Checklist |
| 08 | Microsoft Entra Checklist |
| 09 | Webhook Certification |
| 10 | Database and Restore Drill |
| 11 | Data Retention and Deletion |
| 12 | Observability |
| 13 | Alerting and Metrics Catalogue |
| 14 | Security Assessment (updated M31.1 — archive finding closed) |
| 15 | Privacy and Transparency |
| 16 | Closed Beta Access Model |
| 17 | Beta Onboarding |
| 18 | Beta UX Quality Gate |
| 19 | Product Telemetry Catalogue |
| 20 | Closed Beta Success Criteria |
| 21 | Staged Activation & Feature Flag Matrix |
| 22 | Emergency Stop & Rollback Runbook |
| 23 | Load and Reliability Testing |
| 24 | Staging E2E Certification (local-dev proxy) |
| 25 | Closed Beta RC1 Report (M31) |
| 26 | Milestone 31 Engineering Report |
| 27 | Decision Records (M31) |
| 28 | Final Verdict (M31 — superseded) |
| 29 | M31.1 Blocker Re-Audit Matrix |
| 30 | M31.1 Hosting Decision Package |
| 31 | M31.1 Secret Isolation & Rotation |
| 32 | M31.1 OAuth/Webhook Readiness Re-Verification |
| 33 | M31.1 Monitoring Decision & Implementation |
| 34 | M31.1 Real Company Outreach Hard Gate |
| 35 | Final Verdict (M31.1 — superseded) |
| 36 | **M31.2 Pre-Flight Audit** |
| 37 | **M31.2 Render Staging Topology & IaC** (EXTERNAL ACTION REQUIRED — Render) |
| 38 | **M31.2 Google Cloud & Microsoft Entra External Actions** |
| 39 | **M31.2 Staging Secret Provisioning & Monitoring External Action** |
| 40 | **M31.2 Final Blocker Matrix & Verdict** |

## The single most important fact in this document set

Every `false`-by-default Production Safety Flag (doc 21) stays `false` for the entire Controlled
Closed Beta — confirmed at rest in both local dev `.env` and `render.yaml`'s own Staging defaults.
No application is ever sent to a real German company. No public registration is ever opened.
Nothing in this milestone changes either of those without a separate, explicit, future Product
Owner decision.

## 3 external actions blocking further progress (doc 37/38/39 have exact steps)

1. **Render** — create the account, deploy the `render.yaml` Blueprint, set 4 GitHub Actions
   secrets. Unlocks the most other blocked items (Staging existing is a prerequisite for 11 of 16).
2. **Google Cloud** — a dedicated test project (Gmail API, OAuth consent, Pub/Sub).
3. **Microsoft Entra** — a dedicated test app registration.

A 4th, lower-urgency action — a **Grafana Cloud** account — unlocks real monitoring/alerting;
structured console logs remain real and inspectable without it.
