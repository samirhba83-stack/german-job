'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { useRecruitmentTasks } from '../hooks/use-recruitment-tasks';
import type { RecruitmentTaskStatus } from '../types';
import { RecruitmentTaskRow } from './recruitment-task-row';

const VIEWS: ReadonlyArray<{ key: RecruitmentTaskStatus | 'ALL'; label: string }> = [
  { key: 'OPEN', label: 'Open' },
  { key: 'ALL', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DISMISSED', label: 'Dismissed' },
  { key: 'EXPIRED', label: 'Overdue' },
];

/** M30 Phase 12 — the real recruitment task list. No `Tabs` component exists in this design
 * system (confirmed absent during M29) — a row of `Button` toggles is the established idiom,
 * matching `InboxMessageList`'s identical view-switcher pattern. */
export function RecruitmentTaskList() {
  const [view, setView] = useState<RecruitmentTaskStatus | 'ALL'>('OPEN');
  const { data, isLoading, isError, error } = useRecruitmentTasks(view === 'ALL' ? {} : { status: view });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter tasks">
        {VIEWS.map((v) => (
          <Button key={v.key} size="sm" variant={view === v.key ? 'primary' : 'secondary'} onClick={() => setView(v.key)}>
            {v.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <SkeletonRegion loading label="Loading tasks">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} variant="card" />
            ))}
          </div>
        </SkeletonRegion>
      )}

      {isError && <ErrorState message={error instanceof ApiError ? error.message : 'Something went wrong loading your tasks.'} />}

      {data && data.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-background-subtle p-6 text-body-sm text-secondary">
          No tasks here — real next steps from recruiter replies (documents to send, interviews to confirm, deadlines to hit) will show up automatically.
        </p>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((task) => (
            <RecruitmentTaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}
