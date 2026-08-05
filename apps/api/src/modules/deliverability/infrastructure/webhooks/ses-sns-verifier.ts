import { createVerify } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { NormalizedWebhookEvent, NormalizedWebhookEventType } from '../../domain/models/normalized-webhook-event';

export class SesSnsVerificationError extends Error {}

interface SnsEnvelope {
  Type?: string;
  MessageId?: string;
  TopicArn?: string;
  Message?: string;
  Subject?: string;
  Timestamp?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  SubscribeURL?: string;
  Token?: string;
}

interface SesNotificationMessage {
  notificationType?: 'Bounce' | 'Complaint' | 'Delivery';
  mail?: { messageId?: string; timestamp?: string };
  bounce?: { bounceType?: string; bounceSubType?: string };
  complaint?: { complaintFeedbackType?: string };
  delivery?: { timestamp?: string };
}

export type SesSnsVerificationResult =
  | { kind: 'SUBSCRIPTION_CONFIRMATION'; subscribeUrl: string }
  | { kind: 'EVENT'; event: NormalizedWebhookEvent };

/** Amazon SNS's own signing-certificate host pattern — real, necessary SSRF/spoofing protection:
 * `SigningCertURL` is attacker-controlled input inside the JSON body, so it must be validated to
 * actually be a genuine AWS SNS certificate host *before* this application ever fetches it. */
const SNS_CERT_HOST_PATTERN = /^sns\.[a-z0-9-]+\.amazonaws\.com$/i;

const BOUNCE_TYPE_MAP: Record<string, NormalizedWebhookEventType> = {
  Permanent: 'BOUNCE_HARD',
  Transient: 'BOUNCE_SOFT',
};

/**
 * M28 — SES delivers bounce/complaint/delivery notifications via Amazon SNS, not a direct SES
 * webhook. Real SNS message verification (hand-rolled against Node's built-in `crypto`, no AWS
 * SDK needed for this specific job — signature verification is a generic RSA-SHA1/SHA256 check
 * over a canonical string AWS documents publicly): fetch the signing certificate from
 * `SigningCertURL` (host-validated first — see `SNS_CERT_HOST_PATTERN`), build the exact
 * field-ordered string-to-sign AWS specifies, and verify with the certificate's public key.
 *
 * `Type: SubscriptionConfirmation` is SNS's own real handshake — this application must fetch the
 * given `SubscribeURL` once to complete the subscription; this class only *identifies* that case
 * (returns the URL) and never fetches it itself, since making an outbound HTTP call is a real
 * side effect that belongs in the calling service/controller, not inside a "verify a signature"
 * unit.
 *
 * REQUIRED CALL ORDER (enforced by `EmailWebhookProcessingService`, not by the type system —
 * documented explicitly here since getting this backwards would mean trusting an unverified
 * payload): 1) `assertRealSnsHost(envelope.SigningCertURL)` + fetch the certificate,
 * 2) `verifySignature(rawBody, certPem)` — throws on any mismatch, 3) only then `parse(rawBody)`
 * to get the actual normalized event. `parse()` performs no cryptographic check itself — it is
 * named `parse`, not `verify`, specifically so it can never be mistaken for the security check.
 */
