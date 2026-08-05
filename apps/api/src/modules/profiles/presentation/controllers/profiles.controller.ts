import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateProfileCommand } from '../../application/commands/create-profile/create-profile.command';
import { UpdateProfileCommand } from '../../application/commands/update-profile/update-profile.command';
import { UploadCvMetadataCommand } from '../../application/commands/upload-cv-metadata/upload-cv-metadata.command';
import { UploadProfilePhotoMetadataCommand } from '../../application/commands/upload-profile-photo-metadata/upload-profile-photo-metadata.command';
import { GetProfileQuery } from '../../application/queries/get-profile/get-profile.query';
import { UpdateProfileDto } from '../../application/dto/update-profile.dto';
import { UploadCvMetadataDto } from '../../application/dto/upload-cv-metadata.dto';
import { UploadProfilePhotoMetadataDto } from '../../application/dto/upload-profile-photo-metadata.dto';
import { ProfileResponseDto } from '../../application/dto/profile-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload): Promise<ProfileResponseDto> {
    return this.commandBus.execute(new CreateProfileCommand(user.sub));
  }

  @Get('me')
  async getMine(@CurrentUser() user: JwtPayload): Promise<ProfileResponseDto> {
    return this.queryBus.execute(new GetProfileQuery(user.sub));
  }

  @Patch('me')
  async update(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.commandBus.execute(new UpdateProfileCommand(user.sub, dto));
  }

  @Post('me/cv')
  @HttpCode(HttpStatus.OK)
  async uploadCv(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadCvMetadataDto,
  ): Promise<ProfileResponseDto> {
    return this.commandBus.execute(
      new UploadCvMetadataCommand(user.sub, dto.fileName, dto.fileUrl, dto.mimeType, dto.sizeBytes),
    );
  }

  @Post('me/photo')
  @HttpCode(HttpStatus.OK)
  async uploadPhoto(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadProfilePhotoMetadataDto,
  ): Promise<ProfileResponseDto> {
    return this.commandBus.execute(
      new UploadProfilePhotoMetadataCommand(user.sub, dto.fileName, dto.fileUrl, dto.mimeType, dto.sizeBytes),
    );
  }
}
