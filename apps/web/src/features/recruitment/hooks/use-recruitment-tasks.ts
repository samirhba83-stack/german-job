'use client';

import { useQuery } from '@tanstack/react-query';
import * as recruitmentApi from '../api/recruitment.api';
import type { ListTasksParams } from '../api/recruitment.api';

export function useRecruitmentTasks(params: ListTasksParams = {}) {
  return useQuery({
    queryKey: ['recruitment-tasks', params],
    queryFn: () => recruitmentApi.listTasks(params),
  });
}
