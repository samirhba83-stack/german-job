import { TrustFeedbackCard } from '@/components/shell/trust-feedback-card';
import type { MissionStatusDescriptor } from '@/lib/mission-status';
import type { CampaignDto } from '../types';

/**
 * docs/campaign-workspace/. Section 6, Campaign Health Center. The milestone's requested states
 * (Healthy/Warning/Critical/Waiting/Recovering/Completed) map onto real, live `CampaignStatus`
 * via `getMissionStatus()`'s existing tone system (`lib/mission-status.ts`) — tone genuinely *is*
 * a health signal, it's just derived from real lifecycle state rather than a numeric score.
 *
 * The numeric fields the milestone also asks for (a computed health/risk score with a
 * confidence value) are real DTO fields (`CampaignDto.health`) but have no production writer
 * today — every real campaign's `health` is `null` (docs/campaign-workspace/03-integration-
 * points.md). Rather than invent thresholds against a field that's always empty, this renders
 * `getMissionStatus()`'s real `confidence`/`lastUpdateTime` (which pass straight through
 * `campaign.health` when present) and says so plainly when they're not.
 *
 * `missionStatus` is computed once by `CampaignWorkspace` and passed down (Milestone 23.1) rather
 * than recomputed here, since `CampaignOverview` needs the identical descriptor.
 */
export function CampaignHealthCenter({
  campaign,
  missionStatus: descriptor,
}: {
  campaign: CampaignDto;
  missionStatus: MissionStatusDescriptor;
}) {
  return (
    <div className="space-y-2">
      <TrustFeedbackCard
        label={descriptor.label}
        tone={descriptor.tone}
        explanation={descriptor.explanation}
        recommendedAction={descriptor.recommendedAction}
        confidence={descriptor.confidence}
        lastUpdateTime={descriptor.lastUpdateTime}
      />
      {campaign.health === null && (
        <p className="text-caption text-secondary">
          Numeric health scoring isn&apos;t computed yet — the health assessment engine has no live backend surface
          today. The status above is derived from this campaign&apos;s real lifecycle stage instead of a fabricated
          score.
        </p>
      )}
    </div>
  );
}
