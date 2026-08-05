import { CompanyIndustry, CompanySize, EmploymentType, ContractType, UserRole } from '@german-job-engine/shared-types';
import { CandidateApplicationAssemblyService } from './candidate-application-assembly.service';
import { UserProfileRepository } from '../../../profiles/domain/repositories/user-profile.repository.interface';
import { UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { CompanyRepository } from '../../../companies/domain/repositories/company.repository.interface';
import { JobRepository } from '../../../jobs/domain/repositories/job.repository.interface';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { ApplicationAssemblyStrategy } from '../../domain/ports/application-assembly-strategy.port';
import { ApplicationAssemblyInput } from '../../domain/models/application-assembly-input';
import { ApplicationPackage } from '../../domain/models/application-package';
import { UserProfile } from '../../../profiles/domain/entities/user-profile.entity';
import { FileMetadata } from '../../../profiles/domain/value-objects/file-metadata.vo';
import { User } from '../../../users/domain/entities/user.entity';
import { Email } from '../../../users/domain/value-objects/email.vo';
import { Company } from '../../../companies/domain/entities/company.entity';
import { CompanyLocation } from '../../../companies/domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../companies/domain/value-objects/company-contact.vo';
import { Job } from '../../../jobs/domain/entities/job.entity';
import { JobTitle } from '../../../jobs/domain/value-objects/job-title.vo';
import { JobDescription } from '../../../jobs/domain/value-objects/job-description.vo';
import { WorkLocation } from '../../../jobs/domain/value-objects/work-location.vo';
import { CandidateProfileNotFoundException } from '../../domain/exceptions/candidate-profile-not-found.exception';
import { CandidateUserNotFoundException } from '../../domain/exceptions/candidate-user-not-found.exception';
import { TargetJobNotFoundException } from '../../domain/exceptions/target-job-not-found.exception';
import { TargetCompanyNotFoundException } from '../../domain/exceptions/target-company-not-found.exception';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { CandidateDocumentRepository } from '../../../documents/domain/ports/candidate-document.repository';
import { CandidateDocumentRecord } from '../../../documents/domain/models/candidate-document';
import { DocumentType } from '../../../documents/domain/models/document-type';

const NOW = new Date('2026-01-05T10:00:00.000Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = '22222222-2222-4222-8222-222222222222';
const COMPANY_ID = '33333333-3333-4333-8333-333333333333';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';

function buildProfile(withCv = true): UserProfile {
  const profile = UserProfile.create(PROFILE_ID, USER_ID);
  if (withCv) {
    profile.attachCv(
      FileMetadata.create({ fileName: 'cv.pdf', fileUrl: 'https://files.example/cv.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }),
    );
  }
  return profile;
}

function buildUser(): User {
  return User.create(USER_ID, {
    email: Email.create('jane.doe@example.com'),
    passwordHash: 'hashed',
    role: UserRole.CANDIDATE,
    createdAt: NOW,
  });
}

function buildCompany(contactName: string | null = 'HR Team'): Company {
  return Company.create(COMPANY_ID, 'owner-1', {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'hr@acme.de', contactName: contactName ?? undefined }),
  });
}

function buildJob(): Job {
  return Job.create(JOB_ID, COMPANY_ID, {
    title: JobTitle.create('Backend Engineer'),
    description: JobDescription.create('We are looking for a backend engineer.'),
    employmentType: EmploymentType.FULL_TIME,
    contractType: ContractType.PERMANENT,
    workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
  });
}

function fakeUserProfileRepository(profile: UserProfile | null): UserProfileRepository {
  return {
    findById: jest.fn().mockResolvedValue(profile),
    findByUserId: jest.fn().mockResolvedValue(profile),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function fakeUserRepository(user: User | null): UserRepository {
  return {
    findById: jest.fn().mockResolvedValue(user),
    findByEmail: jest.fn().mockResolvedValue(user),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function fakeCompanyRepository(company: Company | null): CompanyRepository {
  return {
    findById: jest.fn().mockResolvedValue(company),
    findByOwnerId: jest.fn().mockResolvedValue(company),
    search: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function fakeJobRepository(job: Job | null): JobRepository {
  return {
    findById: jest.fn().mockResolvedValue(job),
    search: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function buildCandidateDocument(overrides: Partial<CandidateDocumentRecord> = {}): CandidateDocumentRecord {
  return {
    id: 'doc-1',
    ownerUserId: USER_ID,
    documentType: 'CV',
    version: 1,
    isActive: true,
    storageProvider: 'minio',
    storageBucket: 'candidate-documents',
    storageObjectKey: 'user/cv/doc-1.pdf',
    originalFileName: 'cv.pdf',
    safeFileName: 'cv.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    checksumSha256: 'abc123',
    scanStatus: 'CLEAN',
    scanFailureReason: null,
    scannedAt: NOW,
    scopeApplicationId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** M28.5: CV/motivation-letter candidates now come from CandidateDocumentRepository, never
 * UserProfile.cv — this fake lets each test control exactly what the "active, clean" document per
 * type looks like, independent of the UserProfile fixture. Defaults to no documents of any type,
 * so tests that don't care about attachments aren't accidentally coupled to a default CV. */
function fakeCandidateDocumentRepository(byType: Partial<Record<DocumentType, CandidateDocumentRecord | null>> = {}): CandidateDocumentRepository {
  return {
    findById: jest.fn(),
    findActiveByOwnerAndType: jest.fn(async (_ownerUserId: string, documentType: DocumentType) => byType[documentType] ?? null),
    findScopedToApplication: jest.fn().mockResolvedValue([]),
    listByOwner: jest.fn().mockResolvedValue([]),
    createNewVersion: jest.fn(),
    updateScanResult: jest.fn(),
  };
}

function fakeClock(): ExecutionClock {
  return { now: () => NOW };
}

function fakeStrategy(result?: Partial<ApplicationPackage>): { strategy: ApplicationAssemblyStrategy; capturedInput: ApplicationAssemblyInput[] } {
  const capturedInput: ApplicationAssemblyInput[] = [];
  const strategy: ApplicationAssemblyStrategy = {
    assemble: jest.fn((input: ApplicationAssemblyInput, now: Date) => {
      capturedInput.push(input);
      return {
        applicationId: input.applicationId,
        assembledAt: now,
        candidateIdentity: input.candidateIdentity,
        recipientIdentity: input.recipientIdentity,
        selectedCv: null,
        rejectedCvs: [],
        selectedMotivationLetter: null,
        rejectedMotivationLetters: [],
        selectedCertificates: [],
        omittedCertificates: [],
        attachments: [],
        motivationLetterSource: 'NOT_AVAILABLE',
        assemblyReasoning: 'stub',
        ...result,
      };
    }),
  };
  return { strategy, capturedInput };
}

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function buildService(overrides: {
  profile?: UserProfile | null;
  user?: User | null;
  company?: Company | null;
  job?: Job | null;
  documents?: CandidateDocumentRepository;
  strategy?: ApplicationAssemblyStrategy;
  eventRecorder?: ExecutionEventRecorder;
} = {}): CandidateApplicationAssemblyService {
  return new CandidateApplicationAssemblyService(
    fakeUserProfileRepository(overrides.profile === undefined ? buildProfile() : overrides.profile),
    fakeUserRepository(overrides.user === undefined ? buildUser() : overrides.user),
    fakeCompanyRepository(overrides.company === undefined ? buildCompany() : overrides.company),
    fakeJobRepository(overrides.job === undefined ? buildJob() : overrides.job),
    overrides.documents ?? fakeCandidateDocumentRepository(),
    fakeClock(),
    overrides.strategy ?? fakeStrategy().strategy,
    overrides.eventRecorder ?? fakeEventRecorder(),
  );
}

describe('CandidateApplicationAssemblyService', () => {
  describe('translation into ApplicationAssemblyInput', () => {
    it('translates an active, CLEAN-scanned CandidateDocument into a single cvCandidate (M28.5: never from UserProfile.cv)', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const documents = fakeCandidateDocumentRepository({ CV: buildCandidateDocument({ id: 'cv-doc-1', originalFileName: 'cv.pdf' }) });
      const service = buildService({ strategy, documents });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.cvCandidates).toHaveLength(1);
      expect(capturedInput[0].documents.cvCandidates[0]).toMatchObject({ fileName: 'cv.pdf', documentReference: 'cv-doc-1' });
    });

    it('translates zero cvCandidates when no active CV document exists', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy, documents: fakeCandidateDocumentRepository() });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.cvCandidates).toEqual([]);
    });

    it('translates zero cvCandidates when the active CV document has not finished (or failed) security scanning — never offers an unscanned/rejected document as a candidate', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const documents = fakeCandidateDocumentRepository({ CV: buildCandidateDocument({ scanStatus: 'NOT_SCANNED' }) });
      const service = buildService({ strategy, documents });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.cvCandidates).toEqual([]);
    });

    it('UserProfile.cv presence/absence has no effect on cvCandidates anymore (regression guard for the M28.5 resourcing)', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const documents = fakeCandidateDocumentRepository({ CV: buildCandidateDocument() });
      // Profile explicitly has NO cv attached, yet a real CandidateDocument exists — the
      // candidate should still be offered, proving the source of truth genuinely moved.
      const service = buildService({ strategy, profile: buildProfile(false), documents });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.cvCandidates).toHaveLength(1);
    });

    it('translates an active, CLEAN motivation letter document into a single motivationLetterCandidate', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const documents = fakeCandidateDocumentRepository({ MOTIVATION_LETTER: buildCandidateDocument({ id: 'letter-1', documentType: 'MOTIVATION_LETTER', originalFileName: 'letter.pdf' }) });
      const service = buildService({ strategy, documents });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.motivationLetterCandidates).toHaveLength(1);
      expect(capturedInput[0].documents.motivationLetterCandidates[0]).toMatchObject({ fileName: 'letter.pdf', documentReference: 'letter-1' });
    });

    it('translates zero motivationLetterCandidates when none exists', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy, documents: fakeCandidateDocumentRepository() });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.motivationLetterCandidates).toEqual([]);
    });

    it('always translates zero certificateCandidates (no certificate concept exists in the domain yet)', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].documents.certificateCandidates).toEqual([]);
    });

    it('derives candidate display name from the email local part', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].candidateIdentity).toEqual({
        displayName: 'jane.doe',
        emailAddress: 'jane.doe@example.com',
        displayNameSource: 'EMAIL_LOCAL_PART',
      });
    });

    it('prepares recipient identity from company contact name when present', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy, company: buildCompany('HR Team') });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].recipientIdentity).toEqual({
        displayName: 'HR Team',
        emailAddress: 'hr@acme.de',
        companyName: 'Acme GmbH',
      });
    });

    it('falls back to company name for recipient display name when no contact name is set', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy, company: buildCompany(null) });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].recipientIdentity.displayName).toBe('Acme GmbH');
    });

    it('passes the job title through to the strategy input', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].jobTitle).toBe('Backend Engineer');
    });

    it('passes the applicationId through unmodified', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy });

      await service.assemble({ applicationId: 'app-42', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0].applicationId).toBe('app-42');
    });
  });

  describe('event recording (M18)', () => {
    it('records with real companyId, jobId, userId, and geography from the target company', async () => {
      const eventRecorder = fakeEventRecorder();
      const service = buildService({ eventRecorder });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(eventRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          businessContext: expect.objectContaining({
            companyId: COMPANY_ID,
            jobId: JOB_ID,
            userId: USER_ID,
            geography: expect.objectContaining({ city: 'Berlin', country: 'Germany' }),
          }),
        }),
      );
    });

    it('generates a fresh correlationId when the caller supplies none', async () => {
      const eventRecorder = fakeEventRecorder();
      const service = buildService({ eventRecorder });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      const call = (eventRecorder.record as jest.Mock).mock.calls[0][0];
      expect(call.correlationId).toEqual(expect.any(String));
      expect(call.correlationId.length).toBeGreaterThan(0);
    });

    it('uses the caller-supplied correlationId when present', async () => {
      const eventRecorder = fakeEventRecorder();
      const service = buildService({ eventRecorder });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID, correlationId: 'correlation-from-caller' });

      expect(eventRecorder.record).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'correlation-from-caller' }));
    });
  });

  describe('missing data', () => {
    it('throws CandidateProfileNotFoundException when no profile exists', async () => {
      const service = buildService({ profile: null });

      await expect(service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID })).rejects.toThrow(
        CandidateProfileNotFoundException,
      );
    });

    it('throws CandidateUserNotFoundException when no user exists', async () => {
      const service = buildService({ user: null });

      await expect(service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID })).rejects.toThrow(
        CandidateUserNotFoundException,
      );
    });

    it('throws TargetJobNotFoundException when no job exists', async () => {
      const service = buildService({ job: null });

      await expect(service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID })).rejects.toThrow(
        TargetJobNotFoundException,
      );
    });

    it('throws TargetCompanyNotFoundException when the job references a missing company', async () => {
      const service = buildService({ company: null });

      await expect(service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID })).rejects.toThrow(
        TargetCompanyNotFoundException,
      );
    });
  });

  describe('dependency injection', () => {
    it('returns whatever the injected strategy produces, unmodified', async () => {
      const { strategy } = fakeStrategy({ assemblyReasoning: 'custom reasoning from injected strategy' });
      const service = buildService({ strategy });

      const pkg = await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(pkg.assemblyReasoning).toBe('custom reasoning from injected strategy');
    });

    it('passes the clock-provided instant through to the strategy', async () => {
      const { strategy } = fakeStrategy();
      const service = buildService({ strategy });

      const pkg = await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(pkg.assembledAt).toBe(NOW);
    });
  });

  describe('edge cases', () => {
    it('produces a deterministic input for repeated calls with identical data', async () => {
      const { strategy, capturedInput } = fakeStrategy();
      const service = buildService({ strategy });

      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });
      await service.assemble({ applicationId: 'app-1', candidateUserId: USER_ID, jobId: JOB_ID });

      expect(capturedInput[0]).toEqual(capturedInput[1]);
    });
  });
});
