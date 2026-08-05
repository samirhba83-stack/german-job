# 10. Empty State Philosophy

## The principle

An empty screen is not a lack of content — it's a specific piece of information (nothing exists here yet, for this specific reason) that deserves the same care as a populated one. [M20's screen inventory](../frontend-architecture/03-screen-inventory.md) already establishes that empty states must be distinguished by *cause* (zero-state vs. filtered-to-zero vs. legitimately-null field) — this document adds the *why it matters* layer and a consistent three-part template on top of that structural rule.

## The template

Every empty state answers three things, in this order:

1. **Why** — the specific, honest reason this is empty right now.
2. **What to do next** — one concrete, real action (never "explore the app" vagueness).
3. **Why it matters** — the payoff of taking that action, tied to a real outcome.

## Applied to the milestone's named examples

### No campaigns
- **Why**: "You haven't created a campaign yet." (First-run zero-state — distinct from a filtered list returning zero per M20's own distinction.)
- **What to do next**: "Create your first campaign" — direct action, opens Campaign Create (M20 §3).
- **Why it matters**: "A campaign is what lets us start finding and applying to companies on your behalf." Names the real mechanism, doesn't oversell it — a campaign in `DRAFT` doesn't do anything yet either (M20's own honesty about the pipeline), so this copy stays scoped to what creating one actually enables.

### No interviews
- **Why**: "No interviews scheduled yet." Context-sensitive: if there are active applications in earlier stages, add "your applications are still working through the process" (a true, real statement of `ApplicationLifecycleStatus` distribution — never implied if it isn't true, e.g. don't say this if there are actually zero active applications either).
- **What to do next**: if no applications exist yet, point to campaign/application creation; if applications exist but no interview yet, there's no manufactured action to suggest — say so ("nothing to do here right now — this will update automatically when a company schedules one").
- **Why it matters**: "Interviews are the clearest signal a campaign is working — we'll let you know the moment one's scheduled." (Ties forward to §9's Interview notification category, once real.)

### No applications
- **Why**: distinguishes "you haven't sent any yet" from "your campaign hasn't produced any yet" (§5's funnel — a real difference the copy should reflect if the data supports knowing which case it is).
- **What to do next**: campaign creation/activation, or (once live) reviewing pending recommendations.
- **Why it matters**: "Every application is a real, tracked attempt — you'll see its full status from draft through any reply."

### No notifications
- **Why**: honestly, today, this is **always** true — no notification backend exists (§9). Copy must not pretend this is a normal "you're all caught up" empty state; it should read the same whether the user has zero real activity or the platform simply can't notify them yet. Given the honesty discipline this whole document set follows, the safest, truest copy is close to: "Notifications aren't available yet — check back here as this feature becomes available." This is the one empty state in this list that is not really "nothing has happened" but "this isn't built yet," and it must not be disguised as the former.
- **What to do next**: none to fabricate — redirect attention to what *is* live (Dashboard, Campaigns).
- **Why it matters**: skip this beat rather than invent a reason for something not yet real.

### No CV
- **Why**: "No CV uploaded yet." Plain, no judgment.
- **What to do next**: "Upload your CV" — direct link to CV Management (M20 §3).
- **Why it matters**: "Your CV is what campaigns use to apply on your behalf — without one, applications can't be prepared." Concrete mechanism, not vague encouragement — and matches M20's own noted rule that campaign creation isn't backend-blocked by this today, so the copy shouldn't overstate urgency either (calm, per §1, not alarmed).

## Rules that generalize beyond these five examples

- **Never reuse one generic empty-state component's copy across different causes.** The structural empty/loading/error distinction is [M20](../frontend-architecture/03-screen-inventory.md)'s job; writing distinct, cause-specific copy for each is this document's job — the two must stay paired per screen, never defaulted to a shared "No data" string.
- **An empty state is not a failure state.** Visually and tonally distinct from [Error Experience](11-error-experience.md) — calm, informative, forward-looking, never using error-red or alarm iconography.
- **Where the empty state has no real next action, say so rather than inventing one** (the "No interviews, nothing to do yet" and "No notifications, not built yet" cases above are the clearest examples) — a fabricated call-to-action in a genuinely idle empty state is a small but real instance of the same dishonesty this whole document set exists to prevent elsewhere.
