# Reply Rule Catalogue

Source of truth: `apps/api/src/modules/inbox-intelligence/domain/services/reply-rule-engine.ts`.
Rules are checked in this exact order; the **first** match wins — never a weighted vote. A message
whose provider marks it as a delivery failure or auto-reply is resolved before any text rule runs
at all, from the provider's own header signal, never inferred from body text alone.

## Header-driven terminal cases (checked before any text rule)

| Order | Condition | Category | Confidence |
|---|---|---|---|
| 1 | `isDeliveryFailure` (provider header) | `DELIVERY_FAILURE` | 0.98 |
| 2 | `isAutoReply && !isOutOfOffice` (provider header) | `AUTOMATIC_REPLY` | 0.90 |
| 3 | `isOutOfOffice` (provider header + OOO body language) | `OUT_OF_OFFICE` | 0.90 |

## Text-pattern rules (in priority order)

| Rule ID | Category | Confidence | Language | Intent |
|---|---|---|---|---|
| `RULE_DELIVERY_FAILURE_TEXT` | DELIVERY_FAILURE | 0.95 | EN/DE | Delivery-failure language without the header flag set |
| `RULE_OUT_OF_OFFICE_TEXT` | OUT_OF_OFFICE | 0.85 | EN/DE | OOO language without the header flag set |
| `RULE_OFFER_EN` / `RULE_OFFER_DE` | ACCEPTANCE_OR_OFFER | 0.80 | EN/DE | "pleased to offer" / "wir freuen uns...anzubieten" |
| `RULE_REJECTION_EN` / `RULE_REJECTION_DE` | REJECTION | 0.80 | EN/DE | "unfortunately...not moving forward" / "leider...entschieden" |
| `RULE_INTERVIEW_EN` / `RULE_INTERVIEW_DE` | INTERVIEW_INVITATION | 0.80 | EN/DE | "invite you to an interview" / "zum Vorstellungsgespräch einladen" |
| `RULE_CALENDAR_INVITE` | INTERVIEW_INVITATION | 0.75 | — | A real calendar invite is attached, regardless of body text |
| `RULE_ASSESSMENT` | ASSESSMENT_OR_TEST_INVITATION | 0.75 | EN/DE | "online test" / "coding challenge" / "assessment center" |
| `RULE_DOCUMENT_REQUEST_EN` / `_DE` | DOCUMENT_REQUEST | 0.70 | EN/DE | "please send/provide" / "bitte senden Sie uns" |
| `RULE_AVAILABILITY_REQUEST` | AVAILABILITY_REQUEST | 0.70 | EN/DE | "when would you be available" |
| `RULE_WITHDRAWAL` | WITHDRAWAL_CONFIRMATION | 0.75 | EN/DE | "confirming your withdrawal" |
| `RULE_REFERRAL` | REFERRAL_TO_OTHER_POSITION | 0.65 | EN | "a different role might be a better fit" |
| `RULE_WAITLIST` | WAITLIST_OR_DELAY | 0.65 | EN/DE | "take a bit longer" / "etwas länger dauern" |
| `RULE_UNDER_REVIEW` | APPLICATION_UNDER_REVIEW | 0.60 | EN/DE | "currently under review" / "wird derzeit geprüft" |
| `RULE_APPLICATION_RECEIVED` | APPLICATION_RECEIVED_CONFIRMATION | 0.70 | EN/DE | "we have received your application" |
| `RULE_SPAM_MARKER` | SPAM_OR_UNRELATED | 0.70 | EN | "click here to claim", "limited time offer" |

No match, real content present → `NEEDS_MANUAL_REVIEW`, confidence 0 (never `UNKNOWN` — that value is
reserved for a future AI adapter that could plausibly resolve it; with AI disabled this milestone,
`NEEDS_MANUAL_REVIEW` is the honest terminal state).

## Structured fact extraction (independent of category)

Runs on every classified message: contact email/phone (regex), a video-meeting link
(zoom/teams/meet/webex), and a deadline-phrase extractor (`by`/`before`/`until`/`bis`/`Frist`/
`deadline` followed by a date-like blob). A `DD.MM.YYYY` or `YYYY-MM-DD` date normalizes cleanly;
anything else is preserved as the original text with `isAmbiguous: true` and never silently
resolved to a guess (Phase 13 — German timezone is never assumed).

**Fixed during this milestone's own unit-test pass** (both were real, live bugs, not
hypothetical): the deadline-phrase regex used a lazy quantifier that truncated `15.03.2026` down
to `15.03`, incorrectly reporting an unambiguous date as ambiguous; the German quote-boundary
pattern (`content-normalizer.ts`) required 0–3 characters between "schrieb" and the colon, which
never matches the real-world `schrieb "Jane Doe" <jane@example.com>:` format every actual German
mail client produces — both fixed, see `reply-rule-engine.spec.ts` and `content-normalizer.spec.ts`
for the regression tests.

## Secondary labels

`POSITIVE`, `NEGATIVE`, `NEUTRAL`, `ACTION_REQUIRED`, `DEADLINE_PRESENT`, `INTERVIEW_DATE_PRESENT`,
`DOCUMENTS_REQUIRED`, `HUMAN_REPLY`, `AUTOMATED_REPLY` — compose freely with a primary category
(e.g. a REJECTION can carry `DEADLINE_PRESENT` for a reapplication window); never collapsed into a
single enum value.
