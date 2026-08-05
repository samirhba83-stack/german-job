import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * M27.5 — the one real error-state treatment, extracted after finding the exact same
 * `<p className="rounded-md border border-dashed border-status-critical ...">` markup
 * independently duplicated across 6 existing screens (campaign/company list and workspace pages)
 * plus 2 new billing screens — the same "duplicated three-plus times, extract it" threshold this
 * codebase has already applied to `NativeSelect`/`StatTile`/`DefinitionField`. `message` is always
 * a real, already-resolved string the caller derived from its own query error (usually
 * `error instanceof ApiError ? error.message : 'fallback'`) — this component only renders it, it
 * never inspects the error itself.
 */
export function ErrorState({ message }: { message: string }) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-status-critical/10">
        <AlertTriangle className="h-5 w-5 text-status-critical" aria-hidden="true" strokeWidth={1.75} />
      </div>
      <p className="max-w-md text-body-sm text-secondary">{message}</p>
    </Card>
  );
}
