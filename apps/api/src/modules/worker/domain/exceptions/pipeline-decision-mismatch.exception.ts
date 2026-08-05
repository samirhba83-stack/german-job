export class PipelineDecisionMismatchException extends Error {
  constructor(pipelineCampaignId: string, decisionCampaignId: string) {
    super(`Decision targets campaign "${decisionCampaignId}" but the provided pipeline is for campaign "${pipelineCampaignId}".`);
    this.name = 'PipelineDecisionMismatchException';
  }
}
