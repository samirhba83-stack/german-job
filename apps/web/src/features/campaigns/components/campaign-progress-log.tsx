import { humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import type { CampaignTimelineEntryDto } from '../types';

/**
 * docs/campaign-workspace/. Section 3, Campaign Progress. The milestone's own example events
 * (Companies Selected, CV Generated, Motivation Letter Generated, Email Prepared, ...) are
 * pipeline-internal steps with zero HTTP exposure today (`recommendations`/`application-
 * assembly`/`execution-tracking` all have no controller — docs/campaign-workspace/
 * 03-integration-points.md). What's real and live is the campaign's actual transition ledger
 * (`GET /campaigns/:id/timeline`) — a chronological log of every real status change, each entry
 * carrying exactly the fields this section asks for: Execution ID (`correlationId`), Timestamp,
 * Status, Evidence, Explanation. This renders that real ledger rather than fabricating the
 * granular pipeline steps no endpoint can back.
 */
export function CampaignProgressLog({ timeline }: { timeline: CampaignTimelineEntryDto[] }) {
  if (timeline.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
        No recorded transitions yet.
      </p>
    );
  }

  const sorted = [...timeline].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <ol className="space-y-3">
      {sorted.map((entry) => {
        const explanation = entry.aiExplanation ?? entry.reason?.note ?? null;
        return (
          <li key={entry.id} className="rounded-md border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body-sm font-medium text-primary">{humanizeStatus(entry.currentState)}</span>
              <time dateTime={entry.timestamp} className="text-caption text-secondary">
                {formatDateTime(entry.timestamp)}
              </time>
            </div>
            <p className="mt-1 text-caption text-secondary">
              Execution ID: <span className="font-mono">{entry.correlationId}</span>
            </p>
            {explanation && <p className="mt-1 text-body-sm text-secondary">{explanation}</p>}
            {entry.evidenceReference && (
              <p className="mt-1 text-caption text-secondary">
                Evidence:{' '}
                {entry.evidenceReference.url ? (
                  <a
                    href={entry.evidenceReference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-accent"
                  >
                    {entry.evidenceReference.type}
                  </a>
                ) : (
                  entry.evidenceReference.type
                )}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
