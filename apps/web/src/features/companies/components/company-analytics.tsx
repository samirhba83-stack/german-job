import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { StatTile } from '@/components/ui/stat-tile';
import { humanizeStatus } from '@/lib/status-mappings';
import type { PaginatedApplicationsDto } from '@/features/applications/types';

/**
 * docs/company-workspace/. Section 8, Company Analytics. Real analytics only, computed from the
 * same real, already-fetched application set the Health Center and History sections use (no
 * duplicate query). Two things this milestone's own examples ask for are deliberately not shown:
 *
 * "Response Time" and "Delivery Success rate" would require fetching every application's own
 * timeline to find historical `DELIVERED`/`COMPANY_REPLIED` transitions — `Application` status is
 * a forward-only DAG (docs/company-workspace/03-integration-points.md), so an application's
 * *current* status alone cannot say whether it passed through `DELIVERED` earlier before being
 * rejected/withdrawn later. Computing this accurately would mean N extra timeline fetches per
 * company (a real N+1 pattern this milestone's Performance Validation asks to avoid) — approximating
 * it from current status alone would silently undercount and produce a number that looks precise
 * but isn't, which is exactly the "fabricated analytics" this milestone forbids. Shown instead:
 * the real, accurate *current* stage distribution, honestly labeled as current, not historical.
 *
 * "Campaign Participation" is also omitted — the only real signal is `channel.campaignRef`, an
 * unvalidated free-text field never checked against a real campaign id server-side; presenting it
 * as verified campaign participation data would overstate what it actually is.
 */
export function CompanyAnalytics({ applications }: { applications: PaginatedApplicationsDto }) {
  const counts = new Map<ApplicationLifecycleStatus, number>();
  for (const application of applications.items) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
  }
  const nonZeroCounts = Array.from(counts.entries()).filter(([, count]) => count > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Applications sent" value={String(applications.total)} />
      </div>
      {nonZeroCounts.length > 0 && (
        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-secondary">
            Current stage distribution{applications.total > applications.items.length ? ` (of first ${applications.items.length} shown)` : ''}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {nonZeroCounts.map(([status, count]) => (
              <StatTile key={status} label={humanizeStatus(status)} value={String(count)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
