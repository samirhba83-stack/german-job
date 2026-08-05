export class InvalidMetadataException extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidMetadataException';
  }
}
