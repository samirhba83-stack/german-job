import { registerAs } from '@nestjs/config';

/** M31 Phase 20/26 — Closed Beta production safety gates. Both default to the safe/restrictive
 * state, matching this codebase's own established "fail closed" discipline for every real
 * external-facing capability since M27.
 *
 * `publicRegistrationEnabled=false` (must stay false per this milestone's own explicit
 * instruction) means `RegisterHandler` always requires a valid, unused, unexpired, email-matched
 * `BetaInvitation` — there is no other path to a real account while this is false.
 *
 * `closedBetaEnabled` gates whether the beta-access admin surface (invite/revoke/list) is
 * meaningfully usable at all — kept as a separate flag from `publicRegistrationEnabled` (not
 * merely its negation) so an operator can disable ALL registration, invited or not, as a real
 * Emergency Stop action (Phase 27) without needing to touch `publicRegistrationEnabled`'s own,
 * separate meaning. */
export default registerAs('betaAccess', () => ({
  publicRegistrationEnabled: (process.env.PUBLIC_REGISTRATION_ENABLED ?? 'false').toLowerCase() === 'true',
  closedBetaEnabled: (process.env.CLOSED_BETA_ENABLED ?? 'false').toLowerCase() === 'true',
  invitationExpiryDays: parseInt(process.env.BETA_INVITATION_EXPIRY_DAYS ?? '14', 10),
}));
