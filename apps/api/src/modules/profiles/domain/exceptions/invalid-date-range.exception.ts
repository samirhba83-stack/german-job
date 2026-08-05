export class InvalidDateRangeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDateRangeException';
  }
}
