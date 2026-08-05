'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Server-state cache (docs/frontend-architecture/12-architecture-decision-records.md ADR-001).
 * staleTime defaults short (30s) per docs/frontend-architecture/06-api-consumption-architecture.md
 * — individual queries override this where the milestone's caching table calls for 0s
 * (mid-workflow resources) or a longer window (rarely-changing data).
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Reads retry on network failure only, never on a 4xx — mirrors the API client's
          // ApiError.status check (lib/api-client.ts) so a validation/permission error never
          // silently retries.
          if (error instanceof Error && 'status' in error) {
            const status = (error as Error & { status?: number }).status;
            if (status && status >= 400 && status < 500) return false;
          }
          return failureCount < 3;
        },
      },
      mutations: {
        // Writes never auto-retry (docs/frontend-architecture/12-architecture-decision-records.md
        // ADR-007) — a failed mutation surfaces its error and waits for an explicit user retry.
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
