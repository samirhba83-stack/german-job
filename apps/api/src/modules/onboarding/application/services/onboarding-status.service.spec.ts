import { NotFoundException } from '@nestjs/common';
import { OnboardingStatusService } from './onboarding-status.service';

describe('OnboardingStatusService', () => {
  const user = { id: 'user-1', createdAt: new Date('2026-01-01T00:00:00.000Z') };

  function buildService(overrides: {
    profile?: { calculateCompletionPercentage: () => number } | null;
    mailbox?: unknown | null;
    campaigns?: unknown[];
    mailboxConfigured?: boolean;
  } = {}) {
    const users = { findById: jest.fn().mockResolvedValue(user) };
    const profiles = { findByUserId: jest.fn().mockResolvedValue(overrides.profile ?? null) };
    const mailboxes = { findActiveByUserId: jest.fn().mockResolvedValue(overrides.mailbox ?? null) };
    const campaigns = { findByOwnerId: jest.fn().mockResolvedValue(overrides.campaigns ?? []) };
    const mailboxConfigured = overrides.mailboxConfigured ?? false;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'connectedMailbox.tokenEncryption.key') return mailboxConfigured ? 'a-key' : '';
        if (key === 'connectedMailbox.google.clientId') return mailboxConfigured ? 'a-client-id' : '';
        if (key === 'connectedMailbox.microsoft.clientId') return '';
        return undefined;
      }),
    };
    const service = new OnboardingStatusService(users as any, profiles as any, mailboxes as any, campaigns as any, config as any);
    return { service, users, profiles, mailboxes, campaigns };
  }

  function stepById<T extends { id: string }>(steps: T[], id: string): T | undefined {
    return steps.find((step) => step.id === id);
  }

  it('throws NotFoundException when the user does not exist', async () => {
    const { service, users } = buildService();
    users.findById.mockResolvedValue(null);

    await expect(service.getStatus('missing')).rejects.toThrow(NotFoundException);
  });

  it('reports a brand-new account with nothing set up yet', async () => {
    const { service } = buildService();

    const status = await service.getStatus('user-1');

    expect(status.profileCompletionPercentage).toBe(0);
    expect(stepById(status.steps, 'account')?.state).toBe('complete');
    expect(stepById(status.steps, 'profile')?.state).toBe('incomplete');
    expect(stepById(status.steps, 'campaign')?.state).toBe('incomplete');
    expect(status.productionSafetyNotice).toContain('Controlled Closed Beta');
  });

  it('reports the mailbox step as unavailable (not incomplete) when no real OAuth is configured', async () => {
    const { service } = buildService({ mailboxConfigured: false });

    const status = await service.getStatus('user-1');

    expect(stepById(status.steps, 'connect-mailbox')?.state).toBe('unavailable');
  });

  it('reports the mailbox step as incomplete (not unavailable) once OAuth is configured but nothing is connected', async () => {
    const { service } = buildService({ mailboxConfigured: true, mailbox: null });

    const status = await service.getStatus('user-1');

    expect(stepById(status.steps, 'connect-mailbox')?.state).toBe('incomplete');
  });

  it('reports the mailbox step as complete once a mailbox is connected', async () => {
    const { service } = buildService({ mailboxConfigured: true, mailbox: { id: 'mailbox-1' } });

    const status = await service.getStatus('user-1');

    expect(stepById(status.steps, 'connect-mailbox')?.state).toBe('complete');
  });

  it('reports the profile step complete only at 100% completion', async () => {
    const { service } = buildService({ profile: { calculateCompletionPercentage: () => 80 } });

    const status = await service.getStatus('user-1');

    expect(stepById(status.steps, 'profile')?.state).toBe('incomplete');
    expect(status.profileCompletionPercentage).toBe(80);
  });

  it('reports the profile step complete at 100%', async () => {
    const { service } = buildService({ profile: { calculateCompletionPercentage: () => 100 } });

    const status = await service.getStatus('user-1');

    expect(stepById(status.steps, 'profile')?.state).toBe('complete');
  });

  it('reports the campaign step complete once at least one campaign exists', async () => {
    const { service } = buildService({ campaigns: [{ id: 'campaign-1' }] });

    const status = await service.getStatus('user-1');

    expect(stepById(status.steps, 'campaign')?.state).toBe('complete');
  });
});
