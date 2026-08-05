import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetUserHandler } from './get-user.handler';
import { GetUserQuery } from './get-user.query';
import { UserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserRole } from '@german-job-engine/shared-types';

describe('GetUserHandler', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let handler: GetUserHandler;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new GetUserHandler(userRepository);
  });

  it('returns a UserResponseDto when the requester looks up their own record', async () => {
    const user = User.reconstitute('user-1', {
      email: Email.create('found@example.com'),
      passwordHash: 'hash',
      role: UserRole.CANDIDATE,
      createdAt: new Date('2026-01-01'),
    });
    userRepository.findById.mockResolvedValue(user);

    const result = await handler.execute(new GetUserQuery('user-1', UserRole.CANDIDATE, 'user-1'));

    expect(result).toEqual({
      id: 'user-1',
      email: 'found@example.com',
      role: UserRole.CANDIDATE,
      createdAt: new Date('2026-01-01'),
    });
  });

  it('returns a UserResponseDto for Admin looking up another user', async () => {
    const user = User.reconstitute('user-1', {
      email: Email.create('found@example.com'),
      passwordHash: 'hash',
      role: UserRole.CANDIDATE,
      createdAt: new Date('2026-01-01'),
    });
    userRepository.findById.mockResolvedValue(user);

    const result = await handler.execute(new GetUserQuery('user-1', UserRole.ADMIN, 'admin-1'));

    expect(result.id).toBe('user-1');
  });

  it('throws ForbiddenException when a non-admin looks up a different user', async () => {
    await expect(
      handler.execute(new GetUserQuery('user-1', UserRole.CANDIDATE, 'user-2')),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetUserQuery('missing', UserRole.ADMIN, 'admin-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
