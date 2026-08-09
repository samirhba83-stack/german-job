import { EmailQueueWorkerService } from './email-queue-worker.service';

/** M31.1 Phase 11 — real, previously-missing coverage for this driver. Focused on the two
 * behaviors this phase actually touched (the new MetricsPort wiring) rather than re-deriving
 * every pre-existing behavior this class's own doc comment already explains. */
describe('EmailQueueWorkerService', () => {
  function harness() {
    const repository = { claimBatch: jest.fn() };
    const queueService = { processClaimed: jest.fn().mockResolvedValue(undefined) };
    const clock = { now: () => new Date('2026-08-08T00:00:00.000Z') };
    const config = { get: jest.fn().mockReturnValue(10) };
    const schedulerRegistry = { addInterval: jest.fn(), doesExist: jest.fn().mockReturnValue(false), deleteInterval: jest.fn() };
    const metrics = { incrementCounter: jest.fn(), recordGauge: jest.fn(), recordHistogram: jest.fn() };

    const service = new EmailQueueWorkerService(
      repository as any,
      queueService as any,
      clock as any,
      config as any,
      schedulerRegistry as any,
      metrics as any,
    );
    return { service, repository, queueService, metrics };
  }

  it('records the claimed batch size as a real gauge, even when nothing was claimed', async () => {
    const { service, repository, metrics } = harness();
    repository.claimBatch.mockResolvedValue([]);

    await service.tick();

    expect(metrics.recordGauge).toHaveBeenCalledWith('email_queue.claimed_batch_size', 0);
  });

  it('records the real claimed batch size and processes every claimed message', async () => {
    const { service, repository, queueService, metrics } = harness();
    repository.claimBatch.mockResolvedValue([{ id: 'msg-1' }, { id: 'msg-2' }]);

    await service.tick();

    expect(metrics.recordGauge).toHaveBeenCalledWith('email_queue.claimed_batch_size', 2);
    expect(queueService.processClaimed).toHaveBeenCalledTimes(2);
  });

  it('records a tick-failure counter when the tick itself throws, without crashing', async () => {
    const { service, repository, metrics } = harness();
    repository.claimBatch.mockRejectedValue(new Error('DB unavailable'));

    await expect(service.tick()).resolves.not.toThrow();

    expect(metrics.incrementCounter).toHaveBeenCalledWith('email_queue.tick_failures');
  });
});
