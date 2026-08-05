import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProfilesController } from './presentation/controllers/profiles.controller';
import { CreateProfileHandler } from './application/commands/create-profile/create-profile.handler';
import { UpdateProfileHandler } from './application/commands/update-profile/update-profile.handler';
import { UploadCvMetadataHandler } from './application/commands/upload-cv-metadata/upload-cv-metadata.handler';
import { UploadProfilePhotoMetadataHandler } from './application/commands/upload-profile-photo-metadata/upload-profile-photo-metadata.handler';
import { GetProfileHandler } from './application/queries/get-profile/get-profile.handler';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository.interface';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma-user-profile.repository';

const commandHandlers = [
  CreateProfileHandler,
  UpdateProfileHandler,
  UploadCvMetadataHandler,
  UploadProfilePhotoMetadataHandler,
];
const queryHandlers = [GetProfileHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ProfilesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository },
  ],
  exports: [USER_PROFILE_REPOSITORY],
})
export class ProfilesModule {}
