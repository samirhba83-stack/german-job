export class MissingCampaignReasonException extends Error {
  constructor(action: string) {
    super(`A reason is required to ${action} a campaign`);
    this.name = 'MissingCampaignReasonException';
  }
}
