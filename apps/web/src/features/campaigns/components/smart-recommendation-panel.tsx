import type { CampaignDto } from '../types';

/**
 * docs/campaign-workspace/. Section 5, Smart Recommendation Panel. `CampaignDto.intelligence` is
 * a real DTO field (`recommendationExplanation`), but no production code path ever calls
 * `Campaign.recordIntelligenceAssessment()` — every real campaign's `intelligence` is `null`
 * today (docs/campaign-workspace/03-integration-points.md). The milestone's own example
 * recommendations ("Improve German level," "Upload missing certificate," ...) would require that
 * reserved engine; inventing plausible-sounding ones instead would be exactly the fabrication
 * this whole project's discipline forbids. This renders the real explanation the moment one
 * exists, and an honest, explicit "not yet" state until then — never a guess standing in for it.
 */
export function SmartRecommendationPanel({ campaign }: { campaign: CampaignDto }) {
  const explanation = campaign.intelligence?.recommendationExplanation ?? null;

  if (explanation) {
    return <div className="rounded-md border border-border bg-surface p-4 text-body-sm text-primary">{explanation}</div>;
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
      No recommendations yet — the recommendation engine has no live backend surface today. This panel will show
      real, evidence-backed suggestions the moment that engine is wired in; nothing here is invented in the
      meantime.
    </div>
  );
}
