import { Injectable } from '@nestjs/common';
import { ExecutionEvent as PrismaExecutionEvent } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ExecutionEventRepository } from '../../domain/repositories/execution-event.repository.interface';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { ExecutionEventType } from '../../domain/models/execution-event-type';
import { ExecutionEventMapper } from '../mappers/execution-event.mapper';

@Injectable()
export class PrismaExecutionEventRepository implements ExecutionEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(event: ExecutionEvent): Promise<void> {
    await this.prisma.executionEvent.create({ data: ExecutionEventMapper.toPersistence(event) });
  }

  async findByCampaignId(campaignId: string): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({ where: { campaignId }, orderBy: { occurredAt: 'asc' } });
    return rows.map(ExecutionEventMapper.toDomain);
  }

  async findByExecutionId(executionId: string): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({ where: { executionId }, orderBy: { occurredAt: 'asc' } });
    return rows.map(ExecutionEventMapper.toDomain);
  }

  async findRecent(limit: number): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({ orderBy: { occurredAt: 'desc' }, take: limit });
    return rows.map(ExecutionEventMapper.toDomain);
  }

  async findByEventType(eventType: ExecutionEventType, limit: number): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({
      where: { eventType: eventType as unknown as PrismaExecutionEvent['eventType'] },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return rows.map(ExecutionEventMapper.toDomain);
  }

  async findByCorrelationId(correlationId: string): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({ where: { correlationId }, orderBy: { occurredAt: 'asc' } });
    return rows.map(ExecutionEventMapper.toDomain);
  }

  async findByTraceId(traceId: string): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({ where: { traceId }, orderBy: { occurredAt: 'asc' } });
    return rows.map(ExecutionEventMapper.toDomain);
  }

  async findByCampaignIdAndTraceId(campaignId: string, traceId: string): Promise<ExecutionEvent[]> {
    const rows = await this.prisma.executionEvent.findMany({ where: { campaignId, traceId }, orderBy: { occurredAt: 'asc' } });
    return rows.map(ExecutionEventMapper.toDomain);
  }
}
