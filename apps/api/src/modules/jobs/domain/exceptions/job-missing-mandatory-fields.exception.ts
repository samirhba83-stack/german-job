export class JobMissingMandatoryFieldsException extends Error {
  constructor(public readonly missingFields: string[]) {
    super(`Job cannot be published — missing mandatory fields: ${missingFields.join(', ')}`);
    this.name = 'JobMissingMandatoryFieldsException';
  }
}
