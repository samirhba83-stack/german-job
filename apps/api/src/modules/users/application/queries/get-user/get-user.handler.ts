import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserRole } from '@german-job-engine/shared-types';
import { GetUserQuery } from './get-user.query';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserResponseDto } from '../../dto/user-response.dto';

/** Self-or-admin: a user may look up their own record; only Admin may look up anyone else's. */
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async execute(query: GetUserQuery): Promise<UserResponseDto> {
    if (query.requesterRole !== UserRole.ADMIN && query.requesterId !== query.userId) {
      throw new ForbiddenException('You do not have permission to view this user');
    }

    const user = await this.userRepository.findById(query.userId);

    if (!user) {
      throw new NotFoundException(`User not found: ${query.userId}`);
    }

    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email.value;
    dto.role = user.role;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
