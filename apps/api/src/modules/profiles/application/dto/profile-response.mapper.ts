import { UserProfile } from '../../domain/entities/user-profile.entity';
import { ProfileResponseDto } from './profile-response.dto';

/** Assembles the read-facing DTO from the domain aggregate — shared by every handler that returns a profile. */
export class ProfileResponseMapper {
  static toDto(profile: UserProfile): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = profile.id;
    dto.userId = profile.userId;
    dto.germanLevel = profile.germanLevel;
    dto.skills = [...profile.skills.items];
    dto.preferredCities = [...profile.preferredCities.items];

    dto.salaryExpectation = profile.salaryExpectation
      ? {
          min: profile.salaryExpectation.min,
          max: profile.salaryExpectation.max,
          currency: profile.salaryExpectation.currency,
        }
      : null;

    dto.availability = profile.availability
      ? {
          status: profile.availability.status,
          availableFrom: profile.availability.availableFrom,
        }
      : null;

    dto.cv = profile.cv
      ? {
          fileName: profile.cv.fileName,
          fileUrl: profile.cv.fileUrl,
          mimeType: profile.cv.mimeType,
          sizeBytes: profile.cv.sizeBytes,
          uploadedAt: profile.cv.uploadedAt,
        }
      : null;

    dto.photo = profile.photo
      ? {
          fileName: profile.photo.fileName,
          fileUrl: profile.photo.fileUrl,
          mimeType: profile.photo.mimeType,
          sizeBytes: profile.photo.sizeBytes,
          uploadedAt: profile.photo.uploadedAt,
        }
      : null;

    dto.workExperiences = profile.workExperiences.map((entry) => ({
      company: entry.company,
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate,
      description: entry.description,
    }));

    dto.educations = profile.educations.map((entry) => ({
      institution: entry.institution,
      degree: entry.degree,
      fieldOfStudy: entry.fieldOfStudy,
      startDate: entry.startDate,
      endDate: entry.endDate,
    }));

    dto.languages = profile.languages.map((entry) => ({
      language: entry.language,
      proficiency: entry.proficiency,
    }));

    dto.completionPercentage = profile.calculateCompletionPercentage();
    dto.createdAt = profile.createdAt;
    dto.updatedAt = profile.updatedAt;

    return dto;
  }
}
