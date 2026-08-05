# 8. AI Communication Style

## The register: professional career advisor, not assistant-chatbot

Every AI-originated message in this product — recommendations, warnings, errors, suggestions, success messages, educational tips — is written in one consistent voice: a competent, calm, evidence-driven professional advisor. Not a customer-support bot, not a hype-driven growth-marketing voice, not a cutesy assistant persona. This is a direct extension of [Product Personality](01-product-personality.md)'s seven traits into concrete phrasing rules.

## The three failure modes to avoid, by name

- **Robotic**: "RECOMMENDATION_GENERATED: Action required." Terse, mechanical, exposes internal system vocabulary. A career advisor doesn't talk like a log line.
- **Overly emotional**: "We're SO excited about this opportunity for you!! 🎉" Performed enthusiasm the platform hasn't earned in that specific moment, undermines the calm/professional traits, and — critically — over-time trains the user to discount the platform's tone as noise (so when a moment genuinely warrants warmth, like an Offer, it no longer reads as special — see §13).
- **Exaggerated**: "This is your best possible match!" when `expectedImpactScore` is 0.55. Overstating certainty is a transparency violation (§4), not just a tone problem — the AI Communication Style rules and the Transparency Principles converge here, and tone must never be used to paper over a number that doesn't support the claim.

## Rules by message type

### Recommendations
Lead with the action, follow with the reasoning, always include confidence (§4, §7). Never use superlatives ("best," "perfect," "guaranteed") — use calibrated language ("strong fit," "worth considering," "a reasonable next step") that matches the actual `confidenceScore`/`expectedImpactScore` band.

### Warnings
State the specific risk and its real consequence, without alarm. "Your campaign has been paused for 6 days — resume it when you're ready to keep applications moving" is a warning; it is not "⚠️ Your campaign is stalling!!" Warnings never use red/alarm styling for something that isn't actually urgent (e.g. a user-initiated pause is not an emergency) — reserve visual/tonal alarm for genuine problems (a provider failure, a rejected transition).

### Errors
Reused directly from [Error Experience](11-error-experience.md)'s tone rules: state what happened, in plain terms, and what to do next. Never blame the user ("You entered invalid data" → "This field needs a valid email address"), never use developer vocabulary (no "500," no "null reference," no field names that don't match the visible label).

### Suggestions
Softer register than Recommendations — a suggestion is lower-stakes, often about platform usage rather than career decisions ("Adding your availability helps narrow down better-timed matches"). Always optional-sounding in phrasing, never phrased as an implicit requirement.

### Success messages
Specific and brief. "Your application to [Company] was sent." not "Success!" or "Woohoo, all done!" Confirms exactly what happened, using the real resource name/status, never a generic acknowledgment that could apply to anything.

### Educational tips
Explain a real mechanism the platform actually has ("Campaigns run within the execution window you set — outside those hours, nothing is sent" is real and true; never invent a capability to sound more sophisticated). Tips are opt-in feeling, never interrupt a task in progress (see [09-notification-strategy.md](09-notification-strategy.md) for timing rules).

## Universal phrasing rules

- **Plain language over domain jargon** — the backend's own vocabulary (`CampaignHealthRecommendationStrategy`, `ExecutionEvent`, `traceId`) never appears in user-facing copy; it's translated to what it means for the user ("we noticed your campaign's momentum has been strong" not "health score 0.82").
- **Active voice, specific subject** — "We sent your application" not "Your application has been sent" (the passive voice is acceptable when the actor genuinely doesn't matter, e.g. status confirmations, but active voice is the default because it reads as more direct and less evasive).
- **No rhetorical questions** ("Ready to take the next step?") — states things, doesn't perform enthusiasm through question marks.
- **No first-person singular** ("I found 3 matches") — per [Product Personality](01-product-personality.md), the platform is never a singular anthropomorphized "I"; use "we" (the platform/team) or a fact-first construction ("3 matches were found").
- **Numbers stated precisely, never rounded into vagueness** — "62% confidence" not "pretty confident"; "3 replies" not "a few replies."

## What "sounding like a professional career advisor" actually means in practice

A good human career advisor doesn't oversell a mediocre opportunity, doesn't panic when something goes wrong, doesn't drown you in caveats either — they state the situation, their reasoning, and a next step, calmly and specifically, and they say "I'm not sure" when they're not sure. Every rule above is that standard, applied consistently, everywhere the platform speaks.
