'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { FOLLOW_UP_CONTROL_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { useFollowUpControls, useFollowUpControlActions } from '../hooks/use-follow-up-controls';
import type { FollowUpControlDto } from '../types';

const CANDIDATE_RELEASABLE_TYPES = new Set(['TEMPORARY_HOLD', 'PERMANENT_SUPPRESSION', 'WAITING_PERIOD', 'MANUAL_REVIEW_HOLD']);

function FollowUpControlRow({ control }: { control: FollowUpControlDto }) {
  const { release } = useFollowUpControlActions();
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [reason, setReason] = useState('');
  const isActive = control.status === 'ACTIVE';
  const isReleasable = isActive && CANDIDATE_RELEASABLE_TYPES.has(control.controlType);

  return (
    <li>
      <Card padding="md" className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-body font-medium text-primary">{humanizeStatus(control.controlType)}</p>
            <p className="text-body-sm text-secondary">{control.explanation}</p>
          </div>
          <Badge tone={FOLLOW_UP_CONTROL_STATUS_TONE[control.status]}>{humanizeStatus(control.status)}</Badge>
        </div>
        <p className="text-caption text-secondary">
          Started {formatDateTime(control.createdAt)}
          {control.expiresAt && ` · Resumes ${formatDateTime(control.expiresAt)}`}
        </p>

        {isReleasable && !confirmingRelease && (
          <Button size="sm" variant="secondary" onClick={() => setConfirmingRelease(true)}>
            Resume follow-ups now
          </Button>
        )}
        {confirmingRelease && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-background-subtle p-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold uppercase tracking-wide text-secondary">Why are you releasing this hold?</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-9 rounded-md border border-border bg-surface px-3 text-body text-primary focus-visible:border-border-focus"
              />
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!reason}
                loading={release.isPending}
                onClick={() => release.mutate({ id: control.id, reason }, { onSuccess: () => setConfirmingRelease(false) })}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRelease(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

/** M30 Phase 12 — "view follow-up suppression reason" / "release a temporary hold." Only ACTIVE
 * controls are shown by default (the ones that actually affect the candidate right now). */
export function FollowUpControlList() {
  const { data, isLoading, isError, error } = useFollowUpControls({ status: 'ACTIVE' });

  if (isLoading) {
    return (
      <SkeletonRegion loading label="Loading follow-up holds">
        <Skeleton variant="card" />
      </SkeletonRegion>
    );
  }
  if (isError) {
    return <ErrorState message={error instanceof ApiError ? error.message : 'Something went wrong loading your follow-up holds.'} />;
  }
  if (!data || data.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background-subtle p-6 text-body-sm text-secondary">
        No active follow-up holds — your campaigns are following up normally.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {data.map((control) => (
        <FollowUpControlRow key={control.id} control={control} />
      ))}
    </ul>
  );
}
