'use client';

import { ContextHeader } from '@/components/shell/context-header';
import { RecruitmentTaskList } from './recruitment-task-list';
import { FollowUpControlList } from './follow-up-control-list';

/**
 * M30 Phase 12 — the real Recruitment Tasks workspace: what a company reply asked the candidate
 * to do next (tasks), and why follow-ups have paused or stopped for a given application (follow-up
 * holds). Composes two independent real queries, matching `CampaignWorkspace`'s own "each section
 * loads/errors independently" discipline — a slow/failed follow-up-controls fetch never blocks
 * the tasks section from rendering.
 */
export function RecruitmentWorkspace() {
  return (
    <div className="space-y-8">
      <ContextHeader title="Tasks" />

      <section className="space-y-3">
        <div>
          <h2 className="text-heading-md font-semibold text-primary">Next steps</h2>
          <p className="text-body-sm text-secondary">Real actions a company&apos;s reply asked you to take — documents to send, interviews to confirm, deadlines to hit.</p>
        </div>
        <RecruitmentTaskList />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-heading-md font-semibold text-primary">Paused follow-ups</h2>
          <p className="text-body-sm text-secondary">Applications where automated follow-ups are currently on hold, and why.</p>
        </div>
        <FollowUpControlList />
      </section>
    </div>
  );
}
