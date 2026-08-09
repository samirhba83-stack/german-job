import { MicrosoftGraphInboxWebhookController } from './microsoft-graph-inbox-webhook.controller';

/** M31.1 Phase 9/10 — real, previously-missing coverage for this controller. Includes a real
 * regression test for the M29 Finding #1 process-crash bug (`@Res()` passthrough footgun) and
 * coverage for the PRODUCTION_WEBHOOK_PROCESSING_ENABLED gate added in M31. */
describe('MicrosoftGraphInboxWebhookController', () => {
  const CLIENT_STATE = 'a-real-client-state-secret';

  function mockResponse() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.type = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  function harness(productionWebhookProcessingEnabled = false) {
    const mailboxes = { findById: jest.fn() };
    const watches = { findByProviderWatchId: jest.fn() };
    const polling = { pollMailbox: jest.fn().mockResolvedValue(undefined) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const flags: Record<string, unknown> = {
      'inboxIntelligence.microsoft.webhookClientState': CLIENT_STATE,
      'productionSafety.productionWebhookProcessingEnabled': productionWebhookProcessingEnabled,
    };
    const config = { get: jest.fn((key: string, defaultValue?: unknown) => flags[key] ?? defaultValue) };

    const controller = new MicrosoftGraphInboxWebhookController(mailboxes as any, watches as any, polling as any, audit as any, config as any);
    return { controller, mailboxes, watches, polling, audit };
  }

  // Regression test for M29 Finding #1: an earlier version of this handler crashed the whole
  // process on this exact request shape (`@Res({ passthrough: true })` plus a second automatic
  // Nest response send -> ERR_HTTP_HEADERS_SENT). This must never happen again.
  it('answers the Graph subscription validation handshake with the exact decoded token as plain text, and does not throw', async () => {
    const { controller } = harness();
    const res = mockResponse();

    await expect(controller.receive('the-decoded-validation-token', {}, res)).resolves.not.toThrow();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith('text/plain');
    expect(res.send).toHaveBeenCalledWith('the-decoded-validation-token');
    expect(res.json).not.toHaveBeenCalled();
  });

  it('ignores a notification with a mismatched clientState, without ever looking up the subscription', async () => {
    const { controller, watches } = harness();
    const res = mockResponse();

    await controller.receive(undefined, { value: [{ subscriptionId: 'sub-1', clientState: 'wrong-secret' }] }, res);

    expect(watches.findByProviderWatchId).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('ignores a notification for an unknown subscription id', async () => {
    const { controller, watches, audit } = harness();
    watches.findByProviderWatchId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.receive(undefined, { value: [{ subscriptionId: 'unknown-sub', clientState: CLIENT_STATE }] }, res);

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audits the notification but does NOT poll when production webhook processing is disabled (the default)', async () => {
    const { controller, watches, mailboxes, audit, polling } = harness(false);
    watches.findByProviderWatchId.mockResolvedValue({ connectedMailboxId: 'mailbox-1' });
    mailboxes.findById.mockResolvedValue({ id: 'mailbox-1', userId: 'user-1' });
    const res = mockResponse();

    await controller.receive(undefined, { value: [{ subscriptionId: 'sub-1', clientState: CLIENT_STATE }] }, res);

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INBOX_CHANGE_RECEIVED' }));
    expect(polling.pollMailbox).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('audits AND polls once production webhook processing is enabled', async () => {
    const { controller, watches, mailboxes, polling } = harness(true);
    watches.findByProviderWatchId.mockResolvedValue({ connectedMailboxId: 'mailbox-1' });
    const mailbox = { id: 'mailbox-1', userId: 'user-1' };
    mailboxes.findById.mockResolvedValue(mailbox);
    const res = mockResponse();

    await controller.receive(undefined, { value: [{ subscriptionId: 'sub-1', clientState: CLIENT_STATE }] }, res);

    expect(polling.pollMailbox).toHaveBeenCalledWith(mailbox);
  });
});
