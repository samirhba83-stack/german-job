export class InvalidSalaryExpectationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSalaryExpectationException';
  }
}
