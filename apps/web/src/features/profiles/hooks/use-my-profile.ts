'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import * as profilesApi from '../api/profiles.api';

/** Real `GET /profiles/me` — used by the Campaign Workspace's Overview section for the real
 * `completionPercentage` "Profile Readiness" signal (docs/campaign-workspace/).
 *
 * M31 Phase 22 (Beta UX Quality Gate) — a brand-new account has no profile row yet, and the
 * backend correctly answers that with a 404 (`GetProfileHandler`), not an empty body. Letting that
 * flow through as a TanStack Query error is technically accurate but practically noisy: every
 * beta user's very first dashboard load would show a failed network request in devtools for a
 * completely normal, expected state. A missing profile is modeled here as real data (`null`), the
 * same way `findByUserId` itself already models "doesn't exist yet" — not as a query failure. Any
 * other status still throws, so a real backend outage still surfaces as `isError`. */
export function useMyProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      try {
        return await profilesApi.getMyProfile();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
