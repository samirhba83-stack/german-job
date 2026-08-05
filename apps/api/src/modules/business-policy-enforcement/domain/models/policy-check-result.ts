/** A single specification's verdict against the context it was given. */
export interface PolicyCheckResult {
  readonly satisfied: boolean;
  readonly reasonCode: string;
  readonly explanation: string;
}
