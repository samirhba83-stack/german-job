export class InvalidCampaignNameException extends Error {
  constructor(reason: string) {
    super(`Invalid campaign name: ${reason}`);
    this.name = 'InvalidCampaignNameException';
  }
}
