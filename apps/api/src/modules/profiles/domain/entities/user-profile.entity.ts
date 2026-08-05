import { GermanLevel } from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { Skills } from '../value-objects/skills.vo';
import { PreferredCities } from '../value-objects/preferred-cities.vo';
import { SalaryExpectation } from '../value-objects/salary-expectation.vo';
import { Availability } from '../value-objects/availability.vo';
import { FileMetadata } from '../value-objects/file-metadata.vo';
import { WorkExperience } from '../value-objects/work-experience.vo';
import { Education } from '../value-objects/education.vo';
import { LanguageEntry } from '../value-objects/language-entry.vo';
import { ProfileCreatedEvent } from '../events/profile-created.event';
import { ProfileUpdatedEvent } from '../events/profile-updated.event';

export interface UserProfileProps {
  userId: string;
  germanLevel: GermanLevel | null;
  skills: Skills;
  preferredCities: PreferredCities;
  salaryExpectation: SalaryExpectation | null;
  availability: Availability | null;
  cv: FileMetadata | null;
  photo: FileMetadata | null;
  workExperiences: WorkExperience[];
  educations: Education[];
  languages: LanguageEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileUpdate {
  germanLevel?: GermanLevel;
  skills?: Skills;
  preferredCities?: PreferredCities;
  salaryExpectation?: SalaryExpectation;
  availability?: Availability;
  workExperiences?: WorkExperience[];
  educations?: Education[];
  languages?: LanguageEntry[];
}

export class UserProfile extends AggregateRoot<string> {
  private props: UserProfileProps;

  private constructor(id: string, props: UserProfileProps) {
    super(id);
    this.props = props;
  }

  get userId(): string {
    return this.props.userId;
  }

  get germanLevel(): GermanLevel | null {
    return this.props.germanLevel;
  }

  get skills(): Skills {
    return this.props.skills;
  }

  get preferredCities(): PreferredCities {
    return this.props.preferredCities;
  }

  get salaryExpectation(): SalaryExpectation | null {
    return this.props.salaryExpectation;
  }

  get availability(): Availability | null {
    return this.props.availability;
  }

  get cv(): FileMetadata | null {
    return this.props.cv;
  }

  get photo(): FileMetadata | null {
    return this.props.photo;
  }

  get workExperiences(): ReadonlyArray<WorkExperience> {
    return this.props.workExperiences;
  }

  get educations(): ReadonlyArray<Education> {
    return this.props.educations;
  }

  get languages(): ReadonlyArray<LanguageEntry> {
    return this.props.languages;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Creates a brand-new, empty profile shell for a user and raises the corresponding domain event. */
  static create(id: string, userId: string): UserProfile {
    const now = new Date();
    const profile = new UserProfile(id, {
      userId,
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
      createdAt: now,
      updatedAt: now,
    });
    profile.addDomainEvent(new ProfileCreatedEvent(id, userId));
    return profile;
  }

  /** Rehydrates a UserProfile from persistence without re-raising domain events. */
  static reconstitute(id: string, props: UserProfileProps): UserProfile {
    return new UserProfile(id, props);
  }

  /** Applies a partial set of changes — only provided fields are updated. */
  update(changes: UserProfileUpdate): void {
    if (changes.germanLevel !== undefined) this.props.germanLevel = changes.germanLevel;
    if (changes.skills !== undefined) this.props.skills = changes.skills;
    if (changes.preferredCities !== undefined) this.props.preferredCities = changes.preferredCities;
    if (changes.salaryExpectation !== undefined) this.props.salaryExpectation = changes.salaryExpectation;
    if (changes.availability !== undefined) this.props.availability = changes.availability;
    if (changes.workExperiences !== undefined) this.props.workExperiences = changes.workExperiences;
    if (changes.educations !== undefined) this.props.educations = changes.educations;
    if (changes.languages !== undefined) this.props.languages = changes.languages;

    this.touch();
    this.addDomainEvent(new ProfileUpdatedEvent(this.id));
  }

  attachCv(file: FileMetadata): void {
    this.props.cv = file;
    this.touch();
    this.addDomainEvent(new ProfileUpdatedEvent(this.id));
  }

  attachPhoto(file: FileMetadata): void {
    this.props.photo = file;
    this.touch();
    this.addDomainEvent(new ProfileUpdatedEvent(this.id));
  }

  /** Equal-weight completion score across the profile's fillable sections, rounded to an integer percentage. */
  calculateCompletionPercentage(): number {
    const sections = [
      this.props.germanLevel !== null,
      !this.props.skills.isEmpty(),
      !this.props.preferredCities.isEmpty(),
      this.props.salaryExpectation !== null,
      this.props.availability !== null,
      this.props.cv !== null,
      this.props.photo !== null,
      this.props.workExperiences.length > 0,
      this.props.educations.length > 0,
      this.props.languages.length > 0,
    ];

    const completed = sections.filter(Boolean).length;
    return Math.round((completed / sections.length) * 100);
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
