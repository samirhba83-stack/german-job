export class InvalidJobIdException extends Error {
  constructor(value: string) {
    super(`Invalid job id: ${value}`);
    this.name = 'InvalidJobIdException';
  }
}
