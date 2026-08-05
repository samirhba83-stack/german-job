export const DISTRIBUTED_LOCK = Symbol('DISTRIBUTED_LOCK');

/**
 * A held lease returned by a successful `acquire()`. The fencing token is monotonically
 * increasing per key and exists for defense-in-depth only — correctness of concurrent
 * aggregate mutation is guaranteed by Campaign's own optimistic-concurrency `version`
 * column (see PrismaCampaignRepository.save()), not by this lock. Treat the lock purely
 * as an efficiency mechanism that avoids redundant work, never as the sole safety net.
 */
export interface AcquiredLease {
  readonly key: string;
  readonly fencingToken: number;
  release(): Promise<void>;
}

/** Abstracts distributed mutual exclusion for a future multi-worker execution engine (M3+). */
export interface DistributedLock {
  /** Returns null (never throws) when the lease is currently held by someone else. */
  acquire(key: string, ttlMs: number): Promise<AcquiredLease | null>;
}
