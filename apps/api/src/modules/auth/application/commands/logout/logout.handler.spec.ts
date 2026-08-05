import { LogoutHandler } from './logout.handler';
import { LogoutCommand } from './logout.command';

describe('LogoutHandler', () => {
  it('revokes the refresh token for the given user', async () => {
    const tokenService = { revokeTokens: jest.fn().mockResolvedValue(undefined) };
    const handler = new LogoutHandler(tokenService as any);

    await handler.execute(new LogoutCommand('user-1'));

    expect(tokenService.revokeTokens).toHaveBeenCalledWith('user-1');
  });
});
