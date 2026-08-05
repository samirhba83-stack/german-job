import { apiClient } from '@/lib/api-client';
import type { AuthTokensDto, LoginRequestDto } from '../types';

/** POST /auth/register — real, live endpoint (docs/frontend-architecture/03-screen-inventory.md).
 * Returns tokens immediately; there is no email-verification step in the backend
 * (docs/frontend-architecture/13-risks-and-open-questions.md OQ-1) — the caller must not imply one. */
export async function register(payload: LoginRequestDto): Promise<AuthTokensDto> {
  return apiClient<AuthTokensDto>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** POST /auth/login. */
export async function login(payload: LoginRequestDto): Promise<AuthTokensDto> {
  return apiClient<AuthTokensDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** POST /auth/logout — server-side session termination; caller clears local state separately
 * (features/auth/hooks/use-auth.ts) regardless of whether this call succeeds. */
export async function logout(): Promise<void> {
  await apiClient<void>('/auth/logout', { method: 'POST' });
}
