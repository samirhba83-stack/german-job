import { Clock } from 'lucide-react';
import { ContextHeader } from './context-header';
import { Card } from '@/components/ui/card';

export interface NotYetAvailableProps {
  title: string;
  /** The real, specific reason this screen isn't built yet — never a generic "coming soon."
   * Distinguishes "the backend module is dormant" from "the backend is live but this frontend
   * screen is reserved for a later milestone," since those are different, real situations. */
  reason: string;
}

/**
 * Milestone 22.3 audit fix: every one of these routes was previously either a real 404 (no
 * `page.tsx` existed at all — Sidebar/Quick Actions/Profile Menu linked to nothing) or, worse,
 * silently rendered the wrong page (`/jobs/new` matched the `[id]` dynamic route and rendered a
 * job detail view for a job literally named "new"). Neither is acceptable in a shell whose own
 * stated principle is "every interruption has a reason" (docs/interaction-framework/
 * 02-interaction-principles.md) — a dead link is the least explainable interruption there is.
 *
 * This is not new feature work: it's the minimum honest content a real route needs to stop being
 * either broken or wrong, using the same "state what's missing, don't fake it" pattern already
 * established by `ExecutionFeedbackUnavailable` (components/shell/execution-stage-list.tsx),
 * applied at page granularity instead of component granularity. It is also `ContextHeader`'s
 * first real caller (built in Milestone 22.2, uninstantiated until now).
 *
 * M27.5 visual upgrade: replaced the dashed "under construction" box with a centered, real Card
 * treatment — a dashed border reads as unfinished/wireframe, which undercuts the "professional,
 * premium" bar this milestone asks for on every screen, including the ones still honestly waiting
 * on a future milestone. Same props, same honest per-route `reason` text, same real routes this
 * already covers (Settings, Applications, Jobs, Admin, Mission Control) — only the visual
 * treatment changed.
 */
export function NotYetAvailable({ title, reason }: NotYetAvailableProps) {
  return (
    <div>
      <ContextHeader title={title} />
      <Card padding="lg" className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-background-subtle">
          <Clock className="h-5 w-5 text-secondary" aria-hidden="true" strokeWidth={1.75} />
        </div>
        <p className="max-w-md text-body-sm text-secondary">{reason}</p>
      </Card>
    </div>
  );
}
