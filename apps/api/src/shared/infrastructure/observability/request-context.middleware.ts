import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

const REQUEST_ID_HEADER = 'x-request-id';

/** M31 Phase 15 — real request IDs: reuses an inbound `X-Request-Id` if a trusted upstream proxy/
 * load balancer already set one (so a request's id stays stable end-to-end across services once a
 * real topology exists — Phase 3), otherwise mints a fresh UUID. Echoed back on the response so a
 * client/support ticket can reference the exact request. Every downstream log line for this
 * request automatically carries this id via `RequestContextService`'s `AsyncLocalStorage`. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string | undefined) || randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    this.context.run({ requestId }, () => next());
  }
}
