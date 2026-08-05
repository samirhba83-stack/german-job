# 7. Decision Explanation Framework

## The five questions, and where each answer comes from

Every important recommendation or decision surfaced anywhere in the product must answer all five — not as separate screens to hunt through, but as one adjacent, coherent explanation block. This document defines the template and, for each question, the exact real backend field that must answer it (continuing directly from [Trust Architecture §3](03-trust-architecture.md)'s field inventory).

| Question | Answered by | Backend field |
|---|---|---|
| **Why?** | The headline reason | `Recommendation.explanation` / `DecisionReport.explanation` |
| **Based on what?** | The evidence | `Recommendation.reasonCode` + `.expectedImpactScore`, `DecisionReport.businessJustification` + `.supportingEvidence` |
| **What alternatives were considered?** | The competing candidates | `DecisionReport.conflicts` (`ConflictGroup.candidates`) |
| **Why were they rejected?** | Per-alternative reasoning | `EvidenceEntry.selected: false` entries within `supportingEvidence`, each still carrying its own `Recommendation.explanation` |
| **What should the user do next?** | A concrete action | Derived from the recommendation's `category` (`RISK`/`TARGETING`/`STRATEGY`/`TIMING`/`BATCH_SIZING`) mapped to a real, available action in the product (M20's screen inventory) |

## The template

```
[Headline — the "why," in one plain sentence]

Based on:
[The evidence — reasonCode/businessJustification, translated to plain language]

Confidence: [confidenceScore, displayed per §4's uncertainty rules]

We also considered:
[Each rejected alternative from conflicts/supportingEvidence, one line each,
 with its own brief reason]

Next step:
[One concrete, actionable next step tied to a real screen/action]
```

## Worked example (illustrative — this exact recommendation type doesn't exist as literal copy in the backend, but every field referenced does)

> **We recommend increasing your batch size for this campaign.**
>
> Based on: your campaign's health score has been consistently high (0.82) over the last two weeks, and the current batch size is limiting how many qualified companies get reached per cycle.
>
> Confidence: High (0.78)
>
> We also considered:
> — *Adjusting your execution window instead* — rejected because your current window already covers peak company-response hours; widening it wouldn't add reach.
> — *No change* — rejected because the health signal has been stable long enough to justify a bigger step, not just a wait-and-see.
>
> **Next step**: Review your batch plan in Campaign Settings.

Every line in this example is traceable to a real field type (`CampaignHealthRecommendationStrategy`'s domain of concern, `ConflictGroup` alternatives, `expectedImpactScore`-derived confidence) — this is the discipline: even illustrative copy in this document itself follows the same rule the product must follow, precisely so nobody copies a plausible-sounding but ungrounded example into production copy by accident.

## Rules specific to this framework

1. **All five questions or none.** A partial explanation (just the headline, no alternatives) is worse than a clearly-labeled "not available yet" state, because a partial explanation implies completeness it doesn't have. If `conflicts` is empty (only one recommendation was ever produced — a real, valid case), say so plainly ("no alternative was strong enough to compete") rather than omitting the section silently.
2. **"Why were they rejected" must be specific per alternative**, not one generic dismissal applied to all of them — `supportingEvidence` provides this per-entry; use it per-entry.
3. **"Next step" is always a real, clickable path** into the product (per [M20's navigation architecture](../frontend-architecture/09-navigation-architecture.md)), never a vague suggestion with nowhere to go.
4. **Never backfill a missing explanation with generic language.** If `explanation` or `businessJustification` is ever empty or missing for any reason, that is a data-quality bug to fix upstream — the frontend must not paper over it with invented, generic-sounding reasoning ("this looks like a good opportunity") that would silently violate the whole premise of this framework.
5. **This framework applies beyond recommendations** — any place the platform makes a consequential judgment on the user's behalf (a document-selection decision — §3's `CvSelectionResult`/`CertificateSelectionResult` — or, once live, a provider-selection decision) uses the same five-question shape, adapted to that decision's own real evidence fields, not a bespoke explanation format invented per feature.

## Relationship to AI Communication Style

This framework defines *what information* must be present. [AI Communication Style](08-ai-communication-style.md) defines *how it's phrased*. A future implementer should treat this document as the content contract and the next one as the tone contract for filling it in — never merge the two into one inconsistent voice-and-structure decision made ad hoc per screen.
