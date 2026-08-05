import { BadRequestException, ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { CreateJobCommand } from './create-job.command';
import { JOB_REPOSITORY, JobRepository } from '../../../domain/repositories/job.repository.interface';
import { Job } from '../../../domain/entities/job.entity';
import { JobTitle } from '../../../domain/value-objects/job-title.vo';
import { JobDescription } from '../../../domain/value-objects/job-description.vo';
import { WorkLocation } from '../../../domain/value-objects/work-location.vo';
import { buildOptionalJobFields } from '../../job-fields.builder';
import { JobResponseDto } from '../../dto/job-response.dto';
import { JobResponseMapper } from '../../dto/job-response.mapper';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../../companies/domain/repositories/company.repository.interface';

@CommandHandler(CreateJobCommand)
export class CreateJobHandler implements ICommandHandler<CreateJobCommand> {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateJobCommand): Promise<JobResponseDto> {
    const company = await this.companyRepository.findByOwnerId(command.requesterId);
    if (!company) {
      throw new NotFoundException('You must create a company profile before posting jobs');
    }
    if (!company.isActive()) {
      throw new ConflictException('Cannot post jobs under an archived company');
    }

    let job: Job;
    try {
      const optionalFields = buildOptionalJobFields(command.data);
      job = Job.create(randomUUID(), company.id, {
        title: JobTitle.create(command.data.title),
        description: JobDescription.create(command.data.description),
        employmentType: command.data.employmentType,
        contractType: command.data.contractType,
        workLocation: WorkLocation.create(command.data.workLocation),
        remotePolicy: command.data.remotePolicy,
        ...optionalFields,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid job data');
    }

    await this.jobRepository.save(job);
    job.domainEvents.forEach((event) => this.eventBus.publish(event));
    job.clearDomainEvents();

    return JobResponseMapper.toDto(job);
  }
}
