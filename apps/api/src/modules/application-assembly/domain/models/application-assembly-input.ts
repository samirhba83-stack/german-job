import { CandidateDocumentCandidate } from './candidate-document-candidate';
import { CandidateIdentity } from './candidate-identity';
import { RecipientIdentity } from './recipient-identity';

export interface CandidateDocumentsSnapshot {
  readonly cvCandidates: ReadonlyArray<CandidateDocumentCandidate>;
  readonly motivationLetterCandidates: ReadonlyArray<CandidateDocumentCandidate>;
  readonly certificateCandidates: ReadonlyArray<CandidateDocumentCandidate>;
}

/**
 * The engine's sole input — an anti-corruption-layer snapshot assembled by
 * CandidateApplicationAssemblyService from UserProfile/User/Company/Job.
 * The domain-layer strategy never sees those foreign-module entities
 * directly (same reasoning as RecommendationContext in the recommendations
 * module).
 */
export interface ApplicationAssemblyInput {
  readonly applicationId: string;
  readonly candidateIdentity: CandidateIdentity;
  readonly recipientIdentity: RecipientIdentity;
  readonly documents: CandidateDocumentsSnapshot;
  readonly jobTitle: string;
}
