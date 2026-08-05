import { RegisterHandler } from './register.handler';
import { RegisterCommand } from './register.command';
import { CreateUserCommand } from '../../../../users/application/commands/create-user/create-user.command';
import { UserRole } from '@german-job-engine/shared-types';

describe('RegisterHandler', () => {
  it('delegates user creation to the Users context then issues tokens', async () => {
    const createdUser = {
      id: 'user-1',
      email: 'new@example.com',
      role: UserRole.CANDIDATE,
      createdAt: new Date(),
    };
    const commandBus = { execute: jest.fn().mockResolvedValue(createdUser) };
    const tokenService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };

    const handler = new RegisterHandler(commandBus as any, tokenService as any);
    const result = await handler.execute(new RegisterCommand('new@example.com', 'password123'));

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining(new CreateUserCommand('new@example.com', 'password123')),
    );
    expect(tokenService.issueTokens).toHaveBeenCalledWith(createdUser);
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
