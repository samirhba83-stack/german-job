import { Controller, Headers, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookProcessingService } from '../../application/services/webhook-processing.service';

/**
 * M27 Phase 5 — the ONLY entry point that can ever grant, renew, or revoke a paid entitlement.
 * Deliberately NOT behind JwtAuthGuard — Paddle itself is the caller, authenticated by its own
 * cryptographic signature (verified inside WebhookProcessingService), not a bearer token. Reads
 * `req.rawBody` (see main.ts's `rawBody: true`) rather than the parsed `req.body`, since
 * signature verification is byte-exact — a re-serialized JSON object would not reproduce the
 * same bytes Paddle signed. Excluded from Swagger — this is not a documented public API surface.
 */
@ApiExcludeController()
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly webhookProcessing: WebhookProcessingService) {}

  @Post('paddle')
  @HttpCode(HttpStatus.OK)
  async handlePaddleWebhook(@Req() request: RawBodyRequest<Request>, @Headers('paddle-signature') signature?: string): Promise<{ status: string }> {
    if (!request.rawBody) {
      throw new UnauthorizedException('Missing raw request body.');
    }

    const outcome = await this.webhookProcessing.processWebhook(request.rawBody, signature);

    if (outcome === 'REJECTED') {
      // A 4xx tells Paddle not to retry an unfixable request (bad signature) — retrying an
      // invalid signature would never succeed.
      throw new UnauthorizedException('Webhook rejected.');
    }

    // PROCESSED, DUPLICATE, and IGNORED_UNKNOWN_TYPE all return 200 — Paddle should not retry
    // any of these (duplicate is already handled; an unknown type is intentionally not an
    // error). A genuine processing failure (dispatch() throwing inside processWebhook) instead
    // propagates as an unhandled exception here, which the global exception filter turns into a
    // 500 — the one case Paddle SHOULD retry.
    return { status: outcome.toLowerCase() };
  }
}
