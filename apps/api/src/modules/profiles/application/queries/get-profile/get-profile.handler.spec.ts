import { NotFoundException } from '@nestjs/common';
import { GetProfileHandler } from './get-profile.handler';
import { GetProfileQuery } from './get-profile.query';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../../domain/entities/user-profile.entity';

describe('GetProfileHandler', () => {
  let profileRepository: jest.Mocked<UserProfileRepository>;
  let handler: GetProfileHandler;

  beforeEach(() => {
    profileRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new GetProfileHandler(profileRepository);
  });

  it('returns the mapped profile when it exists', async () => {
    const profile = UserProfile.create('profile-1', 'user-1');
    profileRepository.findByUserId.mockResolvedValue(profile);

    const result = await handler.execute(new GetProfileQuery('user-1'));

    expect(result.id).toBe('profile-1');
    expect(result.userId).toBe('user-1');
    expect(result.completionPercentage).toBe(0);
  });

  it('throws NotFoundException when no profile exists for the user', async () => {
    profileRepository.findByUserId.mockResolvedValue(null);

    await expect(handler.execute(new GetProfileQuery('missing-user'))).rejects.toThrow(NotFoundException);
  });
});
