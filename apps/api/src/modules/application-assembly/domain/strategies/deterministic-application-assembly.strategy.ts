import { Inject, Injectable } from '@nestjs/common';
import {
  APPLICATION_ASSEMBLY_CONFIG,
  ApplicationAssemblyConfig,
  DEFAULT_APPLICATION_ASSEMBLY_CONFIG,
} from '../application-assembly-config';
import { ApplicationAssemblyStrategy } from '../ports/application-assembly-strategy.port';
import { ApplicationAssemblyInput } from '../models/application-assembly-input';
import { ApplicationPackage } from '../models/application-package';
import { CandidateDocumentCandidate } from '../models/candidate-document-candidate';
import { CvSelectionResult, CertificateSelectionResult, MotivationLetterSelectionResult, RejectedDocument } from '../models/document-decision';
import { AssembledAttachment, AttachmentCategory } from '../models/assembled-attachment';

/** Most-recently-uploaded first; ties broken by id for full determinism. */
function sortByRecency(candidates: ReadonlyArray<CandidateDocumentCandidate>): CandidateDocumentCandidate[] {
  return [...candidates].sort((a, b) => {
    const byDate = b.uploadedAt.getTime() - a.uploadedAt.getTime();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

/**
 * Default, deterministic Application Assembly Strategy (M14).
 *
 * CV selection: the single most-recently-uploaded CV wins; every other
 * candidate is rejected as NOT_MOST_RECENT. Certificate selection: the
 * `maxCertificates` most-recently-uploaded certificates are kept; the rest
 * are omitted as CERTIFICATE_LIMIT_EXCEEDED. No profile currently supplies
 * more than one CV candidate or any certificate candidates — this strategy
 * is written to handle N of either so a richer profile model plugs in
 * without any change here, only in the application-layer translation.
 */
@Injectable()
export class DeterministicApplicationAssemblyStrategy implements ApplicationAssemblyStrategy {
  constructor(
    @Inject(APPLICATION_ASSEMBLY_CONFIG)
    private readonly config: ApplicationAssemblyConfig = DEFAULT_APPLICATION_ASSEMBLY_CONFIG,
  ) {}

  assemble(input: ApplicationAssemblyInput, now: Date): ApplicationPackage {
    const cvResult = this.selectCv(input.documents.cvCandidates);
    const motivationLetterResult = this.selectMotivationLetter(input.documents.motivationLetterCandidates);
    const certificateResult = this.selectCertificates(input.documents.certificateCandidates);
    const attachments = this.buildAttachments(cvResult.selectedCv, motivationLetterResult.selectedMotivationLetter, certificateResult.selectedCertificates);

    const assemblyReasoning = [cvResult.reason, motivationLetterResult.reason, certificateResult.reason].join(' ');

    return {
      applicationId: input.applicationId,
      assembledAt: now,
      candidateIdentity: input.candidateIdentity,
      recipientIdentity: input.recipientIdentity,
      selectedCv: cvResult.selectedCv,
      rejectedCvs: cvResult.rejectedCvs,
      selectedMotivationLetter: motivationLetterResult.selectedMotivationLetter,
      rejectedMotivationLetters: motivationLetterResult.rejectedMotivationLetters,
      selectedCertificates: certificateResult.selectedCertificates,
      omittedCertificates: certificateResult.omittedCertificates,
      attachments,
      motivationLetterSource: motivationLetterResult.selectedMotivationLetter !== null ? 'CANDIDATE_PROVIDED' : 'NOT_AVAILABLE',
      assemblyReasoning,
    };
  }

  private selectCv(candidates: ReadonlyArray<CandidateDocumentCandidate>): CvSelectionResult {
    if (candidates.length === 0) {
      return { selectedCv: null, rejectedCvs: [], reason: 'No CV is available on the candidate profile.' };
    }

    const [selected, ...rest] = sortByRecency(candidates);
    const rejectedCvs: RejectedDocument[] = rest.map((document) => ({
      document,
      reasonCode: 'NOT_MOST_RECENT',
      explanation: `"${document.fileName}" was not selected because "${selected.fileName}" (uploaded ${selected.uploadedAt.toISOString()}) is more recent.`,
    }));

    const reason =
      candidates.length === 1
        ? `Selected the only available CV "${selected.fileName}".`
        : `Selected the most recently uploaded CV "${selected.fileName}" from ${candidates.length} candidates.`;

    return { selectedCv: selected, rejectedCvs, reason };
  }

  /** Same most-recent-wins policy as CV selection — a candidate profile has at most one active
   * motivation letter document at a time (`CandidateDocument`'s own single-active-version-per-slot
   * design), so in practice this only ever sees 0 or 1 candidates; written to handle N so a future
   * multi-letter-variant profile model plugs in without changing this method. */
  private selectMotivationLetter(candidates: ReadonlyArray<CandidateDocumentCandidate>): MotivationLetterSelectionResult {
    if (candidates.length === 0) {
      return { selectedMotivationLetter: null, rejectedMotivationLetters: [], reason: 'No motivation letter is available on the candidate profile.' };
    }

    const [selected, ...rest] = sortByRecency(candidates);
    const rejectedMotivationLetters: RejectedDocument[] = rest.map((document) => ({
      document,
      reasonCode: 'NOT_MOST_RECENT',
      explanation: `"${document.fileName}" was not selected because "${selected.fileName}" (uploaded ${selected.uploadedAt.toISOString()}) is more recent.`,
    }));

    const reason =
      candidates.length === 1
        ? `Selected the only available motivation letter "${selected.fileName}".`
        : `Selected the most recently uploaded motivation letter "${selected.fileName}" from ${candidates.length} candidates.`;

    return { selectedMotivationLetter: selected, rejectedMotivationLetters, reason };
  }

  private selectCertificates(candidates: ReadonlyArray<CandidateDocumentCandidate>): CertificateSelectionResult {
    if (candidates.length === 0) {
      return { selectedCertificates: [], omittedCertificates: [], reason: 'No certificates are available on the candidate profile.' };
    }

    const sorted = sortByRecency(candidates);
    const selectedCertificates = sorted.slice(0, this.config.maxCertificates);
    const omittedCertificates: RejectedDocument[] = sorted.slice(this.config.maxCertificates).map((document) => ({
      document,
      reasonCode: 'CERTIFICATE_LIMIT_EXCEEDED',
      explanation: `"${document.fileName}" exceeds the configured limit of ${this.config.maxCertificates} certificates.`,
    }));

    const reason = `Selected ${selectedCertificates.length} of ${candidates.length} certificates (limit ${this.config.maxCertificates}).`;

    return { selectedCertificates, omittedCertificates, reason };
  }

  private buildAttachments(
    selectedCv: CandidateDocumentCandidate | null,
    selectedMotivationLetter: CandidateDocumentCandidate | null,
    selectedCertificates: ReadonlyArray<CandidateDocumentCandidate>,
  ): AssembledAttachment[] {
    const attachments: AssembledAttachment[] = [];

    if (selectedCv !== null) {
      attachments.push(this.toAttachment(selectedCv, 'CV'));
    }

    if (selectedMotivationLetter !== null) {
      attachments.push(this.toAttachment(selectedMotivationLetter, 'MOTIVATION_LETTER'));
    }

    for (const certificate of selectedCertificates) {
      attachments.push(this.toAttachment(certificate, 'CERTIFICATE'));
    }

    return attachments;
  }

  private toAttachment(document: CandidateDocumentCandidate, category: AttachmentCategory): AssembledAttachment {
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      contentReference: document.documentReference,
      category,
    };
  }
}
