import { ForbiddenException } from '@nestjs/common';
import { RegisterHandler } from './register.handler';
import { RegisterCommand } from './register.command';
import { CreateUserCommand } from '../../../../users/application/commands/create-user/create-user.command';
import { UserRole } from '@german-job-engine/shared-types';

describe('RegisterHandler', () => {
  const createdUser = {
    id: 'user-1',
    email: 'new@example.com',
    role: UserRole.CANDIDATE,
    createdAt: new Date(),
  };

  function buildHandler(publicRegistrationEnabled: boolean, closedBetaEnabled = true) {
    const commandBus = { execute: jest.fn().mockResolvedValue(createdUser) };
    const tokenService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
    const invitations = {
      checkEligible: jest.fn().mockResolvedValue({ eligible: true }),
      redeem: jest.fn().mockResolvedValue({ ok: true, invitation: {}, reason: null }),
    };
    const flags: Record<string, boolean> = {
      'betaAccess.publicRegistrationEnabled': publicRegistrationEnabled,
      'betaAccess.closedBetaEnabled': closedBetaEnabled,
    };
    const config = { get: jest.fn((key: string) => flags[key]) };
    const handler = new RegisterHandler(commandBus as any, tokenService as any, invitations as any, config as any);
    return { handler, commandBus, tokenService, invitations, config };
  }

  it('delegates user creation to the Users context then issues tokens when open registration is enabled', async () => {
    const { handler, commandBus, tokenService, invitations } = buildHandler(true);

    const result = await handler.execute(new RegisterCommand('new@example.com', 'password123'));

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining(new CreateUserCommand('new@example.com', 'password123')),
    );
    expect(invitations.checkEligible).not.toHaveBeenCalled();
    expect(tokenService.issueTokens).toHaveBeenCalledWith(createdUser);
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('rejects registration outright when Closed Beta itself is disabled (Emergency Stop position), even with an invitation code', async () => {
    const { handler, commandBus, invitations } = buildHandler(false, false);

    await expect(
      handler.execute(new RegisterCommand('new@example.com', 'password123', 'valid-code')),
    ).rejects.toThrow(ForbiddenException);
    expect(invitations.checkEligible).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects registration during Closed Beta when no invitation code is provided', async () => {
    const { handler, commandBus } = buildHandler(false);

    await expect(handler.execute(new RegisterCommand('new@example.com', 'password123'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects registration during Closed Beta when the invitation is not eligible', async () => {
    const { handler, commandBus, invitations } = buildHandler(false);
    invitations.checkEligible.mockResolvedValue({ eligible: false, reason: 'This invitation has expired.' });

    await expect(
      handler.execute(new RegisterCommand('new@example.com', 'password123', 'some-code')),
    ).rejects.toThrow(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('creates the user and redeems the invitation when a valid invitation code is provided', async () => {
    const { handler, commandBus, tokenService, invitations } = buildHandler(false);

    const result = await handler.execute(new RegisterCommand('new@example.com', 'password123', 'valid-code'));

    expect(invitations.checkEligible).toHaveBeenCalledWith('new@example.com', 'valid-code');
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining(new CreateUserCommand('new@example.com', 'password123')),
    );
    expect(invitations.redeem).toHaveBeenCalledWith('new@example.com', 'valid-code', createdUser.id);
    expect(tokenService.issueTokens).toHaveBeenCalledWith(createdUser);
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
