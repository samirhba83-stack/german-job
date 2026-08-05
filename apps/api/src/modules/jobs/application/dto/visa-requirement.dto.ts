import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { VisaSponsorship } from '@german-job-engine/shared-types';

export class VisaRequirementDto {
  @ApiProperty({ enum: VisaSponsorship })
  @IsEnum(VisaSponsorship)
  sponsorshipAvailable!: VisaSponsorship;

  @ApiProperty()
  @IsBoolean()
  requiresEuWorkAuthorization!: boolean;
}
