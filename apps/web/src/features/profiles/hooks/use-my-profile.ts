'use client';

import { useQuery } from '@tanstack/react-query';
import * as profilesApi from '../api/profiles.api';

/** Real `GET /profiles/me` — used by the Campaign Workspace's Overview section for the real
 * `completionPercentage` "Profile Readiness" signal (docs/campaign-workspace/). */
export function useMyProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profilesApi.getMyProfile(),
  });
}
