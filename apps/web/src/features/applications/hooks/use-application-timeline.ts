'use client';

import { useQuery } from '@tanstack/react-query';
import * as applicationsApi from '../api/applications.api';

/** Real `GET /applications/:id/timeline`. `enabled` defaults to `true` but callers doing lazy,
 * on-demand fetching (the Company Workspace's Communication Timeline — only fetch when a user
 * actually expands one application's history) should pass `enabled: false` until that happens,
 * via TanStack Query's own standard conditional-fetch mechanism — no bespoke lazy-loading code
 * needed. */
export function useApplicationTimeline(applicationId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['application', applicationId, 'timeline'],
    queryFn: () => applicationsApi.getApplicationTimeline(applicationId),
    enabled: options.enabled ?? true,
  });
}
