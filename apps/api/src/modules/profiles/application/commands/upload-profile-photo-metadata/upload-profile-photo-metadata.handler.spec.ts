import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadProfilePhotoMetadataHandler } from './upload-profile-photo-metadata.handler';
import { UploadProfilePhotoMetadataCommand } from './upload-profile-photo-metadata.command';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../../domain/entities/user-profile.entity';

describe('UploadProfilePhotoMetadataHandler', () => {
  let profileRepository: jest.Mocked<UserProfileRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: UploadProfilePhotoMetadataHandler;
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
    handler = new UploadProfilePhotoMetadataHandler(profileRepository, eventBus as any);
  });

  it('attaches photo metadata and persists the profile', async () => {
    const result = await handler.execute(
      new UploadProfilePhotoMetadataCommand(
        'user-1',
        'photo.jpg',
        'https://files.example.com/photo.jpg',
        'image/jpeg',
        2048,
      ),
    );

    expect(profileRepository.save).toHaveBeenCalledWith(profile);
    expect(result.photo).toMatchObject({ fileName: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 });
    expect(result.completionPercentage).toBe(10);
  });

  it('throws NotFoundException when the profile does not exist', async () => {
    profileRepository.findByUserId.mockResolvedValue(null);

    await expect(
      handler.execute(new UploadProfilePhotoMetadataCommand('missing-user', 'photo.jpg', 'url', 'image/jpeg', 2048)),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates invalid file metadata into BadRequestException', async () => {
    await expect(
      handler.execute(new UploadProfilePhotoMetadataCommand('user-1', '  ', 'url', 'image/jpeg', 2048)),
    ).rejects.toThrow(BadRequestException);
  });
});
