import { BadRequestException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserRole } from '@german-job-engine/shared-types';
import { UpdateCompanyCommand } from './update-company.command';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../domain/repositories/company.repository.interface';
import { CompanyUpdate } from '../../../domain/entities/company.entity';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';
import { CompanyLocation } from '../../../domain/value-objects/company-location.vo';
import { CompanyWebsite } from '../../../domain/value-objects/company-website.vo';
import { CompanyContact } from '../../../domain/value-objects/company-contact.vo';
import { CompanyMetadata } from '../../../domain/value-objects/company-metadata.vo';
import { CompanyResponseDto } from '../../dto/company-response.dto';
import { CompanyResponseMapper } from '../../dto/company-response.mapper';

@CommandHandler(UpdateCompanyCommand)
export class UpdateCompanyHandler implements ICommandHandler<UpdateCompanyCommand> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateCompanyCommand): Promise<CompanyResponseDto> {
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
      throw new ForbiddenException('You do not have permission to modify this company');
    }

    const changes = this.buildDomainChanges(command.changes);
    company.update(changes);

    await this.companyRepository.save(company);
    company.domainEvents.forEach((event) => this.eventBus.publish(event));
    company.clearDomainEvents();

    return CompanyResponseMapper.toDto(company);
  }

  private buildDomainChanges(changes: UpdateCompanyCommand['changes']): CompanyUpdate {
    try {
      const domainChanges: CompanyUpdate = {};

      if (changes.name !== undefined) domainChanges.name = changes.name;
      if (changes.industry !== undefined) domainChanges.industry = changes.industry;
      if (changes.size !== undefined) domainChanges.size = changes.size;
      if (changes.location !== undefined) domainChanges.location = CompanyLocation.create(changes.location);
      if (changes.websiteUrl !== undefined) domainChanges.website = CompanyWebsite.create(changes.websiteUrl);
      if (changes.contact !== undefined) domainChanges.contact = CompanyContact.create(changes.contact);
      if (changes.visaSponsorship !== undefined) domainChanges.visaSponsorship = changes.visaSponsorship;
      if (changes.ausbildungSupport !== undefined) domainChanges.ausbildungSupport = changes.ausbildungSupport;
      if (changes.metadata !== undefined) domainChanges.metadata = CompanyMetadata.create(changes.metadata);

      return domainChanges;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid company update');
    }
  }
}
