'use client';

import { Megaphone, Building2, Send, HardDrive, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/format-bytes';
import type { EntitlementSummaryDto } from '../types';

interface UsageRowProps {
  icon: LucideIcon;
  label: string;
  used: number;
  limit: number | null;
  formatValue?: (value: number) => string;
}

function UsageBar({ icon: Icon, label, used, limit, formatValue = (value) => value.toLocaleString('en-GB') }: UsageRowProps) {
  // null limit = the plan has no numeric cap for this metric (e.g. FREE's deliveries, which are
  // blocked entirely by the missing CAN_PRODUCTION_EXECUTE entitlement rather than a count).
  const ratio = limit === null || limit === 0 ? null : Math.min(used / limit, 1);
  const nearLimit = ratio !== null && ratio >= 0.9;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-body-sm">
        <span className="flex items-center gap-1.5 text-primary">
          <Icon className="h-3.5 w-3.5 text-secondary" aria-hidden="true" strokeWidth={1.75} />
          {label}
        </span>
        <span className="tabular-nums text-secondary">
          {formatValue(used)} {limit !== null && `/ ${formatValue(limit)}`}
        </span>
      </div>
      {ratio !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-background-subtle">
          <div
            className={cn('h-full rounded-full transition-[width] duration-slow ease-standard', nearLimit ? 'bg-status-warning' : 'bg-accent')}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Real usage vs. real limits — every number is `BillingEntitlementProjectionService`'s own
 * count-real-rows computation (`GET /billing/status`'s `entitlements.usage`/`limits`), never a
 * separate, driftable client-side counter. Scoped to the current billing period for a paid plan,
 * or all-time for FREE (the backend already resolves which window applies — this just displays
 * whatever it returns).
 */
export function UsageLimitsPanel({ entitlements }: { entitlements: EntitlementSummaryDto }) {
  const { usage, limits } = entitlements;

  return (
    <Card padding="lg" className="space-y-4">
      <h2 className="text-heading-md font-semibold text-primary">Usage this period</h2>
      <div className="space-y-3">
        <UsageBar icon={Megaphone} label="Active campaigns" used={usage.activeCampaigns} limit={limits.activeCampaigns} />
        <UsageBar icon={Building2} label="Companies this period" used={usage.companiesThisPeriod} limit={limits.companiesPerMonth} />
        <UsageBar icon={Send} label="Deliveries this period" used={usage.deliveriesThisPeriod} limit={limits.deliveriesPerMonth} />
        <UsageBar icon={HardDrive} label="Storage" used={usage.storageBytes} limit={limits.storageBytes} formatValue={formatBytes} />
      </div>
    </Card>
  );
}
