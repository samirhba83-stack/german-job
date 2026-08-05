import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenHandler } from './refresh-token.handler';
import { RefreshTokenCommand } from './refresh-token.command';
import { hashToken } from '../../../infrastructure/security/token-hash.util';
import { User } from '../../../../users/domain/entities/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.vo';
import { UserRole } from '@german-job-engine/shared-types';

describe('RefreshTokenHandler', () => {
  const user = User.reconstitute('user-1', {
    email: Email.create('user@example.com'),
    passwordHash: 'hash',
    role: UserRole.CANDIDATE,
    createdAt: new Date(),
  });

  function buildHandler(overrides?: { isValid?: boolean; userExists?: boolean }) {
    const refreshTokenRepository = {
      store: jest.fn(),
      isValid: jest.fn().mockResolvedValue(overrides?.isValid ?? true),
      revoke: jest.fn(),
    };
    const userRepository = {
      findById: jest.fn().mockResolvedValue(overrides?.userExists === false ? null : user),
      findByEmail: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const tokenService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };

    return {
      handler: new RefreshTokenHandler(refreshTokenRepository as any, userRepository as any, tokenService as any),
      refreshTokenRepository,
      userRepository,
      tokenService,
    };
  }

  it('rotates tokens when the presented refresh token is valid', async () => {
    const { handler, refreshTokenRepository, tokenService } = buildHandler({ isValid: true });

    const result = await handler.execute(new RefreshTokenCommand('user-1', 'raw-refresh-token'));

    expect(refreshTokenRepository.isValid).toHaveBeenCalledWith('user-1', hashToken('raw-refresh-token'));
    expect(tokenService.issueTokens).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.CANDIDATE,
    });
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('throws UnauthorizedException when the token hash does not match the stored one', async () => {
    const { handler, tokenService } = buildHandler({ isValid: false });

    await expect(handler.execute(new RefreshTokenCommand('user-1', 'stale-token'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the user no longer exists', async () => {
    const { handler } = buildHandler({ isValid: true, userExists: false });

    await expect(handler.execute(new RefreshTokenCommand('user-1', 'raw-refresh-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
