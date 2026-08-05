import { BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { CreateCompanyCommand } from './create-company.command';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../domain/repositories/company.repository.interface';
import { Company } from '../../../domain/entities/company.entity';
import { CompanyLocation } from '../../../domain/value-objects/company-location.vo';
import { CompanyWebsite } from '../../../domain/value-objects/company-website.vo';
import { CompanyContact } from '../../../domain/value-objects/company-contact.vo';
import { CompanyMetadata } from '../../../domain/value-objects/company-metadata.vo';
import { CompanyAlreadyExistsException } from '../../../domain/exceptions/company-already-exists.exception';
import { CompanyResponseDto } from '../../dto/company-response.dto';
import { CompanyResponseMapper } from '../../dto/company-response.mapper';

@CommandHandler(CreateCompanyCommand)
export class CreateCompanyHandler implements ICommandHandler<CreateCompanyCommand> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateCompanyCommand): Promise<CompanyResponseDto> {
    const existing = await this.companyRepository.findByOwnerId(command.ownerId);
    if (existing) {
      throw new ConflictException(new CompanyAlreadyExistsException(command.ownerId).message);
    }

    let company: Company;
    try {
      company = Company.create(randomUUID(), command.ownerId, {
        name: command.data.name,
        industry: command.data.industry,
        size: command.data.size,
        location: CompanyLocation.create(command.data.location),
        website: command.data.websiteUrl ? CompanyWebsite.create(command.data.websiteUrl) : null,
        contact: CompanyContact.create(command.data.contact),
        visaSponsorship: command.data.visaSponsorship,
        ausbildungSupport: command.data.ausbildungSupport,
        metadata: command.data.metadata ? CompanyMetadata.create(command.data.metadata) : undefined,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid company data');
    }

    await this.companyRepository.save(company);
    company.domainEvents.forEach((event) => this.eventBus.publish(event));
    company.clearDomainEvents();

    return CompanyResponseMapper.toDto(company);
  }
}
