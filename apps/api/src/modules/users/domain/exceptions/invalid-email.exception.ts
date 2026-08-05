export class InvalidEmailException extends Error {
  constructor(value: string) {
    super(`Invalid email address: ${value}`);
    this.name = 'InvalidEmailException';
  }
}
