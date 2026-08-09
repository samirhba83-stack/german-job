export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    /** M31 Phase 20 — see RegisterDto's own doc comment; `undefined` when
     * PUBLIC_REGISTRATION_ENABLED=true (open registration, must stay off by default). */
    public readonly invitationCode?: string,
  ) {}
}
