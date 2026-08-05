import { JobStatus, EmploymentType, ContractType, RemotePolicy } from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { JobId } from '../value-objects/job-id.vo';
import { JobTitle } from '../value-objects/job-title.vo';
import { JobDescription } from '../value-objects/job-description.vo';
import { WorkingTime } from '../value-objects/working-time.vo';
import { WorkLocation } from '../value-objects/work-location.vo';
import { SalaryRange } from '../value-objects/salary-range.vo';
import { ExperienceRequirement } from '../value-objects/experience-requirement.vo';
import { EducationRequirement } from '../value-objects/education-requirement.vo';
import { GermanLanguageRequirement } from '../value-objects/german-language-requirement.vo';
import { EnglishLanguageRequirement } from '../value-objects/english-language-requirement.vo';
import { VisaRequirement } from '../value-objects/visa-requirement.vo';
import { AusbildungAvailability } from '../value-objects/ausbildung-availability.vo';
import { ApplicationDeadline } from '../value-objects/application-deadline.vo';
import { Benefits } from '../value-objects/benefits.vo';
import { Skills } from '../value-objects/skills.vo';
import { Tags } from '../value-objects/tags.vo';
import { JobCreatedEvent } from '../events/job-created.event';
import { JobUpdatedEvent } from '../events/job-updated.event';
import { JobPublishedEvent } from '../events/job-published.event';
import { JobArchivedEvent } from '../events/job-archived.event';
import { JobClosedEvent } from '../events/job-closed.event';
import { JobReopenedEvent } from '../events/job-reopened.event';
import { InvalidJobStatusTransitionException } from '../exceptions/invalid-job-status-transition.exception';
import { JobMissingMandatoryFieldsException } from '../exceptions/job-missing-mandatory-fields.exception';
import { JobClosedException } from '../exceptions/job-closed.exception';

export interface JobProps {
  companyId: string;
  title: JobTitle;
  description: JobDescription;
  status: JobStatus;
  employmentType: EmploymentType;
  contractType: ContractType;
  workingTime: WorkingTime | null;
  workLocation: WorkLocation;
  remotePolicy: RemotePolicy;
  salaryRange: SalaryRange | null;
  experienceRequirement: ExperienceRequirement | null;
  educationRequirement: EducationRequirement | null;
  germanLanguageRequirement: GermanLanguageRequirement | null;
  englishLanguageRequirement: EnglishLanguageRequirement | null;
  visaRequirement: VisaRequirement | null;
  ausbildungAvailability: AusbildungAvailability | null;
  applicationDeadline: ApplicationDeadline | null;
  benefits: Benefits;
  skills: Skills;
  tags: Tags;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobUpdate {
  title?: JobTitle;
  description?: JobDescription;
  employmentType?: EmploymentType;
  contractType?: ContractType;
  workingTime?: WorkingTime | null;
  workLocation?: WorkLocation;
  remotePolicy?: RemotePolicy;
  salaryRange?: SalaryRange | null;
  experienceRequirement?: ExperienceRequirement | null;
  educationRequirement?: EducationRequirement | null;
  germanLanguageRequirement?: GermanLanguageRequirement | null;
  englishLanguageRequirement?: EnglishLanguageRequirement | null;
  visaRequirement?: VisaRequirement | null;
  ausbildungAvailability?: AusbildungAvailability | null;
  applicationDeadline?: ApplicationDeadline | null;
  benefits?: Benefits;
  skills?: Skills;
  tags?: Tags;
}

export interface JobUpdateOptions {
  allowEditWhenClosed: boolean;
}

export class Job extends AggregateRoot<string> {
  private props: JobProps;

  private constructor(id: string, props: JobProps) {
    super(id);
    JobId.create(id);
    this.props = props;
  }

