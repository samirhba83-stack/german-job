export class InvalidCurrencyException extends Error {
  constructor(value: string) {
    super(`Unsupported currency: ${value}`);
    this.name = 'InvalidCurrencyException';
  }
}
