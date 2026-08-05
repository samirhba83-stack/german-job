import { Badge } from '@/components/ui/badge';
import { humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import type { CampaignExecutionStatusDto, ExecutionWindowDto } from '../types';

const BATCH_STATUS_TONE: Record<string, 'neutral' | 'positive' | 'warning' | 'critical' | 'info'> = {
  PLANNED: 'neutral',
  RUNNING: 'info',
  COMPLETED: 'positive',
  PARTIALLY_COMPLETED: 'warning',
  FAILED: 'critical',
};

/**
 * Milestone 25. `GetCampaignExecutionStatusHandler` already returns `currentBatch`, `checkpoint`,
 * and `cooldownActive` — all real, live fields the Campaign Workspace fetched (via
 * `useCampaignExecutionStatus`) since Milestone 23 but never rendered anywhere. This surfaces them
 * honestly: `currentBatch`/`checkpoint` are real but, like `health`/`intelligence`, structurally
 * `null` for every real campaign today because nothing in the live command set (`create/update/
 * start/pause/resume/cancel/complete/retry/replay/archive`) ever creates a batch — that requires
 * the dormant execution-orchestrator pipeline, which has no HTTP surface
 * (docs/campaign-workspace/03-integration-points.md, docs/architecture-stabilization/README.md).
 * `cooldownActive` is a real boolean that's always computable, and the execution window is real,
 * always-present configuration — both render with real values today, not just a "not yet" note.
 */
export function ExecutionMonitor({
  executionStatus,
  executionWindow,
}: {
  executionStatus: CampaignExecutionStatusDto;
  executionWindow: ExecutionWindowDto;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Current batch</p>
          {executionStatus.currentBatch ? (
            <div className="mt-1 space-y-1">
              <Badge tone={BATCH_STATUS_TONE[executionStatus.currentBatch.status] ?? 'neutral'}>
                {humanizeStatus(executionStatus.currentBatch.status)}
              </Badge>
              <p className="text-body-sm text-secondary">
                {executionStatus.currentBatch.targetIds.length} of {executionStatus.currentBatch.plannedSize} planned targets
              </p>
            </div>
          ) : (
            <p className="mt-1 text-body-sm text-secondary">No batch is currently active.</p>
          )}
        </div>

        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Checkpoint</p>
          {executionStatus.checkpoint ? (
            <p className="mt-1 text-body-sm text-primary">Saved {formatDateTime(executionStatus.checkpoint.savedAt)}</p>
          ) : (
            <p className="mt-1 text-body-sm text-secondary">No checkpoint saved yet.</p>
          )}
        </div>

        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Cooldown</p>
          <Badge tone={executionStatus.cooldownActive ? 'warning' : 'neutral'} className="mt-1">
            {executionStatus.cooldownActive ? 'Active' : 'Not active'}
          </Badge>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Execution window</p>
        <p className="mt-1 text-body-sm text-primary">
          {executionWindow.allowedWeekdays.map((day) => humanizeStatus(day)).join(', ')} · {executionWindow.dailyStartHour}:00–
          {executionWindow.dailyEndHour}:00 ({executionWindow.timezone})
        </p>
        {executionWindow.respectHolidays && <p className="text-caption text-secondary">Respects German public holidays.</p>}
      </div>
    </div>
  );
}
