# 6. Motivation System

## The line this document draws

[Progress Psychology](05-progress-psychology.md) makes real data legible as movement. Motivation System goes one step further — it actively encourages the next action — and that extra step is exactly where manipulative product mechanics usually creep in (streaks that punish missing a day, notifications engineered for compulsive checking, artificial scarcity). This document exists to get the encouragement without the manipulation. Every mechanism below is checked against one test: **does this serve the user's actual job search, or does it serve engagement-for-its-own-sake?** Anything that only serves the second is out, unconditionally.

## Mechanisms

### Profile Completeness
**What**: a real, computed measure of how much of `GET /profiles/me`'s populated fields exist (🟢, per [M20 §4](../frontend-architecture/04-dashboard-architecture.md)'s Profile Completeness widget — this document adds the motivational framing on top of that already-specified widget). **Motivational framing**: each missing section states specifically what it unlocks ("adding your German level helps us match roles that require it precisely" — a real, true mechanism, not a manufactured reward). **Anti-manipulation guard**: never a hard gate (M20 confirms the backend doesn't gate on this either); never uses loss-framing ("your profile is only 60% — you're missing out!") — always gain-framing on real capability.

### Campaign Readiness
**What**: whether a `DRAFT` campaign has everything it needs to meaningfully run — profile complete, CV present, at least one target — surfaced before the user hits Start, not after a confusing failure. **Motivational framing**: "Your campaign is ready to launch" is a genuine, earned statement once the real prerequisites are met, not a default positive nudge. **Anti-manipulation guard**: never pressures toward launching before the user is actually ready just to drive an activation metric — if something is missing, it's named plainly (§4), not soft-pedaled.

### Daily Progress
**What**: a same-day summary of real events (an application moved to `DELIVERED`, a company replied) — not a daily-login reward, and not a streak counter. **Anti-manipulation guard**: **no streak mechanic of any kind.** A job search has natural silence — weekends, waiting for replies, a paused campaign — and a system that makes the user feel bad for a "broken streak" during a legitimately quiet period is actively hostile to the emotional journey's Waiting stage (§2). If there's nothing new today, the honest daily summary is "no new activity today" (a real [empty state](10-empty-state-philosophy.md), not a guilt trip).

### Career Milestones
**What**: real, meaningful lifecycle events — first campaign launched, first application delivered, first company reply, first interview scheduled, first offer received — each backed by a real, first-time-observed status transition. **Motivational framing**: acknowledged once, warmly but professionally (§13, Delight Moments handles the exact tone). **Anti-manipulation guard**: milestones are observations of real progress, never artificial "levels" or point thresholds invented to manufacture a sense of achievement disconnected from actual outcomes.

### Achievement History
**What**: a real, chronological record the user can look back on — every campaign run, every application's outcome, every interview — sourced directly from the real timeline/history endpoints already specified in [M20 §3](../frontend-architecture/03-screen-inventory.md) (`GET /applications/:id/history`, `GET /campaigns/:id/timeline`), aggregated across all the user's campaigns/applications rather than viewed one at a time. **Motivational framing**: this is the evidence behind "you have a track record" (§2, Future Campaign stage) — proof, not a badge shelf.

### Next Recommended Action
**What**: a single, specific, real next step derived from actual state — "Your CV hasn't been uploaded yet," "3 applications are ready to send," "Your campaign has been paused for 5 days" — never a generic "keep going!" **Anti-manipulation guard**: recommends the action that's genuinely most useful to the user's outcome, never the action most useful to a platform engagement metric (e.g. never nudges toward creating a second campaign as a growth tactic if the first one hasn't been meaningfully acted on yet).

### Positive Reinforcement
**What**: specific, earned acknowledgment tied to a real outcome ("Your profile completeness helped qualify you for 3 additional roles this week" — only ever stated when a real mechanism like this actually exists and is measurable; until the Recommendation Engine is live, this specific example is aspirational and must not be shown). **Anti-manipulation guard**: reinforcement is never generic praise disconnected from a real event ("Great job!" with nothing named is empty calories and, over repeated use, reads as insincere — directly undermining the "Reassuring" and "Respectful" personality traits, §1).

## What this system explicitly refuses to do

- No streaks, no daily-login rewards, no "don't lose your progress" loss-framing.
- No artificial urgency ("only 2 spots left," "offer expires in 10 minutes") — nothing in this platform's backend produces genuine scarcity of this kind, so nothing in the UI should claim it (§14).
- No engagement-optimized notification cadence that exists to bring the user back rather than to inform them of something real (§9 draws this line precisely, per-category).
- No point/level/badge system disconnected from real career outcomes.
- No dark-pattern default (pre-checked opt-ins, hard-to-find opt-outs, confirmshaming copy like "No thanks, I don't want a better career").

## Why this restraint is itself the motivation strategy

A platform the user trusts not to manipulate them is one they keep coming back to voluntarily — which is a stronger, more durable engagement outcome than any mechanic engineered to produce compulsive return visits. This is the same logic as [Trust Architecture](03-trust-architecture.md) applied to retention specifically: the honest version of motivation is slower to show short-term engagement lift and durably better for a product whose entire premise is being trusted with someone's career.
