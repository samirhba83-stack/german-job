export class MissingCheckpointException extends Error {
  constructor() {
    super('Cannot confirm resume without a valid checkpoint');
    this.name = 'MissingCheckpointException';
  }
}
