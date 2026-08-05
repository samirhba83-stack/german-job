export class InvalidCooldownPeriodException extends Error {
  constructor(reason: string) {
    super(`Invalid cooldown period: ${reason}`);
    this.name = 'InvalidCooldownPeriodException';
  }
}
