export class ConcurrentModificationException extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} was modified concurrently — reload and retry`);
    this.name = 'ConcurrentModificationException';
  }
}
