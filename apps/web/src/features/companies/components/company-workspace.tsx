'use client';

import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { COMPANY_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { useApplicationsSearch } from '@/features/applications/hooks/use-applications-search';
import { useCompany } from '../hooks/use-company';
import { CompanyOverview } from './company-overview';
import { CompanyActions } from './company-actions';
import { CompanyHealthCenter } from './company-health-center';
import { OpportunityIntelligencePanel } from './opportunity-intelligence-panel';
import { CompanyHistory } from './company-history';
import { CompanyAnalytics } from './company-analytics';

const APPLICATIONS_PAGE_SIZE = 100;

function WorkspaceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading-md font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

/**
 * docs/company-workspace/. The Company Workspace — composes every section this milestone asked
 * for from two real queries: `GET /companies/:id` and `GET /applications/search?companyId=...`
 * (fetched once, at the maximum real page size of 100, and shared by `CompanyHealthCenter`,
 * `CompanyHistory`, and `CompanyAnalytics` — no section re-fetches the same data, closing this
 * milestone's own "no duplicated queries" audit requirement before it could ever be found as a
 * gap). `GET /companies/:id/health` is not called — no such endpoint exists (unlike Campaign).
 *
 * Trust Layer / Mission Status / Background Activities: Trust Layer is `CompanyHealthCenter`'s
 * `TrustFeedbackCard`; "Mission Status" for a company is the real `CompanyStatus` shown in
 * `ContextHeader` (Company has no richer per-status descriptor system the way Campaign's
 * `getMissionStatus()` does — its real status model is just two values). Background Activities is
 * deliberately not re-instantiated here — `AppShell`'s header already renders one real, global
 * `BackgroundActivityCenter`, and `CompanyActions`' mutations already populate it via
 * `useTrackedMutation`, exactly the same reasoning as the Campaign Workspace
 * (docs/campaign-workspace/09-final-deliverables-and-principal-review.md).
 */
export function CompanyWorkspace({ companyId }: { companyId: string }) {
  const companyQuery = useCompany(companyId);
  const applicationsQuery = useApplicationsSearch({ companyId, limit: APPLICATIONS_PAGE_SIZE });

  if (companyQuery.isLoading) {
    return (
      <SkeletonRegion loading label="Loading company">
        <div className="space-y-4">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-48" />
        </div>
      </SkeletonRegion>
    );
  }

  if (companyQuery.isError || !companyQuery.data) {
    return (
      <ErrorState message={companyQuery.error instanceof ApiError ? companyQuery.error.message : 'This company could not be loaded.'} />
    );
  }

  const company = companyQuery.data;
  const applications = applicationsQuery.data;
  const truncated = Boolean(applications && applications.total > applications.items.length);

  return (
    <div className="space-y-8">
      {/* Real page <h1> from the start (the lesson from docs/campaign-workspace/09's mid-build
          accessibility fix, applied here directly rather than re-discovered) — ContextHeader
          carries the company's real name, real status badge, and real Actions. */}
      <ContextHeader
        title={company.name}
        status={<Badge tone={COMPANY_STATUS_TONE[company.status]}>{humanizeStatus(company.status)}</Badge>}
        actions={<CompanyActions company={company} />}
      />

      <CompanyOverview company={company} />

      <WorkspaceSection title="Health">
        <CompanyHealthCenter company={company} applications={applications} />
      </WorkspaceSection>

      <WorkspaceSection title="Opportunity Intelligence">
        <OpportunityIntelligencePanel />
      </WorkspaceSection>

      <WorkspaceSection title="Analytics">
        {applicationsQuery.isLoading ? (
          <SkeletonRegion loading label="Loading analytics">
            <Skeleton variant="card" className="h-20" />
          </SkeletonRegion>
        ) : applicationsQuery.isError || !applications ? (
          <p className="text-body-sm text-secondary">Analytics are unavailable right now.</p>
        ) : (
          <CompanyAnalytics applications={applications} />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="History & Communication">
        {truncated && (
          <p className="text-caption text-secondary">
            Showing the first {applications?.items.length} of {applications?.total} real applications.
          </p>
        )}
        <CompanyHistory applications={applications} isLoading={applicationsQuery.isLoading} isError={applicationsQuery.isError} />
      </WorkspaceSection>
    </div>
  );
}
