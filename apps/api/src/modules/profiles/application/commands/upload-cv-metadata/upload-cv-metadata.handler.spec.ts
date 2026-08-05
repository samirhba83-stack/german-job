import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadCvMetadataHandler } from './upload-cv-metadata.handler';
import { UploadCvMetadataCommand } from './upload-cv-metadata.command';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../../domain/entities/user-profile.entity';

describe('UploadCvMetadataHandler', () => {
  let profileRepository: jest.Mocked<UserProfileRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: UploadCvMetadataHandler;
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
    handler = new UploadCvMetadataHandler(profileRepository, eventBus as any);
  });

  it('attaches CV metadata and persists the profile', async () => {
    const result = await handler.execute(
      new UploadCvMetadataCommand('user-1', 'cv.pdf', 'https://files.example.com/cv.pdf', 'application/pdf', 1024),
    );

    expect(profileRepository.save).toHaveBeenCalledWith(profile);
    expect(result.cv).toMatchObject({ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 1024 });
    expect(result.completionPercentage).toBe(10);
  });

  it('throws NotFoundException when the profile does not exist', async () => {
    profileRepository.findByUserId.mockResolvedValue(null);

    await expect(
      handler.execute(new UploadCvMetadataCommand('missing-user', 'cv.pdf', 'url', 'application/pdf', 1024)),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates invalid file metadata into BadRequestException', async () => {
    await expect(
      handler.execute(new UploadCvMetadataCommand('user-1', 'cv.pdf', 'url', 'application/pdf', 0)),
    ).rejects.toThrow(BadRequestException);
  });
});
