import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NormalizedWebhookEvent, NormalizedWebhookEventType } from '../../domain/models/normalized-webhook-event';

export class ResendWebhookVerificationError extends Error {}

interface ResendWebhookBody {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; to?: string[] | string };
}

const EVENT_TYPE_MAP: Record<string, NormalizedWebhookEventType> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCE_HARD',
  'email.complained': 'COMPLAINT',
  'email.opened': 'OPEN',
  'email.clicked': 'CLICK',
};

/**
 * M28 — Resend's webhooks are signed via Svix (a third-party webhook-delivery provider Resend
 * uses under the hood), not a Resend-specific scheme. Hand-rolled against the real, documented
 * Svix signing algorithm (the same reasoning as `PaddlePaymentAdapter`'s own hand-rolled webhook
 * verification, M27: a well-documented HMAC scheme doesn't justify a full SDK dependency) rather
 * than adding the `svix` package.
 *
 * Real scheme: headers `svix-id` / `svix-timestamp` / `svix-signature` (space-separated
 * `v1,<base64>` values, since a secret can be rotated with both old and new signatures present
 * briefly); signed content is `${svix-id}.${svix-timestamp}.${rawBody}`; the secret is
 * `whsec_<base64>` — the `whsec_` prefix is stripped before base64-decoding it into the real HMAC
 * key bytes.
 */
@Injectable()
export class ResendWebhookVerifier {
  constructor(private readonly config: ConfigService) {}

  verify(rawBody: Buffer, headers: { svixId?: string; svixTimestamp?: string; svixSignature?: string }): NormalizedWebhookEvent {
    const secret = this.config.get<string>('emailInfrastructure.resend.webhookSecret', '');
    if (!secret) {
      throw new ResendWebhookVerificationError('RESEND_WEBHOOK_SECRET is not configured.');
    }
    if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
      throw new ResendWebhookVerificationError('Missing svix-id/svix-timestamp/svix-signature header(s).');
    }

    const toleranceSeconds = this.config.get<number>('emailInfrastructure.webhookToleranceSeconds', 300);
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(headers.svixTimestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new ResendWebhookVerificationError(`Timestamp outside tolerance window (${ageSeconds.toFixed(0)}s).`);
    }

    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    const expectedBuffer = Buffer.from(expected, 'base64');

    const provided = headers.svixSignature.split(' ').map((part) => part.split(',')[1]).filter(Boolean);
    const matched = provided.some((candidate) => {
      const candidateBuffer = Buffer.from(candidate, 'base64');
      return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
    });
    if (!matched) {
      throw new ResendWebhookVerificationError('Signature mismatch.');
    }

    let parsed: ResendWebhookBody;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new ResendWebhookVerificationError('Body is not valid JSON.');
    }
    if (!parsed.type || !parsed.data?.email_id) {
      throw new ResendWebhookVerificationError('Missing type or data.email_id.');
    }

    return {
      providerEventId: headers.svixId,
      providerMessageId: parsed.data.email_id,
      eventType: EVENT_TYPE_MAP[parsed.type] ?? 'OTHER',
      occurredAt: parsed.created_at ? new Date(parsed.created_at) : new Date(),
      detail: `Resend event "${parsed.type}"`,
      clickedUrl: null,
    };
  }
}
