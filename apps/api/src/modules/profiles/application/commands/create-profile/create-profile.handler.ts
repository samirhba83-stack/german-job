import { ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { CreateProfileCommand } from './create-profile.command';
import {
  USER_PROFILE_REPOSITORY,
  UserProfileRepository,
} from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../../domain/entities/user-profile.entity';
import { ProfileAlreadyExistsException } from '../../../domain/exceptions/profile-already-exists.exception';
import { ProfileResponseDto } from '../../dto/profile-response.dto';
import { ProfileResponseMapper } from '../../dto/profile-response.mapper';

@CommandHandler(CreateProfileCommand)
export class CreateProfileHandler implements ICommandHandler<CreateProfileCommand> {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profileRepository: UserProfileRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateProfileCommand): Promise<ProfileResponseDto> {
    const existing = await this.profileRepository.findByUserId(command.userId);
    if (existing) {
      throw new ConflictException(new ProfileAlreadyExistsException(command.userId).message);
    }

    const profile = UserProfile.create(randomUUID(), command.userId);

    await this.profileRepository.save(profile);
    profile.domainEvents.forEach((event) => this.eventBus.publish(event));
    profile.clearDomainEvents();

    return ProfileResponseMapper.toDto(profile);
  }
}
