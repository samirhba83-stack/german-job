import { Inject, Injectable } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY, UserProfileRepository } from '../../../profiles/domain/repositories/user-profile.repository.interface';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../companies/domain/repositories/company.repository.interface';
import { JOB_REPOSITORY, JobRepository } from '../../../jobs/domain/repositories/job.repository.interface';
import { EXECUTION_CLOCK, ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { APPLICATION_ASSEMBLY_STRATEGY, ApplicationAssemblyStrategy } from '../../domain/ports/application-assembly-strategy.port';
import { ApplicationAssemblyInput } from '../../domain/models/application-assembly-input';
import { ApplicationPackage } from '../../domain/models/application-package';
import { CandidateDocumentCandidate } from '../../domain/models/candidate-document-candidate';
import { CandidateProfileNotFoundException } from '../../domain/exceptions/candidate-profile-not-found.exception';
import { CandidateUserNotFoundException } from '../../domain/exceptions/candidate-user-not-found.exception';
import { TargetJobNotFoundException } from '../../domain/exceptions/target-job-not-found.exception';
import { TargetCompanyNotFoundException } from '../../domain/exceptions/target-company-not-found.exception';
import { randomUUID } from 'crypto';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { CandidateDocumentRepository, CANDIDATE_DOCUMENT_REPOSITORY } from '../../../documents/domain/ports/candidate-document.repository';
import { CandidateDocumentRecord } from '../../../documents/domain/models/candidate-document';

export interface AssembleApplicationPackageParams {
  readonly applicationId: string;
  readonly candidateUserId: string;
  readonly jobId: string;
  /** Supplied by the caller when it has one (M18) — this module is not yet wired into the main correlated pipeline, so this is honestly optional rather than pretending a value always flows in from upstream. */
  readonly correlationId?: string | null;
}

/**
 * Application-layer coordinator for Milestone 14. Loads UserProfile, User,
 * Job, and Company from their own bounded contexts, translates them into the
 * domain-layer ApplicationAssemblyInput snapshot (the anti-corruption
 * boundary — the injected strategy never sees these foreign entities
 * directly), and delegates the actual selection judgment to the DI-injected
 * ApplicationAssemblyStrategy. Never sends anything, never knows about
 * email providers, SMTP, or delivery infrastructure.
 */
@Injectable()
export class CandidateApplicationAssemblyService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepository: UserProfileRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    @Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository,
    @Inject(CANDIDATE_DOCUMENT_REPOSITORY) private readonly candidateDocuments: CandidateDocumentRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(APPLICATION_ASSEMBLY_STRATEGY) private readonly strategy: ApplicationAssemblyStrategy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  async assemble(params: AssembleApplicationPackageParams): Promise<ApplicationPackage> {
    const profile = await this.userProfileRepository.findByUserId(params.candidateUserId);
    if (profile === null) {
      throw new CandidateProfileNotFoundException(params.candidateUserId);
    }

    const user = await this.userRepository.findById(params.candidateUserId);
    if (user === null) {
      throw new CandidateUserNotFoundException(params.candidateUserId);
    }

    const job = await this.jobRepository.findById(params.jobId);
    if (job === null) {
      throw new TargetJobNotFoundException(params.jobId);
    }

    const company = await this.companyRepository.findById(job.companyId);
    if (company === null) {
      throw new TargetCompanyNotFoundException(job.companyId);
    }

    // M28.5: sourced from the real, secure `CandidateDocument` store — never `UserProfile.cv`'s
    // client-asserted `fileUrl` metadata. Only a document that is both the current active version
    // AND has already passed security scanning (`scanStatus === 'CLEAN'`) is ever offered as a
    // candidate — a document still pending scan or rejected by it must never be silently selected
    // (Non-Negotiable Principles #5/#6); the assembly engine simply behaves as if it doesn't exist
    // yet, and `selectedCv === null` naturally blocks dispatch downstream with a clear reason.
    const cvCandidates = await this.loadDocumentCandidates(params.candidateUserId, 'CV');
    const motivationLetterCandidates = await this.loadDocumentCandidates(params.candidateUserId, 'MOTIVATION_LETTER');

    const emailAddress = user.email.value;
    const displayName = emailAddress.split('@')[0];

    const input: ApplicationAssemblyInput = {
      applicationId: params.applicationId,
      candidateIdentity: {
        displayName,
        emailAddress,
        displayNameSource: 'EMAIL_LOCAL_PART',
      },
      recipientIdentity: {
        displayName: company.contact.contactName ?? company.name,
        emailAddress: company.contact.contactEmail,
        companyName: company.name,
      },
      documents: {
        cvCandidates,
        motivationLetterCandidates,
        // No supporting-document auto-assembly exists yet — a candidate can already upload and
        // store supporting documents (`documents` module, M28.5), but this assembly engine does
        // not yet automatically include them in a package. A real, bounded, honestly-named scope
        // decision (M28.5 report Known Limitations), not an oversight.
        certificateCandidates: [],
      },
      jobTitle: job.title.value,
    };

    const pkg = this.strategy.assemble(input, this.clock.now());

    // M18: not yet wired into the main correlated pipeline — correlationId comes from the
    // caller when supplied, otherwise this assembly starts its own (documented gap).
    const correlationId = params.correlationId ?? randomUUID();

    await this.eventRecorder.record({
      eventType: 'APPLICATION_PACKAGE_ASSEMBLED',
      campaignId: null,
      executionId: params.applicationId,
      correlationId,
      traceId: params.applicationId,
      summary: `Application package assembled with ${pkg.attachments.length} attachment(s)`,
      explanation: pkg.assemblyReasoning,
      status: pkg.selectedCv !== null ? 'SUCCESS' : 'FAILURE',
      metadata: { attachmentCount: String(pkg.attachments.length) },
      businessContext: {
        ...EMPTY_BUSINESS_CONTEXT,
        companyId: company.id,
        jobId: job.id,
        userId: params.candidateUserId,
        geography: {
          country: company.location.country,
          federalState: company.location.federalState,
          city: company.location.city,
          postalCode: company.location.postalCode,
          latitude: company.location.latitude,
          longitude: company.location.longitude,
        },
      },
    });

    return pkg;
  }

  private async loadDocumentCandidates(ownerUserId: string, documentType: 'CV' | 'MOTIVATION_LETTER'): Promise<CandidateDocumentCandidate[]> {
    const document = await this.candidateDocuments.findActiveByOwnerAndType(ownerUserId, documentType);
    if (document === null || document.scanStatus !== 'CLEAN') {
      return [];
    }
    return [this.toDocumentCandidate(document)];
  }

  private toDocumentCandidate(document: CandidateDocumentRecord): CandidateDocumentCandidate {
    return {
      id: document.id,
      fileName: document.originalFileName,
      documentReference: document.id,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.createdAt,
    };
  }
}
