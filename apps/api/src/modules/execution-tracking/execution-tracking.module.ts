import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { ExecutionEventRecordingService } from './application/services/execution-event-recording.service';
import { ExecutionEventQueryService } from './application/services/execution-event-query.service';
import { EXECUTION_EVENT_REPOSITORY } from './domain/repositories/execution-event.repository.interface';
import { PrismaExecutionEventRepository } from './infrastructure/persistence/prisma-execution-event.repository';
import { EXECUTION_EVENT_RECORDER } from './domain/ports/execution-event-recorder.port';

/**
 * Execution Tracking & Event Engine (M16) — the single source of truth for
 * every execution event across the platform. Unlike every module since M2,
 * this one is REAL persistence-backed (Postgres via Prisma), because its
 * whole purpose is to durably survive past the request/process that
 * produced it — a future Mission Control read (M17) may happen long after
 * and in a different process from the execution that generated the event.
 * Still not imported into AppModule itself; it is consumed by the pipeline
 * modules that record into it (Recommendations through Email Delivery),
 * each of which remains individually dormant/unwired exactly as before.
 */
@Module({
  imports: [ExecutionModule],
  providers: [
    ExecutionEventRecordingService,
    ExecutionEventQueryService,
    { provide: EXECUTION_EVENT_REPOSITORY, useClass: PrismaExecutionEventRepository },
    { provide: EXECUTION_EVENT_RECORDER, useExisting: ExecutionEventRecordingService },
  ],
  exports: [ExecutionEventRecordingService, ExecutionEventQueryService, EXECUTION_EVENT_RECORDER],
})
export class ExecutionTrackingModule {}
