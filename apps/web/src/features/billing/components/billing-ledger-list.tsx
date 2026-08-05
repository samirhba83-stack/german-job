import { Receipt } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { formatLedgerAmount } from '@/lib/format-currency';
import { cn } from '@/lib/utils';
import type { BillingLedgerEntryDto } from '../types';

const LEDGER_STATUS_TONE: Record<string, BadgeTone> = {
  SUCCESS: 'positive',
  FAILURE: 'critical',
  PENDING: 'warning',
};

const DOT_TONE_CLASS: Record<BadgeTone, string> = {
  positive: 'bg-status-positive',
  critical: 'bg-status-critical',
  warning: 'bg-status-warning',
  info: 'bg-status-info',
  neutral: 'bg-status-neutral',
};

/**
 * The current user's real payment/subscription event history (`GET /billing/ledger`) — the
 * append-only `BillingLedgerEntry` table every material financial operation writes to. Rendered as
 * a real timeline (M27.5 Phase 2: "Payment history timeline") — a connecting rail with a
 * status-toned dot per entry — over the same real, chronological data `CampaignProgressLog`'s
 * transition ledger already uses this pattern for, never a fabricated "invoice" layout Paddle
 * itself doesn't hand back in this shape.
 */
export function BillingLedgerList({ entries }: { entries: BillingLedgerEntryDto[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-background-subtle p-8 text-center">
        <Receipt className="h-6 w-6 text-disabled" aria-hidden="true" strokeWidth={1.5} />
        <p className="text-body-sm text-secondary">No billing activity yet — your first checkout or renewal will appear here.</p>
      </div>
    );
  }

  return (
    <ol className="relative">
      {entries.map((entry, index) => {
        const tone = LEDGER_STATUS_TONE[entry.status] ?? 'neutral';
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && <span aria-hidden="true" className="absolute left-[5px] top-3 h-full w-px bg-border" />}
            <span aria-hidden="true" className={cn('mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-background', DOT_TONE_CLASS[tone])} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-primary">{humanizeStatus(entry.eventType)}</span>
                  <Badge tone={tone}>{humanizeStatus(entry.status)}</Badge>
                </div>
                <p className="mt-0.5 text-caption text-secondary">
                  {formatDateTime(entry.occurredAt)}
                  {entry.planCode && ` · ${humanizeStatus(entry.planCode)}`}
                  {entry.reason && ` · ${entry.reason}`}
                </p>
              </div>
              <span className="shrink-0 text-body-sm font-semibold tabular-nums text-primary">{formatLedgerAmount(entry.amountCents)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
