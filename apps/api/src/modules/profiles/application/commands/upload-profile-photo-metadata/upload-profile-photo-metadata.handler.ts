import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UploadProfilePhotoMetadataCommand } from './upload-profile-photo-metadata.command';
import {
  USER_PROFILE_REPOSITORY,
  UserProfileRepository,
} from '../../../domain/repositories/user-profile.repository.interface';
import { FileMetadata } from '../../../domain/value-objects/file-metadata.vo';
import { ProfileResponseDto } from '../../dto/profile-response.dto';
import { ProfileResponseMapper } from '../../dto/profile-response.mapper';

@CommandHandler(UploadProfilePhotoMetadataCommand)
export class UploadProfilePhotoMetadataHandler
  implements ICommandHandler<UploadProfilePhotoMetadataCommand>
{
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profileRepository: UserProfileRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UploadProfilePhotoMetadataCommand): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findByUserId(command.userId);
    if (!profile) {
      throw new NotFoundException(`Profile not found for user: ${command.userId}`);
    }

    let file: FileMetadata;
    try {
      file = FileMetadata.create({
        fileName: command.fileName,
        fileUrl: command.fileUrl,
        mimeType: command.mimeType,
        sizeBytes: command.sizeBytes,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid photo metadata');
    }

    profile.attachPhoto(file);

    await this.profileRepository.save(profile);
    profile.domainEvents.forEach((event) => this.eventBus.publish(event));
    profile.clearDomainEvents();

    return ProfileResponseMapper.toDto(profile);
  }
}
