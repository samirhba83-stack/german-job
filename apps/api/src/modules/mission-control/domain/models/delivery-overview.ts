export interface RecentDeliveryFailure {
  readonly executionId: string | null;
  readonly timestamp: Date;
  readonly explanation: string;
}

export interface DeliveryOverview {
  readonly totalAttempts: number;
  readonly confirmed: number;
  readonly failed: number;
  /** 0..1; 0 when totalAttempts is 0 rather than NaN. */
  readonly successRate: number;
  readonly recentFailures: ReadonlyArray<RecentDeliveryFailure>;
}
