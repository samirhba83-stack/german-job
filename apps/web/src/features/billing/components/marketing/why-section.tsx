import { Wand2, Clock, ShieldAlert, LineChart, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { PlanCatalogueEntryDto } from '../../types';
import { PlanCode } from '../../types';

interface Pillar {
  icon: LucideIcon;
  title: string;
  /** Pulled from a real plan's own `customerOutcomes` (GET /billing/plans) — never invented copy. */
  outcome: string;
}

/** 4 real outcomes drawn from the Professional/Premium catalogue entries — the product's actual
 * value proposition, not marketing copy invented for this page. */
function buildPillars(plans: PlanCatalogueEntryDto[]): Pillar[] {
  const professional = plans.find((plan) => plan.code === PlanCode.PROFESSIONAL);
  const premium = plans.find((plan) => plan.code === PlanCode.PREMIUM);

  return [
    { icon: Wand2, title: 'Personalized, not generic', outcome: professional?.customerOutcomes[0] ?? 'Every application adapted to each company' },
    { icon: Clock, title: 'Sent at the right time', outcome: professional?.customerOutcomes[2] ?? 'Strategic sending times' },
    { icon: ShieldAlert, title: 'Protected reputation', outcome: professional?.customerOutcomes[3] ?? 'Avoid duplicate applications' },
    { icon: LineChart, title: 'Continuously optimized', outcome: premium?.customerOutcomes[3] ?? 'Optimize campaigns automatically' },
  ];
}

export function WhySection({ plans }: { plans: PlanCatalogueEntryDto[] }) {
  const pillars = buildPillars(plans);

  return (
    <section className="mx-auto max-w-content px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-heading-lg font-semibold text-primary md:text-display">Why German Job Engine</h2>
        <p className="mt-3 text-body text-secondary">
          Applying to jobs manually doesn&apos;t scale. Every paid plan replaces hours of repetitive work with a real,
          traceable execution system.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((pillar) => (
          <Card key={pillar.title} padding="lg" className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <pillar.icon className="h-5 w-5 text-accent" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <h3 className="text-body font-semibold text-primary">{pillar.title}</h3>
            <p className="text-body-sm text-secondary">{pillar.outcome}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
