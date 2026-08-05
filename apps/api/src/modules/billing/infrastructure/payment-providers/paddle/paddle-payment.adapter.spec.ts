import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PaddlePaymentAdapter } from './paddle-payment.adapter';
import { WebhookVerificationError } from '../../../domain/ports/payment-provider.port';

const WEBHOOK_SECRET = 'test_webhook_secret_do_not_use_in_prod';

function fakeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'billing.environment': 'sandbox',
    'billing.webhookSecret': WEBHOOK_SECRET,
    'billing.webhookToleranceSeconds': 300,
    ...overrides,
  };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

function sign(body: string, secret: string, ts: number): string {
  const hash = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${hash}`;
}

const VALID_EVENT_BODY = JSON.stringify({
  event_id: 'evt_01',
  event_type: 'subscription.activated',
  occurred_at: '2026-07-30T00:00:00.000Z',
  data: { id: 'sub_paddle_1' },
});

describe('PaddlePaymentAdapter.verifyAndParseWebhook (real Paddle-Signature scheme: ts=...;h1=...)', () => {
  it('accepts a correctly signed, fresh payload and parses event_id/event_type/data', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = sign(VALID_EVENT_BODY, WEBHOOK_SECRET, nowSeconds);

    const result = adapter.verifyAndParseWebhook(Buffer.from(VALID_EVENT_BODY), header);

    expect(result.providerEventId).toBe('evt_01');
    expect(result.eventType).toBe('subscription.activated');
    expect(result.data).toEqual({ id: 'sub_paddle_1' });
  });

  it('rejects a missing Paddle-Signature header', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    expect(() => adapter.verifyAndParseWebhook(Buffer.from(VALID_EVENT_BODY), undefined)).toThrow(WebhookVerificationError);
  });

  it('rejects a malformed header (missing ts or h1)', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    expect(() => adapter.verifyAndParseWebhook(Buffer.from(VALID_EVENT_BODY), 'not-a-real-header')).toThrow(
      WebhookVerificationError,
    );
  });

  it('rejects a tampered body against a signature computed for the original body', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = sign(VALID_EVENT_BODY, WEBHOOK_SECRET, nowSeconds);
    const tamperedBody = VALID_EVENT_BODY.replace('subscription.activated', 'subscription.canceled');

    expect(() => adapter.verifyAndParseWebhook(Buffer.from(tamperedBody), header)).toThrow(WebhookVerificationError);
  });

  it('rejects a signature produced with the wrong secret (forged webhook)', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    const nowSeconds = Math.floor(Date.now() / 1000);
    const forgedHeader = sign(VALID_EVENT_BODY, 'attacker_guessed_secret', nowSeconds);

    expect(() => adapter.verifyAndParseWebhook(Buffer.from(VALID_EVENT_BODY), forgedHeader)).toThrow(WebhookVerificationError);
  });

  it('rejects a validly-signed payload whose timestamp is outside the tolerance window (replay protection)', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig({ 'billing.webhookToleranceSeconds': 300 }));
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour old, correctly signed
    const header = sign(VALID_EVENT_BODY, WEBHOOK_SECRET, staleTimestamp);

    expect(() => adapter.verifyAndParseWebhook(Buffer.from(VALID_EVENT_BODY), header)).toThrow(WebhookVerificationError);
  });

  it('rejects when PADDLE_WEBHOOK_SECRET is not configured — fails closed, never falls back to accepting unsigned', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig({ 'billing.webhookSecret': '' }));
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = sign(VALID_EVENT_BODY, WEBHOOK_SECRET, nowSeconds);

    expect(() => adapter.verifyAndParseWebhook(Buffer.from(VALID_EVENT_BODY), header)).toThrow(WebhookVerificationError);
  });

  it('rejects a body that is not valid JSON even if correctly signed', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    const nowSeconds = Math.floor(Date.now() / 1000);
    const notJson = 'this is not json';
    const header = sign(notJson, WEBHOOK_SECRET, nowSeconds);

    expect(() => adapter.verifyAndParseWebhook(Buffer.from(notJson), header)).toThrow(WebhookVerificationError);
  });

  it('rejects a correctly signed payload missing event_id or event_type', () => {
    const adapter = new PaddlePaymentAdapter(fakeConfig());
    const incomplete = JSON.stringify({ occurred_at: '2026-07-30T00:00:00.000Z', data: {} });
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = sign(incomplete, WEBHOOK_SECRET, nowSeconds);

    expect(() => adapter.verifyAndParseWebhook(Buffer.from(incomplete), header)).toThrow(WebhookVerificationError);
  });
});
