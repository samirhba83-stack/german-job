import { IsString, MaxLength, MinLength } from 'class-validator';

/** Every admin action against a connected mailbox requires a reason (Phase 19), matching
 * `AdminEmailController`'s `SenderIdentityActionDto` precedent exactly. */
export class MailboxAdminActionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
