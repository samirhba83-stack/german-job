export class InvalidSalaryRangeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSalaryRangeException';
  }
}
