import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { humanizeStatus } from '@/lib/status-mappings';
import type { PlanCatalogueEntryDto } from '../types';
import { PlanCode } from '../types';

interface BillingHeroProps {
  /** The user's real current plan definition (resolved from `entitlements.planCode` against the
   * real catalogue) — every word rendered here is a real field of it, nothing invented. */
  currentPlan: PlanCatalogueEntryDto;
}

/**
 * The Billing Workspace's premium hero (M27.5 Phase 2) — restrained on purpose: one icon, one
 * headline, one real sentence of value copy pulled straight from the plan's own catalogue
 * `purpose` field. No illustration, no gradient background, no fabricated stat ("10,000 users
 * upgraded this month") — the only numbers this could show are real ones already covered by
 * `UsageLimitsPanel` directly below it, so it doesn't duplicate them here.
 */
export function BillingHero({ currentPlan }: BillingHeroProps) {
  const isFree = currentPlan.code === PlanCode.FREE;

  return (
    <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <h2 className="text-heading-lg font-semibold text-primary">
            You&apos;re on the {humanizeStatus(currentPlan.code)} plan
          </h2>
          <p className="max-w-xl text-body-sm text-secondary">
            {isFree
              ? `${currentPlan.purpose} Upgrade anytime to unlock production execution and AI-personalized applications.`
              : currentPlan.purpose}
          </p>
        </div>
      </div>
    </Card>
  );
}
