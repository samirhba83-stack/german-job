export class InvalidSubscriptionTransitionException extends Error {
  constructor(subscriptionId: string, from: string, to: string) {
    super(`Subscription ${subscriptionId} cannot transition from ${from} to ${to}.`);
    this.name = 'InvalidSubscriptionTransitionException';
  }
}
