import { OAuthTransactionRecord, CreateOAuthTransactionInput } from '../models/oauth-transaction';

export const OAUTH_TRANSACTION_REPOSITORY = Symbol('OAUTH_TRANSACTION_REPOSITORY');

export interface OAuthTransactionRepository {
  create(input: CreateOAuthTransactionInput, now: Date): Promise<OAuthTransactionRecord>;
  findByState(state: string): Promise<OAuthTransactionRecord | null>;

  /** The real single-use/replay defense: a conditional update that only succeeds if the row is
   * still `PENDING` — `count === 1` means this exact call won the "consume it" race, matching the
   * same conditional-`updateMany` idiom `PostgresLeaseLock`/`EmailQueueRepository.claimBatch()`/
   * M28.5's document versioning already established for "exactly one winner under concurrency." */
  tryConsume(state: string, now: Date): Promise<boolean>;
}
