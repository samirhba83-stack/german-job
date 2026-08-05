export class InvalidCompanyIdException extends Error {
  constructor(value: string) {
    super(`Invalid company id: ${value}`);
    this.name = 'InvalidCompanyIdException';
  }
}
