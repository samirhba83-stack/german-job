export class DuplicateCampaignTargetException extends Error {
  constructor(jobId: string) {
    super(`A target for job ${jobId} already exists in this campaign or its company memory`);
    this.name = 'DuplicateCampaignTargetException';
  }
}
