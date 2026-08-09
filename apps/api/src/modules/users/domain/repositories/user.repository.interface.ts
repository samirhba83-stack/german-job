import { Repository } from '../../../../shared/application';
import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserAccountStatus {
  readonly suspended: boolean;
  readonly reason: string | null;
}

export interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;

  /** M31 Phase 20/27 — deliberately narrow, dedicated methods (not routed through the full `User`
   * aggregate's `save()`/mapper round trip) for the same reason `ConnectedMailboxRepository`'s own
   * `release()` and similar narrow methods exist elsewhere in this codebase: a real, distinct,
   * administrative operation on a specific field set, not a rich domain-entity mutation. Checked
   * on EVERY authenticated request (`JwtStrategy.validate()`) — `getAccountStatus()` is
   * deliberately a lightweight, single-row lookup, not a full entity reconstruction. */
  getAccountStatus(userId: string): Promise<UserAccountStatus | null>;
  suspend(userId: string, reason: string, suspendedByAdminId: string, now: Date): Promise<void>;
  unsuspend(userId: string): Promise<void>;
}
