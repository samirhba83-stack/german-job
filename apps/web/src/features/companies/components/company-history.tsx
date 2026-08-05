'use client';

import { useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { APPLICATION_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDate } from '@/lib/format-date';
import { ApplicationCommunicationTimeline } from './application-communication-timeline';
import type { PaginatedApplicationsDto } from '@/features/applications/types';

interface CompanyHistoryProps {
  applications: PaginatedApplicationsDto | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * docs/company-workspace/. Section 4, Company History. The milestone's own example events
 * (Company Imported, Eligibility Evaluated, Campaign Assignment, ...) are mostly pipeline-internal
 * concepts with zero HTTP exposure (docs/company-workspace/03-integration-points.md) or, for
 * "Campaign Assignment" specifically, backed only by an unvalidated free-text reference. What's
 * real is the company's actual application history — every real `Application` carries a real
 * `companyId` — so this renders that: one row per real application (job title, current status,
 * submitted/last-activity dates), each expandable into its own real, lazily-fetched Communication
 * Timeline (`ApplicationCommunicationTimeline`).
 *
 * Deliberately not built on the `Accordion` component's own internal open/close state for the
 * lazy-fetch trigger — `AccordionContent` keeps its children mounted even while visually collapsed
 * (a real, correct design for already-loaded content, per its own decision record), which would
 * fetch every application's timeline immediately rather than lazily. `expandedIds` tracks "has
 * this row been opened at least once" independently, purely to gate the fetch — the Accordion
 * component itself is otherwise used completely unmodified for the actual disclosure UI/ARIA/
 * animation.
 */
export function CompanyHistory({ applications, isLoading, isError }: CompanyHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <SkeletonRegion loading label="Loading company history">
        <Skeleton variant="card" className="h-24" />
      </SkeletonRegion>
    );
  }

  if (isError) {
    return <p className="text-body-sm text-secondary">Company history is unavailable right now.</p>;
  }

  if (!applications || applications.items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
        No applications have been sent to this company yet.
      </p>
    );
  }

  return (
    <Accordion type="single">
      {applications.items.map((application) => (
        <div key={application.id} onClick={() => setExpandedIds((current) => new Set(current).add(application.id))}>
          <AccordionItem value={application.id}>
            <AccordionTrigger>
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 text-left">
                <div>
                  <p className="text-body-sm font-medium text-primary">{application.snapshot.jobTitle}</p>
                  <p className="text-caption text-secondary">
                    Last activity {formatDate(application.lastActivityAt)}
                  </p>
                </div>
                <Badge tone={APPLICATION_STATUS_TONE[application.status]}>{humanizeStatus(application.status)}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ApplicationCommunicationTimeline applicationId={application.id} enabled={expandedIds.has(application.id)} />
            </AccordionContent>
          </AccordionItem>
        </div>
      ))}
    </Accordion>
  );
}
