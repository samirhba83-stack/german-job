import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPlanPrice } from '@/lib/format-currency';
import type { PlanCatalogueEntryDto } from '../../types';
import { PlanCode } from '../../types';

const RECOMMENDED_PLAN_CODE = PlanCode.PREMIUM;

/**
 * The public pricing grid for unauthenticated visitors — same real `GET /billing/plans` data as
 * the in-app `PlanCatalogue`, but every CTA routes to `/register` rather than triggering a
 * checkout directly (checkout requires a real authenticated session — `POST /billing/checkout` is
 * guarded). A visitor picks a plan, creates an account, and completes checkout from inside the
 * real Billing Workspace, which already knows how to start it.
 */
export function PricingPlanCards({ plans }: { plans: PlanCatalogueEntryDto[] }) {
  return (
    <section id="plans" className="mx-auto max-w-content px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-heading-lg font-semibold text-primary md:text-display">Simple, transparent pricing</h2>
        <p className="mt-3 text-body text-secondary">Every plan includes the Free tier&apos;s profile tools. Cancel anytime, effective at period end.</p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isFree = plan.code === PlanCode.FREE;
          const isRecommended = plan.code === RECOMMENDED_PLAN_CODE;

          return (
            <Card
              key={plan.code}
              padding="lg"
              className={cn(
                'flex flex-col gap-4 transition-shadow duration-base ease-standard hover:shadow-elevation-2',
                isRecommended && 'ring-1 ring-accent/40',
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-heading-md font-semibold text-primary">{plan.displayName}</h3>
                  {isRecommended && <Badge tone="positive">Recommended</Badge>}
                </div>
                <p className="text-heading-lg font-semibold text-primary tabular-nums">{formatPlanPrice(plan.priceCents)}</p>
                <p className="text-body-sm text-secondary">{plan.purpose}</p>
              </div>

              <ul className="flex-1 space-y-1.5">
                {plan.featureHighlights.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-body-sm text-primary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-positive" aria-hidden="true" strokeWidth={2} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/register" className="w-full">
                <Button size="sm" variant={isRecommended ? 'primary' : 'secondary'} className="w-full">
                  {isFree ? 'Start free' : `Choose ${plan.displayName}`}
                </Button>
              </Link>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
