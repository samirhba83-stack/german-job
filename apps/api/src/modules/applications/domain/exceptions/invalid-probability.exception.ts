export class InvalidProbabilityException extends Error {
  constructor(value: number) {
    super(`Probability must be between 0.0 and 1.0, received: ${value}`);
    this.name = 'InvalidProbabilityException';
  }
}
