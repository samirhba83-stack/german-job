import { Check, Minus } from 'lucide-react';
import { formatPlanPrice } from '@/lib/format-currency';
import { formatBytes } from '@/lib/format-bytes';
import { FEATURE_ENTITLEMENT_DISPLAY_ORDER, FEATURE_ENTITLEMENT_LABEL } from '@/lib/feature-entitlement-labels';
import { cn } from '@/lib/utils';
import type { PlanCatalogueEntryDto } from '../types';

interface PlanComparisonTableProps {
  plans: PlanCatalogueEntryDto[];
  /** Real current plan, when known — highlights that column. `null` on the unauthenticated
   * marketing pricing page, where there is no "current plan" to highlight. */
  currentPlanCode?: string | null;
}

const LIMIT_ROWS: { label: string; read: (plan: PlanCatalogueEntryDto) => string }[] = [
  { label: 'Active campaigns', read: (plan) => String(plan.limits.activeCampaigns) },
  { label: 'Companies / month', read: (plan) => plan.limits.companiesPerMonth?.toLocaleString('en-GB') ?? '—' },
  { label: 'Deliveries / month', read: (plan) => plan.limits.deliveriesPerMonth?.toLocaleString('en-GB') ?? '—' },
  { label: 'Specializations', read: (plan) => String(plan.limits.specializations) },
  { label: 'Storage', read: (plan) => formatBytes(plan.limits.storageBytes) },
];

/**
 * The full plan comparison matrix (M27.5 Phase 2/3) — every row is either a real numeric limit or
 * a real `FeatureEntitlement` the backend actually grants (`FEATURE_ENTITLEMENT_LABEL`), read
 * straight from `GET /billing/plans`. Shared between the Billing Workspace and the standalone
 * marketing pricing page so the two can never show a different matrix for the same real data.
 */
export function PlanComparisonTable({ plans, currentPlanCode = null }: PlanComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-body-sm">
        <thead>
          <tr className="border-b border-border bg-background-subtle">
            <th scope="col" className="sticky left-0 bg-background-subtle p-3 text-left font-semibold text-primary">
              <span className="sr-only">Feature</span>
            </th>
            {plans.map((plan) => (
              <th
                key={plan.code}
                scope="col"
                className={cn(
                  'min-w-[140px] p-3 text-left align-top font-semibold text-primary',
                  plan.code === currentPlanCode && 'bg-accent/5',
                )}
              >
                <div>{plan.displayName}</div>
                <div className="mt-0.5 font-normal text-caption text-secondary tabular-nums">{formatPlanPrice(plan.priceCents)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIMIT_ROWS.map((row, index) => (
            <tr key={row.label} className={cn('border-b border-border-subtle', index % 2 === 1 && 'bg-background-subtle/40')}>
              <th scope="row" className="sticky left-0 bg-inherit p-3 text-left font-medium text-secondary">
                {row.label}
              </th>
              {plans.map((plan) => (
                <td
                  key={plan.code}
                  className={cn('p-3 tabular-nums text-primary', plan.code === currentPlanCode && 'bg-accent/5')}
                >
                  {row.read(plan)}
                </td>
              ))}
            </tr>
          ))}
          {FEATURE_ENTITLEMENT_DISPLAY_ORDER.map((entitlement, index) => (
            <tr
              key={entitlement}
              className={cn('border-b border-border-subtle last:border-b-0', (index + LIMIT_ROWS.length) % 2 === 1 && 'bg-background-subtle/40')}
            >
              <th scope="row" className="sticky left-0 bg-inherit p-3 text-left font-medium text-secondary">
                {FEATURE_ENTITLEMENT_LABEL[entitlement]}
              </th>
              {plans.map((plan) => {
                const included = plan.entitlements.includes(entitlement);
                return (
                  <td key={plan.code} className={cn('p-3', plan.code === currentPlanCode && 'bg-accent/5')}>
                    {included ? (
                      <Check className="h-4 w-4 text-status-positive" aria-label="Included" strokeWidth={2} />
                    ) : (
                      <Minus className="h-4 w-4 text-disabled" aria-label="Not included" strokeWidth={2} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
