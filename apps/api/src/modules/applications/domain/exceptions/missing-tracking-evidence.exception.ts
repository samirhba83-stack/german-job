export class MissingTrackingEvidenceException extends Error {
  constructor(signal: string) {
    super(`Recording "${signal}" requires both evidence and a confidence score`);
    this.name = 'MissingTrackingEvidenceException';
  }
}
