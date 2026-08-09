'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as authApi from '../api/auth.api';
import type { LoginRequestDto, RegisterRequestDto } from '../types';

/**
 * The one hook every auth-adjacent screen/component uses — never calls features/auth/api or
 * lib/stores/auth-store directly (docs/frontend-architecture/06-api-consumption-architecture.md
 * layered-client rule).
 *
 * Wired through useTrackedMutation (Milestone 22.2 self-review fix): Milestone 22 built the
 * Background Activity Center and useTrackedMutation but never actually connected either to a real
 * user flow — login/register used a plain useMutation, so the one real, live interaction every
 * user performs never appeared in the Activity Center at all. It does now. The previous custom
 * 401-message override for login was also removed: live testing against the real backend
 * (docs/interaction-framework/13-decision-records.md ADR-004) already confirmed
 * `POST /auth/login`'s real failure message is verbatim "Invalid email or password" — the
 * generic-enumeration guard is already enforced server-side, so duplicating it client-side was
 * dead defensive code solving an already-solved problem.
 */
export function useAuth() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const loginMutation = useTrackedMutation({
    activityLabel: 'Logging in',
    mutationFn: (payload: LoginRequestDto) => authApi.login(payload),
    onSuccess: (tokens) => {
      useAuthStore.getState().setTokens(tokens);
      router.push('/');
    },
  });

  const registerMutation = useTrackedMutation({
    activityLabel: 'Creating your account',
    mutationFn: (payload: RegisterRequestDto) => authApi.register(payload),
    onSuccess: (tokens) => {
      // Redirects to the shell root, not /onboarding — the Onboarding Wizard
      // (docs/frontend-architecture/03-screen-inventory.md) is page-implementation scope this
      // milestone doesn't build (docs/interaction-framework/14-risks-and-future-expansion.md);
      // linking to a route with no page would be a dead end, which the Interaction Principles
      // (docs/interaction-framework/02-interaction-principles.md) explicitly rule out.
      useAuthStore.getState().setTokens(tokens);
      router.push('/');
    },
  });

  const logoutMutation = useTrackedMutation({
    activityLabel: 'Logging out',
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Server-side logout failing (e.g. an already-expired token) must never block the client
      // from clearing its own session — the user's intent to sign out is honored regardless of
      // whether the request itself succeeded.
      clearSession();
      router.push('/login');
    },
  });

  return {
    isAuthenticated: Boolean(accessToken || user),
    user,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    logout: () => logoutMutation.mutate(undefined),
  };
}
