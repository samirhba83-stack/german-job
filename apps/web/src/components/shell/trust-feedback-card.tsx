import { Card } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format-date';

export interface TrustFeedbackCardProps {
  label: string;
  tone: BadgeTone;
  explanation: string;
  recommendedAction?: string | null;
  /** Real 0..1 score — e.g. `MissionStatusDescriptor.confidence` (`CampaignHealth.healthScore`)
   * or a timeline entry's `ConfidenceScore`. Rendered only when not null/undefined; this
   * component never estimates or interpolates a confidence value of its own. */
  confidence?: number | null;
  /** Real ISO timestamp the underlying assessment was actually computed — e.g.
   * `MissionStatusDescriptor.lastUpdateTime`. Rendered only when present. */
  lastUpdateTime?: string | null;
  className?: string;
}

/**
 * docs/interaction-framework/09-trust-feedback.md. A single, reusable surface for "what's
 * happening, and what it's based on" — deliberately shaped to accept
 * `lib/mission-status.ts`'s `MissionStatusDescriptor` directly (`label`/`tone`/`explanation`/
 * `recommendedAction`/`confidence`/`lastUpdateTime` all line up), so the Mission Status Layer and
 * the Trust Feedback Layer render from one real data shape instead of two parallel ones. Every
 * field beyond `label`/`tone`/`explanation` is optional and simply omitted — never defaulted or
 * guessed — when the caller has no real value for it.
 */
export function TrustFeedbackCard({
  label,
  tone,
  explanation,
  recommendedAction,
  confidence,
  lastUpdateTime,
  className,
}: TrustFeedbackCardProps) {
  return (
    <Card padding="md" className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone}>{label}</Badge>
        {typeof confidence === 'number' && (
          <span className="text-caption text-secondary">{Math.round(confidence * 100)}% confidence</span>
        )}
      </div>
      <p className="text-body-sm text-primary">{explanation}</p>
      {recommendedAction && <p className="text-body-sm text-accent">{recommendedAction}</p>}
      {lastUpdateTime && (
        <p className="text-caption text-secondary">
          Updated <time dateTime={lastUpdateTime}>{formatDateTime(lastUpdateTime)}</time>
        </p>
      )}
    </Card>
  );
}