@Injectable()
export class SesSnsVerifier {
  parse(rawBody: Buffer): SesSnsVerificationResult {
    let envelope: SnsEnvelope;
    try {
      envelope = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new SesSnsVerificationError('Body is not valid JSON.');
    }

    this.verifySignatureFields(envelope);

    if (envelope.Type === 'SubscriptionConfirmation') {
      if (!envelope.SubscribeURL) {
        throw new SesSnsVerificationError('SubscriptionConfirmation is missing SubscribeURL.');
      }
      this.assertRealSnsHost(envelope.SubscribeURL);
      return { kind: 'SUBSCRIPTION_CONFIRMATION', subscribeUrl: envelope.SubscribeURL };
    }

    if (envelope.Type !== 'Notification') {
      throw new SesSnsVerificationError(`Unsupported SNS message type "${envelope.Type}".`);
    }
    if (!envelope.Message || !envelope.MessageId) {
      throw new SesSnsVerificationError('Notification is missing Message or MessageId.');
    }

    let sesMessage: SesNotificationMessage;
    try {
      sesMessage = JSON.parse(envelope.Message);
    } catch {
      throw new SesSnsVerificationError('SNS Message field is not valid JSON.');
    }
    const providerMessageId = sesMessage.mail?.messageId;
    if (!providerMessageId || !sesMessage.notificationType) {
      throw new SesSnsVerificationError('SES notification is missing mail.messageId or notificationType.');
    }

    return {
      kind: 'EVENT',
      event: {
        providerEventId: envelope.MessageId,
        providerMessageId,
        eventType: this.mapEventType(sesMessage),
        occurredAt: envelope.Timestamp ? new Date(envelope.Timestamp) : new Date(),
        detail: `SES notification "${sesMessage.notificationType}"${sesMessage.bounce?.bounceType ? ` (${sesMessage.bounce.bounceType})` : ''}`,
        clickedUrl: null,
      },
    };
  }

  /** The real cryptographic check — separated out so the `SigningCertURL` fetch (a real network
   * call) is the caller's own explicit step, matching this codebase's "no hidden I/O inside a
   * pure verification unit" convention. Must be called, and must not throw, before `parse()`'s
   * result is trusted — see this class's own doc comment for the required order. */
  verifySignature(rawBody: Buffer, certificatePem: string): void {
    const envelope = JSON.parse(rawBody.toString('utf8')) as SnsEnvelope;
    const stringToSign = this.buildStringToSign(envelope);
    if (!envelope.Signature) {
      throw new SesSnsVerificationError('Missing Signature field.');
    }
    const algorithm = envelope.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
    const verifier = createVerify(algorithm);
    verifier.update(stringToSign, 'utf8');
    const valid = verifier.verify(certificatePem, envelope.Signature, 'base64');
    if (!valid) {
      throw new SesSnsVerificationError('SNS signature mismatch.');
    }
  }

  assertRealSnsHost(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new SesSnsVerificationError(`Malformed URL: ${url}`);
    }
    if (parsed.protocol !== 'https:' || !SNS_CERT_HOST_PATTERN.test(parsed.hostname)) {
      throw new SesSnsVerificationError(`URL host "${parsed.hostname}" is not a real Amazon SNS host — refusing to fetch it.`);
    }
  }

  private verifySignatureFields(envelope: SnsEnvelope): void {
    if (!envelope.Type || !envelope.MessageId || !envelope.Timestamp || !envelope.Signature || !envelope.SigningCertURL) {
      throw new SesSnsVerificationError('Missing one or more required SNS envelope fields.');
    }
    this.assertRealSnsHost(envelope.SigningCertURL);
  }

  private buildStringToSign(envelope: SnsEnvelope): string {
    const pairs: [string, string | undefined][] =
      envelope.Type === 'Notification'
        ? [
            ['Message', envelope.Message],
            ['MessageId', envelope.MessageId],
            ...(envelope.Subject !== undefined ? ([['Subject', envelope.Subject]] as [string, string][]) : []),
            ['Timestamp', envelope.Timestamp],
            ['TopicArn', envelope.TopicArn],
            ['Type', envelope.Type],
          ]
        : [
            ['Message', envelope.Message],
            ['MessageId', envelope.MessageId],
            ['SubscribeURL', envelope.SubscribeURL],
            ['Timestamp', envelope.Timestamp],
            ...(envelope.Token !== undefined ? ([['Token', envelope.Token]] as [string, string][]) : []),
            ['TopicArn', envelope.TopicArn],
            ['Type', envelope.Type],
          ];

    return pairs.map(([key, value]) => `${key}\n${value ?? ''}\n`).join('');
  }

  private mapEventType(message: SesNotificationMessage): NormalizedWebhookEventType {
    if (message.notificationType === 'Delivery') return 'DELIVERED';
    if (message.notificationType === 'Complaint') return 'COMPLAINT';
    if (message.notificationType === 'Bounce') {
      return BOUNCE_TYPE_MAP[message.bounce?.bounceType ?? ''] ?? 'BOUNCE_SOFT';
    }
    return 'OTHER';
  }
}
