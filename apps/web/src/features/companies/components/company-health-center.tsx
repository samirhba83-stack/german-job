import { TrustFeedbackCard } from '@/components/shell/trust-feedback-card';
import type { BadgeTone } from '@/components/ui/badge';
import { CompanyStatus } from '../types';
import type { CompanyDto } from '../types';
import type { PaginatedApplicationsDto } from '@/features/applications/types';

interface CompanyHealthCenterProps {
  company: CompanyDto;
  /** The same real, already-fetched application set `CompanyAnalytics`/`CompanyHistory` use
   * (`useApplicationsSearch({companyId})`, fetched once by `CompanyWorkspace`) — passed down
   * rather than re-fetched, so this panel never issues its own duplicate query
   * (docs/company-workspace/03-integration-points.md's "no duplicated queries" audit). */
  applications: PaginatedApplicationsDto | undefined;
}

/**
 * docs/company-workspace/. Company Health. The milestone's requested states (Healthy/Waiting/
 * Attention Required/Inactive/Completed/Archived) assume a richer status model than the real
 * backend has: `CompanyStatus` is a 2-value enum (`ACTIVE`/`ARCHIVED` — verified in
 * 03-integration-points.md), and there is no company-level health-assessment concept or endpoint
 * anywhere in the backend at all (unlike Campaign, which at least has a real, if unpopulated,
 * `health` DTO field). Rather than invent a 6-state classification from a staleness threshold this
 * frontend has no authority to define (a real business-rule decision, not an implementation
 * detail), this shows the real `CompanyStatus` with real supporting evidence (how many real
 * applications exist, when the most recent one was last active) — giving the user the real
 * evidence to judge engagement themselves, rather than a fabricated verdict pretending to have
 * decided it for them. "Every score must explain itself" is honored here by explaining that there
 * is no score, not by manufacturing one.
 */
export function CompanyHealthCenter({ company, applications }: CompanyHealthCenterProps) {
  if (company.status === CompanyStatus.ARCHIVED) {
    return (
      <TrustFeedbackCard
        label="Archived"
        tone="neutral"
        explanation="This company has been archived and is no longer active on the platform."
        lastUpdateTime={company.updatedAt}
      />
    );
  }

  const total = applications?.total ?? null;
  const mostRecentActivity =
    applications && applications.items.length > 0
      ? applications.items.reduce<string | null>((latest, application) => {
          if (!latest) return application.lastActivityAt;
          return new Date(application.lastActivityAt) > new Date(latest) ? application.lastActivityAt : latest;
        }, null)
      : null;

  let label: string;
  let tone: BadgeTone;
  let explanation: string;

  if (total === null) {
    label = 'Loading';
    tone = 'neutral';
    explanation = 'Checking real application activity for this company…';
  } else if (total === 0) {
    label = 'No engagement yet';
    tone = 'neutral';
    explanation = 'No applications have been sent to this company yet.';
  } else {
    label = 'Active engagement';
    tone = 'positive';
    explanation = `${total} real application${total === 1 ? '' : 's'} on record for this company.`;
  }

  return (
    <div className="space-y-2">
      <TrustFeedbackCard label={label} tone={tone} explanation={explanation} lastUpdateTime={mostRecentActivity ?? company.updatedAt} />
      <p className="text-caption text-secondary">
        This reflects real application activity, not a computed health score — no health-assessment engine exists
        for companies today.
      </p>
    </div>
  );
}
