import { Subscription } from '../entities/subscription.entity';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByPaddleSubscriptionId(paddleSubscriptionId: string): Promise<Subscription | null>;
  /** The user's current subscription — the most recent non-terminal (ACTIVE/PAST_DUE/
   * CANCEL_AT_PERIOD_END) row, or null if the user has none (i.e. is on the FREE plan). A user
   * may have older CANCELED/REFUNDED rows preserved as history; this never returns those. */
  findCurrentByUserId(userId: string): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
}
