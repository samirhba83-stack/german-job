import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GermanLevel, AvailabilityStatus } from '@german-job-engine/shared-types';
import { UpdateProfileHandler } from './update-profile.handler';
import { UpdateProfileCommand } from './update-profile.command';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../../domain/entities/user-profile.entity';

describe('UpdateProfileHandler', () => {
  let profileRepository: jest.Mocked<UserProfileRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: UpdateProfileHandler;
  let profile: UserProfile;

  beforeEach(() => {
    profile = UserProfile.create('profile-1', 'user-1');
    profile.clearDomainEvents();

    profileRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(profile),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new UpdateProfileHandler(profileRepository, eventBus as any);
  });

  it('applies provided changes and persists the profile', async () => {
    const result = await handler.execute(
      new UpdateProfileCommand('user-1', {
        germanLevel: GermanLevel.B2,
        skills: ['TypeScript', 'NestJS'],
        availability: { status: AvailabilityStatus.IMMEDIATELY },
      }),
    );

    expect(profileRepository.save).toHaveBeenCalledWith(profile);
    expect(result.germanLevel).toBe(GermanLevel.B2);
    expect(result.skills).toEqual(['TypeScript', 'NestJS']);
    expect(result.availability).toEqual({ status: AvailabilityStatus.IMMEDIATELY, availableFrom: null });
  });

  it('throws NotFoundException when the profile does not exist', async () => {
    profileRepository.findByUserId.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateProfileCommand('missing-user', { germanLevel: GermanLevel.A1 })),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates invalid cross-field VO input into BadRequestException', async () => {
    await expect(
      handler.execute(
        new UpdateProfileCommand('user-1', {
          salaryExpectation: { min: 60000, max: 40000, currency: 'EUR' },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(profileRepository.save).not.toHaveBeenCalled();
  });

  it('translates an invalid work experience date range into BadRequestException', async () => {
    await expect(
      handler.execute(
        new UpdateProfileCommand('user-1', {
          workExperiences: [
            {
              company: 'Acme',
              title: 'Engineer',
              startDate: '2023-01-01',
              endDate: '2022-01-01',
            },
          ],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
