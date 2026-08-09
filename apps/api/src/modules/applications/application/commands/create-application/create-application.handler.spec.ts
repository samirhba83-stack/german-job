import { BadRequestException, ConflictException } from '@nestjs/common';
import { ActorRole, TransitionReasonCode } from '@german-job-engine/shared-types';
import { CreateApplicationHandler } from './create-application.handler';
import { CreateApplicationCommand } from './create-application.command';
import { ApplicationRepository } from '../../../domain/repositories/application.repository.interface';
import { Application } from '../../../domain/entities/application.entity';
import { ApplicationSnapshot } from '../../../domain/value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../../../domain/value-objects/application-channel.vo';
import { Actor } from '../../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../../domain/value-objects/correlation-id.vo';
import { TransitionReason } from '../../../domain/value-objects/transition-reason.vo';

const VALID_SNAPSHOT = { jobTitle: 'Backend Engineer', companyName: 'Acme GmbH', jobLocation: 'Berlin' };

function existingApplication(jobId: string, terminal = false): Application {
  const application = Application.create(
    '123e4567-e89b-12d3-a456-426614174000',
    'candidate-1',
    jobId,
    'company-1',
    ApplicationSnapshot.create(VALID_SNAPSHOT),
    ApplicationChannel.direct(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
  if (terminal) {
    application.archive(
      Actor.admin('admin-1'),
      CorrelationId.create('corr-0'),
      null,
      TransitionReason.create(TransitionReasonCode.CANDIDATE_REQUEST),
    );
  }
  return application;
}

describe('CreateApplicationHandler', () => {
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: CreateApplicationHandler;

  beforeEach(() => {
    applicationRepository = {
      findById: jest.fn(),
      findByCandidateId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new CreateApplicationHandler(applicationRepository, eventBus as any);
  });

  it('creates a draft application and publishes its domain events', async () => {
    applicationRepository.findByCandidateId.mockResolvedValue([]);

    const result = await handler.execute(
      new CreateApplicationCommand('candidate-1', 'job-1', 'company-1', VALID_SNAPSHOT, ActorRole.CANDIDATE, 'candidate-1'),
    );

    expect(applicationRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('DRAFT');
    expect(result.candidateId).toBe('candidate-1');
  });

  it('refuses a duplicate active application for the same candidate and job', async () => {
    applicationRepository.findByCandidateId.mockResolvedValue([existingApplication('job-1')]);

    await expect(
      handler.execute(
        new CreateApplicationCommand('candidate-1', 'job-1', 'company-1', VALID_SNAPSHOT, ActorRole.CANDIDATE, 'candidate-1'),
      ),
    ).rejects.toThrow(ConflictException);
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it('allows a new application once the prior one for that job is terminal', async () => {
    applicationRepository.findByCandidateId.mockResolvedValue([existingApplication('job-1', true)]);

    const result = await handler.execute(
      new CreateApplicationCommand('candidate-1', 'job-1', 'company-1', VALID_SNAPSHOT, ActorRole.CANDIDATE, 'candidate-1'),
    );

    expect(result.status).toBe('DRAFT');
  });

  it('translates invalid snapshot data into BadRequestException', async () => {
    applicationRepository.findByCandidateId.mockResolvedValue([]);

    await expect(
      handler.execute(
        new CreateApplicationCommand(
          'candidate-1',
          'job-1',
          'company-1',
          { jobTitle: '', companyName: 'Acme GmbH', jobLocation: 'Berlin' },
          ActorRole.CANDIDATE,
          'candidate-1',
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });
});
