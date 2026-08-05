import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format-date';

export type ExecutionStageStatus = 'pending' | 'active' | 'complete' | 'failed';

export interface ExecutionStageEvidence {
  type: string;
  externalId: string;
  url: string | null;
}

export interface ExecutionStage {
  id: string;
  label: string;
  status: ExecutionStageStatus;
  /** Real ISO timestamp when this stage's transition actually happened — omitted (never
   * fabricated) for a stage that hasn't happened yet. */
  occurredAt?: string;
  /** Real, human-readable context for why this transition happened — sourced from the backend's
   * own `TransitionReason.note` (a real, optional field an actor/policy may set), never a
   * synthesized sentence. Omitted when the transition has no reason note. */
  explanation?: string;
  /** Real evidence backing this transition (e.g. an email-provider delivery receipt), sourced
   * from the backend's own `EvidenceReference`. Omitted when the transition has none. */
  evidence?: ExecutionStageEvidence;
  /** No backend field exists today for a per-stage recommended next action (only
   * `TransitionReason` and `EvidenceReference` are real) — always omitted rather than guessed.
   * Kept in the type so a future real field can be wired without a breaking change
   * (docs/interaction-framework/14-risks-and-future-expansion.md). */
  recommendedNextAction?: string;
}

const STATUS_ICON: Record<ExecutionStageStatus, typeof Circle> = {
  pending: Circle,
  active: Loader2,
  complete: CheckCircle2,
  failed: XCircle,
};

const STATUS_CLASSES: Record<ExecutionStageStatus, string> = {
  pending: 'text-disabled',
  active: 'text-accent animate-spin',
  complete: 'text-status-positive',
  failed: 'text-status-critical',
};

/**
 * docs/interaction-framework/03-execution-feedback.md. Generic and data-source-agnostic by
 * design: it renders whatever real stages it's given and nothing else. It is never populated
 * with the dormant pipeline's internal stages (recommendation → decision → planning →
 * orchestration → worker) as if they were observable — no controller exposes that today
 * (docs/frontend-architecture/01-information-architecture.md §1.8). Where this component IS
 * wired to real data today is the Application lifecycle (lib/application-lifecycle-stages.ts),
 * whose 15 states are live and timestamped. `explanation`/`evidence` render only when the real
 * timeline transition actually carried a `TransitionReason.note` or `EvidenceReference`
 * (Milestone 22.2) — most transitions today have neither, so most stages show only label + icon +
 * timestamp, which is the honest state of the data, not a rendering gap.
 */
export function ExecutionStageList({ stages }: { stages: ExecutionStage[] }) {
  return (
    <ol className="space-y-3">
      {stages.map((stage) => {
        const Icon = STATUS_ICON[stage.status];
        return (
          <li key={stage.id} className="flex items-start gap-3">
            <Icon
              className={cn('mt-0.5 h-4 w-4 shrink-0', STATUS_CLASSES[stage.status])}
              aria-hidden="true"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {/* M25 sign-off audit fix: `text-disabled` measured 2.45:1 here in a real axe-core
                    scan — this is de-emphasized *informational* text about a future step, not a
                    disabled interactive control (the one case WCAG exempts from the contrast
                    requirement), so it needs to actually meet it. `text-secondary` is the token
                    already used for de-emphasized-but-legible text elsewhere in this exact
                    component (`explanation`/`evidence` below) and already passes AA. */}
                <span className={cn('text-body-sm', stage.status === 'pending' ? 'text-secondary' : 'text-primary')}>
                  {stage.label}
                </span>
                {stage.occurredAt && (
                  <time dateTime={stage.occurredAt} className="ml-auto shrink-0 text-caption text-secondary">
                    {formatDateTime(stage.occurredAt)}
                  </time>
                )}
              </div>
              {stage.explanation && <p className="text-caption text-secondary">{stage.explanation}</p>}
              {stage.recommendedNextAction && (
                <p className="text-caption text-accent">{stage.recommendedNextAction}</p>
              )}
              {stage.evidence && (
                <p className="text-caption text-secondary">
                  Evidence:{' '}
                  {stage.evidence.url ? (
                    <a href={stage.evidence.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
                      {stage.evidence.type}
                    </a>
                  ) : (
                    stage.evidence.type
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Honest placeholder for a real execution surface with no backend controller yet
 * (docs/frontend-architecture ADR-008 pattern, applied to a component instead of a whole screen). */
export function ExecutionFeedbackUnavailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
      {reason}
    </div>
  );
}
