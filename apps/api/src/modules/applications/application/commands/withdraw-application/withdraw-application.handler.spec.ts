import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActorRole, TransitionReasonCode } from '@german-job-engine/shared-types';
import { WithdrawApplicationHandler } from './withdraw-application.handler';
import { WithdrawApplicationCommand } from './withdraw-application.command';
import { ApplicationRepository } from '../../../domain/repositories/application.repository.interface';
import { Application } from '../../../domain/entities/application.entity';
import { ApplicationSnapshot } from '../../../domain/value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../../../domain/value-objects/application-channel.vo';
import { Actor } from '../../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../../domain/value-objects/correlation-id.vo';

const APPLICATION_ID = '123e4567-e89b-12d3-a456-426614174000';

function draftApplication(): Application {
  return Application.create(
    APPLICATION_ID,
    'candidate-1',
    'job-1',
    'company-1',
    ApplicationSnapshot.create({ jobTitle: 'Backend Engineer', companyName: 'Acme GmbH', jobLocation: 'Berlin' }),
    ApplicationChannel.direct(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
}

describe('WithdrawApplicationHandler', () => {
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: WithdrawApplicationHandler;

  beforeEach(() => {
    applicationRepository = {
      findById: jest.fn(),
      findByCandidateId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new WithdrawApplicationHandler(applicationRepository, eventBus as any);
  });

  it('withdraws the application when the owning candidate is the actor', async () => {
    applicationRepository.findById.mockResolvedValue(draftApplication());

    const result = await handler.execute(
      new WithdrawApplicationCommand(APPLICATION_ID, ActorRole.CANDIDATE, 'candidate-1', TransitionReasonCode.CANDIDATE_REQUEST),
    );

    expect(result.status).toBe('WITHDRAWN');
    expect(applicationRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown application id', async () => {
    applicationRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new WithdrawApplicationCommand(APPLICATION_ID, ActorRole.CANDIDATE, 'candidate-1', TransitionReasonCode.CANDIDATE_REQUEST)),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates WithdrawalPolicy refusal into ForbiddenException when actor is not the owner', async () => {
    applicationRepository.findById.mockResolvedValue(draftApplication());

    await expect(
      handler.execute(
        new WithdrawApplicationCommand(APPLICATION_ID, ActorRole.CANDIDATE, 'someone-else', TransitionReasonCode.CANDIDATE_REQUEST),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });
});
