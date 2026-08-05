export class InvalidRateLimitProfileException extends Error {
  constructor(reason: string) {
    super(`Invalid rate limit profile: ${reason}`);
    this.name = 'InvalidRateLimitProfileException';
  }
}
