import { TokenService } from './token.service';
import { hashToken } from '../../infrastructure/security/token-hash.util';
import { UserRole } from '@german-job-engine/shared-types';

describe('TokenService', () => {
  function buildService() {
    const jwtService = {
      signAsync: jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve('access-token'))
        .mockImplementationOnce(() => Promise.resolve('refresh-token')),
    };
    const config: Record<string, string> = {
      'jwt.accessSecret': 'access-secret',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.refreshExpiresIn': '7d',
    };
    const configService = { get: jest.fn((key: string) => config[key]) };
    const refreshTokenRepository = { store: jest.fn(), isValid: jest.fn(), revoke: jest.fn() };

    return {
      service: new TokenService(jwtService as any, configService as any, refreshTokenRepository as any),
      jwtService,
      refreshTokenRepository,
    };
  }

  it('issues an access/refresh pair and stores the hashed refresh token', async () => {
    const { service, jwtService, refreshTokenRepository } = buildService();

    const tokens = await service.issueTokens({ id: 'user-1', email: 'user@example.com', role: UserRole.CANDIDATE });

    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      { sub: 'user-1', email: 'user@example.com', role: UserRole.CANDIDATE },
      { secret: 'access-secret', expiresIn: '15m' },
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1', email: 'user@example.com', role: UserRole.CANDIDATE },
      { secret: 'refresh-secret', expiresIn: '7d' },
    );
    expect(refreshTokenRepository.store).toHaveBeenCalledWith(
      'user-1',
      hashToken('refresh-token'),
      expect.any(Date),
    );
  });

  it('revokes the stored refresh token on logout', async () => {
    const { service, refreshTokenRepository } = buildService();

    await service.revokeTokens('user-1');

    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('user-1');
  });
});
