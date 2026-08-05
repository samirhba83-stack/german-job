export class CampaignNotFoundException extends Error {
  constructor(id: string) {
    super(`Campaign not found: ${id}`);
    this.name = 'CampaignNotFoundException';
  }
}
