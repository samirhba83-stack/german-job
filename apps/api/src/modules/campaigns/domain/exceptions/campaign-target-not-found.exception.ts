export class CampaignTargetNotFoundException extends Error {
  constructor(targetId: string) {
    super(`Campaign target not found: ${targetId}`);
    this.name = 'CampaignTargetNotFoundException';
  }
}
