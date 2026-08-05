import { LoginHandler } from './login.handler';
import { LoginCommand } from './login.command';
import { UserRole } from '@german-job-engine/shared-types';

describe('LoginHandler', () => {
  it('issues tokens for the already-authenticated principal', async () => {
    const tokenService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
    const handler = new LoginHandler(tokenService as any);

    const result = await handler.execute(new LoginCommand('user-1', 'user@example.com', UserRole.CANDIDATE));

    expect(tokenService.issueTokens).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.CANDIDATE,
    });
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
