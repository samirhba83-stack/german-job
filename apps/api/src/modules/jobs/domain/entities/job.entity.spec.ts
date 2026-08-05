import {
  EmploymentType,
  ContractType,
  JobStatus,
  Currency,
  SalaryPeriod,
  RemotePolicy,
} from '@german-job-engine/shared-types';
import { Job } from './job.entity';
import { JobTitle } from '../value-objects/job-title.vo';
import { JobDescription } from '../value-objects/job-description.vo';
import { WorkLocation } from '../value-objects/work-location.vo';
import { SalaryRange } from '../value-objects/salary-range.vo';
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

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function createJob(withSalary = false): Job {
  return Job.create(VALID_ID, 'company-1', {
    title: JobTitle.create('Backend Engineer'),
    description: JobDescription.create('We are looking for a backend engineer.'),
    employmentType: EmploymentType.FULL_TIME,
    contractType: ContractType.PERMANENT,
    workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
    salaryRange: withSalary
      ? SalaryRange.create({ min: 50000, max: 70000, currency: Currency.EUR, period: SalaryPeriod.ANNUAL })
      : undefined,
  });
}

describe('Job', () => {
  it('starts DRAFT and raises a JobCreatedEvent on creation', () => {
    const job = createJob();

    expect(job.status).toBe(JobStatus.DRAFT);
    expect(job.isDraft()).toBe(true);
    expect(job.domainEvents).toHaveLength(1);
    expect(job.domainEvents[0]).toBeInstanceOf(JobCreatedEvent);
  });

  it('rejects creation without a company', () => {
    expect(() =>
      Job.create(VALID_ID, '', {
        title: JobTitle.create('Engineer'),
        description: JobDescription.create('A description long enough.'),
        employmentType: EmploymentType.FULL_TIME,
        contractType: ContractType.PERMANENT,
        workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
      }),
    ).toThrow(/cannot exist without an owner company/);
  });

  it('only updates fields explicitly provided and raises JobUpdatedEvent', () => {
    const job = createJob();
    job.clearDomainEvents();

    job.update({ title: JobTitle.create('Senior Backend Engineer') }, { allowEditWhenClosed: false });

    expect(job.title.value).toBe('Senior Backend Engineer');
    expect(job.employmentType).toBe(EmploymentType.FULL_TIME);
    expect(job.domainEvents[0]).toBeInstanceOf(JobUpdatedEvent);
  });

  describe('publish', () => {
    it('publishes a draft job that has a disclosed salary range', () => {
      const job = createJob(true);
      job.clearDomainEvents();

      job.publish();

      expect(job.status).toBe(JobStatus.PUBLISHED);
      expect(job.domainEvents[0]).toBeInstanceOf(JobPublishedEvent);
    });

    it('refuses to publish without a disclosed salary range', () => {
      const job = createJob(false);

      expect(() => job.publish()).toThrow(JobMissingMandatoryFieldsException);
    });

    it('refuses to publish a job that is not a draft', () => {
      const job = createJob(true);
      job.publish();

      expect(() => job.publish()).toThrow(InvalidJobStatusTransitionException);
    });
  });

  describe('archive', () => {
    it('archives a draft, published, or closed job', () => {
      const job = createJob();
      job.archive();

      expect(job.status).toBe(JobStatus.ARCHIVED);
      expect(job.domainEvents.some((e) => e instanceof JobArchivedEvent)).toBe(true);
    });

    it('refuses to archive an already-archived job', () => {
      const job = createJob();
      job.archive();

      expect(() => job.archive()).toThrow(InvalidJobStatusTransitionException);
    });
  });

  describe('close', () => {
    it('closes a published job', () => {
      const job = createJob(true);
      job.publish();
      job.clearDomainEvents();

      job.close();

      expect(job.status).toBe(JobStatus.CLOSED);
      expect(job.domainEvents[0]).toBeInstanceOf(JobClosedEvent);
    });

    it('refuses to close a job that is not published', () => {
      const job = createJob();

      expect(() => job.close()).toThrow(InvalidJobStatusTransitionException);
    });
  });

  describe('reopen', () => {
    it('reopens an archived job back to published', () => {
      const job = createJob(true);
      job.publish();
      job.archive();
      job.clearDomainEvents();

      job.reopen();

      expect(job.status).toBe(JobStatus.PUBLISHED);
      expect(job.domainEvents[0]).toBeInstanceOf(JobReopenedEvent);
    });

    it('reopens a closed job back to published', () => {
      const job = createJob(true);
      job.publish();
      job.close();

      job.reopen();

      expect(job.status).toBe(JobStatus.PUBLISHED);
    });

    it('refuses to reopen a draft job', () => {
      const job = createJob(true);

      expect(() => job.reopen()).toThrow(InvalidJobStatusTransitionException);
    });
  });

  describe('editing a closed job', () => {
    it('refuses edits without admin override', () => {
      const job = createJob(true);
      job.publish();
      job.close();

      expect(() =>
        job.update({ title: JobTitle.create('New Title') }, { allowEditWhenClosed: false }),
      ).toThrow(JobClosedException);
    });

    it('allows edits with admin override', () => {
      const job = createJob(true);
      job.publish();
      job.close();

      job.update({ title: JobTitle.create('New Title') }, { allowEditWhenClosed: true });

      expect(job.title.value).toBe('New Title');
    });
  });

  it('does not raise domain events when reconstituted from persistence', () => {
    const job = Job.reconstitute(VALID_ID, {
      companyId: 'company-1',
      title: JobTitle.create('Backend Engineer'),
      description: JobDescription.create('We are looking for a backend engineer.'),
      status: JobStatus.DRAFT,
      employmentType: EmploymentType.FULL_TIME,
      contractType: ContractType.PERMANENT,
      workingTime: null,
      workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
      remotePolicy: RemotePolicy.ON_SITE,
      salaryRange: null,
      experienceRequirement: null,
      educationRequirement: null,
      germanLanguageRequirement: null,
      englishLanguageRequirement: null,
      visaRequirement: null,
      ausbildungAvailability: null,
      applicationDeadline: null,
      benefits: Benefits.empty(),
      skills: Skills.empty(),
      tags: Tags.empty(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(job.domainEvents).toHaveLength(0);
  });
});
