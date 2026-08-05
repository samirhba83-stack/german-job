import { BadRequestException, ConflictException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserRole } from '@german-job-engine/shared-types';
import { RestoreCompanyCommand } from './restore-company.command';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../domain/repositories/company.repository.interface';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';
import { CompanyNotArchivedException } from '../../../domain/exceptions/company-not-archived.exception';
import { CompanyResponseDto } from '../../dto/company-response.dto';
import { CompanyResponseMapper } from '../../dto/company-response.mapper';

@CommandHandler(RestoreCompanyCommand)
export class RestoreCompanyHandler implements ICommandHandler<RestoreCompanyCommand> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RestoreCompanyCommand): Promise<CompanyResponseDto> {
    try {
      CompanyId.create(command.companyId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid company id');
    }

    const company = await this.companyRepository.findById(command.companyId);
    if (!company) {
      throw new NotFoundException(`Company not found: ${command.companyId}`);
    }

    if (company.ownerId !== command.requesterId && command.requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to restore this company');
    }

    try {
      company.restore();
    } catch (error) {
      if (error instanceof CompanyNotArchivedException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    await this.companyRepository.save(company);
    company.domainEvents.forEach((event) => this.eventBus.publish(event));
    company.clearDomainEvents();

    return CompanyResponseMapper.toDto(company);
  }
}
