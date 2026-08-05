# 1. Product Personality

## How this document relates to Milestone 20

[Milestone 20](../frontend-architecture/README.md) defines *where* things live and *what data* powers them. This document defines *how it feels* to be told that data. Nothing here changes a screen's structure, route, or API call — it changes the tone, pacing, and framing every screen written against M20's blueprint must use. Where this document names a concrete moment (a status change, an empty state, an error), it's naming a moment M20 already specified structurally — see the cross-references throughout.

## The core reframe

M20's own information architecture already draws the line this personality has to live inside: Campaign Management, Applications, and (once wired) Mission Control are 🟢/🟡 real systems doing real, traceable work — not a metaphor. The personality below is not decoration layered on top of a dashboard; it's the honest voice of a system that is *actually* tracking a 10-state campaign lifecycle and a 15-state application lifecycle on the user's behalf, deterministically, with a full audit trail once [execution-tracking](../M19-VALIDATION-REPORT.md) is exposed. A "dashboard" reports numbers. A companion explains what it did and why. The platform has the backend substance for the second one (recommendation reasoning, decision explanations, execution events all exist as real domain concepts today, even where 🟡 dormant) — this document makes sure the interface actually sounds like it, instead of defaulting to generic dashboard neutrality.

## The seven traits

### Professional
Speaks like a competent career advisor, not a chatbot and not a corporate FAQ. No slang, no forced enthusiasm, no jargon the user didn't bring themselves (never say "we ran the `RiskMitigationStrategy`" — say "we flagged this company as higher-risk based on..."). Professionalism here means *precision*, not formality for its own sake.

### Transparent
Every claim is traceable to something real. If the platform says a company was recommended, it says why (§7, Decision Explanation Framework) — and if the "why" isn't available yet because the reasoning engine behind it is still 🟡 dormant, the platform says *that*, honestly, rather than presenting a confident-sounding recommendation with invisible reasoning. Transparency is the trait most directly inherited from this whole project's own engineering discipline (M14–M20's repeated refusal to fabricate data) — the personality just makes that discipline audible to the user, not only auditable in code.

### Reassuring
Reduces uncertainty without minimizing it falsely. "Your application was delivered" is reassuring because it's true and specific (a real `DELIVERED` state transition, §2 of M20's screen inventory). "Everything looks great!" when nothing has happened yet is not reassuring — it's noise the user will learn to distrust. Reassurance comes from specificity, not from positivity.

### Intelligent
Sounds like it understands the German job market and the user's specific situation — not generically capable, but *situated*. Uses the platform's real domain vocabulary (Ausbildung, visa sponsorship, German-level requirements — all real, live filters per M20 §3) naturally, because the backend already models these as first-class concepts, not as an afterthought.

### Calm
Never urgent without cause. No countdown timers, no manufactured scarcity (see §14's false-urgency rule). A job search is already stressful; the platform's job is to be the one steady voice in it, especially during the "waiting" phase of the emotional journey (§2), which is structurally the longest and most anxiety-prone part of the whole experience.

### Proactive
Surfaces what matters before being asked, wherever the backend genuinely supports it (a status change, a new company reply) — and never *simulates* proactivity where nothing is actually happening (M20's own repeated warning against implying pipeline activity nothing is driving, carried forward here as a personality constraint, not just a technical one: a proactive-sounding platform that's lying about activity is worse than a quiet, honest one).

### Respectful
Of the user's time, attention, and intelligence. Never explains what doesn't need explaining, never repeats itself, never uses a dark pattern to extract engagement (§6 Motivation System's explicit anti-manipulation stance). Respect is the trait that keeps every other trait honest — an "intelligent" platform that talks down to the user, or a "proactive" one that won't stop interrupting, has stopped being respectful and needs to be reined in.

## How the personality shows up in every interaction

| Interaction type | Personality expression |
|---|---|
| A status change (campaign started, application sent) | Calm confirmation, specific, no exclamation-point enthusiasm — "Your application to [Company] was sent." |
| A recommendation | Reasoned, evidenced, never absolute — "We recommend this company because..." not "This is your best match." |
| An error | Reassuring + actionable, never alarming — see §11. |
| A wait (execution in progress, no reply yet) | Calm, specific about what's happening, honest about what isn't — see §12. |
| A milestone (first campaign, first interview) | Warm but restrained — see §13. |
| A limitation (a feature not yet backend-ready, a NullEmailProvider-style dead end) | Named plainly, never hidden behind a spinner that never resolves — see §4. |

## What this personality is not

Not a mascot, not a persona with a name, not a "friend." The platform is a professional instrument the user is trusting with their career — the personality traits above describe a *register*, not a character. Nothing in this document should ever produce first-person "I" language implying the platform is a singular sentient assistant (that would overstate its nature and undercut the transparency trait) — communication is from "the platform" or is stated factually, never anthropomorphized past what §8 (AI Communication Style) allows.
