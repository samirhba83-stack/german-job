import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { SendGridWebhookVerifier, SendGridWebhookVerificationError } from './sendgrid-webhook-verifier';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PUBLIC_KEY_BASE64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

function fakeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'emailInfrastructure.sendgrid.webhookVerificationKey': PUBLIC_KEY_BASE64,
    'emailInfrastructure.webhookToleranceSeconds': 300,
    ...overrides,
  };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

function sign(timestamp: string, body: string): string {
  const payload = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(body, 'utf8')]);
  return cryptoSign('sha256', payload, privateKey).toString('base64');
}

const EVENTS_BODY = JSON.stringify([
  { sg_event_id: 'evt_1', sg_message_id: 'msg_abc', event: 'delivered', timestamp: 1735689600 },
  { sg_event_id: 'evt_2', sg_message_id: 'msg_def', event: 'click', timestamp: 1735689601, url: 'https://example.com/apply' },
]);

describe('SendGridWebhookVerifier (real ECDSA scheme)', () => {
  it('accepts a correctly signed batch and normalizes every event', () => {
    const verifier = new SendGridWebhookVerifier(fakeConfig());
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(timestamp, EVENTS_BODY);

    const events = verifier.verifyBatch(Buffer.from(EVENTS_BODY), { signature, timestamp });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ providerEventId: 'evt_1', providerMessageId: 'msg_abc', eventType: 'DELIVERED' });
    expect(events[1]).toMatchObject({ providerEventId: 'evt_2', eventType: 'CLICK', clickedUrl: 'https://example.com/apply' });
  });

  it('rejects a tampered body', () => {
    const verifier = new SendGridWebhookVerifier(fakeConfig());
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(timestamp, EVENTS_BODY);
    const tampered = EVENTS_BODY.replace('delivered', 'bounce');

    expect(() => verifier.verifyBatch(Buffer.from(tampered), { signature, timestamp })).toThrow(SendGridWebhookVerificationError);
  });

  it('rejects a signature produced by a different key pair (forged)', () => {
    const verifier = new SendGridWebhookVerifier(fakeConfig());
    const timestamp = String(Math.floor(Date.now() / 1000));
    const { privateKey: attackerKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const payload = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(EVENTS_BODY, 'utf8')]);
    const forged = cryptoSign('sha256', payload, attackerKey).toString('base64');

    expect(() => verifier.verifyBatch(Buffer.from(EVENTS_BODY), { signature: forged, timestamp })).toThrow(SendGridWebhookVerificationError);
  });

  it('rejects a stale timestamp outside the tolerance window', () => {
    const verifier = new SendGridWebhookVerifier(fakeConfig());
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = sign(staleTimestamp, EVENTS_BODY);

    expect(() => verifier.verifyBatch(Buffer.from(EVENTS_BODY), { signature, timestamp: staleTimestamp })).toThrow(SendGridWebhookVerificationError);
  });

  it('fails closed when no verification key is configured', () => {
    const verifier = new SendGridWebhookVerifier(fakeConfig({ 'emailInfrastructure.sendgrid.webhookVerificationKey': '' }));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(timestamp, EVENTS_BODY);

    expect(() => verifier.verifyBatch(Buffer.from(EVENTS_BODY), { signature, timestamp })).toThrow(SendGridWebhookVerificationError);
  });

  it('rejects a non-array body', () => {
    const verifier = new SendGridWebhookVerifier(fakeConfig());
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ not: 'an array' });
    const signature = sign(timestamp, body);

    expect(() => verifier.verifyBatch(Buffer.from(body), { signature, timestamp })).toThrow(SendGridWebhookVerificationError);
  });
});
