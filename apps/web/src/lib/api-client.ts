import { useAuthStore } from '@/lib/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Normalized shape of every error this client can throw — mirrors the backend's
 * AllExceptionsFilter response `{ statusCode, timestamp, path, message }`
 * (docs/frontend-architecture/06-api-consumption-architecture.md). `message` is a string for a
 * hand-thrown domain/business rejection, or a string array for per-field class-validator
 * failures. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: string[] | null;

  constructor(status: number, message: string | string[]) {
    super(Array.isArray(message) ? message.join(' ') : message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = Array.isArray(message) ? message : null;
  }
}

/**
 * Verified directly against live responses (2026-07-25): NestJS's built-in exceptions
 * (ValidationPipe's BadRequestException, Passport's UnauthorizedException) return `message` as a
 * *nested* `{ message, error, statusCode }` object from `exception.getResponse()`, which
 * AllExceptionsFilter forwards as-is — the outer `message` field is not always the flat
 * `string | string[]` docs/frontend-architecture/06-api-consumption-architecture.md described.
 * `extractMessage` below normalizes both shapes so ApiError always receives the flat form,
 * regardless of which one produced it.
 */
interface BackendErrorBody {
  statusCode: number;
  message: string | string[] | { message: string | string[]; error?: string; statusCode?: number };
}

function extractMessage(body: BackendErrorBody | null): string | string[] {
  if (!body) return 'Something went wrong. Please try again.';
  if (typeof body.message === 'string' || Array.isArray(body.message)) {
    return body.message;
  }
  return body.message?.message ?? 'Something went wrong. Please try again.';
}

/**
 * Verified directly against a live response (2026-07-25, `POST /auth/register`): the backend's
 * global TransformInterceptor wraps every successful response body in `{ data: T }` — this was
 * an open question in docs/frontend-architecture/13-risks-and-open-questions.md OQ-9, now
 * resolved by real evidence rather than assumption. Error responses (from AllExceptionsFilter,
 * which runs outside the interceptor pipeline) are NOT wrapped — confirmed separately below.
 */
interface BackendSuccessEnvelope<T> {
  data: T;
}

let refreshInFlight: Promise<string | null> | null = null;

/** POST /auth/refresh — deduplicated so concurrent 401s from several in-flight requests trigger
 * exactly one refresh call, not one per request. Exported (M25 sign-off audit fix) so `AppShell`
 * can proactively call it on boot when `hydrate()` restores a `refreshToken` but not `user` (by
 * design, `accessToken`/`user` are never persisted — ADR-003) — without this, a role-gated route
 * (e.g. `/campaigns`) shows a false "Access restricted" on every full page reload, since the role
 * guard evaluates before any child component's API call could otherwise trigger this same refresh
 * via the 401-retry path below. */
export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clearSession } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        if (!response.ok) {
          clearSession();
          return null;
        }
        const envelope = (await response.json()) as BackendSuccessEnvelope<{ accessToken: string; refreshToken: string }>;
        setTokens(envelope.data);
        return envelope.data.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Fetch wrapper (docs/frontend-architecture/06-api-consumption-architecture.md): injects the
 * Bearer access token, attempts one silent refresh-and-retry on a 401, and normalizes every
 * error into ApiError. Every apps/web `*.api.ts` module goes through this — no screen or hook
 * calls `fetch` directly.
 */
export async function apiClient<T>(path: string, init?: RequestInit, _isRetry = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401 && !_isRetry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return apiClient<T>(path, init, true);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let body: BackendErrorBody | null = null;
    try {
      body = (await response.json()) as BackendErrorBody;
    } catch {
      // Non-JSON error body (e.g. a network-level failure surfaced as a Response) — fall through
      // to the generic message below, matching the honesty rule for masked 5xx responses
      // (docs/M19-VALIDATION-REPORT.md §5.3): we don't invent a more specific cause than we have.
    }
    throw new ApiError(response.status, extractMessage(body));
  }

  const envelope = (await response.json()) as BackendSuccessEnvelope<T>;
  return envelope.data;
}
