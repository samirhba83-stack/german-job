import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UpdateProfileCommand } from './update-profile.command';
import {
  USER_PROFILE_REPOSITORY,
  UserProfileRepository,
} from '../../../domain/repositories/user-profile.repository.interface';
import { UserProfileUpdate } from '../../../domain/entities/user-profile.entity';
import { Skills } from '../../../domain/value-objects/skills.vo';
import { PreferredCities } from '../../../domain/value-objects/preferred-cities.vo';
import { SalaryExpectation } from '../../../domain/value-objects/salary-expectation.vo';
import { Availability } from '../../../domain/value-objects/availability.vo';
import { WorkExperience } from '../../../domain/value-objects/work-experience.vo';
import { Education } from '../../../domain/value-objects/education.vo';
import { LanguageEntry } from '../../../domain/value-objects/language-entry.vo';
import { ProfileResponseDto } from '../../dto/profile-response.dto';
import { ProfileResponseMapper } from '../../dto/profile-response.mapper';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profileRepository: UserProfileRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findByUserId(command.userId);
    if (!profile) {
      throw new NotFoundException(`Profile not found for user: ${command.userId}`);
    }

    const changes = this.buildDomainChanges(command.changes);

    profile.update(changes);

    await this.profileRepository.save(profile);
    profile.domainEvents.forEach((event) => this.eventBus.publish(event));
    profile.clearDomainEvents();

    return ProfileResponseMapper.toDto(profile);
  }

  private buildDomainChanges(changes: UpdateProfileCommand['changes']): UserProfileUpdate {
    try {
      const domainChanges: UserProfileUpdate = {};

      if (changes.germanLevel !== undefined) {
        domainChanges.germanLevel = changes.germanLevel;
      }
      if (changes.skills !== undefined) {
        domainChanges.skills = Skills.create(changes.skills);
      }
      if (changes.preferredCities !== undefined) {
        domainChanges.preferredCities = PreferredCities.create(changes.preferredCities);
      }
      if (changes.salaryExpectation !== undefined) {
        domainChanges.salaryExpectation = SalaryExpectation.create(
          changes.salaryExpectation.min,
          changes.salaryExpectation.max,
          changes.salaryExpectation.currency,
        );
      }
      if (changes.availability !== undefined) {
        domainChanges.availability = Availability.create(
          changes.availability.status,
          changes.availability.availableFrom ? new Date(changes.availability.availableFrom) : null,
        );
      }
      if (changes.workExperiences !== undefined) {
        domainChanges.workExperiences = changes.workExperiences.map((entry) =>
          WorkExperience.create({
            company: entry.company,
            title: entry.title,
            startDate: new Date(entry.startDate),
            endDate: entry.endDate ? new Date(entry.endDate) : null,
            description: entry.description ?? null,
          }),
        );
      }
      if (changes.educations !== undefined) {
        domainChanges.educations = changes.educations.map((entry) =>
          Education.create({
            institution: entry.institution,
            degree: entry.degree,
            fieldOfStudy: entry.fieldOfStudy ?? null,
            startDate: new Date(entry.startDate),
            endDate: entry.endDate ? new Date(entry.endDate) : null,
          }),
        );
      }
      if (changes.languages !== undefined) {
        domainChanges.languages = changes.languages.map((entry) =>
          LanguageEntry.create(entry.language, entry.proficiency),
        );
      }

      return domainChanges;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid profile update');
    }
  }
}
