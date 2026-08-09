import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from './request-context.service';

/** M31 Phase 15 — attaches the real authenticated user id (once auth has resolved — guards run
 * before interceptors in Nest's request lifecycle, so `request.user` is already set here for any
 * guarded route) to the active `RequestContextService` context, so every log line for the rest of
 * this request automatically carries a real, safe user reference (never an email — matching this
 * codebase's established "user id only, never raw PII" logging discipline). A no-op for
 * unauthenticated routes (webhooks, health checks, login/register). */
@Injectable()
export class RequestContextUserInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    if (request.user?.sub) {
      this.requestContext.setUserId(request.user.sub);
    }
    return next.handle();
  }
}
