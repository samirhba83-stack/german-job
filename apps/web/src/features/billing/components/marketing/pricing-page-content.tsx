'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shell/error-state';
import { usePlans } from '../../hooks/use-plans';
import { PlanComparisonTable } from '../plan-comparison-table';
import { MarketingHeader } from './marketing-header';
import { MarketingFooter } from './marketing-footer';
import { PricingHero } from './pricing-hero';
import { WhySection } from './why-section';
import { ProblemsSolvedSection } from './problems-solved-section';
import { PricingPlanCards } from './pricing-plan-cards';
import { FaqSection } from './faq-section';
import { TrustSecuritySection } from './trust-security-section';
import { FinalCtaSection } from './final-cta-section';

/**
 * The standalone marketing pricing page (M27.5 Phase 3) — unauthenticated, outside `AppShell`,
 * its own minimal header/footer. Every price/limit/feature comes from the real, public
 * `GET /billing/plans` (`usePlans()`) — the exact same data and hook the in-app Billing Workspace
 * uses, so this page can never show a different catalogue than what checkout will actually charge.
 */
export function PricingPageContent() {
  const plansQuery = usePlans();

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <PricingHero />

        {plansQuery.isLoading && (
          <div className="mx-auto max-w-content space-y-4 px-4 py-16 sm:px-6">
            <Skeleton variant="card" className="h-10 w-1/3" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="card" className="h-80" />
              ))}
            </div>
          </div>
        )}

        {plansQuery.isError && (
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
            <ErrorState message="Pricing is temporarily unavailable. Please refresh the page in a moment." />
          </div>
        )}

        {plansQuery.data && (
          <>
            <WhySection plans={plansQuery.data} />
            <ProblemsSolvedSection plans={plansQuery.data} />
            <PricingPlanCards plans={plansQuery.data} />
            <div className="mx-auto max-w-content px-4 pb-16 sm:px-6">
              <h2 className="mb-6 text-center text-heading-lg font-semibold text-primary md:text-display">Compare every plan</h2>
              <PlanComparisonTable plans={plansQuery.data} />
            </div>
            <TrustSecuritySection />
            <FaqSection />
            <FinalCtaSection />
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
