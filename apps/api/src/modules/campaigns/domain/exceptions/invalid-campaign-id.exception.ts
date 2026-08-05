export class InvalidCampaignIdException extends Error {
  constructor(value: string) {
    super(`Invalid campaign id: ${value}`);
    this.name = 'InvalidCampaignIdException';
  }
}
