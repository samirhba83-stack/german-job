export class RateLimitExceededException extends Error {
  constructor(reason: string) {
    super(`Rate limit exceeded: ${reason}`);
    this.name = 'RateLimitExceededException';
  }
}
