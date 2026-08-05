import { BadRequestException, ConflictException } from '@nestjs/common';
import { MarkDeliveredHandler } from './mark-delivered.handler';
import { MarkDeliveredCommand } from './mark-delivered.command';
import { ApplicationRepository } from '../../../domain/repositories/application.repository.interface';
import { Application } from '../../../domain/entities/application.entity';
import { ApplicationSnapshot } from '../../../domain/value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../../../domain/value-objects/application-channel.vo';
import { Actor } from '../../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../../domain/value-objects/correlation-id.vo';

const APPLICATION_ID = '123e4567-e89b-12d3-a456-426614174000';

function sentApplication(): Application {
  const application = Application.create(
    APPLICATION_ID,
    'candidate-1',
    'job-1',
    'company-1',
    ApplicationSnapshot.create({ jobTitle: 'Backend Engineer', companyName: 'Acme GmbH', jobLocation: 'Berlin' }),
    ApplicationChannel.direct(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
  application.prepare(Actor.candidate('candidate-1'), CorrelationId.create('corr-0'));
  application.queue(Actor.candidate('candidate-1'), CorrelationId.create('corr-0'));
  application.send(Actor.candidate('candidate-1'), CorrelationId.create('corr-0'));
  return application;
}

describe('MarkDeliveredHandler', () => {
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: MarkDeliveredHandler;

  beforeEach(() => {
    applicationRepository = {
      findById: jest.fn(),
      findByCandidateId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new MarkDeliveredHandler(applicationRepository, eventBus as any);
  });

  it('marks a sent application delivered under a system actor', async () => {
    applicationRepository.findById.mockResolvedValue(sentApplication());

    const result = await handler.execute(new MarkDeliveredCommand(APPLICATION_ID, 'email-webhook', 'evt-1', 0.9));

    expect(result.status).toBe('DELIVERED');
    expect(applicationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('translates an invalid confidence score into BadRequestException', async () => {
    applicationRepository.findById.mockResolvedValue(sentApplication());

    await expect(handler.execute(new MarkDeliveredCommand(APPLICATION_ID, 'email-webhook', 'evt-1', 1.5))).rejects.toThrow(
      BadRequestException,
    );
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it('translates an unreachable transition into ConflictException', async () => {
    const draft = Application.create(
      APPLICATION_ID,
      'candidate-1',
      'job-1',
      'company-1',
      ApplicationSnapshot.create({ jobTitle: 'Backend Engineer', companyName: 'Acme GmbH', jobLocation: 'Berlin' }),
      ApplicationChannel.direct(),
      Actor.candidate('candidate-1'),
      CorrelationId.create('corr-0'),
    );
    applicationRepository.findById.mockResolvedValue(draft);

    await expect(handler.execute(new MarkDeliveredCommand(APPLICATION_ID, 'email-webhook', 'evt-1', 0.9))).rejects.toThrow(
      ConflictException,
    );
  });
});
