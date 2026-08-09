import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GmailInboxWebhookController } from './gmail-inbox-webhook.controller';

/** M31.1 Phase 10 — real, previously-missing coverage for this controller, found during the
 * "Production Webhook Gate Review." Real evidence, not assumed, that the auth token check, the
 * cross-user mailbox lookup, and the PRODUCTION_WEBHOOK_PROCESSING_ENABLED gate all behave as
 * documented. */
describe('GmailInboxWebhookController', () => {
  const EXPECTED_TOKEN = 'a-real-push-auth-token';

  function harness(overrides: { pushAuthAudience?: string; productionWebhookProcessingEnabled?: boolean } = {}) {
    const mailboxes = { findByProviderAndEmailAddress: jest.fn() };
    const polling = { pollMailbox: jest.fn().mockResolvedValue(undefined) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const flags: Record<string, unknown> = {
      'inboxIntelligence.google.pushAuthAudience': overrides.pushAuthAudience ?? EXPECTED_TOKEN,
      'productionSafety.productionWebhookProcessingEnabled': overrides.productionWebhookProcessingEnabled ?? false,
    };
    const config = { get: jest.fn((key: string, defaultValue?: unknown) => flags[key] ?? defaultValue) };

    const controller = new GmailInboxWebhookController(mailboxes as any, polling as any, audit as any, config as any);
    return { controller, mailboxes, polling, audit };
  }

  function envelope(emailAddress = 'candidate@gmail.com') {
    return { message: { data: Buffer.from(JSON.stringify({ emailAddress, historyId: 1 })).toString('base64') } };
  }

  it('rejects a request with a missing or wrong token before any other processing', async () => {
    const { controller, mailboxes } = harness();
    await expect(controller.receive('wrong-token', envelope())).rejects.toThrow(UnauthorizedException);
    expect(mailboxes.findByProviderAndEmailAddress).not.toHaveBeenCalled();
  });

  it('rejects when no push auth audience is configured at all (fails closed, never "open by omission")', async () => {
    const { controller } = harness({ pushAuthAudience: '' });
    await expect(controller.receive(EXPECTED_TOKEN, envelope())).rejects.toThrow(UnauthorizedException);
  });

  it('rejects malformed Pub/Sub message data', async () => {
    const { controller } = harness();
    await expect(controller.receive(EXPECTED_TOKEN, { message: { data: 'not-valid-base64-json!!!' } })).rejects.toThrow(BadRequestException);
  });

  it('silently ignores a notification for a mailbox this application does not track, without auditing or polling', async () => {
    const { controller, mailboxes, audit, polling } = harness();
    mailboxes.findByProviderAndEmailAddress.mockResolvedValue(null);

    await controller.receive(EXPECTED_TOKEN, envelope());

    expect(audit.record).not.toHaveBeenCalled();
    expect(polling.pollMailbox).not.toHaveBeenCalled();
  });

  it('audits the notification but does NOT poll when production webhook processing is disabled (the default)', async () => {
    const { controller, mailboxes, audit, polling } = harness({ productionWebhookProcessingEnabled: false });
    const mailbox = { id: 'mailbox-1', userId: 'user-1' };
    mailboxes.findByProviderAndEmailAddress.mockResolvedValue(mailbox);

    await controller.receive(EXPECTED_TOKEN, envelope());

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INBOX_CHANGE_RECEIVED', connectedMailboxId: 'mailbox-1' }));
    expect(polling.pollMailbox).not.toHaveBeenCalled();
  });

  it('audits AND polls once production webhook processing is enabled', async () => {
    const { controller, mailboxes, audit, polling } = harness({ productionWebhookProcessingEnabled: true });
    const mailbox = { id: 'mailbox-1', userId: 'user-1' };
    mailboxes.findByProviderAndEmailAddress.mockResolvedValue(mailbox);

    await controller.receive(EXPECTED_TOKEN, envelope());

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(polling.pollMailbox).toHaveBeenCalledWith(mailbox);
  });
});
