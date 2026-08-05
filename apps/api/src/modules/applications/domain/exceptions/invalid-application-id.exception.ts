export class InvalidApplicationIdException extends Error {
  constructor(value: string) {
    super(`Invalid application id: ${value}`);
    this.name = 'InvalidApplicationIdException';
  }
}
