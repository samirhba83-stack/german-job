# 11. Error Experience

## The one rule everything else follows

The user should never feel abandoned after an error — every error state ends with the user knowing what happened and what they can do about it, even when "what they can do" is just "wait and try again." An error screen or message that dead-ends with no path forward is the failure mode this entire document exists to prevent.

## Grounded in the real error contract

Every error the frontend will ever see comes from the same normalized shape ([M20 §6](../frontend-architecture/06-api-consumption-architecture.md)): `{ statusCode, timestamp, path, message }`, where `message` is a string (a domain/business rejection) or a string array (per-field validation failures from the global `ValidationPipe`). This document's categories map directly onto what that contract can actually distinguish — the experience can only be as honest as the information available, and the information available is exactly this shape, nothing richer (per [M19's confirmation](../M19-VALIDATION-REPORT.md) that `AllExceptionsFilter` masks all non-`HttpException` errors to a generic message).

## Error categories and their experience

### Validation errors
**Source**: `message: string[]` from `class-validator`. **Experience**: field-level, inline, at the point of entry — never a top-of-page summary list disconnected from the fields themselves. Tone: instructive, not scolding ("Email must be a valid address" not "Invalid input"). **Recovery**: immediate — the user fixes the field and resubmits; no waiting, no retry mechanism needed since this is a client-fixable state.

### Permission errors
**Source**: a 403-equivalent from a `RolesGuard` rejection, or the frontend's own pre-emptive `can()` check ([M20 §8](../frontend-architecture/08-permission-matrix.md)) preventing the request entirely. **Experience**: state plainly what's required ("This action requires [role]") — never implies the user did something wrong, since they didn't; this is a permissions fact, not a mistake. **Recovery**: usually none available to the user directly (a role is what it is) — the message should not suggest a retry that won't work; it should redirect to what *is* available.

### Provider unavailable
**Source**: the real, current, deterministic state of `NullEmailProvider` (M19-confirmed: always reports itself unavailable until a real provider is registered) — surfaced through an application's `EMAIL_DELIVERY_FAILED`-derived failure reason. **Experience**: this is a **known, standing** condition, not a transient blip, and the copy must reflect that distinction honestly rather than implying "try again in a minute" for something that won't resolve on retry. Something closer to: "Delivery isn't available for this application right now — this is a platform-side limitation, not something on your end." **Recovery**: none available client-side today; do not offer a retry button that will deterministically fail again — offering a retry the platform already knows will fail is a small but real trust violation (§3).

### Temporary failures (real 5xx, masked to generic per the backend's own error-masking)
**Source**: an unmasked `HttpException` reaching the frontend as a generic "Internal server error." **Experience**: honest generality — "Something went wrong on our end" is *accurate* here (the frontend genuinely doesn't have more information, per the grounding note above), unlike a validation error where specificity is available and required. **Recovery**: offer a retry (this class of failure often is transient), but never promise investigation or a fix timeline the platform has no actual visibility into — do not say "we've been notified" unless a real reporting mechanism exists (none does today, per [M19's observability finding](../M19-VALIDATION-REPORT.md) that unhandled exceptions aren't even logged server-side yet — a claim of "we're on it" would be false).

### Network failures
**Source**: the request never reached the API at all (offline, DNS, timeout). **Experience**: distinguishable from a real API error — "Can't connect right now — check your connection" is a different message from "the server had a problem," and conflating them (a common shortcut) removes exactly the information that would tell the user whether retrying is likely to help. **Recovery**: automatic retry with backoff for reads ([M20 §6](../frontend-architecture/06-api-consumption-architecture.md)'s retry policy), manual retry surfaced for writes.

## Retry opportunities and recovery suggestions, by category

| Category | Auto-retry? | Manual retry offered? | Recovery suggestion |
|---|---|---|---|
| Validation | No (not applicable) | N/A — user edits and resubmits | Fix the named field |
| Permission | No | No | Navigate to something accessible |
| Provider unavailable | No | **No** — would fail again deterministically | None client-side; named as a platform limitation |
| Temporary/5xx | No (writes never auto-retry, per M20 ADR-007) | Yes | Try again; if it recurs, this is worth surfacing distinctly (see below) |
| Network | Yes (reads only) | Yes | Check connection |

**A repeated failure across retries deserves different copy than a first failure** — if the same action has now failed twice, the third attempt's error state should acknowledge that ("This hasn't gone through a couple of times — feel free to try again in a bit") rather than repeating identical, context-blind copy, which is where "abandoned" feelings compound fastest.

## Tone (cross-reference to §8)

Every error uses [AI Communication Style](08-ai-communication-style.md)'s Error rules: what happened, plainly, and what to do next — never blame, never developer vocabulary, never false reassurance about a fix that isn't actually guaranteed.
