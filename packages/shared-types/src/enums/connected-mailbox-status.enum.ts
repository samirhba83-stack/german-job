/** M28.6 — a plain string-literal union, not a TS `enum` (see `connected-mailbox-provider.enum.ts`
 * for why). See apps/api's `connected-mailbox/domain/models/connected-mailbox.ts` for the full
 * rationale behind each state (PENDING mid-OAuth-flow, CONNECTED real/verified/usable,
 * REAUTHORIZATION_REQUIRED a refresh failed in a way only re-consent fixes, REVOKED the provider
 * itself reported the grant gone, USER_DISABLED the user disconnected it, SYSTEM_SUSPENDED this
 * application paused it for safety, FAILED the connection attempt itself never completed). */
export type ConnectedMailboxStatus =
  | 'PENDING'
  | 'CONNECTED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'REVOKED'
  | 'USER_DISABLED'
  | 'SYSTEM_SUSPENDED'
  | 'FAILED';
