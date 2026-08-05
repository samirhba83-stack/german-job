import { Controller, Headers, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { EmailWebhookProcessingService } from '../../application/services/email-webhook-processing.service';

/**
 * M28 — the only entry points that can ever mark a real email delivered/bounced/complained/
 * opened/clicked. None of these are behind `JwtAuthGuard` — each provider is authenticated by its
 * own cryptographic signature (verified inside `EmailWebhookProcessingService`), not a bearer
 * token, matching the M27 billing webhook controller's identical reasoning. Reads `req.rawBody`
 * (main.ts's app-wide `rawBody: true`) rather than the parsed body — every one of these signature
 * schemes is byte-exact. Excluded from Swagger — none of these is a documented public API surface.
 */
@ApiExcludeController()
@Controller('email-webhooks')
export class EmailWebhooksController {
  constructor(private readonly webhookProcessing: EmailWebhookProcessingService) {}

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async resend(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ): Promise<{ status: string }> {
    if (!request.rawBody) throw new UnauthorizedException('Missing raw request body.');
    const outcome = await this.webhookProcessing.processResend(request.rawBody, { svixId, svixTimestamp, svixSignature });
    if (outcome === 'REJECTED') throw new UnauthorizedException('Webhook rejected.');
    return { status: outcome.toLowerCase() };
  }

  @Post('sendgrid')
  @HttpCode(HttpStatus.OK)
  async sendgrid(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-twilio-email-event-webhook-signature') signature?: string,
    @Headers('x-twilio-email-event-webhook-timestamp') timestamp?: string,
  ): Promise<{ status: string }> {
    if (!request.rawBody) throw new UnauthorizedException('Missing raw request body.');
    const outcome = await this.webhookProcessing.processSendGrid(request.rawBody, { signature, timestamp });
    if (outcome === 'REJECTED') throw new UnauthorizedException('Webhook rejected.');
    return { status: outcome.toLowerCase() };
  }

  /** SNS POSTs with `Content-Type: text/plain` by its own convention (not `application/json`) —
   * still real JSON in the body; `main.ts`'s raw-body capture doesn't depend on the declared
   * content type, so this needs no special handling beyond reading `req.rawBody` like every
   * other webhook here. */
  @Post('ses')
  @HttpCode(HttpStatus.OK)
  async ses(@Req() request: RawBodyRequest<Request>): Promise<{ status: string }> {
    if (!request.rawBody) throw new UnauthorizedException('Missing raw request body.');
    const { outcome } = await this.webhookProcessing.processSes(request.rawBody);
    if (outcome === 'REJECTED') throw new UnauthorizedException('Webhook rejected.');
    return { status: outcome.toLowerCase() };
  }
}
