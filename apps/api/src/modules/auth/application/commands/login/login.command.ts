import { UserRole } from '@german-job-engine/shared-types';

/**
 * Credentials are already verified by LocalStrategy (via LocalAuthGuard) before this command
 * is dispatched — the handler's job is only to issue tokens for the authenticated principal.
 */
export class LoginCommand {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: UserRole,
  ) {}
}
