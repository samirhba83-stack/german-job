import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ResendWebhookVerifier, ResendWebhookVerificationError } from './resend-webhook-verifier';

const SECRET_BASE64 = Buffer.from('test-resend-secret-bytes-0123456789').toString('base64');
const SECRET = `whsec_${SECRET_BASE64}`;

function fakeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'emailInfrastructure.resend.webhookSecret': SECRET,
    'emailInfrastructure.webhookToleranceSeconds': 300,
    ...overrides,
  };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

function sign(svixId: string, svixTimestamp: string, body: string, secret: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const hash = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  return `v1,${hash}`;
}

const BODY = JSON.stringify({ type: 'email.delivered', created_at: '2026-07-30T00:00:00.000Z', data: { email_id: 'msg_123' } });

describe('ResendWebhookVerifier (real Svix HMAC scheme)', () => {
  it('accepts a correctly signed, fresh payload and normalizes the event', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig());
    const svixId = 'msg_evt_1';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(svixId, svixTimestamp, BODY, SECRET);

    const event = verifier.verify(Buffer.from(BODY), { svixId, svixTimestamp, svixSignature: signature });

    expect(event.providerEventId).toBe(svixId);
    expect(event.providerMessageId).toBe('msg_123');
    expect(event.eventType).toBe('DELIVERED');
  });

  it('accepts when svix-signature carries multiple space-separated values (secret rotation)', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig());
    const svixId = 'msg_evt_2';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const real = sign(svixId, svixTimestamp, BODY, SECRET);
    const bogus = 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    const event = verifier.verify(Buffer.from(BODY), { svixId, svixTimestamp, svixSignature: `${bogus} ${real}` });
    expect(event.providerEventId).toBe(svixId);
  });

  it('rejects a missing header', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig());
    expect(() => verifier.verify(Buffer.from(BODY), { svixId: 'x', svixTimestamp: '1' })).toThrow(ResendWebhookVerificationError);
  });

  it('rejects a tampered body', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig());
    const svixId = 'msg_evt_3';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(svixId, svixTimestamp, BODY, SECRET);
    const tampered = BODY.replace('email.delivered', 'email.bounced');

    expect(() => verifier.verify(Buffer.from(tampered), { svixId, svixTimestamp, svixSignature: signature })).toThrow(ResendWebhookVerificationError);
  });

  it('rejects a forged signature made with the wrong secret', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig());
    const svixId = 'msg_evt_4';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const forged = sign(svixId, svixTimestamp, BODY, 'whsec_' + Buffer.from('attacker-secret').toString('base64'));

    expect(() => verifier.verify(Buffer.from(BODY), { svixId, svixTimestamp, svixSignature: forged })).toThrow(ResendWebhookVerificationError);
  });

  it('rejects a stale timestamp outside the tolerance window (replay protection)', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig());
    const svixId = 'msg_evt_5';
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = sign(svixId, staleTimestamp, BODY, SECRET);

    expect(() => verifier.verify(Buffer.from(BODY), { svixId, svixTimestamp: staleTimestamp, svixSignature: signature })).toThrow(ResendWebhookVerificationError);
  });

  it('fails closed when RESEND_WEBHOOK_SECRET is not configured', () => {
    const verifier = new ResendWebhookVerifier(fakeConfig({ 'emailInfrastructure.resend.webhookSecret': '' }));
    const svixId = 'msg_evt_6';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(svixId, svixTimestamp, BODY, SECRET);

    expect(() => verifier.verify(Buffer.from(BODY), { svixId, svixTimestamp, svixSignature: signature })).toThrow(ResendWebhookVerificationError);
  });
});
