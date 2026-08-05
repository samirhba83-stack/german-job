export class InvalidMetadataException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMetadataException';
  }
}
