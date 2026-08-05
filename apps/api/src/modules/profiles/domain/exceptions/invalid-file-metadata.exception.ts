export class InvalidFileMetadataException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFileMetadataException';
  }
}
