import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Milestone 24 (Production Integration Validation) fix: this filter previously converted every
 * exception into an HTTP response without ever logging it anywhere — a real, live 500 during
 * validation produced zero trace in `docker logs`, making "verify server logs contain no
 * unexpected exceptions" impossible to check. A non-`HttpException` (an unexpected, real bug) is
 * now logged with its message and stack via Nest's own `Logger`, matching every other module's
 * existing logging convention. A real, handled `HttpException` (validation errors, 404s, 403s —
 * expected, not bugs) is not logged, to avoid drowning real exceptions in routine 4xx noise. The
 * response body sent to the client is byte-for-byte unchanged — this is purely an observability
 * fix, not a change to the public API contract.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    if (!(exception instanceof HttpException)) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`Unhandled exception on ${request.method} ${request.url}: ${error.message}`, error.stack);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
