export class InvalidCompanyWebsiteException extends Error {
  constructor(value: string) {
    super(`Invalid company website URL: ${value}`);
    this.name = 'InvalidCompanyWebsiteException';
  }
}
