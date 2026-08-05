# 9. Trust Feedback

## What's real today

Every one of the milestone's example trust messages maps to a real, checkable mechanism already built:

| Example message | Real mechanism |
|---|---|
| "Campaign created successfully" | `useTrackedMutation`'s `successMessage` → real toast, fired only on a real `2xx` response ([04](04-interaction-feedback-system.md)) |
| "Execution started" | Would be a `useTrackedMutation` call on `POST /campaigns/:id/start` (🟢 live) — not built as a page action in this milestone (no Campaign Workspace exists to host the button yet), but the exact mechanism that would deliver this message already exists and is proven (used by the real Login/Register flows today) |
| "Documents validated," "Email provider selected," "Delivery confirmed," "Reply received," "Interview detected" | All map to real `ApplicationLifecycleStatus`/`ExecutionEvent` concepts — 🟡 dormant/no controller for the pipeline-internal ones (provider selection), 🟢 live for the lifecycle ones (reply, interview) — same tiering as [03-execution-feedback.md](03-execution-feedback.md) |

## The implemented trust mechanism: real error messages, not generic ones

The most concrete trust-feedback work this milestone did was fixing `lib/api-client.ts`'s error extraction after discovering (via live testing, not assumption) that real backend errors nest their message inside `{ message: { message, error, statusCode } }`. Before that fix, every error toast in the app would have shown "Something went wrong" even when the backend had a specific, useful message like "email must be an email" — a direct, measured instance of the trust erosion [Product Experience's Trust Architecture](../product-experience/03-trust-architecture.md) warns about ("a confidence claim stronger than the underlying score supports" — here, a message vaguer than the real one available). Fixing it is this milestone's clearest single act of trust feedback, more concrete than any new component.

## What "every message must explain what happened" means in the code that exists today

`ApiError.message` is always the real backend message (unwrapped correctly now), never a client-invented paraphrase. `useTrackedMutation`'s failure toast title is always `"${activityLabel} failed"` — naming the specific action, not a generic "Error." This is the trust-feedback discipline applied consistently, everywhere a real failure can occur in the code built so far.

## `TrustFeedbackCard` (Milestone 22.2)

`components/shell/trust-feedback-card.tsx` is a real, reusable, persistent surface (as opposed to a Toast's transient one) for "what's happening, and what it's based on." It's deliberately shaped to accept `lib/mission-status.ts`'s `MissionStatusDescriptor` directly — `label`/`tone`/`explanation`/`recommendedAction`/`confidence`/`lastUpdateTime` all line up — so the Mission Status Layer ([05](05-mission-status.md)) and the Trust Feedback Layer render from one real data shape instead of two parallel ones that could drift apart. `confidence` renders only when the caller passes a real number (never estimated by the component itself); `lastUpdateTime` renders only when the caller has a real timestamp. Not yet instantiated by any real page in this milestone — no Campaign Workspace exists yet to host it — but ready the moment one does, the same "additive, not a redesign" pattern as [03](03-execution-feedback.md)'s `ExecutionStageList`.
