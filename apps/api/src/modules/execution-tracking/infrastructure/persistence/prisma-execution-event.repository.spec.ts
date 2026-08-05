import { PrismaExecutionEventRepository } from './prisma-execution-event.repository';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { EMPTY_BUSINESS_CONTEXT } from '../../domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildEvent(id: string): ExecutionEvent {
  return ExecutionEvent.create(id, {
    eventType: 'TASK_EXECUTED',
    campaignId: 'campaign-1',
    executionId: 'execution-1',
    correlationId: 'correlation-1',
    traceId: 'execution-1',
    summary: 'summary',
    explanation: 'explanation',
    status: 'SUCCESS',
    metadata: { key: 'value' },
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  });
}

function buildRawRow(id: string) {
  return {
    id,
    eventType: 'TASK_EXECUTED',
    campaignId: 'campaign-1',
    executionId: 'execution-1',
    correlationId: 'correlation-1',
    traceId: 'execution-1',
    summary: 'summary',
    explanation: 'explanation',
    status: 'SUCCESS',
    metadata: { key: 'value' },
    context: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  };
}

function fakePrisma(overrides: { findMany?: jest.Mock; create?: jest.Mock } = {}) {
  return {
    executionEvent: {
      create: overrides.create ?? jest.fn().mockResolvedValue(undefined),
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    },
  };
}

describe('PrismaExecutionEventRepository', () => {
  describe('append', () => {
    it('creates exactly one row mapped from the domain event', async () => {
      const prisma = fakePrisma();
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.append(buildEvent('123e4567-e89b-12d3-a456-426614174000'));

      expect(prisma.executionEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.executionEvent.create.mock.calls[0][0].data).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'TASK_EXECUTED',
        campaignId: 'campaign-1',
        status: 'SUCCESS',
      });
    });
  });

  describe('findByCampaignId', () => {
    it('queries by campaignId ordered chronologically ascending and maps rows to domain', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1'), buildRawRow('2')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      const result = await repository.findByCampaignId('campaign-1');

      expect(findMany).toHaveBeenCalledWith({ where: { campaignId: 'campaign-1' }, orderBy: { occurredAt: 'asc' } });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(ExecutionEvent);
    });
  });

  describe('findByExecutionId', () => {
    it('queries by executionId ordered chronologically ascending', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.findByExecutionId('execution-1');

      expect(findMany).toHaveBeenCalledWith({ where: { executionId: 'execution-1' }, orderBy: { occurredAt: 'asc' } });
    });
  });

  describe('findRecent', () => {
    it('queries ordered chronologically descending with the given take limit', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.findRecent(25);

      expect(findMany).toHaveBeenCalledWith({ orderBy: { occurredAt: 'desc' }, take: 25 });
    });
  });

  describe('findByEventType', () => {
    it('queries by eventType ordered chronologically descending with the given take limit', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.findByEventType('TASK_EXECUTED', 100);

      expect(findMany).toHaveBeenCalledWith({ where: { eventType: 'TASK_EXECUTED' }, orderBy: { occurredAt: 'desc' }, take: 100 });
    });
  });

  describe('findByCorrelationId', () => {
    it('queries by correlationId ordered chronologically ascending', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.findByCorrelationId('correlation-1');

      expect(findMany).toHaveBeenCalledWith({ where: { correlationId: 'correlation-1' }, orderBy: { occurredAt: 'asc' } });
    });
  });

  describe('findByTraceId', () => {
    it('queries by traceId ordered chronologically ascending', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.findByTraceId('trace-1');

      expect(findMany).toHaveBeenCalledWith({ where: { traceId: 'trace-1' }, orderBy: { occurredAt: 'asc' } });
    });
  });

  describe('findByCampaignIdAndTraceId', () => {
    it('queries by campaignId and traceId together ordered chronologically ascending', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRawRow('1')]);
      const prisma = fakePrisma({ findMany });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      await repository.findByCampaignIdAndTraceId('campaign-1', 'trace-1');

      expect(findMany).toHaveBeenCalledWith({
        where: { campaignId: 'campaign-1', traceId: 'trace-1' },
        orderBy: { occurredAt: 'asc' },
      });
    });
  });

  describe('edge cases', () => {
    it('returns an empty array when no rows match', async () => {
      const prisma = fakePrisma({ findMany: jest.fn().mockResolvedValue([]) });
      const repository = new PrismaExecutionEventRepository(prisma as any);

      const result = await repository.findByCampaignId('no-events');

      expect(result).toEqual([]);
    });
  });
});
