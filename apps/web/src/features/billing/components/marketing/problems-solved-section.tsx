import { ArrowRight } from 'lucide-react';
import type { PlanCatalogueEntryDto } from '../../types';
import { PlanCode } from '../../types';

interface ProblemSolution {
  problem: string;
  /** The real, matching feature — read from the Professional plan's own `featureHighlights`
   * (GET /billing/plans), never written independently of what the product actually does. */
  solutionIndex: number;
  fallback: string;
}

const PAIRS: ProblemSolution[] = [
  { problem: 'Generic applications get ignored', solutionIndex: 1, fallback: 'Company-specific CV personalization' },
  { problem: 'Manually writing every motivation letter takes hours', solutionIndex: 2, fallback: 'Company-specific Motivation Letter' },
  { problem: 'Sending at the wrong time lowers response rates', solutionIndex: 4, fallback: 'Strategic German business-hour scheduling' },
  { problem: 'Duplicate applications damage your reputation', solutionIndex: 5, fallback: 'Duplicate prevention' },
  { problem: 'No visibility into whether a campaign is actually working', solutionIndex: 7, fallback: 'Basic execution monitoring' },
];

export function ProblemsSolvedSection({ plans }: { plans: PlanCatalogueEntryDto[] }) {
  const professional = plans.find((plan) => plan.code === PlanCode.PROFESSIONAL);

  return (
    <section className="border-y border-border bg-background-subtle">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-heading-lg font-semibold text-primary md:text-display">Problems this solves</h2>
          <p className="mt-3 text-body text-secondary">The real, specific failure modes of a manual job search.</p>
        </div>
        <ul className="mx-auto mt-10 max-w-2xl space-y-3">
          {PAIRS.map((pair) => (
            <li key={pair.problem} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-body-sm text-secondary line-through decoration-status-critical/50">{pair.problem}</span>
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-disabled sm:block" aria-hidden="true" strokeWidth={1.75} />
              <span className="text-body-sm font-medium text-primary">
                {professional?.featureHighlights[pair.solutionIndex] ?? pair.fallback}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
