export class InvalidApplicationSnapshotException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidApplicationSnapshotException';
  }
}
