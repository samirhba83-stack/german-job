import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NormalizedWebhookEvent, NormalizedWebhookEventType } from '../../domain/models/normalized-webhook-event';

export class SendGridWebhookVerificationError extends Error {}

interface SendGridEventBody {
  sg_event_id?: string;
  sg_message_id?: string;
  event?: string;
  type?: string;
  timestamp?: number;
  url?: string;
}

const EVENT_TYPE_MAP: Record<string, NormalizedWebhookEventType> = {
  delivered: 'DELIVERED',
  bounce: 'BOUNCE_HARD',
  blocked: 'BOUNCE_SOFT',
  deferred: 'BOUNCE_SOFT',
  spamreport: 'COMPLAINT',
  open: 'OPEN',
  click: 'CLICK',
};

/**
 * M28 — SendGrid's real Event Webhook signing scheme (distinct from Resend/Paddle's shared-secret
 * HMAC): an Elliptic Curve (P-256/ECDSA) key pair. SendGrid signs
 * `${X-Twilio-Email-Event-Webhook-Timestamp}${rawBody}` and the dashboard-issued base64 public
 * key verifies it — there is no shared secret to protect here (a public key, by definition, isn't
 * one), only correct verification logic. Uses Node's built-in `crypto.verify` (ECDSA support is
 * native) rather than a dependency.
 *
 * SendGrid batches multiple events in one POST (`SendGridEventBody[]`), unlike Resend/SES's
 * one-event-per-delivery shape — `verifyBatch` returns every normalized event from the payload.
 */
@Injectable()
export class SendGridWebhookVerifier {
  constructor(private readonly config: ConfigService) {}

  verifyBatch(rawBody: Buffer, headers: { signature?: string; timestamp?: string }): NormalizedWebhookEvent[] {
    const publicKeyBase64 = this.config.get<string>('emailInfrastructure.sendgrid.webhookVerificationKey', '');
    if (!publicKeyBase64) {
      throw new SendGridWebhookVerificationError('SENDGRID_WEBHOOK_VERIFICATION_KEY is not configured.');
    }
    if (!headers.signature || !headers.timestamp) {
      throw new SendGridWebhookVerificationError('Missing signature/timestamp header(s).');
    }

    const toleranceSeconds = this.config.get<number>('emailInfrastructure.webhookToleranceSeconds', 300);
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(headers.timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new SendGridWebhookVerificationError(`Timestamp outside tolerance window (${ageSeconds.toFixed(0)}s).`);
    }

    const publicKey = createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    const payload = Buffer.concat([Buffer.from(headers.timestamp, 'utf8'), rawBody]);
    const signatureValid = cryptoVerify('sha256', payload, publicKey, Buffer.from(headers.signature, 'base64'));
    if (!signatureValid) {
      throw new SendGridWebhookVerificationError('Signature mismatch.');
    }

    let parsed: SendGridEventBody[];
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new SendGridWebhookVerificationError('Body is not valid JSON array.');
    }
    if (!Array.isArray(parsed)) {
      throw new SendGridWebhookVerificationError('Body is not a JSON array of events.');
    }

    return parsed
      .filter((event): event is SendGridEventBody & { sg_event_id: string; sg_message_id: string; event: string } =>
        Boolean(event.sg_event_id && event.sg_message_id && event.event))
      .map((event) => ({
        providerEventId: event.sg_event_id,
        providerMessageId: event.sg_message_id,
        eventType: EVENT_TYPE_MAP[event.event] ?? 'OTHER',
        occurredAt: event.timestamp ? new Date(event.timestamp * 1000) : new Date(),
        detail: `SendGrid event "${event.event}"`,
        clickedUrl: event.event === 'click' ? (event.url ?? null) : null,
      }));
  }
}
