import { ConflictException } from '@nestjs/common';
import { CreateProfileHandler } from './create-profile.handler';
import { CreateProfileCommand } from './create-profile.command';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../../domain/entities/user-profile.entity';

describe('CreateProfileHandler', () => {
  let profileRepository: jest.Mocked<UserProfileRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: CreateProfileHandler;

  beforeEach(() => {
    profileRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new CreateProfileHandler(profileRepository, eventBus as any);
  });

  it('creates and persists a new empty profile when none exists yet', async () => {
    profileRepository.findByUserId.mockResolvedValue(null);

    const result = await handler.execute(new CreateProfileCommand('user-1'));

    expect(profileRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(result.userId).toBe('user-1');
    expect(result.completionPercentage).toBe(0);
  });

  it('throws ConflictException when a profile already exists for the user', async () => {
    profileRepository.findByUserId.mockResolvedValue({} as UserProfile);

    await expect(handler.execute(new CreateProfileCommand('user-1'))).rejects.toThrow(ConflictException);
    expect(profileRepository.save).not.toHaveBeenCalled();
  });
});
