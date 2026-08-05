import { AssembledAttachment } from './assembled-attachment';
import { CandidateDocumentCandidate } from './candidate-document-candidate';
import { CandidateIdentity } from './candidate-identity';
import { MotivationLetterSource } from './motivation-letter-source';
import { RecipientIdentity } from './recipient-identity';
import { RejectedDocument } from './document-decision';

/**
 * The engine's single immutable output. Becomes the future input to
 * EmailDeliveryExecutionService once a later milestone wires the two
 * together — not done in this milestone, matching the established
 * one-hop-upstream-only, dormant-until-wired pattern.
 */
export interface ApplicationPackage {
  readonly applicationId: string;
  readonly assembledAt: Date;
  readonly candidateIdentity: CandidateIdentity;
  readonly recipientIdentity: RecipientIdentity;
  readonly selectedCv: CandidateDocumentCandidate | null;
  readonly rejectedCvs: ReadonlyArray<RejectedDocument>;
  readonly selectedMotivationLetter: CandidateDocumentCandidate | null;
  readonly rejectedMotivationLetters: ReadonlyArray<RejectedDocument>;
  readonly selectedCertificates: ReadonlyArray<CandidateDocumentCandidate>;
  readonly omittedCertificates: ReadonlyArray<RejectedDocument>;
  readonly attachments: ReadonlyArray<AssembledAttachment>;
  readonly motivationLetterSource: MotivationLetterSource;
  readonly assemblyReasoning: string;
}
