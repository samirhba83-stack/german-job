import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';

/**
 * M27 Phase 17 — real Postgres concurrency tests. Requires a live database reachable via
 * `DATABASE_URL` (the same local Postgres every other `pnpm --filter api start:dev` run already
 * needs — `docker compose up -d postgres`); deliberately excluded from the default `pnpm test` /
 * CI `test` job (see package.json's `testPathIgnorePatterns` — CI has no Postgres service), and
 * run on demand via `pnpm test:concurrency`.
 *
 * What this actually proves: `WebhookProcessingService.processWebhook` and
 * `CheckoutService.startCheckout` both do a check-then-act read (`findByProviderEventId` /
 * `findByIdempotencyKey`) before their own insert — under a genuine race (two requests for the
 * identical Paddle event, or two rapid double-clicks reusing the same client-generated
 * idempotency key) both could pass that read before either write commits. The real backstop isn't
 * the application-level check; it's the DB-level `@unique` constraint on `providerEventId` /
 * `idempotencyKey` (schema.prisma). This test skips the application layer's own read-then-write
 * (which isn't itself atomic) and fires the raw concurrent inserts directly, to prove the
 * constraint that actually has to hold under a race — the DB layer beneath the application-level
 * check — genuinely rejects the second one rather than silently allowing two rows.
 */
describe('Billing DB-level uniqueness constraints under real concurrency', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('WebhookEvent.providerEventId: two concurrent inserts for the same Paddle event — exactly one succeeds', async () => {
    const providerEventId = `test-concurrency-webhook-${randomUUID()}`;

    const attempt = () =>
      prisma.webhookEvent.create({
        data: {
          id: randomUUID(),
          providerEventId,
          eventType: 'subscription.activated',
          signatureValid: true,
          rawPayloadHash: 'test-hash',
        },
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('P2002'); // Prisma unique-constraint violation

    const rows = await prisma.webhookEvent.findMany({ where: { providerEventId } });
    expect(rows).toHaveLength(1);

    await prisma.webhookEvent.deleteMany({ where: { providerEventId } });
  });

  it('CheckoutSession.idempotencyKey: two concurrent inserts for the same idempotency key — exactly one succeeds', async () => {
    const idempotencyKey = `test-concurrency-checkout-${randomUUID()}`;
    const userId = randomUUID();

    const attempt = () =>
      prisma.checkoutSession.create({
        data: {
          id: randomUUID(),
          userId,
          planCode: 'PROFESSIONAL',
          idempotencyKey,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('P2002');

    const rows = await prisma.checkoutSession.findMany({ where: { idempotencyKey } });
    expect(rows).toHaveLength(1);

    await prisma.checkoutSession.deleteMany({ where: { idempotencyKey } });
  });
});
