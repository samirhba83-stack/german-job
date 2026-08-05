import { Card } from '@/components/ui/card';
import { DefinitionField } from '@/components/ui/definition-field';
import { humanizeStatus } from '@/lib/status-mappings';
import { formatDate, formatDateTime } from '@/lib/format-date';
import type { MissionStatusDescriptor } from '@/lib/mission-status';
import type { CampaignDto } from '../types';

interface CampaignOverviewProps {
  campaign: CampaignDto;
  /** Computed once by `CampaignWorkspace` and passed down — `CampaignHealthCenter` needs the
   * exact same descriptor, and computing it independently in each component was real, needless
   * duplicated work (Milestone 23.1's "no duplicated transformations" pass) despite being a cheap
   * pure function; passing it down means the two panels are also guaranteed to agree with each
   * other, since they read the one real computed value rather than two separate calls that could
   * (in principle, if the function ever grew a non-deterministic input) disagree. */
  missionStatus: MissionStatusDescriptor;
  /** Real `GET /profiles/me`'s `completionPercentage` (0-100) — a genuinely computed 10-section
   * boolean completeness score, not a fabricated readiness signal. `null` while it's still
   * loading or if the caller has no profile context. */
  profileCompleteness: number | null;
}

/**
 * docs/campaign-workspace/. Section 1, Campaign Overview — every field here is a real,
 * directly-read `CampaignDto`/profile field. "Execution Health," "Campaign Confidence," and
 * "Current Recommendation" (also requested by this section) are deliberately not duplicated into
 * this card — they get their own dedicated panels (`CampaignHealthCenter`,
 * `SmartRecommendationPanel`) so a null/reserved value doesn't sit awkwardly inside an otherwise
 * fully-populated summary card. The campaign's name/status/objective and its lifecycle actions
 * live in `ContextHeader` (`CampaignWorkspace`'s own top-level element, the page's real `<h1>`) —
 * this card is only the supporting-fields grid underneath it.
 */
export function CampaignOverview({ campaign, missionStatus, profileCompleteness }: CampaignOverviewProps) {
  return (
    <Card padding="lg" className="space-y-4">
      <p className="text-body-sm text-secondary">
        Objective: {humanizeStatus(campaign.goal.desiredOutcome)} · Target {campaign.goal.targetApplicationCount} applications
      </p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DefinitionField label="Current Stage" value={missionStatus.label} />
        <DefinitionField label="Created" value={formatDate(campaign.createdAt)} />
        <DefinitionField label="Last Activity" value={formatDateTime(campaign.updatedAt)} />
        <DefinitionField label="Targets" value={String(campaign.targetsCount)} />
        <DefinitionField label="Batches" value={String(campaign.batchesCount)} />
        <DefinitionField
          label="Profile Readiness"
          value={profileCompleteness !== null ? `${profileCompleteness}% complete` : 'Unknown'}
        />
      </dl>
    </Card>
  );
}
