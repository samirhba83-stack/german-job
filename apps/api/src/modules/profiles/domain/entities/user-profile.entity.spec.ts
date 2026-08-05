import { GermanLevel, AvailabilityStatus } from '@german-job-engine/shared-types';
import { UserProfile } from './user-profile.entity';
import { ProfileCreatedEvent } from '../events/profile-created.event';
import { ProfileUpdatedEvent } from '../events/profile-updated.event';
import { Skills } from '../value-objects/skills.vo';
import { PreferredCities } from '../value-objects/preferred-cities.vo';
import { SalaryExpectation } from '../value-objects/salary-expectation.vo';
import { Availability } from '../value-objects/availability.vo';
import { FileMetadata } from '../value-objects/file-metadata.vo';

describe('UserProfile', () => {
  it('starts at 0% completion and raises a ProfileCreatedEvent on creation', () => {
    const profile = UserProfile.create('profile-1', 'user-1');

    expect(profile.calculateCompletionPercentage()).toBe(0);
    expect(profile.domainEvents).toHaveLength(1);
    expect(profile.domainEvents[0]).toBeInstanceOf(ProfileCreatedEvent);
  });

  it('does not raise domain events when reconstituted from persistence', () => {
    const profile = UserProfile.reconstitute('profile-1', {
      userId: 'user-1',
      germanLevel: null,
      skills: Skills.empty(),
      preferredCities: PreferredCities.empty(),
      salaryExpectation: null,
      availability: null,
      cv: null,
      photo: null,
      workExperiences: [],
      educations: [],
      languages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(profile.domainEvents).toHaveLength(0);
  });

  it('increases completion percentage as sections are filled and raises ProfileUpdatedEvent', () => {
    const profile = UserProfile.create('profile-1', 'user-1');
    profile.clearDomainEvents();

    profile.update({ germanLevel: GermanLevel.B2, skills: Skills.create(['TypeScript']) });

    expect(profile.calculateCompletionPercentage()).toBe(20);
    expect(profile.domainEvents.some((event) => event instanceof ProfileUpdatedEvent)).toBe(true);
  });

  it('reaches 100% completion when every section is filled', () => {
    const profile = UserProfile.create('profile-1', 'user-1');
    profile.update({
      germanLevel: GermanLevel.C1,
      skills: Skills.create(['TypeScript']),
      preferredCities: PreferredCities.create(['Berlin']),
      salaryExpectation: SalaryExpectation.create(40000, 60000, 'EUR'),
      availability: Availability.create(AvailabilityStatus.IMMEDIATELY),
      workExperiences: [],
      educations: [],
      languages: [],
    });
    profile.attachCv(
      FileMetadata.create({ fileName: 'cv.pdf', fileUrl: 'url', mimeType: 'application/pdf', sizeBytes: 10 }),
    );
    profile.attachPhoto(
      FileMetadata.create({ fileName: 'photo.jpg', fileUrl: 'url', mimeType: 'image/jpeg', sizeBytes: 10 }),
    );

    // workExperiences/educations/languages are still empty, so completion is 7/10 sections.
    expect(profile.calculateCompletionPercentage()).toBe(70);
  });

  it('only updates fields that are explicitly provided', () => {
    const profile = UserProfile.create('profile-1', 'user-1');
    profile.update({ germanLevel: GermanLevel.B1 });
    profile.update({ skills: Skills.create(['Go']) });

    expect(profile.germanLevel).toBe(GermanLevel.B1);
    expect(profile.skills.items).toEqual(['Go']);
  });
});
