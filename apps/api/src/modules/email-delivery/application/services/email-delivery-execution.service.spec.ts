import { EmailDeliveryExecutionService } from './email-delivery-execution.service';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';
import { EmailProviderManagerPort, EmailProviderManagerResult } from '../../../deliverability/domain/ports/email-provider-manager.port';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildTask(id = 'task-1'): ExecutionTask {
  return ExecutionTask.create(id, 'BATCH_EXECUTION', 'Execute batch 1', 'Explanation for batch 1.', [], 'READY', 'correlation-1', NOW);
}

function buildResponse(overrides: Partial<EmailDeliveryResponse> = {}): EmailDeliveryResponse {
  return {
    providerId: 'fake-provider',
    status: 'ACCEPTED',
    accepted: true,
    executedAt: NOW,
    providerMessage: 'Accepted for delivery.',
    providerMetadata: {},
    failure: null,
    ...overrides,
  };
}

/** M28 — EmailDeliveryExecutionService now delegates entirely to EmailProviderManagerPort
 * (failover/circuit-breaker/timeout all live there and are covered by
 * email-provider-manager.service.spec.ts); this spec only needs to prove the translation/
 * event-recording boundary, so the fake Provider Manager just returns a pre-built result. */
function fakeProviderManager(response: EmailDeliveryResponse, attemptsCount = 1): EmailProviderManagerPort {
  const attempts = Array.from({ length: attemptsCount }, () => ({ providerId: response.providerId, response, skippedCircuitOpen: false }));
  const result: EmailProviderManagerResult = { response, attempts };
  return { sendWithFailover: jest.fn().mockResolvedValue(result) };
}

function fakeProviderManagerRejecting(error: Error): EmailProviderManagerPort {
  return { sendWithFailover: jest.fn().mockRejectedValue(error) };
}

