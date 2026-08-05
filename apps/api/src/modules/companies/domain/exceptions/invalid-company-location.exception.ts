export class InvalidCompanyLocationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCompanyLocationException';
  }
}
