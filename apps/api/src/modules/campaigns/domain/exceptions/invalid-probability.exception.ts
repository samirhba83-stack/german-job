export class InvalidProbabilityException extends Error {
  constructor(value: number) {
    super(`Probability must be between 0 and 1, got: ${value}`);
    this.name = 'InvalidProbabilityException';
  }
}
