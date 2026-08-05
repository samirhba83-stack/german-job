import { Inject, Injectable } from '@nestjs/common';
import { EXECUTION_EVENT_REPOSITORY, ExecutionEventRepository } from '../../domain/repositories/execution-event.repository.interface';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { ExecutionEventType } from '../../domain/models/execution-event-type';

/** Read side (M16, extended in M17 and M18). Thin delegation to the repository — no aggregation or projection logic belongs here; that is Mission Control's (M17) job. */
@Injectable()
export class ExecutionEventQueryService {
  constructor(@Inject(EXECUTION_EVENT_REPOSITORY) private readonly repository: ExecutionEventRepository) {}

  async findByCampaignId(campaignId: string): Promise<ExecutionEvent[]> {
    return this.repository.findByCampaignId(campaignId);
  }

  async findByExecutionId(executionId: string): Promise<ExecutionEvent[]> {
    return this.repository.findByExecutionId(executionId);
  }

  async findRecent(limit: number): Promise<ExecutionEvent[]> {
    return this.repository.findRecent(limit);
  }

  async findByEventType(eventType: ExecutionEventType, limit: number): Promise<ExecutionEvent[]> {
    return this.repository.findByEventType(eventType, limit);
  }

  async findByCorrelationId(correlationId: string): Promise<ExecutionEvent[]> {
    return this.repository.findByCorrelationId(correlationId);
  }

  async findByTraceId(traceId: string): Promise<ExecutionEvent[]> {
    return this.repository.findByTraceId(traceId);
  }

  async findByCampaignIdAndTraceId(campaignId: string, traceId: string): Promise<ExecutionEvent[]> {
    return this.repository.findByCampaignIdAndTraceId(campaignId, traceId);
  }
}
