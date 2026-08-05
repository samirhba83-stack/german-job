import { ExecutionEvent as PrismaExecutionEvent, Prisma } from '@german-job-engine/database';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { ExecutionEventStatus, ExecutionEventType } from '../../domain/models/execution-event-type';
import { BusinessContext, EMPTY_BUSINESS_CONTEXT } from '../../domain/models/business-context';

/** Maps between the Prisma persistence row and the domain ExecutionEvent. */
export class ExecutionEventMapper {
  static toDomain(raw: PrismaExecutionEvent): ExecutionEvent {
    return ExecutionEvent.reconstitute(raw.id, {
      // Prisma generates its own enums; values are identical to the domain's by contract.
      eventType: raw.eventType as unknown as ExecutionEventType,
      campaignId: raw.campaignId,
      executionId: raw.executionId,
      correlationId: raw.correlationId,
      traceId: raw.traceId,
      summary: raw.summary,
      explanation: raw.explanation,
      status: raw.status as unknown as ExecutionEventStatus,
      metadata: raw.metadata as Record<string, string>,
      businessContext: (raw.context as unknown as BusinessContext | null) ?? EMPTY_BUSINESS_CONTEXT,
      occurredAt: raw.occurredAt,
    });
  }

  static toPersistence(event: ExecutionEvent): Prisma.ExecutionEventUncheckedCreateInput {
    return {
      id: event.id,
      eventType: event.eventType as unknown as PrismaExecutionEvent['eventType'],
      campaignId: event.campaignId,
      executionId: event.executionId,
      correlationId: event.correlationId,
      traceId: event.traceId,
      summary: event.summary,
      explanation: event.explanation,
      status: event.status as unknown as PrismaExecutionEvent['status'],
      metadata: event.metadata as Prisma.InputJsonValue,
      context: event.businessContext as unknown as Prisma.InputJsonValue,
      occurredAt: event.occurredAt,
    };
  }
}
