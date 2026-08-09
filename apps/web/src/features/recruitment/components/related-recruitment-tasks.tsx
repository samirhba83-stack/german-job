'use client';

import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { useRecruitmentTasks } from '../hooks/use-recruitment-tasks';
import { RecruitmentTaskRow } from './recruitment-task-row';

/** M30 Phase 12 — "view related next-action task" from inside the Inbox message detail page,
 * scoped to the one application this specific reply correlated to. */
export function RelatedRecruitmentTasks({ applicationId }: { applicationId: string }) {
  const { data, isLoading } = useRecruitmentTasks({ applicationId });

  if (isLoading) {
    return (
      <SkeletonRegion loading label="Loading related tasks">
        <Skeleton variant="card" className="h-16" />
      </SkeletonRegion>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <ul className="space-y-2">
      {data.map((task) => (
        <RecruitmentTaskRow key={task.id} task={task} />
      ))}
    </ul>
  );
}
