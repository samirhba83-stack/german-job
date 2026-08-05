import { CandidateDocumentCandidate } from './candidate-document-candidate';

export interface RejectedDocument {
  readonly document: CandidateDocumentCandidate;
  readonly reasonCode: string;
  readonly explanation: string;
}

export interface CvSelectionResult {
  readonly selectedCv: CandidateDocumentCandidate | null;
  readonly rejectedCvs: ReadonlyArray<RejectedDocument>;
  readonly reason: string;
}

export interface MotivationLetterSelectionResult {
  readonly selectedMotivationLetter: CandidateDocumentCandidate | null;
  readonly rejectedMotivationLetters: ReadonlyArray<RejectedDocument>;
  readonly reason: string;
}

export interface CertificateSelectionResult {
  readonly selectedCertificates: ReadonlyArray<CandidateDocumentCandidate>;
  readonly omittedCertificates: ReadonlyArray<RejectedDocument>;
  readonly reason: string;
}
