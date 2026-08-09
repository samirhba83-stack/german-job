'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RECRUITMENT_TASK_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { useRecruitmentTaskActions } from '../hooks/use-recruitment-task-actions';
import type { RecruitmentTaskDto } from '../types';

export function RecruitmentTaskRow({ task }: { task: RecruitmentTaskDto }) {
  const { completeTask, dismissTask, confirmDueDate } = useRecruitmentTaskActions();
  const [confirmingDate, setConfirmingDate] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const isActionable = task.status === 'OPEN' || task.status === 'IN_PROGRESS';

  return (
    <li>
      <Card padding="md" className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-body font-medium text-primary">{task.title}</p>
            <p className="text-body-sm text-secondary">{task.explanation}</p>
          </div>
          <Badge tone={RECRUITMENT_TASK_STATUS_TONE[task.status]}>{humanizeStatus(task.status)}</Badge>
        </div>

        {task.dueAt && <p className="text-caption text-secondary">Due {formatDateTime(task.dueAt)}</p>}
        {!task.dueAt && task.dueDateConfidence === 'AMBIGUOUS' && task.originalDateText && (
          <p className="text-caption text-status-warning">Mentioned deadline: &quot;{task.originalDateText}&quot; — unclear, please confirm the real date below.</p>
        )}

        {isActionable && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" loading={completeTask.isPending} onClick={() => completeTask.mutate(task.id)}>
              Mark complete
            </Button>
            <Button size="sm" variant="secondary" loading={dismissTask.isPending} onClick={() => dismissTask.mutate({ id: task.id })}>
              Dismiss
            </Button>
            {!task.dueAt && task.dueDateConfidence === 'AMBIGUOUS' && !confirmingDate && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDate(true)}>
                Confirm real date
              </Button>
            )}
          </div>
        )}

        {confirmingDate && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background-subtle p-3">
            <Input type="date" label="Actual deadline" value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
            <Button
              size="sm"
              disabled={!dateInput}
              loading={confirmDueDate.isPending}
              onClick={() => {
                confirmDueDate.mutate({ id: task.id, dueAt: new Date(dateInput).toISOString() }, { onSuccess: () => setConfirmingDate(false) });
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDate(false)}>
              Cancel
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}
