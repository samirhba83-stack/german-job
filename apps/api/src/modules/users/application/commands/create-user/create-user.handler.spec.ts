import { ConflictException } from '@nestjs/common';
import { CreateUserHandler } from './create-user.handler';
import { CreateUserCommand } from './create-user.command';
import { UserRepository } from '../../../domain/repositories/user.repository.interface';
import { PasswordHasher } from '../../ports/password-hasher.port';

describe('CreateUserHandler', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let eventBus: { publish: jest.Mock };
  let handler: CreateUserHandler;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      getAccountStatus: jest.fn(),
      suspend: jest.fn(),
      unsuspend: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      compare: jest.fn(),
    };
    eventBus = { publish: jest.fn() };

    handler = new CreateUserHandler(userRepository, passwordHasher, eventBus as any);
  });

  it('creates and persists a new user when the email is not taken', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await handler.execute(new CreateUserCommand('new@example.com', 'password123'));

    expect(passwordHasher.hash).toHaveBeenCalledWith('password123');
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(result.email).toBe('new@example.com');
    expect(result.id).toEqual(expect.any(String));
  });

  it('throws ConflictException when the email is already registered', async () => {
    userRepository.findByEmail.mockResolvedValue({} as any);

    await expect(
      handler.execute(new CreateUserCommand('taken@example.com', 'password123')),
    ).rejects.toThrow(ConflictException);

    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
