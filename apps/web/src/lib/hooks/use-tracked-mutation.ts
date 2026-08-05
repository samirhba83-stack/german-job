import { useRef } from 'react';
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import {
  useBackgroundActivityStore,
  type BackgroundActivityContext,
} from '@/lib/stores/background-activity-store';
import { toast } from '@/lib/stores/toast-store';
import { ApiError } from '@/lib/api-client';

export interface TrackedMutationOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, Error, TVariables>, 'onMutate'> {
  /** Present-tense label shown in the Background Activity Center while running,
   * e.g. "Updating profile", "Creating campaign" (docs/interaction-framework/06-background-
   * activity-center.md). */
  activityLabel: string;
  /** Shown as a success toast once the mutation resolves — omit for mutations that already
   * navigate away or show their own confirmation. */
  successMessage?: string;
  /** Real, optional context (executionId/relatedCampaignId/relatedCompanyId/
   * relatedRecommendationId/currentStep) — only ever populated by a caller that genuinely has
   * one of these real ids; never fabricated by this hook itself. */
  activityContext?: BackgroundActivityContext;
}

/** Same eligibility as lib/api-client.ts's / app/providers.tsx's read-retry logic: a network
 * failure or a real 5xx is worth retrying verbatim; a 4xx (validation, permission) will just fail
 * the same way again, so offering "Retry" for one would be dishonest UI. */
function isRetryable(error: Error): boolean {
  if (!(error instanceof ApiError)) return true; // no status at all — treat as a network failure
  return error.status >= 500;
}

/**
 * docs/interaction-framework/02-interaction-principles.md: "every request has progress, every
 * completed action is acknowledged, every failure is explained." This is the single hook that
 * gives every mutation in the product that behavior uniformly — registers with the Background
 * Activity Center on start, and pushes a toast on completion or failure — so no feature has to
 * reimplement the pattern. This wraps real TanStack Query mutation state (isPending/isError/
 * isSuccess); it never simulates progress or invents intermediate stages that don't exist
 * (docs/interaction-framework/03-execution-feedback.md).
 *
 * activityId is tracked in a ref rather than mutation `context`, deliberately, so this hook never
 * has to fight TanStack Query's context-typing generics or collide with a caller's own onMutate
 * return value.
 */
export function useTrackedMutation<TData, TVariables>({
  activityLabel,
  successMessage,
  activityContext,
  onSuccess,
  onError,
  ...options
}: TrackedMutationOptions<TData, TVariables>): UseMutationResult<TData, Error, TVariables> {
  const start = useBackgroundActivityStore((state) => state.start);
  const complete = useBackgroundActivityStore((state) => state.complete);
  const fail = useBackgroundActivityStore((state) => state.fail);
  const activityIdRef = useRef<string | null>(null);
  const lastVariablesRef = useRef<TVariables | undefined>(undefined);

  const mutation = useMutation<TData, Error, TVariables>({
    ...options,
    onMutate: (variables) => {
      lastVariablesRef.current = variables;
      activityIdRef.current = start(activityLabel, activityContext);
    },
    onSuccess: (...args) => {
      if (activityIdRef.current) complete(activityIdRef.current);
      if (successMessage) toast.success(successMessage);
      onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
      if (activityIdRef.current) {
        const retryable = isRetryable(error);
        fail(activityIdRef.current, message, {
          retryable,
          retry: retryable
            ? () => {
                if (lastVariablesRef.current !== undefined) mutation.mutate(lastVariablesRef.current);
              }
            : null,
        });
      }
      toast.error(`${activityLabel} failed`, message);
      onError?.(error, ...rest);
    },
  });

  return mutation;
}
