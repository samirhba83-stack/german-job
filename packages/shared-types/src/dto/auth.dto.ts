export interface LoginRequestDto {
  email: string;
  password: string;
}

/** M31 Phase 20/21 — registration during Closed Beta requires an invitation code (checked
 * server-side; whether it's actually required depends on the runtime `CLOSED_BETA_ENABLED`/
 * `PUBLIC_REGISTRATION_ENABLED` flags, not a fixed shape — see `RegisterDto` on the API side). */
export interface RegisterRequestDto {
  email: string;
  password: string;
  invitationCode?: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}
