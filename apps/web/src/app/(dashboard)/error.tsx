'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';

/**
 * Next.js App Router error boundary — a real, previously-missing production gap (Milestone 22.2
 * self-review): before this, an uncaught render error anywhere inside the shell crashed the
 * entire app to a blank screen with no recovery path, directly violating this whole document
 * set's "every failure is explained, users should never feel abandoned after an error" principle
 * (docs/interaction-framework/02-interaction-principles.md; docs/product-experience/11-error-
 * experience.md). Scoped to the (dashboard) route group specifically, so an error here never
 * takes down the (auth) login/register flow.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- this is exactly the server-side-visibility gap
    // docs/M19-VALIDATION-REPORT.md §8 flagged on the backend; logging client-side at least keeps
    // it out of total silence until real error reporting exists (docs/interaction-framework/14-
    // risks-and-future-expansion.md).
    console.error(error);
  }, [error]);

  const message = error instanceof ApiError ? error.message : 'Something went wrong loading this page.';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 text-status-critical" aria-hidden="true" strokeWidth={1.75} />
      <div>
        <h1 className="text-heading-lg font-semibold text-primary">This page didn&apos;t load correctly</h1>
        <p className="mt-1 text-body-sm text-secondary">{message}</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
