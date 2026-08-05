export class UnauthorizedCampaignActionException extends Error {
  constructor(explanation: string) {
    super(explanation);
    this.name = 'UnauthorizedCampaignActionException';
  }
}
