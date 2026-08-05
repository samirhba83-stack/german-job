export class CampaignBatchNotFoundException extends Error {
  constructor(batchId: string) {
    super(`Campaign batch not found: ${batchId}`);
    this.name = 'CampaignBatchNotFoundException';
  }
}
