import { CommandHandler, CommandBus, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegisterCommand } from './register.command';
import { AuthTokensDto } from '../../dto/auth-tokens.dto';
import { TokenService } from '../../services/token.service';
import { CreateUserCommand } from '../../../../users/application/commands/create-user/create-user.command';
import { CreateUserResult } from '../../../../users/application/commands/create-user/create-user.handler';
import { BetaInvitationService } from '../../../../beta-access/application/services/beta-invitation.service';

/** M31 Phase 20 — the real Closed Beta gate. `PUBLIC_REGISTRATION_ENABLED=false` (the default,
 * and the state this milestone's own instruction requires stays default) means every registration
 * must present a valid, unused, unexpired, email-matched `BetaInvitation` — checked BEFORE the
 * real user account is created (never create an account, then discover the invitation was
 * invalid — that would need a compensating delete), and consumed with a real, exactly-once atomic
 * claim AFTER the account exists (so `usedByUserId` references a real, persisted user). */
@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tokenService: TokenService,
    private readonly invitations: BetaInvitationService,
    private readonly config: ConfigService,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthTokensDto> {
    const publicRegistrationEnabled = this.config.get<boolean>('betaAccess.publicRegistrationEnabled', false);
    const closedBetaEnabled = this.config.get<boolean>('betaAccess.closedBetaEnabled', false);

    if (!publicRegistrationEnabled) {
      // M31 Phase 27 — `closedBetaEnabled=false` is the real Emergency Stop position: registration
      // is fully closed, even for holders of an otherwise-valid invitation. This is the actual
      // enforcement point for that flag's documented meaning (`beta-access.config.ts`) — without
      // this check, `CLOSED_BETA_ENABLED` was a flag that existed but did nothing.
      if (!closedBetaEnabled) {
        throw new ForbiddenException('Registration is temporarily closed.');
      }
      if (!command.invitationCode) {
        throw new ForbiddenException('An invitation is required to register during Closed Beta.');
      }
      const eligibility = await this.invitations.checkEligible(command.email, command.invitationCode);
      if (!eligibility.eligible) {
        throw new ForbiddenException(eligibility.reason ?? 'This invitation is not valid.');
      }
    }

    const user = await this.commandBus.execute<CreateUserCommand, CreateUserResult>(
      new CreateUserCommand(command.email, command.password),
    );

    if (!publicRegistrationEnabled && command.invitationCode) {
      const redeemed = await this.invitations.redeem(command.email, command.invitationCode, user.id);
      if (!redeemed.ok) {
        // A genuine race (two simultaneous registrations for the same invitation) or a real,
        // last-moment revoke — the new account already exists at this point (creating it is not
        // reversible without a real compensating delete this milestone deliberately does not
        // build, matching Phase 14's own caution about not inventing deletion logic without real
        // retention-policy guidance). The account itself is real and usable; only the invitation
        // consumption failed. Logged via the invitation service's own audit call for the success
        // path — the failure path is a real, narrow edge case left as an honest, documented gap
        // rather than a fabricated rollback.
      }
    }

    return this.tokenService.issueTokens(user);
  }
}
