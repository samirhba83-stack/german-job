import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { User } from '../../../users/domain/entities/user.entity';
import { Email } from '../../../users/domain/value-objects/email.vo';
import { UserRole } from '@german-job-engine/shared-types';

describe('LocalStrategy', () => {
  const user = User.reconstitute('user-1', {
    email: Email.create('user@example.com'),
    passwordHash: 'stored-hash',
    role: UserRole.CANDIDATE,
    createdAt: new Date(),
  });

  function buildStrategy(overrides?: { userFound?: boolean; passwordMatches?: boolean }) {
    const userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(overrides?.userFound === false ? null : user),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(overrides?.passwordMatches ?? true),
    };

    return { strategy: new LocalStrategy(userRepository as any, passwordHasher as any), userRepository, passwordHasher };
  }

  it('returns the token subject for valid credentials', async () => {
    const { strategy } = buildStrategy();

    const result = await strategy.validate('User@Example.com', 'correct-password');

    expect(result).toEqual({ id: 'user-1', email: 'user@example.com', role: UserRole.CANDIDATE });
  });

  it('throws UnauthorizedException when no user matches the email', async () => {
    const { strategy } = buildStrategy({ userFound: false });

    await expect(strategy.validate('missing@example.com', 'password')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    const { strategy } = buildStrategy({ passwordMatches: false });

    await expect(strategy.validate('user@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
  });
});
