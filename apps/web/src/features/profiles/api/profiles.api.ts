import { apiClient } from '@/lib/api-client';
import type { ProfileDto } from '@german-job-engine/shared-types';

/** GET /profiles/me — real, live endpoint. */
export async function getMyProfile(): Promise<ProfileDto> {
  return apiClient<ProfileDto>('/profiles/me');
}
