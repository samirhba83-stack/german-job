import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** M31 Phase 20 — required whenever `PUBLIC_REGISTRATION_ENABLED=false` (the default, and the
   * state this milestone's own instruction requires stays default) — validated inside
   * `RegisterHandler`, not via a class-validator decorator, since whether it's required at all is
   * itself a runtime config value, not a fixed shape. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invitationCode?: string;
}
