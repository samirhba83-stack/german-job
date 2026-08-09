import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContext {
  readonly requestId: string;
  /** Set once the request passes through auth (most routes) — `undefined` for genuinely
   * unauthenticated routes (webhooks, health checks, login/register itself). Never a raw email —
   * matches Phase 15's own "logs must never contain user-identifying content beyond a safe
   * reference" requirement; a user id alone is the established safe-reference shape this codebase
   * already uses everywhere else (audit events, notifications). */
  userId?: string;
}

/**
 * M31 Phase 15 — the real, HTTP-request-scoped counterpart to
 * `CampaignExecutionCallContextHolder`'s (M26) identical `AsyncLocalStorage` pattern, reused here
 * rather than inventing a second mechanism. `StructuredLoggerService` reads the active context to
 * attach `requestId`/`userId` to every log line automatically, without every call site needing to
 * pass them manually.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  current(): RequestContext | undefined {
    return this.storage.getStore();
  }

  setUserId(userId: string): void {
    const context = this.storage.getStore();
    if (context) context.userId = userId;
  }
}
