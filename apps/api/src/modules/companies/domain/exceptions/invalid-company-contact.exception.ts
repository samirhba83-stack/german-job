export class InvalidCompanyContactException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCompanyContactException';
  }
}
