import {
  UserProfile as PrismaUserProfile,
  WorkExperienceEntry as PrismaWorkExperienceEntry,
  EducationEntry as PrismaEducationEntry,
  LanguageEntry as PrismaLanguageEntry,
} from '@german-job-engine/database';
import { GermanLevel, AvailabilityStatus, LanguageProficiency } from '@german-job-engine/shared-types';
import { UserProfile, UserProfileProps } from '../../domain/entities/user-profile.entity';
import { Skills } from '../../domain/value-objects/skills.vo';
import { PreferredCities } from '../../domain/value-objects/preferred-cities.vo';
import { SalaryExpectation } from '../../domain/value-objects/salary-expectation.vo';
import { Availability } from '../../domain/value-objects/availability.vo';
import { FileMetadata } from '../../domain/value-objects/file-metadata.vo';
import { WorkExperience } from '../../domain/value-objects/work-experience.vo';
import { Education } from '../../domain/value-objects/education.vo';
import { LanguageEntry } from '../../domain/value-objects/language-entry.vo';

export type PrismaUserProfileWithRelations = PrismaUserProfile & {
  workExperiences: PrismaWorkExperienceEntry[];
  educations: PrismaEducationEntry[];
  languages: PrismaLanguageEntry[];
};

export interface UserProfilePersistenceScalars {
  germanLevel: PrismaUserProfile['germanLevel'];
  skills: string[];
  preferredCities: string[];
  salaryExpectationMin: number | null;
  salaryExpectationMax: number | null;
  salaryExpectationCurrency: string | null;
  availabilityStatus: PrismaUserProfile['availabilityStatus'];
  availableFrom: Date | null;
  cvFileName: string | null;
  cvFileUrl: string | null;
  cvMimeType: string | null;
  cvSizeBytes: number | null;
  cvUploadedAt: Date | null;
  photoFileName: string | null;
  photoFileUrl: string | null;
  photoMimeType: string | null;
  photoSizeBytes: number | null;
  photoUploadedAt: Date | null;
}

export interface UserProfilePersistenceData {
  scalars: UserProfilePersistenceScalars;
  workExperiences: Omit<PrismaWorkExperienceEntry, 'id' | 'profileId' | 'createdAt'>[];
  educations: Omit<PrismaEducationEntry, 'id' | 'profileId' | 'createdAt'>[];
  languages: Omit<PrismaLanguageEntry, 'id' | 'profileId' | 'createdAt'>[];
}

export class UserProfileMapper {
  static toDomain(raw: PrismaUserProfileWithRelations): UserProfile {
    const props: UserProfileProps = {
      userId: raw.userId,
      germanLevel: raw.germanLevel as unknown as GermanLevel | null,
      skills: Skills.create(raw.skills),
      preferredCities: PreferredCities.create(raw.preferredCities),
      salaryExpectation:
        raw.salaryExpectationMin !== null &&
        raw.salaryExpectationMax !== null &&
        raw.salaryExpectationCurrency !== null
          ? SalaryExpectation.create(
              raw.salaryExpectationMin,
              raw.salaryExpectationMax,
              raw.salaryExpectationCurrency,
            )
          : null,
      availability: raw.availabilityStatus
        ? Availability.create(raw.availabilityStatus as unknown as AvailabilityStatus, raw.availableFrom)
        : null,
      cv:
        raw.cvFileName && raw.cvFileUrl && raw.cvMimeType && raw.cvSizeBytes && raw.cvUploadedAt
          ? FileMetadata.create({
              fileName: raw.cvFileName,
              fileUrl: raw.cvFileUrl,
              mimeType: raw.cvMimeType,
              sizeBytes: raw.cvSizeBytes,
              uploadedAt: raw.cvUploadedAt,
            })
          : null,
      photo:
        raw.photoFileName && raw.photoFileUrl && raw.photoMimeType && raw.photoSizeBytes && raw.photoUploadedAt
          ? FileMetadata.create({
              fileName: raw.photoFileName,
              fileUrl: raw.photoFileUrl,
              mimeType: raw.photoMimeType,
              sizeBytes: raw.photoSizeBytes,
              uploadedAt: raw.photoUploadedAt,
            })
          : null,
      workExperiences: raw.workExperiences.map((entry) =>
        WorkExperience.create({
          company: entry.company,
          title: entry.title,
          startDate: entry.startDate,
          endDate: entry.endDate,
          description: entry.description,
        }),
      ),
      educations: raw.educations.map((entry) =>
        Education.create({
          institution: entry.institution,
          degree: entry.degree,
          fieldOfStudy: entry.fieldOfStudy,
          startDate: entry.startDate,
          endDate: entry.endDate,
        }),
      ),
      languages: raw.languages.map((entry) =>
        LanguageEntry.create(entry.language, entry.proficiency as unknown as LanguageProficiency),
      ),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };

    return UserProfile.reconstitute(raw.id, props);
  }

  static toPersistence(profile: UserProfile): UserProfilePersistenceData {
    return {
      scalars: {
        germanLevel: profile.germanLevel as unknown as PrismaUserProfile['germanLevel'],
        skills: [...profile.skills.items],
        preferredCities: [...profile.preferredCities.items],
        salaryExpectationMin: profile.salaryExpectation?.min ?? null,
        salaryExpectationMax: profile.salaryExpectation?.max ?? null,
        salaryExpectationCurrency: profile.salaryExpectation?.currency ?? null,
        availabilityStatus: (profile.availability?.status ??
          null) as unknown as PrismaUserProfile['availabilityStatus'],
        availableFrom: profile.availability?.availableFrom ?? null,
        cvFileName: profile.cv?.fileName ?? null,
        cvFileUrl: profile.cv?.fileUrl ?? null,
        cvMimeType: profile.cv?.mimeType ?? null,
        cvSizeBytes: profile.cv?.sizeBytes ?? null,
        cvUploadedAt: profile.cv?.uploadedAt ?? null,
        photoFileName: profile.photo?.fileName ?? null,
        photoFileUrl: profile.photo?.fileUrl ?? null,
        photoMimeType: profile.photo?.mimeType ?? null,
        photoSizeBytes: profile.photo?.sizeBytes ?? null,
        photoUploadedAt: profile.photo?.uploadedAt ?? null,
      },
      workExperiences: profile.workExperiences.map((entry) => ({
        company: entry.company,
        title: entry.title,
        startDate: entry.startDate,
        endDate: entry.endDate,
        description: entry.description,
      })),
      educations: profile.educations.map((entry) => ({
        institution: entry.institution,
        degree: entry.degree,
        fieldOfStudy: entry.fieldOfStudy,
        startDate: entry.startDate,
        endDate: entry.endDate,
      })),
      languages: profile.languages.map((entry) => ({
        language: entry.language,
        proficiency: entry.proficiency as unknown as PrismaLanguageEntry['proficiency'],
      })),
    };
  }
}
