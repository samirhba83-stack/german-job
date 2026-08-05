import { ConnectedMailboxRecord, ConnectedMailboxUpdatePatch, CreateConnectedMailboxInput, ConnectedMailboxProvider } from '../models/connected-mailbox';

export const CONNECTED_MAILBOX_REPOSITORY = Symbol('CONNECTED_MAILBOX_REPOSITORY');

export interface ConnectedMailboxRepository {
  findById(id: string): Promise<ConnectedMailboxRecord | null>;
  /** The single currently-selected sending mailbox for a user, or null — never more than one
   * exists at the DB level (a real partial unique index enforces this; see the Prisma model's
   * own doc comment). */
  findActiveByUserId(userId: string): Promise<ConnectedMailboxRecord | null>;
  findByProviderAccount(provider: ConnectedMailboxProvider, providerAccountId: string): Promise<ConnectedMailboxRecord | null>;
  /** M29 — a real provider push notification (Gmail's Pub/Sub payload, Graph's subscription
   * resource) identifies the mailbox by its own verified email address, never by our internal
   * `providerAccountId` — this is the real lookup the inbox webhook controllers need. */
  findByProviderAndEmailAddress(provider: ConnectedMailboxProvider, emailAddress: string): Promise<ConnectedMailboxRecord | null>;
  listByUserId(userId: string): Promise<ConnectedMailboxRecord[]>;
  listAll(limit: number, offset: number): Promise<ConnectedMailboxRecord[]>;

  /** Atomically deactivates any prior active mailbox for this user and creates the new one as
   * active — never a window where two are simultaneously active (same "new version supersedes,
   * transaction plus a DB-level backstop" doctrine as M28.5's `CandidateDocument.createNewVersion`). */
  createConnected(input: CreateConnectedMailboxInput, now: Date): Promise<ConnectedMailboxRecord>;

  update(id: string, patch: ConnectedMailboxUpdatePatch, now: Date): Promise<ConnectedMailboxRecord>;
}
