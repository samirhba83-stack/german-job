# Milestone 31 Phase 19 — Privacy and User Transparency (Technical Requirements)

**These are technical requirements drawn from what this application actually does — not a legal
Privacy Policy or Terms of Service, and not a substitute for real legal review. Every section
below states plainly where legal review is required before public use.**

## What must be disclosed, and the real mechanism behind each disclosure

| Disclosure | Real mechanism it must describe accurately |
|---|---|
| Account data collected | Email, password (hashed via bcrypt, never stored plaintext), profile fields (`user_profiles`) |
| CV / document storage | Real MinIO/S3-compatible storage, real virus/content scanning before acceptance (M28.5), real per-document access control |
| Email sending on the candidate's behalf | Real, explicit, separate OAuth consent (M28.6) — sends from the candidate's OWN connected Gmail/Outlook, never a platform address impersonating them |
| Inbox reading | A SEPARATE, explicitly-upgraded consent from sending (M29) — narrowest possible OAuth scope (`gmail.readonly`/equivalent), never full mailbox access; a user who never grants this keeps sending working exactly the same |
| What inbox reading is used for | Real, structured extraction (interview dates, document requests, etc.) to power follow-up suppression and task creation (M30) — never used to draft or send anything automatically (`INBOX_AUTOMATIC_REPLY_ENABLED` stays `false`) |
| Retention | Real: 90-day sanitized excerpt retention (M29, `INBOX_EXCERPT_RETENTION_DAYS`); full email bodies are never stored at all; audit/billing records retained indefinitely pending real legal guidance on required retention periods (Phase 14) |
| Account deletion | **Real gap** (Phase 14) — no deletion workflow exists yet; the technical draft below must not claim a capability that doesn't exist |
| Data export | **Real gap** — no export mechanism exists yet; same caution as above |
| Security contact | Not yet established — needs a real, monitored address before Closed Beta invites go out |
| Third parties data is shared with | Google/Microsoft (OAuth providers), the chosen email delivery provider (Resend/SES/SendGrid/SMTP), Paddle (billing) — real, already-implemented integrations; no others |
| AI use | None — `DisabledAiClassificationAdapter` (M29), explicitly disclosed as inactive; must not claim AI classification is in use |

## Draft consent-explanation copy (technical accuracy check, not final legal/marketing copy)

- **Sending permission**: "German Job Engine will send job applications from your own connected
  Gmail/Outlook account, using your name and address — never from a platform address pretending to
  be you." (Matches the real M28.6 architecture exactly.)
- **Inbox-reading permission** (separate, optional, upgradeable/revocable independently): "With
  your separate permission, German Job Engine can read replies to applications it sent for you —
  only messages related to your applications, never your full inbox — to help you track interview
  invitations, document requests, and next steps automatically. You can revoke this at any time
  without affecting your ability to keep sending applications."
- **Document storage**: "Your CV and other documents are stored securely and scanned before
  acceptance. Only you (and, where you've applied, the receiving company) can access them."

## What genuinely requires real legal review before Public Launch (not this milestone)

- Final Privacy Policy and Terms of Service text (this document is a technical accuracy input to
  that process, not a substitute for it)
- Jurisdiction-specific compliance claims (GDPR or otherwise) — this document makes no such claim
- The real data-retention periods for billing/audit records (Phase 14's own open item)
- The account-deletion/data-export workflow's exact scope, once built (Phase 14)
- Cookie/tracking disclosure for the frontend, once real product telemetry (Phase 23) is live

## Explicitly out of scope for this milestone

This document, and every consent-copy draft in it, is a **technical requirements input** for a
real legal review — not a legal opinion, not a final published policy, and not itself sufficient
authorization to onboard real users. Per this milestone's own AUTONOMY boundary, publishing a
final legal Privacy Policy requires explicit Product Owner (and real legal) sign-off.