describe('EmailDeliveryExecutionService', () => {
  describe('successful translation', () => {
    it('translates an accepted response into a successful TaskExecutionOutcome', async () => {
      const providerManager = fakeProviderManager(buildResponse({ accepted: true, providerMessage: 'Accepted for delivery.' }));
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const outcome = await service.execute(buildTask());

      expect(outcome.success).toBe(true);
      expect(outcome.reason).toBe('Accepted for delivery.');
      expect(outcome.failureReason).toBeNull();
    });

    it('produces a full EmailDeliveryExecutionResult carrying every response field', async () => {
      const providerManager = fakeProviderManager(buildResponse({ providerId: 'fake-provider', providerMetadata: { messageId: 'm-1' } }));
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const result = await service.translate(buildTask('task-42'));

      expect(result.executionId).toBe('task-42');
      expect(result.providerId).toBe('fake-provider');
      expect(result.accepted).toBe(true);
      expect(result.providerMetadata).toEqual({ messageId: 'm-1' });
    });
  });

  describe('failed translation', () => {
    it('translates a rejected response into a failed TaskExecutionOutcome with the failure message', async () => {
      const response = buildResponse({
        status: 'REJECTED',
        accepted: false,
        providerMessage: 'Recipient rejected.',
        failure: { category: 'INVALID_RECIPIENT', message: 'Recipient address is invalid.', retryable: false },
      });
      const providerManager = fakeProviderManager(response);
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const outcome = await service.execute(buildTask());

      expect(outcome.success).toBe(false);
      expect(outcome.reason).toBe('Recipient rejected.');
      expect(outcome.failureReason).toBe('Recipient address is invalid.');
    });
  });

  describe('provider unavailable', () => {
    it('faithfully translates a PROVIDER_UNAVAILABLE failure, calling the Provider Manager exactly once (no retry at this layer)', async () => {
      const response = buildResponse({
        status: 'FAILED',
        accepted: false,
        providerMessage: 'Provider is not available.',
        failure: { category: 'PROVIDER_UNAVAILABLE', message: 'No real email provider is configured for this environment yet.', retryable: false },
      });
      const providerManager = fakeProviderManager(response);
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const outcome = await service.execute(buildTask());

      expect(providerManager.sendWithFailover).toHaveBeenCalledTimes(1);
      expect(outcome.success).toBe(false);
      expect(outcome.failureReason).toBe('No real email provider is configured for this environment yet.');
    });

    it('gracefully translates the Provider Manager finding no eligible provider at all', async () => {
      const response = buildResponse({
        providerId: 'none',
        status: 'UNSUPPORTED',
        accepted: false,
        providerMessage: 'No registered provider is eligible for this request; 1 rejected.',
        providerMetadata: {},
        failure: { category: 'PROVIDER_UNAVAILABLE', message: 'No registered provider is eligible for this request; 1 rejected.', retryable: false },
      });
      const providerManager = fakeProviderManager(response, 0);
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const result = await service.translate(buildTask());

      expect(result.providerId).toBe('none');
      expect(result.accepted).toBe(false);
      expect(result.executedAt).toEqual(NOW);
      expect(result.providerMessage).toContain('No registered provider is eligible');
      expect(result.failure).toEqual({
        category: 'PROVIDER_UNAVAILABLE',
        message: 'No registered provider is eligible for this request; 1 rejected.',
        retryable: false,
      });
    });
  });

  describe('unsupported capability', () => {
    it('faithfully translates an UNSUPPORTED status from the Provider Manager', async () => {
      const response = buildResponse({
        status: 'UNSUPPORTED',
        accepted: false,
        providerMessage: 'Attachments are not supported by this provider.',
        failure: { category: 'UNSUPPORTED_CAPABILITY', message: 'Attachments are not supported.', retryable: false },
      });
      const providerManager = fakeProviderManager(response);
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const result = await service.translate(buildTask());

      expect(result.status).toBe('UNSUPPORTED');
      expect(result.accepted).toBe(false);
      expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
    });
  });

  describe('dependency injection', () => {
    it('adapts to a differently-behaving injected Provider Manager without any code change', async () => {
      const acceptingManager = fakeProviderManager(buildResponse({ providerId: 'provider-a', accepted: true }));
      const rejectingManager = fakeProviderManager(
        buildResponse({ providerId: 'provider-b', accepted: false, status: 'REJECTED', failure: { category: 'INVALID_RECIPIENT', message: 'bad recipient', retryable: false } }),
      );

      const serviceA = new EmailDeliveryExecutionService(acceptingManager, fakeEventRecorder());
      const serviceB = new EmailDeliveryExecutionService(rejectingManager, fakeEventRecorder());

      const resultA = await serviceA.translate(buildTask());
      const resultB = await serviceB.translate(buildTask());

      expect(resultA.accepted).toBe(true);
      expect(resultB.accepted).toBe(false);
    });
  });

  describe('deterministic execution', () => {
    it('produces identical results for repeated calls given the same response', async () => {
      const providerManager = fakeProviderManager(buildResponse());
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());
      const task = buildTask();

      const first = await service.translate(task);
      const second = await service.translate(task);

      expect(first).toEqual(second);
    });
  });

  describe('explainability', () => {
    it('exposes execution id, provider id, status, accepted flag, timestamp, message, metadata, and failure', async () => {
      const response = buildResponse({
        providerId: 'fake-provider',
        status: 'ACCEPTED',
        accepted: true,
        executedAt: NOW,
        providerMessage: 'Accepted.',
        providerMetadata: { queueId: 'q-1' },
        failure: null,
      });
      const providerManager = fakeProviderManager(response);
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const result = await service.translate(buildTask('task-explain'));

      expect(result).toEqual({
        executionId: 'task-explain',
        providerId: 'fake-provider',
        status: 'ACCEPTED',
        accepted: true,
        executedAt: NOW,
        providerMessage: 'Accepted.',
        providerMetadata: { queueId: 'q-1' },
        failure: null,
      });
    });
  });

  describe('event recording', () => {
    it('records with the task correlationId/id and the resolved providerId in businessContext', async () => {
      const providerManager = fakeProviderManager(buildResponse());
      const eventRecorder = fakeEventRecorder();
      const service = new EmailDeliveryExecutionService(providerManager, eventRecorder);

      await service.translate(buildTask('task-record'));

      expect(eventRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'correlation-1',
          traceId: 'task-record',
          businessContext: expect.objectContaining({ providerId: 'fake-provider' }),
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('derives selection criteria and constructs the request deterministically from the task', async () => {
      const providerManager = fakeProviderManager(buildResponse());
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      await service.translate(buildTask('task-99'));

      expect(providerManager.sendWithFailover).toHaveBeenCalledWith(
        {
          requestId: 'task-99',
          sender: { displayName: 'German Job Engine', emailAddress: 'no-reply@pending.internal' },
          recipientEmailAddress: 'unresolved-recipient@pending.internal',
          subject: 'Execute batch 1',
          plainTextBody: 'Explanation for batch 1.',
          htmlBody: null,
          attachments: [],
        },
        {
          requiresAttachments: false,
          requiresHtml: false,
          requiresPlainText: true,
          recipientCount: 1,
          correlationId: 'correlation-1',
          traceId: 'task-99',
        },
      );
    });

    it('propagates a Provider Manager rejection unmodified, performing no retry or swallowing', async () => {
      const providerManager = fakeProviderManagerRejecting(new Error('provider manager exploded'));
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      await expect(service.execute(buildTask())).rejects.toThrow('provider manager exploded');
      expect(providerManager.sendWithFailover).toHaveBeenCalledTimes(1);
    });

    it('falls back to null failureReason on execute() when the response has no failure object', async () => {
      const providerManager = fakeProviderManager(buildResponse({ accepted: true, failure: null }));
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const outcome = await service.execute(buildTask());

      expect(outcome.failureReason).toBeNull();
    });

    it('calls the Provider Manager exactly once per translate(), regardless of how many providers it tried internally', async () => {
      const response = buildResponse({ accepted: false, status: 'FAILED', failure: { category: 'PROVIDER_UNAVAILABLE', message: 'all providers failed', retryable: true } });
      const providerManager = fakeProviderManager(response, 3);
      const service = new EmailDeliveryExecutionService(providerManager, fakeEventRecorder());

      const outcome = await service.execute(buildTask());

      expect(providerManager.sendWithFailover).toHaveBeenCalledTimes(1);
      expect(outcome.success).toBe(false);
    });
  });
});
