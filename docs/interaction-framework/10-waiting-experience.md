# 10. Human Waiting Experience

## The two kinds of "waiting" this codebase now distinguishes, concretely

**Seconds-scale waiting** (a page loading, a mutation in flight) — `Skeleton` and `Button`'s `loading` state ([04](04-interaction-feedback-system.md)). These are genuinely brief, so the treatment is intentionally quiet: shape, not narration.

**Days-scale waiting** (a company hasn't replied yet) — this is [Product Experience's Progress Psychology](../product-experience/05-progress-psychology.md) territory, not a spinner problem at all; no loading indicator makes sense for a wait measured in days. Nothing in this milestone builds that funnel UI (it requires the real, aggregated Application data a future Applications workspace page would fetch) — but the `ExecutionStageList`/`toSendExecutionStages()` pair built in [03](03-execution-feedback.md) is the real, working piece of infrastructure that funnel will render its "delivered, awaiting reply" state through, once that page exists.

## "Meaningful" status messages — what's implemented vs. what the milestone's examples ask for

The milestone's examples ("Analyzing 24 eligible companies...", "Generating company-specific motivation letter...") are, per [03](03-execution-feedback.md)'s finding, examples of the dormant pipeline stages with no real count or event behind them today. What this milestone implements instead, honestly: every real loading state in the shell has a specific, real label — the Background Activity Center shows `"Updating profile"`, `"Logging in"`, never a bare spinner with no text (`useTrackedMutation`'s `activityLabel` is a required parameter, not optional, precisely so this can't be skipped).

## Never display fake progress — checked against the actual code

No component built in this milestone uses an indeterminate spinner where a real percentage exists, and no component fabricates a percentage where none exists. `Progress`/`Progress Bar` (specified in [M20 §5](../frontend-architecture/05-component-architecture.md), [M21 §7](../design-system/07-component-library.md)) is not instantiated anywhere in this milestone's shell — there is no real progress-bar-shaped data (a goal-progress value, a file-upload byte count) flowing through any screen built so far, and building the component without real data to feed it would risk exactly the fake-progress pattern this whole milestone repeatedly forbids. It will be wired the moment a real page (Campaign Workspace's goal progress, a real file upload) has real numbers for it.
