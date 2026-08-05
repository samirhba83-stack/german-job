import { AvailabilityStatus, GermanLevel, LanguageProficiency } from '@german-job-engine/shared-types';

export interface UpdateProfileSalaryExpectation {
  min: number;
  max: number;
  currency: string;
}

export interface UpdateProfileAvailability {
  status: AvailabilityStatus;
  availableFrom?: string;
}

export interface UpdateProfileWorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface UpdateProfileEducation {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
}

export interface UpdateProfileLanguage {
  language: string;
  proficiency: LanguageProficiency;
}

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly changes: {
      germanLevel?: GermanLevel;
      skills?: string[];
      preferredCities?: string[];
      salaryExpectation?: UpdateProfileSalaryExpectation;
      availability?: UpdateProfileAvailability;
      workExperiences?: UpdateProfileWorkExperience[];
      educations?: UpdateProfileEducation[];
      languages?: UpdateProfileLanguage[];
    },
  ) {}
}
