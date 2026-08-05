import { BadRequestException, ConflictException, Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ReopenJobCommand } from './reopen-job.command';
import { JOB_REPOSITORY, JobRepository } from '../../../domain/repositories/job.repository.interface';
import { JobId } from '../../../domain/value-objects/job-id.vo';
import { InvalidJobStatusTransitionException } from '../../../domain/exceptions/invalid-job-status-transition.exception';
import { JobMissingMandatoryFieldsException } from '../../../domain/exceptions/job-missing-mandatory-fields.exception';
import { assertCanManageJob } from '../../job-authorization.helper';
import { JobResponseDto } from '../../dto/job-response.dto';
import { JobResponseMapper } from '../../dto/job-response.mapper';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../../companies/domain/repositories/company.repository.interface';

@CommandHandler(ReopenJobCommand)
export class ReopenJobHandler implements ICommandHandler<ReopenJobCommand> {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReopenJobCommand): Promise<JobResponseDto> {
    try {
      JobId.create(command.jobId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid job id');
    }

    const job = await this.jobRepository.findById(command.jobId);
    if (!job) {
      throw new NotFoundException(`Job not found: ${command.jobId}`);
    }

    await assertCanManageJob(this.companyRepository, job.companyId, command.requesterId, command.requesterRole);

    try {
      job.reopen();
    } catch (error) {
      if (error instanceof JobMissingMandatoryFieldsException) {
        throw new UnprocessableEntityException(error.message);
      }
      if (error instanceof InvalidJobStatusTransitionException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    await this.jobRepository.save(job);
    job.domainEvents.forEach((event) => this.eventBus.publish(event));
    job.clearDomainEvents();

    return JobResponseMapper.toDto(job);
  }
}
