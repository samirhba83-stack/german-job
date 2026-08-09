'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as recruitmentApi from '../api/recruitment.api';

export function useRecruitmentTaskActions() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['recruitment-tasks'] });
  }

  const completeTask = useTrackedMutation({
    activityLabel: 'Completing task',
    successMessage: 'Task completed',
    mutationFn: (id: string) => recruitmentApi.completeTask(id),
    onSuccess: invalidate,
  });

  const dismissTask = useTrackedMutation({
    activityLabel: 'Dismissing task',
    successMessage: 'Task dismissed',
    mutationFn: (input: { id: string; reason?: string }) => recruitmentApi.dismissTask(input.id, input.reason),
    onSuccess: invalidate,
  });

  const confirmDueDate = useTrackedMutation({
    activityLabel: 'Confirming deadline',
    successMessage: 'Deadline confirmed',
    mutationFn: (input: { id: string; dueAt: string }) => recruitmentApi.confirmTaskDueDate(input.id, input.dueAt),
    onSuccess: invalidate,
  });

  return { completeTask, dismissTask, confirmDueDate };
}