  get jobId(): JobId {
    return JobId.create(this.id);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get title(): JobTitle {
    return this.props.title;
  }

  get description(): JobDescription {
    return this.props.description;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get employmentType(): EmploymentType {
    return this.props.employmentType;
  }

  get contractType(): ContractType {
    return this.props.contractType;
  }

  get workingTime(): WorkingTime | null {
    return this.props.workingTime;
  }

  get workLocation(): WorkLocation {
    return this.props.workLocation;
  }

  get remotePolicy(): RemotePolicy {
    return this.props.remotePolicy;
  }

  get salaryRange(): SalaryRange | null {
    return this.props.salaryRange;
  }

  get experienceRequirement(): ExperienceRequirement | null {
    return this.props.experienceRequirement;
  }

  get educationRequirement(): EducationRequirement | null {
    return this.props.educationRequirement;
  }

  get germanLanguageRequirement(): GermanLanguageRequirement | null {
    return this.props.germanLanguageRequirement;
  }

  get englishLanguageRequirement(): EnglishLanguageRequirement | null {
    return this.props.englishLanguageRequirement;
  }

  get visaRequirement(): VisaRequirement | null {
    return this.props.visaRequirement;
  }

  get ausbildungAvailability(): AusbildungAvailability | null {
    return this.props.ausbildungAvailability;
  }

  get applicationDeadline(): ApplicationDeadline | null {
    return this.props.applicationDeadline;
  }

  get benefits(): Benefits {
    return this.props.benefits;
  }

  get skills(): Skills {
    return this.props.skills;
  }

  get tags(): Tags {
    return this.props.tags;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isDraft(): boolean {
    return this.props.status === JobStatus.DRAFT;
  }

  isPublished(): boolean {
    return this.props.status === JobStatus.PUBLISHED;
  }

  isArchived(): boolean {
    return this.props.status === JobStatus.ARCHIVED;
  }

  isClosed(): boolean {
    return this.props.status === JobStatus.CLOSED;
  }

  /** Registers a brand-new draft job under a company and raises the corresponding domain event. */
  static create(
    id: string,
    companyId: string,
    props: {
      title: JobTitle;
      description: JobDescription;
      employmentType: EmploymentType;
      contractType: ContractType;
      workLocation: WorkLocation;
      workingTime?: WorkingTime | null;
      remotePolicy?: RemotePolicy;
      salaryRange?: SalaryRange | null;
      experienceRequirement?: ExperienceRequirement | null;
      educationRequirement?: EducationRequirement | null;
      germanLanguageRequirement?: GermanLanguageRequirement | null;
      englishLanguageRequirement?: EnglishLanguageRequirement | null;
      visaRequirement?: VisaRequirement | null;
      ausbildungAvailability?: AusbildungAvailability | null;
      applicationDeadline?: ApplicationDeadline | null;
      benefits?: Benefits;
      skills?: Skills;
      tags?: Tags;
    },
  ): Job {
    if (!companyId) {
      throw new Error('A job cannot exist without an owner company');
    }

    const now = new Date();
    const job = new Job(id, {
      companyId,
      title: props.title,
      description: props.description,
      status: JobStatus.DRAFT,
      employmentType: props.employmentType,
      contractType: props.contractType,
      workingTime: props.workingTime ?? null,
      workLocation: props.workLocation,
      remotePolicy: props.remotePolicy ?? RemotePolicy.ON_SITE,
      salaryRange: props.salaryRange ?? null,
      experienceRequirement: props.experienceRequirement ?? null,
      educationRequirement: props.educationRequirement ?? null,
      germanLanguageRequirement: props.germanLanguageRequirement ?? null,
      englishLanguageRequirement: props.englishLanguageRequirement ?? null,
      visaRequirement: props.visaRequirement ?? null,
      ausbildungAvailability: props.ausbildungAvailability ?? null,
      applicationDeadline: props.applicationDeadline ?? null,
      benefits: props.benefits ?? Benefits.empty(),
      skills: props.skills ?? Skills.empty(),
      tags: props.tags ?? Tags.empty(),
      createdAt: now,
      updatedAt: now,
    });
    job.addDomainEvent(new JobCreatedEvent(id, companyId));
    return job;
  }

  /** Rehydrates a Job from persistence without re-raising domain events. */
  static reconstitute(id: string, props: JobProps): Job {
    return new Job(id, props);
  }

  /** Applies a partial set of changes. companyId and status are immutable here — use the dedicated transitions. */
  update(changes: JobUpdate, options: JobUpdateOptions): void {
    if (this.isClosed() && !options.allowEditWhenClosed) {
      throw new JobClosedException(this.id);
    }

    if (changes.title !== undefined) this.props.title = changes.title;
    if (changes.description !== undefined) this.props.description = changes.description;
    if (changes.employmentType !== undefined) this.props.employmentType = changes.employmentType;
    if (changes.contractType !== undefined) this.props.contractType = changes.contractType;
    if (changes.workingTime !== undefined) this.props.workingTime = changes.workingTime;
    if (changes.workLocation !== undefined) this.props.workLocation = changes.workLocation;
    if (changes.remotePolicy !== undefined) this.props.remotePolicy = changes.remotePolicy;
    if (changes.salaryRange !== undefined) this.props.salaryRange = changes.salaryRange;
    if (changes.experienceRequirement !== undefined) this.props.experienceRequirement = changes.experienceRequirement;
    if (changes.educationRequirement !== undefined) this.props.educationRequirement = changes.educationRequirement;
    if (changes.germanLanguageRequirement !== undefined) this.props.germanLanguageRequirement = changes.germanLanguageRequirement;
    if (changes.englishLanguageRequirement !== undefined) this.props.englishLanguageRequirement = changes.englishLanguageRequirement;
    if (changes.visaRequirement !== undefined) this.props.visaRequirement = changes.visaRequirement;
    if (changes.ausbildungAvailability !== undefined) this.props.ausbildungAvailability = changes.ausbildungAvailability;
    if (changes.applicationDeadline !== undefined) this.props.applicationDeadline = changes.applicationDeadline;
    if (changes.benefits !== undefined) this.props.benefits = changes.benefits;
    if (changes.skills !== undefined) this.props.skills = changes.skills;
    if (changes.tags !== undefined) this.props.tags = changes.tags;

    this.touch();
    this.addDomainEvent(new JobUpdatedEvent(this.id));
  }

  /** DRAFT -> PUBLISHED. Requires mandatory publish-time fields (e.g. disclosed salary range). */
  publish(): void {
    if (!this.isDraft()) {
      throw new InvalidJobStatusTransitionException(this.status, 'publish');
    }

    this.ensureReadyToPublish();
    this.props.status = JobStatus.PUBLISHED;
    this.touch();
    this.addDomainEvent(new JobPublishedEvent(this.id));
  }

  /** DRAFT, PUBLISHED, or CLOSED -> ARCHIVED. */
  archive(): void {
    if (this.isArchived()) {
      throw new InvalidJobStatusTransitionException(this.status, 'archive');
    }

    this.props.status = JobStatus.ARCHIVED;
    this.touch();
    this.addDomainEvent(new JobArchivedEvent(this.id));
  }

  /** PUBLISHED -> CLOSED. */
  close(): void {
    if (!this.isPublished()) {
      throw new InvalidJobStatusTransitionException(this.status, 'close');
    }

    this.props.status = JobStatus.CLOSED;
    this.touch();
    this.addDomainEvent(new JobClosedEvent(this.id));
  }

  /** ARCHIVED or CLOSED -> PUBLISHED. Re-validates mandatory publish-time fields. */
  reopen(): void {
    if (!this.isArchived() && !this.isClosed()) {
      throw new InvalidJobStatusTransitionException(this.status, 'reopen');
    }

    this.ensureReadyToPublish();
    this.props.status = JobStatus.PUBLISHED;
    this.touch();
    this.addDomainEvent(new JobReopenedEvent(this.id));
  }

  private ensureReadyToPublish(): void {
    const missing: string[] = [];
    if (!this.props.salaryRange) missing.push('salaryRange');

    if (missing.length > 0) {
      throw new JobMissingMandatoryFieldsException(missing);
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
