import { Injectable } from '@nestjs/common';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionTrace } from '../../domain/models/execution-trace';

const DELIVERY_EVENT_TYPES = new Set(['EMAIL_DELIVERY_CONFIRMED', 'EMAIL_DELIVERY_FAILED']);

/**
 * Trust Center (M17, enhanced M18). See ExecutionTrace's doc comment for
 * exactly which spec fields this can and cannot answer today from real
 * event data.
 */
@Injectable()
export class TrustCenterProjectionService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async getExecutionTrace(traceId: string): Promise<ExecutionTrace> {
    const events = await this.eventQuery.findByTraceId(traceId);

    if (events.length === 0) {
      return { traceId, hasEvents: false, events: [], selectedProviderId: null, deliveryStatus: null, durationMs: null, overallStatus: null, workerId: null, geography: null };
    }

    const deliveryEvent = events.find((event) => DELIVERY_EVENT_TYPES.has(event.eventType));
    const executedEvent = events.find((event) => event.eventType === 'TASK_EXECUTED');
    const providerSelectedEvent = events.find((event) => event.eventType === 'PROVIDER_SELECTED');
    const geographyEvent = events.find((event) => event.businessContext.geography !== null);
    const durationMs = executedEvent?.metadata.durationMs ? Number(executedEvent.metadata.durationMs) : null;

    return {
      traceId,
      hasEvents: true,
      events: events.map((event) => ({
        eventType: event.eventType,
        timestamp: event.occurredAt,
        status: event.status,
        explanation: event.explanation,
        metadata: event.metadata,
      })),
      selectedProviderId: deliveryEvent?.metadata.providerId ?? providerSelectedEvent?.businessContext.providerId ?? null,
      deliveryStatus: deliveryEvent?.metadata.deliveryStatus ?? null,
      durationMs: durationMs !== null && !Number.isNaN(durationMs) ? durationMs : null,
      overallStatus: events[events.length - 1].status,
      workerId: executedEvent?.businessContext.workerId ?? null,
      geography: geographyEvent?.businessContext.geography ?? null,
    };
  }
}
