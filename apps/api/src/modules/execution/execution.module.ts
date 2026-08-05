import { Module } from '@nestjs/common';
import { EXECUTION_CLOCK } from './domain/ports/execution-clock.port';
import { EXECUTION_QUEUE } from './domain/ports/execution-queue.port';
import { DISTRIBUTED_LOCK } from './domain/ports/distributed-lock.port';
import { SystemClock } from './infrastructure/clock/system-clock';
import { InMemoryExecutionQueue } from './infrastructure/queue/in-memory-execution-queue';
import { PostgresLeaseLock } from './infrastructure/lock/postgres-lease-lock';

/**
 * Execution infrastructure scaffold (M2). Deliberately NOT imported into AppModule —
 * the execution engine (Scheduler, Dispatcher, Worker) that will consume these ports is
 * built in later milestones. Importing this module has zero effect on any existing
 * request path until that wiring happens.
 */
@Module({
  providers: [
    { provide: EXECUTION_CLOCK, useClass: SystemClock },
    { provide: EXECUTION_QUEUE, useClass: InMemoryExecutionQueue },
    { provide: DISTRIBUTED_LOCK, useClass: PostgresLeaseLock },
  ],
  exports: [EXECUTION_CLOCK, EXECUTION_QUEUE, DISTRIBUTED_LOCK],
})
export class ExecutionModule {}
