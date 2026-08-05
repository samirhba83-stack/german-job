import { Injectable } from '@nestjs/common';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { DeliveryOverview } from '../../domain/models/delivery-overview';

const DEFAULT_LIMIT = 200;

/** Delivery Overview (M17). Real counts across the confirmed/failed delivery event log — no fabricated totals. */
@Injectable()
export class DeliveryOverviewProjectionService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async getOverview(limit: number = DEFAULT_LIMIT): Promise<DeliveryOverview> {
    const [confirmed, failed] = await Promise.all([
      this.eventQuery.findByEventType('EMAIL_DELIVERY_CONFIRMED', limit),
      this.eventQuery.findByEventType('EMAIL_DELIVERY_FAILED', limit),
    ]);

    const totalAttempts = confirmed.length + failed.length;

    return {
      totalAttempts,
      confirmed: confirmed.length,
      failed: failed.length,
      successRate: totalAttempts > 0 ? confirmed.length / totalAttempts : 0,
      recentFailures: failed
        .slice(0, 20)
        .map((event) => ({ executionId: event.executionId, timestamp: event.occurredAt, explanation: event.explanation })),
    };
  }
}
