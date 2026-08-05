import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Status Badge — docs/frontend-architecture/05-component-architecture.md (contract) +
 * docs/design-system/07-component-library.md (visual spec: background at 12% opacity, text/icon
 * at full opacity — passes contrast regardless of theme, docs/design-system/03-design-tokens.md).
 * Tone is the single source of truth every domain enum (CampaignStatus, ApplicationLifecycleStatus,
 * JobStatus, SubscriptionStatus) maps onto — see lib/status-mappings.ts. */
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-status-neutral/10 text-status-neutral',
  positive: 'bg-status-positive/10 text-status-positive',
  warning: 'bg-status-warning/10 text-status-warning',
  critical: 'bg-status-critical/10 text-status-critical',
  info: 'bg-status-info/10 text-status-info',
};

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
