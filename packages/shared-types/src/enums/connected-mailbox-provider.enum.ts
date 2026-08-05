/** M28.6 — the two OAuth-connected mailbox providers a candidate can send applications from. A
 * plain string-literal union, not a TS `enum`, deliberately matching the backend domain model's
 * own choice (`apps/api`'s `connected-mailbox/domain/models/connected-mailbox.ts`: "Domain-level
 * mirrors of the Prisma enums — plain TS unions... never importing generated Prisma types into
 * domain layer") — an enum here would force the domain layer to either import this package or
 * cast at every controller boundary for no real benefit, since a plain union already gives full
 * type safety. */
export type ConnectedMailboxProvider = 'GOOGLE_GMAIL' | 'MICROSOFT_OUTLOOK';
