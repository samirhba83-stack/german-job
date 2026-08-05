import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const KNOWN_PROVIDER_IDS = ['resend', 'ses', 'sendgrid', 'smtp'];

export class CreateSenderIdentityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName!: string;

  @IsEmail()
  emailAddress!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  domain!: string;

  @IsIn(KNOWN_PROVIDER_IDS)
  providerId!: string;

  @IsOptional()
  @IsEmail()
  replyToEmailAddress?: string;
}

/** Every admin action that changes a sender identity's trust status requires a reason
 * (M28.5 Phase 15: "Require a reason") — recorded via structured application logs including the
 * acting admin id, matching the M28 `AdminEmailController` precedent for provider disable/enable. */
export class RecordSenderVerificationDto {
  @IsIn(['UNCONFIGURED', 'PENDING', 'VERIFIED', 'FAILED', 'SUSPENDED'])
  verificationStatus!: 'UNCONFIGURED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'SUSPENDED';

  @IsOptional()
  @IsBoolean()
  dkimVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  spfReady?: boolean;

  @IsOptional()
  @IsBoolean()
  dmarcReady?: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class SenderIdentityActionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
