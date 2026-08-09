# Milestone 31 Phase 14 — Data Retention and Deletion

## Real, already implemented and running (confirmed via direct code inspection)

- **90-day sanitized inbox excerpt retention** (M29): `InboxRetentionService`, a real scheduled
  job — sanitized excerpts are pruned after `INBOX_EXCERPT_RETENTION_DAYS` (default 90); provider
  ids, classification results, and audit history are deliberately kept regardless (the excerpt
  itself, not the fact that a message existed, is the retention-sensitive content).
- **Full email body non-retention**: confirmed architecturally — this codebase never stores a full
  raw email body anywhere; only a sanitized excerpt (subject to the 90-day job above) and
  structured, extracted facts are persisted.
- **OAuth token deletion after disconnect**: real, confirmed in
  `MailboxConnectionService.disconnect()` — best-effort real provider-side revocation
  (`adapter.revokeAuthorization()`) followed by real local destruction
  (`encryptedRefreshToken: null`), for both user-initiated disconnect and the equivalent
  admin/system-forced path. Never merely marks a token "inactive" while leaving the ciphertext in
  place.
- **Audit retention**: `EmailSecurityAuditEvent` rows have no automatic deletion job — retained
  indefinitely by design (an audit trail that expires defeats its own purpose); this is a
  deliberate choice, not an oversight.
- **Billing records**: `BillingLedgerEntry`/`Refund`/`Subscription` rows have no deletion job —
  correct default, since financial records typically carry real legal retention requirements this
  milestone cannot determine without real legal review (Phase 19).

## Real gap found this pass: no account/candidate deletion workflow exists at all

Confirmed via direct search: no endpoint, command, or service anywhere in this codebase lets a
candidate request deletion of their account or data. For a real Closed Beta accepting real (even
if limited) users, this is a genuine, material gap — most real users reasonably expect to be able
to leave and have their data removed, and several privacy frameworks (GDPR among them, though this
document makes no legal claim about applicability) treat this as a baseline expectation.

**Deliberately not built this pass.** Building a full deletion cascade requires first answering
questions this milestone's own brief explicitly reserves for real legal review (Phase 19): which
records must be retained regardless of a deletion request (e.g. billing/invoice records, for tax-
law reasons in whichever jurisdiction applies), for how long, and whether "deletion" should mean
hard-delete or anonymization-in-place for records that must be structurally retained (e.g. an
audit trail referencing a since-deleted user's actions). Building a deletion flow now, without
that guidance, risks either (a) deleting something a real legal requirement says must be kept, or
(b) leaving real PII behind while claiming deletion succeeded — both worse than the current,
honestly-documented absence.

**Recommended real follow-up, once Phase 19's legal review answers the retention questions above:**
a candidate-initiated "request account deletion" endpoint that immediately disables the account
(matching the existing `userDisabled`/`systemSuspended` pattern already used for connected
mailboxes) and creates a real, admin-visible, auditable deletion request — with the actual data
purge/anonymization cascade implemented against the real retention rules once they exist, not
guessed at now.

## Retention jobs — monitoring status

`InboxRetentionService`'s job runs on a real schedule but currently has no dedicated success/
failure metric exposed (Phase 15/17 — "Retention job failure" is a named alert in the brief's own
catalogue; not yet instrumented, since no real metrics destination exists yet either).
