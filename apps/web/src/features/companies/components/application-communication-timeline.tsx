'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { useApplicationTimeline } from '@/features/applications/hooks/use-application-timeline';

/**
 * docs/company-workspace/. Section 5, Communication Timeline — the real per-event ledger for one
 * real application (`GET /applications/:id/timeline`), lazily fetched only once its parent
 * `CompanyHistory` row is actually expanded (`enabled`). Every field the milestone asks for
 * (Email Sent, Delivery Confirmation, Reply, Interview) maps to a real
 * `ApplicationLifecycleStatus` transition here; "Manual Notes" and "Future Follow-up" (also in the
 * milestone's example list) are not shown — no note-taking or follow-up-scheduling capability
 * exists anywhere in the backend, so there is nothing real to render for them.
 */
export function ApplicationCommunicationTimeline({ applicationId, enabled }: { applicationId: string; enabled: boolean }) {
  const { data, isLoading, isError } = useApplicationTimeline(applicationId, { enabled });

  if (!enabled) return null;

  if (isLoading) {
    return <Skeleton variant="card" className="h-16" />;
  }

  if (isError) {
    return <p className="text-caption text-secondary">This application&apos;s timeline is unavailable right now.</p>;
  }

  if (!data || data.length === 0) {
    return <p className="text-caption text-secondary">No recorded events yet.</p>;
  }

  const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <ol className="space-y-2">
      {sorted.map((entry) => (
        <li key={entry.id} className="rounded-md border border-border bg-surface p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption font-medium text-primary">{humanizeStatus(entry.currentState)}</span>
            <time dateTime={entry.timestamp} className="text-caption text-secondary">
              {formatDateTime(entry.timestamp)}
            </time>
          </div>
          <p className="mt-1 text-caption text-secondary">
            Execution ID: <span className="font-mono">{entry.correlationId}</span>
          </p>
          {entry.reason?.note && <p className="mt-1 text-caption text-secondary">{entry.reason.note}</p>}
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
      ))}
    </ol>
  );
}
