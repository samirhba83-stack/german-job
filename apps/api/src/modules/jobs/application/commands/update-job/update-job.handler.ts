import { BadRequestException, ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserRole } from '@german-job-engine/shared-types';
import { UpdateJobCommand } from './update-job.command';
import { JOB_REPOSITORY, JobRepository } from '../../../domain/repositories/job.repository.interface';
import { JobUpdate } from '../../../domain/entities/job.entity';
import { JobId } from '../../../domain/value-objects/job-id.vo';
import { JobTitle } from '../../../domain/value-objects/job-title.vo';
import { JobDescription } from '../../../domain/value-objects/job-description.vo';
import { WorkLocation } from '../../../domain/value-objects/work-location.vo';
import { JobClosedException } from '../../../domain/exceptions/job-closed.exception';
import { buildOptionalJobFields } from '../../job-fields.builder';
import { assertCanManageJob } from '../../job-authorization.helper';
import { JobResponseDto } from '../../dto/job-response.dto';
import { JobResponseMapper } from '../../dto/job-response.mapper';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../../companies/domain/repositories/company.repository.interface';

@CommandHandler(UpdateJobCommand)
export class UpdateJobHandler implements ICommandHandler<UpdateJobCommand> {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateJobCommand): Promise<JobResponseDto> {
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

    const changes = this.buildDomainChanges(command.changes);

    try {
      job.update(changes, { allowEditWhenClosed: command.requesterRole === UserRole.ADMIN });
    } catch (error) {
      if (error instanceof JobClosedException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    await this.jobRepository.save(job);
    job.domainEvents.forEach((event) => this.eventBus.publish(event));
    job.clearDomainEvents();

    return JobResponseMapper.toDto(job);
  }

  private buildDomainChanges(changes: UpdateJobCommand['changes']): JobUpdate {
    try {
      const domainChanges: JobUpdate = buildOptionalJobFields(changes);

      if (changes.title !== undefined) domainChanges.title = JobTitle.create(changes.title);
      if (changes.description !== undefined) domainChanges.description = JobDescription.create(changes.description);
      if (changes.employmentType !== undefined) domainChanges.employmentType = changes.employmentType;
      if (changes.contractType !== undefined) domainChanges.contractType = changes.contractType;
      if (changes.workLocation !== undefined) domainChanges.workLocation = WorkLocation.create(changes.workLocation);
      if (changes.remotePolicy !== undefined) domainChanges.remotePolicy = changes.remotePolicy;

      return domainChanges;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid job update');
    }
  }
}
