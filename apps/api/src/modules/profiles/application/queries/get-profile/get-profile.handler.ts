import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetProfileQuery } from './get-profile.query';
import {
  USER_PROFILE_REPOSITORY,
  UserProfileRepository,
} from '../../../domain/repositories/user-profile.repository.interface';
import { ProfileResponseDto } from '../../dto/profile-response.dto';
import { ProfileResponseMapper } from '../../dto/profile-response.mapper';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(@Inject(USER_PROFILE_REPOSITORY) private readonly profileRepository: UserProfileRepository) {}

  async execute(query: GetProfileQuery): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findByUserId(query.userId);
    if (!profile) {
      throw new NotFoundException(`Profile not found for user: ${query.userId}`);
    }

    return ProfileResponseMapper.toDto(profile);
  }
}
