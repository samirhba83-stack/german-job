import { registerAs } from '@nestjs/config';

/**
 * M31 Phase 26 — the two Production Safety Flags the milestone brief names explicitly that had no
 * home anywhere in the codebase before this phase (`01-production-readiness-audit.md` §"Secret
 * Management" flagged this as a real gap). Both default to the safe/restrictive state, matching
 * every other real-external-side-effect flag in this codebase since M27
 * (`EMAIL_PRODUCTION_SENDING_ENABLED`, `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED`,
 * `BILLING_PRODUCTION_PAYMENTS_ENABLED`) — fail closed, never opt-in by omission.
 *
 * `realCompanyOutreachEnabled` — the explicit, named gate for this milestone's own single most
 * important non-negotiable business rule: no application ever reaches a real German company
 * without separate Product Owner approval. It is deliberately checked ADDITIONALLY to (not
 * instead of) `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` — see
 * `connected-mailbox-readiness.service.ts`'s own doc comment for where and why. Two independent
 * flags that must both be true is a stronger fail-closed posture than one: an operator who
 * mistakenly flips the general mailbox-sending flag on for an unrelated reason (e.g., testing a
 * fix against a real connected mailbox but sending only to pre-approved test recipients) does not
 * also silently arm real company outreach.
 *
 * `productionWebhookProcessingEnabled` — gates the 3 inbound webhook surfaces whose real-world
 * certification (Phase 9/10/11: Google Pub/Sub, Microsoft Graph, email-provider delivery
 * webhooks) is prepared but not yet executed against a real provider. Deliberately does NOT cover
 * the Paddle billing webhook (`WebhookProcessingService`) — that surface already has its own
 * dedicated, independently M27-certified safety gate (`BILLING_PRODUCTION_PAYMENTS_ENABLED`);
 * adding a second, overlapping flag to an already-shipped, already-certified capability would add
 * risk without a meaningful safety improvement. When this flag is `false`, each covered webhook
 * still authenticates the caller and still ACKs with the response code the provider expects (so
 * the provider never retry-storms or disables the subscription) — it just skips the state-
 * mutating side effect, matching the "acknowledge but do not act" pattern this milestone's fail-
 * closed principle requires.
 */
/** M31.1 Phase 17 — parses `TEST_RECIPIENT_ALLOWLIST` (comma-separated) into exact addresses and
 * `@domain` wildcard entries. Empty by default (fail closed — an empty allowlist approves
 * nothing, it never falls back to "allow everyone"). */
function parseTestRecipientAllowlist(): ReadonlyArray<string> {
  const raw = process.env.TEST_RECIPIENT_ALLOWLIST ?? '';
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export default registerAs('productionSafety', () => ({
  realCompanyOutreachEnabled: (process.env.REAL_COMPANY_OUTREACH_ENABLED ?? 'false').toLowerCase() === 'true',
  productionWebhookProcessingEnabled: (process.env.PRODUCTION_WEBHOOK_PROCESSING_ENABLED ?? 'false').toLowerCase() === 'true',
  // M31.1 Phase 17 — the real, additional safety net doc 21's own Stage 1 ("real connected
  // mailboxes, test recipients only, REAL_COMPANY_OUTREACH_ENABLED stays false") depends on: a
  // send to an address on this allowlist is permitted even while realCompanyOutreachEnabled is
  // false (that's the whole point — a real dry run against known-safe test addresses); a send to
  // anything NOT on this allowlist still requires realCompanyOutreachEnabled=true regardless.
  // Entries are either an exact address ("test@example.com") or a "@domain.com" wildcard covering
  // every address at that domain (useful for a dedicated test-recipient domain).
  testRecipientAllowlist: parseTestRecipientAllowlist(),
}));
