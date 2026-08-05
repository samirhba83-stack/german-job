import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EXECUTION_CLOCK, ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EXECUTION_EVENT_REPOSITORY, ExecutionEventRepository } from '../../domain/repositories/execution-event.repository.interface';
import { ExecutionEventRecorder, RecordExecutionEventInput } from '../../domain/ports/execution-event-recorder.port';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { EMPTY_BUSINESS_CONTEXT } from '../../domain/models/business-context';

/**
 * Write side (M16). The only place a fresh ExecutionEvent id and
 * occurredAt timestamp are produced — every pipeline step that records an
 * event goes through here rather than constructing ExecutionEvent itself.
 */
@Injectable()
export class ExecutionEventRecordingService implements ExecutionEventRecorder {
  constructor(
    @Inject(EXECUTION_EVENT_REPOSITORY) private readonly repository: ExecutionEventRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  async record(input: RecordExecutionEventInput): Promise<void> {
    const event = ExecutionEvent.create(randomUUID(), {
      eventType: input.eventType,
      campaignId: input.campaignId,
      executionId: input.executionId,
      correlationId: input.correlationId,
      traceId: input.traceId,
      summary: input.summary,
      explanation: input.explanation,
      status: input.status,
      metadata: input.metadata ?? {},
      businessContext: input.businessContext ?? EMPTY_BUSINESS_CONTEXT,
      occurredAt: this.clock.now(),
    });

    await this.repository.append(event);
  }
}
