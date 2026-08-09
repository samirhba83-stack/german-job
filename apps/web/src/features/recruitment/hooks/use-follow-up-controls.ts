'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as recruitmentApi from '../api/recruitment.api';
import type { ListFollowUpControlsParams } from '../api/recruitment.api';

export function useFollowUpControls(params: ListFollowUpControlsParams = {}) {
  return useQuery({
    queryKey: ['follow-up-controls', params],
    queryFn: () => recruitmentApi.listFollowUpControls(params),
  });
}

export function useFollowUpControlActions() {
  const queryClient = useQueryClient();

  const release = useTrackedMutation({
    activityLabel: 'Releasing follow-up hold',
    successMessage: 'Follow-up hold released',
    mutationFn: (input: { id: string; reason: string }) => recruitmentApi.releaseFollowUpControl(input.id, input.reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-up-controls'] }),
  });

  return { release };
}
