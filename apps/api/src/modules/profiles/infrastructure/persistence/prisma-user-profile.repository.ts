import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { UserProfileRepository } from '../../domain/repositories/user-profile.repository.interface';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserProfileMapper } from '../mappers/user-profile.mapper';

const PROFILE_INCLUDE = {
  workExperiences: true,
  educations: true,
  languages: true,
} as const;

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfile | null> {
    const raw = await this.prisma.userProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    return raw ? UserProfileMapper.toDomain(raw) : null;
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const raw = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    return raw ? UserProfileMapper.toDomain(raw) : null;
  }

  async save(entity: UserProfile): Promise<void> {
    const data = UserProfileMapper.toPersistence(entity);

    await this.prisma.userProfile.upsert({
      where: { userId: entity.userId },
      create: {
        id: entity.id,
        userId: entity.userId,
        ...data.scalars,
        workExperiences: { create: data.workExperiences },
        educations: { create: data.educations },
        languages: { create: data.languages },
      },
      update: {
        ...data.scalars,
        workExperiences: { deleteMany: {}, create: data.workExperiences },
        educations: { deleteMany: {}, create: data.educations },
        languages: { deleteMany: {}, create: data.languages },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.userProfile.delete({ where: { id } });
  }
}
