export class InvalidCampaignGoalException extends Error {
  constructor(reason: string) {
    super(`Invalid campaign goal: ${reason}`);
    this.name = 'InvalidCampaignGoalException';
  }
}
